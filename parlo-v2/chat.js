'use strict';

let chatScenarios = [];
let chatCurrentScenario = null;
let chatHistory = [];
let chatState = 'idle'; // 'idle' | 'listening' | 'processing'
let chatRecognition = null;
let chatRecognitionSupported = false;
let chatRecognitionTimeout = null;
let chatInited = false;

function initChat() {
    if (chatInited) return;
    chatInited = true;

    setupChatSpeech();

    fetch('scenarios.json')
        .then(r => r.json())
        .then(data => { chatScenarios = data; renderScenarioPicker(); })
        .catch(e => console.error('Failed to load scenarios', e));

    document.getElementById('chatEndBtn').addEventListener('click', chatEnd);
    document.getElementById('chatMicBtn').addEventListener('click', chatOnMic);
    document.getElementById('chatSendBtn').addEventListener('click', chatOnSend);
    document.getElementById('chatInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); chatOnSend(); }
    });
}

// ── Scenario picker ───────────────────────────────────────────────────────

function renderScenarioPicker() {
    const grid = document.getElementById('chatScenarioGrid');
    grid.innerHTML = '';

    ['A1', 'A2', 'B1', 'B2'].forEach(level => {
        const levelScenarios = chatScenarios.filter(s => s.level === level);
        if (!levelScenarios.length) return;

        const group = document.createElement('div');
        group.className = 'scenario-group';

        const label = document.createElement('div');
        label.className = 'scenario-group-label';
        label.textContent = level;
        group.appendChild(label);

        const row = document.createElement('div');
        row.className = 'scenario-row';

        levelScenarios.forEach(s => {
            const card = document.createElement('div');
            card.className = 'scenario-card';

            const title = document.createElement('div');
            title.className = 'scenario-card__title';
            title.textContent = s.title;

            const desc = document.createElement('div');
            desc.className = 'scenario-card__desc';
            desc.textContent = s.description;

            const footer = document.createElement('div');
            footer.className = 'scenario-card__footer';

            const badge = document.createElement('span');
            badge.className = `scenario-card__level scenario-level--${s.level.toLowerCase()}`;
            badge.textContent = s.level;

            const role = document.createElement('span');
            role.className = 'scenario-card__role';
            role.textContent = 'You: ' + s.user_role;

            footer.appendChild(badge);
            footer.appendChild(role);
            card.appendChild(title);
            card.appendChild(desc);
            card.appendChild(footer);
            card.addEventListener('click', () => chatStart(s));
            row.appendChild(card);
        });

        group.appendChild(row);
        grid.appendChild(group);
    });
}

// ── Conversation ──────────────────────────────────────────────────────────

function chatStart(scenario) {
    chatCurrentScenario = scenario;
    chatHistory = [];

    document.getElementById('chatTitle').textContent   = scenario.title;
    document.getElementById('chatContext').textContent = scenario.context;
    document.getElementById('chatWindow').innerHTML    = '';
    document.getElementById('chatCorrection').classList.add('hidden');

    document.getElementById('chatScenarioView').classList.add('hidden');
    document.getElementById('chatConvView').classList.remove('hidden');

    // Opening line comes from scenarios.json — push to history as assistant turn
    chatAppendAI(scenario.opening, null);
    chatHistory.push({ role: 'assistant', content: scenario.opening });
    parlo.speakItalian(scenario.opening);

    chatSetState('idle');
}

function chatEnd() {
    if (chatState === 'listening') {
        try { chatRecognition.stop(); } catch (e) {}
    }
    chatSetState('idle');
    chatHistory = [];
    chatCurrentScenario = null;
    document.getElementById('chatConvView').classList.add('hidden');
    document.getElementById('chatScenarioView').classList.remove('hidden');
}

// ── Turn submission ───────────────────────────────────────────────────────

function chatOnSend() {
    const text = document.getElementById('chatInput').value.trim();
    if (!text || chatState !== 'idle') return;
    document.getElementById('chatInput').value = '';
    chatSubmit(text);
}

async function chatSubmit(text) {
    chatSetState('processing');
    chatAppendUser(text);
    chatHistory.push({ role: 'user', content: text });

    const thinking = chatAppendThinking();

    try {
        const data = await parlo.callClaude('chat', chatHistory, {
            scenario: {
                context:   chatCurrentScenario.context,
                ai_role:   chatCurrentScenario.ai_role,
                user_role: chatCurrentScenario.user_role,
            },
        });

        thinking.remove();

        let italian = '', english = '', correction = null;
        try {
            const raw    = data.content?.[0]?.text || '{}';
            const parsed = JSON.parse(raw);
            italian    = parsed.italian    || '';
            english    = parsed.english    || '';
            correction = parsed.correction || null;
        } catch {
            italian = data.content?.[0]?.text || 'Sorry, something went wrong.';
        }

        chatHistory.push({ role: 'assistant', content: italian });
        chatAppendAI(italian, english);
        parlo.speakItalian(italian);

        const corrBox = document.getElementById('chatCorrection');
        if (correction) {
            corrBox.textContent = correction;
            corrBox.classList.remove('hidden');
        } else {
            corrBox.classList.add('hidden');
        }

    } catch (e) {
        thinking.remove();
        chatAppendError('Could not reach tutor — check your connection and try again.');
    }

    chatSetState('idle');
}

