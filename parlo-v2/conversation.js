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
let recognitionTimeout = null;
let recognition = null;
let recognitionSupported = false;
let state = 'idle'; // 'idle' | 'listening' | 'processing'

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

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
    $('sendBtn').addEventListener('click', onSendClick);
    $('helpBtn').addEventListener('click', onHelpClick);
    $('inputTextarea').addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSendClick();
        }
    });
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
        $('inputTextarea').value = transcript;
    };

    recognition.onend = () => {
        clearRecognitionTimeout();
        if (state !== 'listening') return;
        setState('idle');
        const text = $('inputTextarea').value.trim();
        setMicStatus(text ? 'Tap Send or edit above' : 'Nothing heard — tap to try again');
    };

    recognition.onerror = e => {
        clearRecognitionTimeout();
        if (state !== 'listening') return;
        setState('idle');
        if (e.error !== 'aborted') setMicStatus('Error: ' + e.error + ' — tap to try again');
    };
}

function startRecognitionTimeout() {
    clearRecognitionTimeout();
    recognitionTimeout = setTimeout(() => {
        if (state !== 'listening') return;
        try { recognition.stop(); } catch (e) {}
        setState('idle');
        setMicStatus('Timed out — tap to try again');
    }, 10000);
}

function clearRecognitionTimeout() {
    if (recognitionTimeout) { clearTimeout(recognitionTimeout); recognitionTimeout = null; }
}

function onMicClick() {
    if (state === 'listening') {
        clearRecognitionTimeout();
        recognition.stop(); // triggers onend
    } else if (state === 'idle') {
        $('inputTextarea').value = '';
        setState('listening');
        // Yield to the event loop before starting — prevents Safari from blocking the UI thread
        setTimeout(() => {
            try {
                recognition.start();
                startRecognitionTimeout();
            } catch (e) {
                clearRecognitionTimeout();
                setState('idle');
                setMicStatus('Could not start mic — try again');
                console.error('Recognition start error:', e);
            }
        }, 0);
    }
}

function onSendClick() {
    const text = $('inputTextarea').value.trim();
    if (!text || state !== 'idle') return;
    $('inputTextarea').value = '';
    setState('processing');
    submitTurn(text);
}

function onHelpClick() {
    const textarea = $('inputTextarea');
    const question = textarea.value.trim();
    if (!question || state !== 'idle') {
        textarea.placeholder = 'Type your question in English, then tap Ask for help…';
        setMicStatus('Type your question above first');
        textarea.focus();
        return;
    }
    textarea.value = '';
    textarea.placeholder = 'Scrivi in italiano…';
    submitHelp(question);
}

function setState(newState) {
    state = newState;
    const micBtn = $('micBtn');
    const sendBtn = $('sendBtn');
    const helpBtn = $('helpBtn');
    const textarea = $('inputTextarea');

    if (newState === 'idle') {
        micBtn.disabled = !recognitionSupported;
        micBtn.classList.remove('mic-btn--active', 'mic-btn--processing');
        setMicIcon('mic');
        sendBtn.disabled = false;
        helpBtn.disabled = false;
        textarea.disabled = false;
        setMicStatus(recognitionSupported ? 'Tap mic to speak, or type above' : 'Type your response above');
    } else if (newState === 'listening') {
        micBtn.disabled = false;
        micBtn.classList.add('mic-btn--active');
        micBtn.classList.remove('mic-btn--processing');
        setMicIcon('stop');
        sendBtn.disabled = true;
        helpBtn.disabled = true;
        textarea.disabled = false;
        setMicStatus('Listening… tap to stop');
    } else { // processing
        micBtn.disabled = true;
        micBtn.classList.remove('mic-btn--active');
        micBtn.classList.add('mic-btn--processing');
        setMicIcon('mic');
        sendBtn.disabled = true;
        helpBtn.disabled = true;
        textarea.disabled = true;
        setMicStatus('…');
    }
}

