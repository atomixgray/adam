'use strict';

const CHAT_HISTORY_KEY = 'parlo_v2_chat_history';
const MAX_SAVED_CHATS  = 10;

let chatScenarios = [];
let chatCurrentScenario = null;
let chatHistory = [];
let chatState = 'idle'; // 'idle' | 'listening' | 'processing' | 'reviewing'
let chatRecognition = null;
let chatRecognitionSupported = false;
let chatRecognitionTimeout = null;
let chatInited = false;

const SCENARIO_EMOJI = {
    caffe: '☕', mercato: '🛒', direzioni: '🗺️', ristorante: '🍝',
    meeting: '👋', collega: '💼', medico: '🏥', hotel: '🏨',
    treno: '🚆', farmacia: '💊', banca: '🏦', sport: '⚽',
};

function initChat() {
    if (chatInited) return;
    chatInited = true;

    setupChatSpeech();

    fetch('scenarios.json')
        .then(r => r.json())
        .then(data => { chatScenarios = data; renderChips(); renderHistory(); })
        .catch(e => console.error('Failed to load scenarios', e));

    document.getElementById('chatEndBtn').addEventListener('click', chatEnd);
    document.getElementById('chatClearHistoryBtn').addEventListener('click', () => {
        localStorage.removeItem(CHAT_HISTORY_KEY);
        renderHistory();
    });
    document.getElementById('chatRestartBtn').addEventListener('click', chatRestart);
    document.getElementById('chatMicBtn').addEventListener('click', chatOnMic);
    document.getElementById('chatSendBtn').addEventListener('click', chatOnSend);
    document.getElementById('chatInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatOnSend(); }
    });
}

// ── Scenario chips ────────────────────────────────────────────────────────

const FREE_CHAT = {
    id: 'free',
    title: 'Free Chat',
    level: null,
    opening: 'Ciao! Di che cosa vuoi parlare oggi?',
    ai_role: 'Italian friend',
    user_role: 'friend',
    context: null,
};

function renderChips() {
    const container = document.getElementById('chatChips');
    container.innerHTML = '';

    // Free chat chip first
    const freeChip = document.createElement('button');
    freeChip.className = 'chat-chip chat-chip--free';
    freeChip.innerHTML = `<span class="chip-emoji">💬</span><span class="chip-title">Free Chat</span><span class="chip-level">any level</span>`;
    freeChip.addEventListener('click', () => chatStart(FREE_CHAT));
    container.appendChild(freeChip);

    chatScenarios.forEach(s => {
        const chip = document.createElement('button');
        chip.className = `chat-chip chat-chip--${s.level.toLowerCase()}`;
        const emoji = SCENARIO_EMOJI[s.id] || '💬';
        chip.innerHTML = `<span class="chip-emoji">${emoji}</span><span class="chip-title">${s.title}</span><span class="chip-level">${s.level}</span>`;
        chip.addEventListener('click', () => chatStart(s));
        container.appendChild(chip);
    });
}

// ── Conversation history ──────────────────────────────────────────────────

function loadSavedChats() {
    try { return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveChat(scenario, messages) {
    if (messages.filter(m => m.role === 'user').length === 0) return;
    const saved = loadSavedChats();
    saved.unshift({
        id: Date.now(),
        title: scenario.title || 'Free Chat',
        scenarioId: scenario.id,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        messages,
    });
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(saved.slice(0, MAX_SAVED_CHATS)));
}

function renderHistory() {
    const saved = loadSavedChats();
    const section = document.getElementById('chatHistorySection');
    const list    = document.getElementById('chatHistoryList');
    if (!saved.length) { section.classList.add('hidden'); return; }

    section.classList.remove('hidden');
    list.innerHTML = '';
    saved.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-history-item';
        const userTurns = chat.messages.filter(m => m.role === 'user').length;

        const main = document.createElement('button');
        main.className = 'chat-history-main';
        main.innerHTML = `<span class="history-title">${chat.title}</span><span class="history-meta">${chat.date} · ${userTurns} turn${userTurns !== 1 ? 's' : ''}</span>`;
        main.addEventListener('click', () => chatViewHistory(chat));

        const del = document.createElement('button');
        del.className = 'chat-history-delete';
        del.textContent = '×';
        del.title = 'Delete';
        del.addEventListener('click', () => {
            const chats = loadSavedChats().filter(c => c.id !== chat.id);
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chats));
            renderHistory();
        });

        item.appendChild(main);
        item.appendChild(del);
        list.appendChild(item);
    });
}

