// Parlo v2 — Claude API proxy
// Deploy to Cloudflare Workers. Set secrets in the dashboard:
//   CLAUDE_API_KEY   — your Anthropic API key
//   PARLO_PASSPHRASE — the passphrase the app sends in X-Parlo-Auth
//   RESEND_API_KEY   — Resend API key, used to email a lockout alert (optional — no-ops if unset)
//   ALERT_EMAIL      — where to send the lockout alert (optional — no-ops if unset)
//
// Bindings required:
//   RATE_LIMITER   — Rate Limiting binding (30 req/min)
//   PARLO_SECURITY — KV Namespace binding (lockout tracking)
//   PARLO_DATA     — KV Namespace binding (cross-device progress sync)

const ALLOWED_ORIGINS = ['https://adamlarkin.com', 'https://www.adamlarkin.com', 'http://localhost:8080', 'http://localhost:3000'];
const ALLOWED_REFERERS = ['adamlarkin.com', 'www.adamlarkin.com', 'localhost'];
const ALLOWED_COUNTRIES = ['US', 'CA', 'IT'];
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS_DEFAULT = 1024;
const MAX_TOKENS_CAP = 2048;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 1000;

const MAX_FAIL_ATTEMPTS = 5;
const LOCKOUT_MS = 2 * 60 * 1000;   // 2 min (testing) — raise to 60 * 60 * 1000 for prod
const FAIL_WINDOW_TTL = 300;         // 5 min window before attempt counter resets

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://adamlarkin.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Parlo-Auth',
  };
}

// ── KV lockout helpers ────────────────────────────────────────────────────────

async function getLockout(env, ip) {
  if (!env.PARLO_SECURITY) return null;
  try {
    const val = await env.PARLO_SECURITY.get(`lock_${ip}`);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function recordFailure(env, ip) {
  if (!env.PARLO_SECURITY) return;
  const existing = await getLockout(env, ip);
  // If previous lockout already expired, start the count fresh
  const prevExpired = existing?.lockedUntil && Date.now() >= existing.lockedUntil;
  const count = prevExpired ? 1 : (existing?.count || 0) + 1;
  const now = Date.now();
  const data = { count, lastAttempt: now, lockedUntil: null };
  let ttl = FAIL_WINDOW_TTL;

  if (count >= MAX_FAIL_ATTEMPTS) {
    data.lockedUntil = now + LOCKOUT_MS;
    ttl = Math.ceil(LOCKOUT_MS / 1000) + 60;
    console.warn(`[parlo-security] LOCKOUT — IP ${ip} after ${count} failed attempts`);
    await sendLockoutAlert(env, ip, count);
  } else {
    console.warn(`[parlo-security] Failed auth attempt ${count}/${MAX_FAIL_ATTEMPTS} from IP ${ip}`);
  }

  try {
    await env.PARLO_SECURITY.put(`lock_${ip}`, JSON.stringify(data), { expirationTtl: ttl });
  } catch {}
}

async function sendLockoutAlert(env, ip, count) {
  if (!env.RESEND_API_KEY || !env.ALERT_EMAIL) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Parlo Security <onboarding@resend.dev>',
        to: [env.ALERT_EMAIL],
        subject: 'Parlo: IP locked out after repeated failed logins',
        text: `An IP address was locked out of Parlo after ${count} failed passphrase attempts.\n\nIP: ${ip}\nTime: ${new Date().toISOString()}\nLockout duration: ${Math.round(LOCKOUT_MS / 60000)} minute(s)`,
      }),
    });
  } catch (e) {
    console.warn('[parlo-security] Failed to send lockout alert email:', e);
  }
}

async function clearFailures(env, ip) {
  if (!env.PARLO_SECURITY) return;
  try { await env.PARLO_SECURITY.delete(`lock_${ip}`); } catch {}
}

// ── System prompts ────────────────────────────────────────────────────────────

const MAX_SCENARIO_CHARS = 400;

