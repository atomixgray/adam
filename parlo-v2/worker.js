// Parlo v2 — Claude API proxy
// Deploy to Cloudflare Workers. Set two secrets in the dashboard:
//   CLAUDE_API_KEY   — your Anthropic API key
//   PARLO_PASSPHRASE — the passphrase the app sends in X-Parlo-Auth
//
// Bindings required:
//   RATE_LIMITER  — Rate Limiting binding (30 req/min)
//   PARLO_SECURITY — KV Namespace binding (lockout tracking)

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
  } else {
    console.warn(`[parlo-security] Failed auth attempt ${count}/${MAX_FAIL_ATTEMPTS} from IP ${ip}`);
  }

  try {
    await env.PARLO_SECURITY.put(`lock_${ip}`, JSON.stringify(data), { expirationTtl: ttl });
  } catch {}
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

The "italian" field is always in Italian. The "english" field is always the English translation — never leave it empty. If the user made a meaningful grammar or vocabulary mistake, set "correction" to one short friendly note in English (e.g. "use 'mi piace' not 'io piace'"). Set to null if their Italian was fine or the mistake was minor. Never lecture — just flag it once, casually.`,

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

    // Action whitelist
    if (!action || !SYSTEM_PROMPTS[action]) {
      return jsonError('action must be "chat", "translate", or "conjugate"');
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