function chatViewHistory(saved) {
    chatCurrentScenario = chatScenarios.find(s => s.id === saved.scenarioId) || { ...FREE_CHAT, title: saved.title };
    chatHistory = [];

    document.getElementById('chatTitle').textContent = saved.title;
    document.getElementById('chatWindow').innerHTML  = '';
    document.getElementById('chatRestartBtn').classList.remove('hidden');
    document.getElementById('chatScenarioView').classList.add('hidden');
    document.getElementById('chatConvView').classList.remove('hidden');

    saved.messages.forEach(m => {
        if (m.role === 'assistant') chatAppendAI(m.content, null, null);
        else chatAppendUser(m.content);
    });

    chatSetState('reviewing');
}

// ── Conversation ──────────────────────────────────────────────────────────

function chatStart(scenario) {
    chatCurrentScenario = scenario;
    chatHistory = [];

    document.getElementById('chatTitle').textContent = scenario.title;
    document.getElementById('chatWindow').innerHTML  = '';

    document.getElementById('chatScenarioView').classList.add('hidden');
    document.getElementById('chatConvView').classList.remove('hidden');

    chatAppendAI(scenario.opening, null, null);
    chatHistory.push({ role: 'assistant', content: scenario.opening });
    parlo.speakItalian(scenario.opening);
    chatSetState('idle');
}

function chatEnd() {
    if (chatState === 'listening') {
        try { chatRecognition.stop(); } catch (e) {}
    }
    if (chatState !== 'reviewing') saveChat(chatCurrentScenario, chatHistory);
    chatSetState('idle');
    chatHistory = [];
    chatCurrentScenario = null;
    document.getElementById('chatRestartBtn').classList.add('hidden');
    document.getElementById('chatConvView').classList.add('hidden');
    document.getElementById('chatScenarioView').classList.remove('hidden');
    renderHistory();
}

function chatRestart() {
    const scenario = chatCurrentScenario;
    chatEnd();
    if (scenario) chatStart(scenario);
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
        const options = chatCurrentScenario.context ? {
            scenario: {
                context:   chatCurrentScenario.context,
                ai_role:   chatCurrentScenario.ai_role,
                user_role: chatCurrentScenario.user_role,
            },
        } : {};
        const data = await parlo.callClaude('chat', chatHistory, options);

        thinking.remove();

        let italian = '', english = '', correction = null;
        try {
            const raw     = data.content?.[0]?.text || '{}';
            const match   = raw.match(/\{[\s\S]*\}/);
            const cleaned = match ? match[0] : raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            const parsed  = JSON.parse(cleaned);
            italian    = parsed.italian    || '';
            english    = parsed.english    || '';
            correction = parsed.correction || null;
        } catch {
            italian = data.content?.[0]?.text || 'Scusa, qualcosa è andato storto.';
        }

        chatHistory.push({ role: 'assistant', content: italian });
        chatAppendAI(italian, english, correction);
        parlo.speakItalian(italian);

    } catch (e) {
        thinking.remove();
        chatAppendError('Could not connect — check your connection and try again.');
    }

    chatSetState('idle');
}

// ── DOM helpers ───────────────────────────────────────────────────────────