const MIC_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
</svg>`;

const STOP_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2"/>
</svg>`;

function setMicIcon(type) {
    $('micBtn').innerHTML = type === 'stop' ? STOP_ICON : MIC_ICON;
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

            const footer = document.createElement('div');
            footer.className = 'scenario-card__footer';

            const levelBadge = document.createElement('span');
            levelBadge.className = 'scenario-card__level scenario-level--' + s.level.toLowerCase();
            levelBadge.textContent = s.level;

            const role = document.createElement('span');
            role.className = 'scenario-card__role';
            role.textContent = 'You: ' + s.user_role;

            footer.appendChild(levelBadge);
            footer.appendChild(role);

            card.appendChild(title);
            card.appendChild(desc);
            card.appendChild(footer);
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
    $('inputTextarea').value = '';

    $('convTitle').textContent = scenario.title;
    $('convContext').textContent = scenario.context;
    $('chatWindow').innerHTML = '';

    conversationHistory.push({ role: 'system', content: buildSystemPrompt(scenario) });

    appendAIMessage(scenario.opening);
    conversationHistory.push({ role: 'assistant', content: scenario.opening });

    showView('conversationView');

    if (isSafari && recognitionSupported) {
        setMicStatus('Voice input is experimental in Safari — typing is more reliable');
    }

    startUserTurn();
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
    $('inputTextarea').value = '';
    startTimer();
    setState('idle');
}

// ── Turn handling ─────────────────────────────────────────────────────

async function submitTurn(text) {
    stopTimer();
    turnCount++;
    updateTurnCounter();

    const userEl = appendUserMessage(text);
    const thinkingEl = appendThinking();
    conversationHistory.push({ role: 'user', content: text });

    try {
        const { reply, feedback, corrected } = await callGroqConversation();
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

async function submitHelp(question) {
    setState('processing');
    const helpEl = appendHelpBubble(question, null);

    try {
        const res = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getApiKey()
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `You are helping an Italian language learner who is mid-conversation practice. The scenario is: "${currentScenario.context}". The character they're speaking with is: ${currentScenario.ai_role}. Answer their question in plain English, briefly (1-3 sentences). If it's a grammar or vocabulary question, give a clear example. End with a short nudge to keep going.`
                    },
                    { role: 'user', content: question }
                ],
                temperature: 0.7,
                max_tokens: 200
            })
        });

        if (!res.ok) throw new Error('API error ' + res.status);
        const data = await res.json();
        const answer = data.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not answer that.';
        updateHelpBubble(helpEl, answer);
    } catch (e) {
        updateHelpBubble(helpEl, 'Could not get help — check your connection.');
    }

    setState('idle');
    setMicStatus('Ready — continue the conversation in Italian above');
    $('inputTextarea').focus();
}

async function callGroqConversation() {
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

function appendHelpBubble(question, answer) {
    const el = document.createElement('div');
    el.className = 'chat-help';

    const label = document.createElement('div');
    label.className = 'chat-help__label';
    label.textContent = 'Help';

    const q = document.createElement('div');
    q.className = 'chat-help__q';
    q.textContent = '\u201c' + question + '\u201d';

    const a = document.createElement('div');
    a.className = 'chat-help__a';
    a.textContent = answer || '\u2026';
    a.dataset.helpAnswer = 'true';

    el.appendChild(label);
    el.appendChild(q);
    el.appendChild(a);
    $('chatWindow').appendChild(el);
    scrollChat();
    return el;
}

function updateHelpBubble(el, answer) {
    const a = el.querySelector('[data-help-answer]');
    if (a) a.textContent = answer;
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
        state = 'idle';
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

// ── Views ─────────────────────────────────────────────────────────────

function showView(id) {
    ['scenarioView', 'conversationView', 'endView'].forEach(v => {
        $(v).classList.toggle('hidden', v !== id);
    });
}

init();
