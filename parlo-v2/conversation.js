'use strict';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const TIMER_SECONDS = 30;
const MAX_TURNS = 6;

let scenarios = [];
let currentScenario = null;
let conversationHistory = [];
let feedbackLog = [];
let turnCount = 0;
let timerInterval = null;
let recognition = null;
let recognitionSupported = false;
let state = 'idle'; // 'idle' | 'listening' | 'processing'
let currentTranscript = '';

const getApiKey = () => localStorage.getItem('parlo_v2_groq_key') || '';
const $ = id => document.getElementById(id);

// ── Init ──────────────────────────────────────────────────────────────

async function init() {
    setupSpeech();

    try {
        const res = await fetch('scenarios.json');
        scenarios = await res.json();
    } catch (e) {
        console.error('Failed to load scenarios:', e);
        return;
    }

    if (!getApiKey()) {
        $('noKeyBanner').classList.remove('hidden');
    }

    renderPicker();

    $('endBtn').addEventListener('click', endConversation);
    $('micBtn').addEventListener('click', onMicClick);
    $('newConvBtn').addEventListener('click', () => {
        showView('scenarioView');
        renderPicker();
    });
}

// ── Speech recognition ────────────────────────────────────────────────

function setupSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { recognitionSupported = false; return; }

    recognitionSupported = true;
    recognition = new SR();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = e => {
        let transcript = '';
        for (const result of e.results) transcript += result[0].transcript;
        currentTranscript = transcript;
        $('transcriptPreview').textContent = currentTranscript;
        setMicIcon(currentTranscript.trim() ? 'send' : 'mic');
    };

    recognition.onend = () => {
        if (state !== 'listening') return;
        if (currentTranscript.trim()) {
            setState('processing');
            submitTurn(currentTranscript.trim());
        } else {
            setState('idle');
            setMicStatus('Nothing heard — tap to try again');
        }
    };

    recognition.onerror = e => {
        if (state !== 'listening') return;
        setState('idle');
        if (e.error !== 'aborted') setMicStatus('Error: ' + e.error + ' — tap to try again');
    };
}

function onMicClick() {
    if (state === 'idle') {
        currentTranscript = '';
        $('transcriptPreview').textContent = '';
        try {
            recognition.start();
            setState('listening');
        } catch (e) {
            console.error('Recognition start error:', e);
        }
    } else if (state === 'listening') {
        recognition.stop(); // triggers onend → submitTurn
    }
}

function setState(newState) {
    state = newState;
    const btn = $('micBtn');
    if (newState === 'idle') {
        btn.disabled = false;
        btn.classList.remove('mic-btn--active', 'mic-btn--processing');
        setMicIcon('mic');
        setMicStatus('Tap to speak');
    } else if (newState === 'listening') {
        btn.disabled = false;
        btn.classList.add('mic-btn--active');
        btn.classList.remove('mic-btn--processing');
        setMicIcon('mic');
        setMicStatus('Listening…');
    } else {
        btn.disabled = true;
        btn.classList.remove('mic-btn--active');
        btn.classList.add('mic-btn--processing');
        setMicIcon('mic');
        setMicStatus('…');
    }
}

const MIC_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
</svg>`;

const SEND_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
</svg>`;

function setMicIcon(type) {
    $('micBtn').innerHTML = type === 'send' ? SEND_ICON : MIC_ICON;
}

function setMicStatus(text) { $('micStatus').textContent = text; }

// ── Scenario picker ───────────────────────────────────────────────────

function renderPicker() {
    const grid = $('scenarioGrid');
    grid.innerHTML = '';

    ['A1', 'A2', 'B1', 'B2'].forEach(level => {
        const levelScenarios = scenarios.filter(s => s.level === level);
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

            const role = document.createElement('div');
            role.className = 'scenario-card__role';
            role.textContent = 'You: ' + s.user_role;

            card.appendChild(title);
            card.appendChild(desc);
            card.appendChild(role);
            card.addEventListener('click', () => startConversation(s));
            row.appendChild(card);
        });

        group.appendChild(row);
        grid.appendChild(group);
    });
}

// ── Conversation ──────────────────────────────────────────────────────

function startConversation(scenario) {
    if (!getApiKey()) {
        $('noKeyBanner').classList.remove('hidden');
        $('noKeyBanner').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    currentScenario = scenario;
    conversationHistory = [];
    feedbackLog = [];
    turnCount = 0;
    currentTranscript = '';

    $('convTitle').textContent = scenario.title;
    $('convContext').textContent = scenario.context;
    $('chatWindow').innerHTML = '';

    conversationHistory.push({ role: 'system', content: buildSystemPrompt(scenario) });

    appendAIMessage(scenario.opening);
    conversationHistory.push({ role: 'assistant', content: scenario.opening });

    showView('conversationView');

    if (!recognitionSupported) {
        showFallback();
    } else {
        startUserTurn();
    }
}

function buildSystemPrompt(scenario) {
    return `You are playing the role of ${scenario.ai_role} in a conversation with ${scenario.user_role}.
Scenario: ${scenario.context}

Rules:
- Stay in character and respond in Italian. Keep replies to 1–3 natural sentences at ${scenario.level} level.
- After each user message, give brief feedback in English on their Italian (grammar, word choice, naturalness).
- If they made a significant error, provide the corrected Italian.

Respond with valid JSON only — no markdown, no extra text:
{"reply": "your Italian reply", "feedback": "brief English feedback", "corrected": "corrected Italian or null"}`;
}

function startUserTurn() {
    updateTurnCounter();
    $('transcriptPreview').textContent = '';
    currentTranscript = '';
    startTimer();
    setState('idle');
}

// ── Turn handling ─────────────────────────────────────────────────────

async function submitTurn(text) {
    stopTimer();
    $('transcriptPreview').textContent = '';
    turnCount++;
    updateTurnCounter();

    const userEl = appendUserMessage(text);
    const thinkingEl = appendThinking();
    conversationHistory.push({ role: 'user', content: text });

    try {
        const { reply, feedback, corrected } = await callGroq();
        thinkingEl.remove();
        addFeedback(userEl, feedback, corrected);
        feedbackLog.push({ text, feedback, corrected });
        appendAIMessage(reply);
        conversationHistory.push({ role: 'assistant', content: reply });

        if (turnCount >= MAX_TURNS) {
            endConversation();
        } else {
            startUserTurn();
        }
    } catch (e) {
        thinkingEl.remove();
        appendError('Could not reach AI — check your connection and try again.');
        setState('idle');
    }
}

async function callGroq() {
    const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getApiKey()
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: conversationHistory,
            temperature: 0.7,
            max_tokens: 400
        })
    });

    if (!res.ok) throw new Error('Groq API error ' + res.status);

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || '{}';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(content);

    return {
        reply: parsed.reply || '',
        feedback: parsed.feedback || '',
        corrected: (parsed.corrected && parsed.corrected !== 'null') ? parsed.corrected : null
    };
}