function chatAppendAI(italian, english, correction) {
    const el     = document.createElement('div');
    el.className = 'chat-msg chat-msg--ai';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    const italianRow = document.createElement('div');
    italianRow.className = 'chat-italian-row';

    const italianEl = document.createElement('div');
    italianEl.className = 'chat-italian';
    italianEl.textContent = italian;

    const replayBtn = document.createElement('button');
    replayBtn.className = 'chat-replay-btn';
    replayBtn.title = 'Replay';
    replayBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    replayBtn.addEventListener('click', () => parlo.speakItalian(italian));

    italianRow.appendChild(italianEl);
    italianRow.appendChild(replayBtn);
    bubble.appendChild(italianRow);

    if (english) {
        const revealBtn = document.createElement('button');
        revealBtn.className = 'chat-reveal-btn';
        revealBtn.textContent = 'show translation';

        const engEl = document.createElement('div');
        engEl.className = 'chat-translation';
        engEl.style.display = 'none';
        engEl.textContent = english;

        revealBtn.addEventListener('click', () => {
            const visible = engEl.style.display !== 'none';
            engEl.style.display = visible ? 'none' : 'block';
            revealBtn.textContent = visible ? 'show translation' : 'hide';
        });

        bubble.appendChild(revealBtn);
        bubble.appendChild(engEl);
    }

    el.appendChild(bubble);

    if (correction) {
        const corrEl = document.createElement('div');
        corrEl.className = 'chat-correction-note';
        corrEl.textContent = '💡 ' + correction;
        el.appendChild(corrEl);
    }

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
    bubble.innerHTML = '<span></span><span></span><span></span>';
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
        const text = document.getElementById('chatInput').value.trim();
        if (text) {
            chatSetState('idle');
            chatSetMicStatus('Tap to speak');
            document.getElementById('chatInput').focus();
        } else {
            chatSetState('idle');
            chatSetMicStatus('Nothing heard — tap to try again');
        }
    };

    chatRecognition.onerror = e => {
        clearChatRecognitionTimeout();
        if (chatState !== 'listening') return;
        chatSetState('idle');
        if (e.error !== 'aborted') chatSetMicStatus(`Mic error: ${e.error} — tap to try again`);
    };
}

function chatOnMic() {
    if (!chatRecognitionSupported) return;
    if (chatState === 'listening') {
        clearChatRecognitionTimeout();
        try { chatRecognition.stop(); } catch (e) {}
    } else if (chatState === 'idle') {
        document.getElementById('chatInput').value = '';
        try {
            chatRecognition.start();
            chatSetState('listening');
            chatRecognitionTimeout = setTimeout(() => {
                if (chatState !== 'listening') return;
                try { chatRecognition.stop(); } catch (e) {}
            }, 10000);
        } catch (e) {
            chatSetState('idle');
            chatSetMicStatus('Could not start mic — try again');
        }
    }
}

function clearChatRecognitionTimeout() {
    if (chatRecognitionTimeout) { clearTimeout(chatRecognitionTimeout); chatRecognitionTimeout = null; }
}

// ── UI state ──────────────────────────────────────────────────────────────

const CHAT_MIC_SVG  = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const CHAT_STOP_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;

function chatSetState(newState) {
    chatState = newState;
    const mic   = document.getElementById('chatMicBtn');
    const send  = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');

    if (newState === 'reviewing') {
        mic.disabled   = true;
        send.disabled  = true;
        input.disabled = true;
        mic.classList.remove('mic-btn-hero--active', 'mic-btn-hero--processing');
        chatSetMicStatus('Reviewing past conversation');
        return;
    }

    if (newState === 'idle') {
        mic.innerHTML = CHAT_MIC_SVG;
        mic.classList.remove('mic-btn-hero--active', 'mic-btn-hero--processing');
        mic.disabled   = !chatRecognitionSupported;
        send.disabled  = false;
        input.disabled = false;
        chatSetMicStatus(chatRecognitionSupported ? 'Tap to speak' : 'Type below');
    } else if (newState === 'listening') {
        mic.innerHTML = CHAT_STOP_SVG;
        mic.classList.add('mic-btn-hero--active');
        mic.classList.remove('mic-btn-hero--processing');
        mic.disabled   = false;
        send.disabled  = true;
        input.disabled = false;
        chatSetMicStatus('Listening…');
    } else {
        mic.innerHTML = CHAT_MIC_SVG;
        mic.classList.remove('mic-btn-hero--active');
        mic.classList.add('mic-btn-hero--processing');
        mic.disabled   = true;
        send.disabled  = true;
        input.disabled = true;
        chatSetMicStatus('…');
    }
}

function chatSetMicStatus(text) {
    document.getElementById('chatMicStatus').textContent = text;
}
