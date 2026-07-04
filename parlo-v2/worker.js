// Parlo v2 — Claude API proxy
// Deploy to Cloudflare Workers. Set two secrets in the dashboard:
//   CLAUDE_API_KEY   — your Anthropic API key
//   PARLO_PASSPHRASE — the passphrase the app sends in X-Parlo-Auth

const ALLOWED_ORIGINS = ['https://adamlarkin.com', 'http://localhost:8080', 'http://localhost:3000'];
const ALLOWED_REFERERS = ['adamlarkin.com', 'www.adamlarkin.com', 'localhost'];
const ALLOWED_COUNTRIES = ['US', 'CA', 'IT'];
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS_DEFAULT = 1024;
const MAX_TOKENS_CAP = 2048;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 1000;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://adamlarkin.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Parlo-Auth',
  };
}

const MAX_SCENARIO_CHARS = 400;

// System prompts locked server-side — clients send action + optional scenario context
const SYSTEM_PROMPTS = {
  chat: `You are Marco, a young Italian guy living in Milan. You're chatting with a foreign friend who is learning Italian. You speak naturally — not like a teacher. Keep replies short and conversational (1-3 sentences). Respond only in Italian.

Respond with valid JSON only — no markdown, no extra text:
{"italian": "your natural Italian reply", "english": "English translation of your reply", "correction": null}

If the user made a meaningful grammar or vocabulary mistake, set "correction" to one short friendly note in English (e.g. "use 'mi piace' not 'io piace'"). Set to null if their Italian was fine or the mistake was minor. Never lecture — just flag it once, casually.`,

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

    // Passphrase gate
    const auth = request.headers.get('X-Parlo-Auth') || '';
    if (!env.PARLO_PASSPHRASE || auth !== env.PARLO_PASSPHRASE) {
      return deny('Unauthorized', 401);
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return deny('Invalid JSON', 400);
    }

    // Action whitelist — only chat or translate, nothing else
    const action = body.action;
    if (!action || !SYSTEM_PROMPTS[action]) {
      return jsonError('action must be "chat" or "translate"');
    }

    // Validate messages array
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return jsonError('messages array required');
    }

    // Cap message history length
    if (body.messages.length > MAX_MESSAGES) {
      return jsonError(`too many messages (max ${MAX_MESSAGES})`);
    }

    // Validate each message — role and length
    for (const msg of body.messages) {
      if (!['user', 'assistant'].includes(msg.role)) {
        return jsonError('invalid message role — only user and assistant allowed');
      }
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (content.length > MAX_MESSAGE_CHARS) {
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
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...ch, 'Content-Type': 'application/json' },
      });
    }
  },
};