// ── DOM helpers ───────────────────────────────────────────────────────

function appendAIMessage(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg--ai';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    el.appendChild(bubble);
    $('chatWindow').appendChild(el);
    scrollChat();
    return el;
}

function appendUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg--user';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    el.appendChild(bubble);
    $('chatWindow').appendChild(el);
    scrollChat();
    return el;
}

function addFeedback(msgEl, feedback, corrected) {
    if (!feedback) return;
    const fb = document.createElement('div');
    fb.className = 'chat-feedback';
    fb.textContent = feedback;
    msgEl.appendChild(fb);
    if (corrected) {
        const corr = document.createElement('div');
        corr.className = 'chat-corrected';
        corr.textContent = '✓ ' + corrected;
        msgEl.appendChild(corr);
    }
    scrollChat();
}

function appendThinking() {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg--ai';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble--thinking';
    bubble.textContent = '…';
    el.appendChild(bubble);
    $('chatWindow').appendChild(el);
    scrollChat();
    return el;
}

function appendError(msg) {
    const el = document.createElement('div');
    el.className = 'chat-error';
    el.textContent = msg;
    $('chatWindow').appendChild(el);
    scrollChat();
}

function scrollChat() {
    const cw = $('chatWindow');
    cw.scrollTop = cw.scrollHeight;
}

function updateTurnCounter() {
    $('turnCounter').textContent = (turnCount + 1) + ' / ' + MAX_TURNS;
}

// ── Timer ─────────────────────────────────────────────────────────────

function startTimer() {
    stopTimer();
    let elapsed = 0;
    $('timerBar').style.width = '100%';
    timerInterval = setInterval(() => {
        elapsed++;
        $('timerBar').style.width = Math.max(0, 100 - (elapsed / TIMER_SECONDS) * 100) + '%';
        if (elapsed >= TIMER_SECONDS) stopTimer();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ── End ───────────────────────────────────────────────────────────────

function endConversation() {
    stopTimer();
    if (state === 'listening') {
        state = 'idle'; // prevent onend submitting
        try { recognition.stop(); } catch (e) {}
    }

    const summary = $('summaryContent');
    summary.innerHTML = '';

    if (!feedbackLog.length) {
        const p = document.createElement('p');
        p.textContent = 'No turns completed.';
        summary.appendChild(p);
    } else {
        const list = document.createElement('ul');
        list.className = 'summary-list';
        feedbackLog.forEach(entry => {
            const li = document.createElement('li');

            const said = document.createElement('div');
            said.className = 'summary-said';
            said.textContent = '\u201c' + entry.text + '\u201d';

            const fb = document.createElement('div');
            fb.className = 'summary-feedback';
            fb.textContent = entry.feedback;

            li.appendChild(said);
            li.appendChild(fb);

            if (entry.corrected) {
                const corr = document.createElement('div');
                corr.className = 'summary-corrected';
                corr.textContent = '✓ ' + entry.corrected;
                li.appendChild(corr);
            }

            list.appendChild(li);
        });
        summary.appendChild(list);
    }

    showView('endView');
}

// ── Fallback (no SpeechRecognition) ──────────────────────────────────

function showFallback() {
    const micArea = document.querySelector('.mic-area');

    const note = document.createElement('div');
    note.className = 'fallback-note';
    note.textContent = 'Speech recognition is not available in this browser. Type your Italian instead:';

    const textarea = document.createElement('textarea');
    textarea.className = 'fallback-textarea';
    textarea.rows = 3;
    textarea.placeholder = 'Scrivi in italiano…';

    const btn = document.createElement('button');
    btn.className = 'btn-action btn-action--primary';
    btn.textContent = 'Send';
    btn.addEventListener('click', () => {
        const text = textarea.value.trim();
        if (text) { textarea.value = ''; submitTurn(text); }
    });

    micArea.innerHTML = '';
    micArea.appendChild(note);
    micArea.appendChild(textarea);
    micArea.appendChild(btn);
    startTimer();
}

// ── Views ─────────────────────────────────────────────────────────────

function showView(id) {
    ['scenarioView', 'conversationView', 'endView'].forEach(v => {
        $(v).classList.toggle('hidden', v !== id);
    });
}

init();