// ── DOM helpers ───────────────────────────────────────────────────────────

function chatAppendAI(italian, english) {
    const el     = document.createElement('div');
    el.className = 'chat-msg chat-msg--ai';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    const italianEl = document.createElement('div');
    italianEl.className = 'chat-italian';
    italianEl.textContent = italian;
    bubble.appendChild(italianEl);

    if (english) {
        const engEl = document.createElement('div');
        engEl.className = 'chat-translation';
        engEl.textContent = english;
        bubble.appendChild(engEl);
    }

    el.appendChild(bubble);
    document.getElementById('chatWindow').appendChild(el);
    chatScrollBottom();
    return el;
}

function chatAppendUser(text) {
    const el     = document.createElement('div');
    el.className = 'chat-msg chat-msg--user';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    el.appendChild(bubble);
    document.getElementById('chatWindow').appendChild(el);
    chatScrollBottom();
    return el;
}

function chatAppendThinking() {
    const el     = document.createElement('div');
    el.className = 'chat-msg chat-msg--ai';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble--thinking';
    bubble.textContent = '…';
    el.appendChild(bubble);
    document.getElementById('chatWindow').appendChild(el);
    chatScrollBottom();
    return el;
}

function chatAppendError(msg) {
    const el     = document.createElement('div');
    el.className = 'chat-error';
    el.textContent = msg;
    document.getElementById('chatWindow').appendChild(el);
    chatScrollBottom();
}

function chatScrollBottom() {
    const w = document.getElementById('chatWindow');
    w.scrollTop = w.scrollHeight;
}

// ── Speech recognition ────────────────────────────────────────────────────

function setupChatSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { chatRecognitionSupported = false; return; }

    chatRecognitionSupported = true;
    chatRecognition = new SR();
    chatRecognition.lang = 'it-IT';
    chatRecognition.continuous = false;
    chatRecognition.interimResults = true;

    chatRecognition.onresult = e => {
        let t = '';
        for (const r of e.results) t += r[0].transcript;
        document.getElementById('chatInput').value = t;
    };

    chatRecognition.onend = () => {
        clearChatRecognitionTimeout();
        if (chatState !== 'listening') return;
        chatSetState('idle');
        const text = document.getElementById('chatInput').value.trim();
        chatSetMicStatus(text ? 'Tap Send or edit above' : 'Nothing heard — tap to try again');
    };

    chatRecognition.onerror = e => {
        clearChatRecognitionTimeout();
        if (chatState !== 'listening') return;
        chatSetState('idle');
        if (e.error !== 'aborted') chatSetMicStatus('Mic error — tap to try again');
    };
}

function chatOnMic() {
    if (chatState === 'listening') {
        clearChatRecognitionTimeout();
        try { chatRecognition.stop(); } catch (e) {}
    } else if (chatState === 'idle') {
        document.getElementById('chatInput').value = '';
        chatSetState('listening');
        setTimeout(() => {
            try {
                chatRecognition.start();
                chatRecognitionTimeout = setTimeout(() => {
                    if (chatState !== 'listening') return;
                    try { chatRecognition.stop(); } catch (e) {}
                    chatSetState('idle');
                    chatSetMicStatus('Timed out — tap to try again');
                }, 10000);
            } catch (e) {
                chatSetState('idle');
                chatSetMicStatus('Could not start mic — try again');
            }
        }, 0);
    }
}

function clearChatRecognitionTimeout() {
    if (chatRecognitionTimeout) { clearTimeout(chatRecognitionTimeout); chatRecognitionTimeout = null; }
}

// ── UI state ──────────────────────────────────────────────────────────────

const CHAT_MIC_SVG  = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const CHAT_STOP_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;

function chatSetState(newState) {
    chatState = newState;
    const mic   = document.getElementById('chatMicBtn');
    const send  = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');

    if (newState === 'idle') {
        mic.disabled  = !chatRecognitionSupported;
        mic.innerHTML = CHAT_MIC_SVG;
        mic.classList.remove('mic-btn--active', 'mic-btn--processing');
        send.disabled  = false;
        input.disabled = false;
        chatSetMicStatus(chatRecognitionSupported ? 'Tap mic to speak, or type above' : 'Type your response above');
    } else if (newState === 'listening') {
        mic.disabled  = false;
        mic.innerHTML = CHAT_STOP_SVG;
        mic.classList.add('mic-btn--active');
        mic.classList.remove('mic-btn--processing');
        send.disabled  = true;
        input.disabled = false;
        chatSetMicStatus('Listening… tap to stop');
    } else {
        mic.disabled  = true;
        mic.innerHTML = CHAT_MIC_SVG;
        mic.classList.remove('mic-btn--active');
        mic.classList.add('mic-btn--processing');
        send.disabled  = true;
        input.disabled = true;
        chatSetMicStatus('Luca is thinking…');
    }
}

function chatSetMicStatus(text) {
    document.getElementById('chatMicStatus').textContent = text;
}