const SYSTEM_PROMPTS = {
  chat: `You are Marco, a young Italian guy living in Milan. You're chatting with a foreign friend who is learning Italian. You speak naturally — not like a teacher. Keep replies short and conversational (1-3 sentences).

Always respond with valid JSON only — no markdown, no extra text. All three fields are always required:
{"italian": "your reply in Italian", "english": "English translation of your Italian reply", "correction": null}

The "italian" field is always in Italian. The "english" field is always the English translation — never leave it empty. If the user made a meaningful grammar or vocabulary mistake, set "correction" to one short friendly note in English. Be playful about it — tease them a little, maybe throw in a mild Italian expression of disbelief like "Madonna...", "Dai!", "Ma cosa stai dicendo?", or even the occasional light swear like "cazzo" or "porco cane" if the mistake is really bad. Keep it funny, never mean. Set to null if their Italian was fine or the mistake was minor.`,

  repeat: `You are Marco, a young Italian guy running a "Repeat & Translate" drill with a student.

Each turn you receive: the phrase you gave last time (null on the first round), the student's Italian repeat of it, and their English meaning.

Respond with JSON only — no markdown, no extra text:
{
  "feedback": "Brief casual reaction in Italian — warm and natural, 1-2 sentences (null on first round)",
  "feedback_en": "English translation of your feedback (null on first round)",
  "phrase": "A fresh Italian sentence for the next round, A1/A2 level, 6-12 words",
  "correction": "One short correction note in English if their Italian repeat had a meaningful error (null if fine or first round)"
}

Phrase rules: everyday topics, simple present or past tense, common vocabulary. No subjunctive. Short natural sentences a beginner would encounter.
Feedback style: casual like a friend. Celebrate when they get it right. When they get it wrong, tease them a bit — throw in a mild Italian expression like "Madonna...", "Dai!", "Ma che dici?", or a light swear like "cazzo" or "porco cane" if it's really off. Keep it funny and warm, never mean.`,

  conjugate: `You are an Italian language assistant. Given an Italian verb (in any form), return its conjugation in 4 key tenses. Each form must include the Italian conjugation AND its natural English translation.

Respond with valid JSON only — no markdown, no extra text:
{
  "verb": "parlare",
  "english": "to speak",
  "tenses": [
    {
      "name": "Presente",
      "english": "Present",
      "forms": {
        "io":      {"italian": "parlo",     "english": "I speak"},
        "tu":      {"italian": "parli",     "english": "you speak"},
        "lui/lei": {"italian": "parla",     "english": "he/she speaks"},
        "noi":     {"italian": "parliamo",  "english": "we speak"},
        "voi":     {"italian": "parlate",   "english": "you all speak"},
        "loro":    {"italian": "parlano",   "english": "they speak"}
      }
    },
    {
      "name": "Passato Prossimo",
      "english": "Past",
      "forms": {
        "io":      {"italian": "ho parlato",       "english": "I spoke"},
        "tu":      {"italian": "hai parlato",      "english": "you spoke"},
        "lui/lei": {"italian": "ha parlato",       "english": "he/she spoke"},
        "noi":     {"italian": "abbiamo parlato",  "english": "we spoke"},
        "voi":     {"italian": "avete parlato",    "english": "you all spoke"},
        "loro":    {"italian": "hanno parlato",    "english": "they spoke"}
      }
    },
    {
      "name": "Imperfetto",
      "english": "Imperfect",
      "forms": {
        "io":      {"italian": "parlavo",    "english": "I was speaking"},
        "tu":      {"italian": "parlavi",    "english": "you were speaking"},
        "lui/lei": {"italian": "parlava",    "english": "he/she was speaking"},
        "noi":     {"italian": "parlavamo",  "english": "we were speaking"},
        "voi":     {"italian": "parlavate",  "english": "you were speaking"},
        "loro":    {"italian": "parlavano",  "english": "they were speaking"}
      }
    },
    {
      "name": "Futuro Semplice",
      "english": "Future",
      "forms": {
        "io":      {"italian": "parlerò",    "english": "I will speak"},
        "tu":      {"italian": "parlerai",   "english": "you will speak"},
        "lui/lei": {"italian": "parlerà",    "english": "he/she will speak"},
        "noi":     {"italian": "parleremo",  "english": "we will speak"},
        "voi":     {"italian": "parlerete",  "english": "you will speak"},
        "loro":    {"italian": "parleranno", "english": "they will speak"}
      }
    }
  ]
}

Always convert a conjugated form to infinitive before responding. If the input is not an Italian verb, return: {"error": "Please enter a valid Italian verb"}`,

  narrate: `You are Marco, a young Italian guy, narrating short comprehensible-input content for a language learner. This is a monologue — you are NOT expecting a reply, just narrating naturally at the requested level, slightly above what a learner at that level would find effortless (i+1 style), to build listening/reading comprehension.

You will receive a topic and a CEFR level (A1, A2, B1, or B2). Write one self-contained "episode" of narration:
- A1: 3-4 short simple sentences, present tense, high-frequency vocabulary, concrete topics.
- A2: 4-5 sentences, simple past/present, everyday vocabulary, a little more detail.
- B1: 5-7 sentences, mixed tenses, some opinion/connectors, moderately varied vocabulary.
- B2: 6-9 sentences, natural pacing, idiomatic expressions, more complex sentence structures.

Break the narration into natural sentence-level or clause-level segments so it can be revealed and read piece by piece. Respond with valid JSON only — no markdown, no extra text:
{
  "title": "short title for this episode, in English",
  "segments": [
    { "italian": "first sentence or clause in Italian", "english": "its English translation" },
    { "italian": "next sentence or clause in Italian", "english": "its English translation" }
  ]
}

Stay in character as Marco talking naturally about the topic — a story, his day, local news, an opinion, a memory, etc. Never address the learner directly or ask a question; this is pure narration, not conversation. Keep each segment short enough to show as one reading bubble (roughly one sentence or clause, max ~20 words).

If the conversation history already contains a previous episode and the latest message asks you to continue, pick up naturally from exactly where you left off — do not repeat or re-summarize what was already said, and do not restart the scene. Just keep the same topic and level moving forward with new content.`,

  translate: `You are an Italian language assistant. The user will send a word, phrase, or sentence in either English or Italian.

Respond with a JSON object in this exact format:
{
  "translation": "the translation",
  "pronunciation": "pronunciation guide using simple phonetics",
  "breakdown": [
    { "word": "original word", "translation": "word translation", "grammar": "brief grammar note" }
  ],
  "examples": [
    { "italian": "example sentence in Italian", "english": "English translation" },
    { "italian": "another example sentence", "english": "English translation" }
  ]
}

No extra text outside the JSON. If the input is English, translate to Italian. If Italian, translate to English. Always include 2 natural example sentences showing the word or phrase in context.`
};

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const ch = corsHeaders(origin);

    function deny(message, status = 403) {
      return new Response(message, { status, headers: ch });
    }
    function jsonError(message, status = 400) {
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...ch, 'Content-Type': 'application/json' },
      });
    }
    function authError(message, locked = false) {
      return new Response(JSON.stringify({ error: message, locked }), {
        status: 401,
        headers: { ...ch, 'Content-Type': 'application/json' },
      });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: ch });
    }

    // POST only
    if (request.method !== 'POST') {
      return deny('Method not allowed', 405);
    }

    // Geo-fence (US, Canada, Italy)
    const country = request.cf?.country;
    if (country && !ALLOWED_COUNTRIES.includes(country)) {
      return deny('Access denied');
    }

    // Referer check — empty referer is OK (some browsers strip it), wrong referer is not
    const referer = request.headers.get('Referer') || '';
    if (referer && !ALLOWED_REFERERS.some(d => referer.includes(d))) {
      return deny('Access denied');
    }

    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Rate limit — requires RATE_LIMITER binding in Cloudflare dashboard
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: clientIP });
      if (!success) return deny('Too many requests', 429);
    }

    // Lockout check — before passphrase so a locked IP can't probe
    const lockData = await getLockout(env, clientIP);
    if (lockData?.lockedUntil && Date.now() < lockData.lockedUntil) {
      console.warn(`[parlo-security] Locked IP ${clientIP} attempted access`);
      return authError('Access temporarily locked. Please try again later.', true);
    }

    // Passphrase gate
    const auth = request.headers.get('X-Parlo-Auth') || '';
    const passphrase = (env.PARLO_PASSPHRASE || '').trim();
    if (!passphrase || auth !== passphrase) {
      await recordFailure(env, clientIP);
      return authError('Unauthorized', false);
    }

    // Successful auth — clear any failure record
    await clearFailures(env, clientIP);

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return deny('Invalid JSON', 400);
    }

    const action = body.action;

    // Ping — passphrase validation only, no Claude call
    if (action === 'ping') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...ch, 'Content-Type': 'application/json' },
      });
    }

    // ── Cross-device sync ─────────────────────────────────────────────────
    if (action === 'syncPull') {
      const data = env.PARLO_DATA
        ? await env.PARLO_DATA.get('user_data', 'json').catch(() => null)
        : null;
      return new Response(JSON.stringify({ data: data || null }), {
        status: 200,
        headers: { ...ch, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'syncPush') {
      const data = body.data;
      if (!data || typeof data !== 'object') return jsonError('data object required');
      const json = JSON.stringify(data);
      if (json.length > 500_000) return jsonError('data too large');
      if (env.PARLO_DATA) {
        try { await env.PARLO_DATA.put('user_data', json); } catch (e) {
          console.error('KV sync write failed:', e);
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...ch, 'Content-Type': 'application/json' },
      });
    }

    // Action whitelist
    if (!action || !SYSTEM_PROMPTS[action]) {
      return jsonError('action must be "chat", "translate", "conjugate", "repeat", "narrate", "syncPull", or "syncPush"');
    }

    // ── Repeat & Translate — no messages array needed ─────────────────────
    if (action === 'repeat') {
      const original    = typeof body.original    === 'string' ? body.original.slice(0, 200)    : null;
      const userItalian = typeof body.userItalian === 'string' ? body.userItalian.slice(0, 200) : null;
      const userEnglish = typeof body.userEnglish === 'string' ? body.userEnglish.slice(0, 200) : null;

      const userMsg = original
        ? `Phrase I gave: "${original}"\nTheir Italian repeat: "${userItalian || '(not provided)'}"\nTheir English meaning: "${userEnglish || '(not provided)'}"`
        : 'First round — give me the first phrase.';

      try {
        const claudeRes = await fetch(CLAUDE_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 512,
            system: SYSTEM_PROMPTS.repeat,
            messages: [{ role: 'user', content: userMsg }],
          }),
        });
        const data = await claudeRes.json();
        return new Response(JSON.stringify(data), {
          status: claudeRes.status,
          headers: { ...ch, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...ch, 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate messages array
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return jsonError('messages array required');
    }

    // Cap message history length
    if (body.messages.length > MAX_MESSAGES) {
      return jsonError(`too many messages (max ${MAX_MESSAGES})`);
    }

    // Validate each message — role, content type, and length
    for (const msg of body.messages) {
      if (!['user', 'assistant'].includes(msg.role)) {
        return jsonError('invalid message role — only user and assistant allowed');
      }
      if (typeof msg.content !== 'string') {
        return jsonError('message content must be a plain string');
      }
      if (msg.content.length > MAX_MESSAGE_CHARS) {
        return jsonError(`message too long (max ${MAX_MESSAGE_CHARS} characters)`);
      }
    }

    // Optional scenario context — appended to chat system prompt server-side
    let systemPrompt = SYSTEM_PROMPTS[action];
    if (action === 'chat' && body.scenario) {
      const s = body.scenario;
      if (typeof s.context === 'string' && typeof s.ai_role === 'string') {
        const ctx = s.context.slice(0, MAX_SCENARIO_CHARS);
        const role = s.ai_role.slice(0, 80);
        const userRole = typeof s.user_role === 'string' ? s.user_role.slice(0, 80) : 'student';
        systemPrompt += `\n\nActive scenario: ${ctx}\nYour role: ${role}\nUser's role: ${userRole}`;
      }
    }

    // Forward to Claude with server-side system prompt
    try {
      const claudeRes = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: Math.min(body.max_tokens || MAX_TOKENS_DEFAULT, MAX_TOKENS_CAP),
          system: systemPrompt,
          messages: body.messages,
        }),
      });

      const data = await claudeRes.json();
      return new Response(JSON.stringify(data), {
        status: claudeRes.status,
        headers: { ...ch, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...ch, 'Content-Type': 'application/json' },
      });
    }
  },
};
