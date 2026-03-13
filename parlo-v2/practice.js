// ============================================================
// Parlo v2 — Practice (AI sentence builder)
// ============================================================

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-8b-8192';
const API_KEY_STORAGE = 'parlo_v2_groq_key';
const STATS_STORAGE = 'parlo_v2_stats';
const PREFS_STORAGE = 'parlo_v2_practice_prefs';

// ---- Local prompts (fallback when AI is off) ----
const PROMPTS = {
    A0: {
        present:    ['Describe what you are doing right now', 'Say where you live', 'Tell me what you like to eat', 'Describe your family', 'Say what you want to drink', 'Tell me what you see around you', 'Describe the weather today', 'Say how you feel right now', 'Tell me your name and age', 'Describe your favorite color'],
        imperfetto: ['Describe what you used to do as a child', 'Tell me about your old house', 'Say what your routine was last year', 'Describe a toy you used to play with', 'Tell me what you used to eat for breakfast'],
        passato:    ['Tell me what you did this morning', 'Describe what you ate yesterday', 'Say where you went last weekend', 'Tell me something you bought recently', 'Describe your morning routine today'],
        mixed:      ['Talk about your day — morning, now, and tonight', 'Describe yourself: who you are and what you like', 'Tell me about your home', 'Talk about a typical day', 'Describe your best friend']
    },
    A1: {
        present:    ['Describe your daily morning routine', 'Explain what your friend does for work', 'Tell me about your hobbies', 'Describe the weather and seasons in your area', 'Explain how you spend your weekends', 'Describe your typical workday', 'Tell me about your favorite restaurant', 'Explain what you do to relax', 'Describe your neighborhood', 'Talk about your favorite sport'],
        imperfetto: ['Describe your childhood home', 'Tell me what school was like when you were young', 'Describe a hobby you had as a kid', 'Talk about what summers used to be like', 'Describe your favorite childhood memory'],
        passato:    ['Describe your last vacation', 'Talk about a movie you watched recently', 'Tell me about your last birthday', 'Describe a meal you enjoyed this week', 'Talk about something interesting that happened to you'],
        mixed:      ['Describe your life now vs when you were a child', 'Talk about a goal you had and whether you reached it', 'Describe your relationship with a hobby over time', 'Tell me about a friend — how you met and what you do together', 'Talk about your city — what it was like and what it is now']
    },
    A2: {
        present:    ['Describe your daily commute', 'Explain your job or studies', 'Talk about your health and fitness habits', 'Describe a typical Italian meal you know', 'Talk about your relationship with technology', 'Describe your home and how you\'d improve it', 'Talk about shopping habits', 'Describe your social life', 'Talk about your favorite season and why', 'Describe how you stay in touch with family'],
        imperfetto: ['Describe what life was like before smartphones', 'Talk about how your city or town has changed', 'Describe a past relationship or friendship', 'Talk about traditions in your family growing up', 'Describe what school was like for you'],
        passato:    ['Describe a trip you took recently', 'Talk about a challenge you faced and overcame', 'Describe your most recent job interview or meeting', 'Talk about a celebration you attended', 'Describe learning something new recently'],
        mixed:      ['Talk about your career path — past, present, future plans', 'Describe how a hobby has changed your life', 'Talk about moving — either you moved or want to', 'Describe a friendship from beginning to now', 'Talk about your relationship with Italian culture']
    },
    B1: {
        present:    ['Discuss the pros and cons of remote work', 'Explain how social media affects relationships', 'Describe the ideal work-life balance', 'Talk about environmental issues in your country', 'Discuss how technology is changing education', 'Explain what makes a good leader', 'Talk about the importance of travel', 'Describe your philosophy on health and wellness', 'Discuss what success means to you', 'Talk about cultural differences you\'ve noticed'],
        imperfetto: ['Describe how your priorities have changed over time', 'Talk about a period in history you find fascinating', 'Describe what life was like before a major change in your life', 'Talk about an era you wish you\'d lived through', 'Describe how attitudes toward work have changed'],
        passato:    ['Describe a significant decision you made and why', 'Talk about a time you had to adapt to something unexpected', 'Describe a moment that changed your perspective', 'Talk about a project you completed successfully', 'Describe a difficult conversation you had'],
        mixed:      ['Discuss how your values have evolved over time', 'Talk about a goal you\'re working toward and your progress', 'Describe the role of family in your life — past and present', 'Talk about your city and how you\'d like to see it change', 'Discuss a social issue you care about']
    },
    B2: {
        present:    ['Discuss the ethical implications of AI in everyday life', 'Analyze the impact of globalization on local cultures', 'Debate the merits of different approaches to education', 'Discuss how economic inequality affects social mobility', 'Analyze the role of media in shaping public opinion', 'Talk about the intersection of technology and privacy', 'Discuss the future of work in an automated world', 'Analyze environmental policy approaches', 'Discuss the impact of immigration on national identity', 'Talk about the relationship between art and politics'],
        imperfetto: ['Describe how society\'s attitude toward mental health has changed', 'Talk about how political movements shaped the 20th century', 'Describe the cultural shifts that technology has brought about', 'Discuss how urbanization changed family structures', 'Describe a historical period of social change'],
        passato:    ['Analyze a recent political or social event', 'Describe a turning point in your professional development', 'Talk about a time you had to navigate cultural differences', 'Describe a complex negotiation or debate you were part of', 'Talk about how you resolved a significant professional challenge'],
        mixed:      ['Discuss your personal and professional development over the last decade', 'Analyze a social trend you\'ve witnessed over time', 'Talk about a field or industry that has transformed significantly', 'Describe your vision for the future and what led you there', 'Discuss the challenges of living between two cultures']
    }
};

const TIPS = {
    present:    'In the present tense, regular -are verbs end in -o, -i, -a, -iamo, -ate, -ano.',
    imperfetto: 'The imperfetto is used for habitual past actions and ongoing states. -are verbs: -avo, -avi, -ava, -avamo, -avate, -avano.',
    passato:    'Passato prossimo uses avere or essere + past participle. Motion/state verbs usually take essere.',
    mixed:      'Think about which tense fits each part of your sentence — present for now, passato for completed actions, imperfetto for habits or ongoing states.'
};

// ---- State ----
let currentPrompt = '';
let currentLevel = 'A0';
let currentTense = 'present';
let aiEnabled = false;
let stats = { completed: 0, streak: 0, words: 0 };

// ---- DOM refs ----
const promptText      = document.getElementById('promptText');
const tenseLabel      = document.getElementById('tenseLabel');
const levelLabel      = document.getElementById('levelLabel');
const answerInput     = document.getElementById('answerInput');
const doneBtn         = document.getElementById('doneBtn');
const doneBtnText     = document.getElementById('doneBtnText');
const skipBtn         = document.getElementById('skipBtn');
const newPromptBtn    = document.getElementById('newPromptBtn');
const levelSelect     = document.getElementById('levelSelect');
const tenseSelect     = document.getElementById('tenseSelect');
const aiToggle        = document.getElementById('aiToggle');
const aiStatus        = document.getElementById('aiStatus');
const apiKeyBtn       = document.getElementById('apiKeyBtn');
const exampleBtn      = document.getElementById('exampleBtn');
const hintBox         = document.getElementById('hintBox');
const hintText        = document.getElementById('hintText');
const tipText         = document.getElementById('tipText');
const feedbackBox     = document.getElementById('feedbackBox');
const feedbackContent = document.getElementById('feedbackContent');
const closeFeedback   = document.getElementById('closeFeedback');
const challengeBtn    = document.getElementById('challengeBtn');
const tryAnotherBtn   = document.getElementById('tryAnotherBtn');
const challengeBox    = document.getElementById('challengeBox');
const challengeInput  = document.getElementById('challengeInput');
const sendChallengeBtn = document.getElementById('sendChallengeBtn');
const cancelChallengeBtn = document.getElementById('cancelChallengeBtn');
const vocabToggle     = document.getElementById('vocabToggle');
const vocabContent    = document.getElementById('vocabContent');
const vocabGrid       = document.getElementById('vocabGrid');
const apiModal        = document.getElementById('apiModal');
const modalOverlay    = document.getElementById('modalOverlay');
const apiKeyInput     = document.getElementById('apiKeyInput');
const saveApiKeyBtn   = document.getElementById('saveApiKeyBtn');
const cancelApiKeyBtn = document.getElementById('cancelApiKeyBtn');
const statCompleted   = document.getElementById('statCompleted');
const statStreak      = document.getElementById('statStreak');
const statWords       = document.getElementById('statWords');

// ---- API key helpers ----

function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
}

function saveApiKey(key) {
    localStorage.setItem(API_KEY_STORAGE, key);
}

function hasApiKey() {
    return !!getApiKey();
}

// ---- AI status UI ----

function updateAiStatus() {
    if (hasApiKey() && aiEnabled) {
        aiStatus.textContent = 'AI features active';
        aiStatus.className = 'ai-status ready';
        apiKeyBtn.style.display = 'inline-block';
    } else if (hasApiKey()) {
        aiStatus.textContent = 'API key saved — toggle on to enable';
        aiStatus.className = 'ai-status';
        apiKeyBtn.style.display = 'inline-block';
    } else {
        aiStatus.textContent = 'Setup your API key to enable AI features';
        aiStatus.className = 'ai-status';
        apiKeyBtn.style.display = 'none';
    }
}

// ---- Prompts ----

function getLocalPrompt() {
    const tense = currentTense === 'mixed' ? 'mixed' : currentTense;
    const pool = PROMPTS[currentLevel]?.[tense] || PROMPTS.A0.present;
    return pool[Math.floor(Math.random() * pool.length)];
}

async function getAiPrompt() {
    const key = getApiKey();
    if (!key) return null;
    try {
        const res = await fetch(GROQ_API, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [{
                    role: 'user',
                    content: `Generate a single, unique Italian language practice prompt for level ${currentLevel} using the ${currentTense} tense.
The prompt should ask the student to write 1-3 Italian sentences.
Return ONLY the prompt text in English, nothing else. No quotes, no explanation.
Make it specific and interesting — not generic.`
                }],
                max_tokens: 100,
                temperature: 0.9
            })
        });
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch {
        return null;
    }
}

async function loadPrompt(useAi = false) {
    promptText.textContent = 'Loading...';
    hintBox.style.display = 'none';
    feedbackBox.style.display = 'none';
    challengeBox.style.display = 'none';
    answerInput.value = '';

    tenseLabel.textContent = currentTense === 'passato' ? 'Passato Prossimo'
        : currentTense.charAt(0).toUpperCase() + currentTense.slice(1);
    levelLabel.textContent = currentLevel;
    tipText.textContent = TIPS[currentTense] || TIPS.present;

    if (useAi && aiEnabled && hasApiKey()) {
        const aiPrompt = await getAiPrompt();
        currentPrompt = aiPrompt || getLocalPrompt();
    } else {
        currentPrompt = getLocalPrompt();
    }

    promptText.textContent = currentPrompt;
}

// ---- Groq API call ----

async function callGroq(messages, maxTokens = 500) {
    const key = getApiKey();
    if (!key) throw new Error('No API key');
    const res = await fetch(GROQ_API, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: maxTokens, temperature: 0.7 })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'API request failed');
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

// ---- Feedback ----

function renderFeedback(text) {
    // Convert markdown-ish bold/italic to HTML
    const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .split('\n').filter(l => l.trim())
        .map(l => `<p>${l}</p>`).join('');
    feedbackContent.innerHTML = html;
    feedbackBox.style.display = 'block';
    feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function getAiFeedback(answer) {
    doneBtnText.innerHTML = '<span class="loading"></span>Checking...';
    doneBtn.disabled = true;
    try {
        const feedback = await callGroq([{
            role: 'system',
            content: `You are a friendly Italian language tutor. Give concise, encouraging feedback on the student's Italian sentence(s).
Structure your response as:
1. Whether the answer is correct/appropriate for the prompt
2. Any grammar or vocabulary corrections (if needed)
3. One tip for improvement or a "Bravo!" if it's great
Keep it under 150 words. Be warm and supportive.`
        }, {
            role: 'user',
            content: `Level: ${currentLevel}, Tense: ${currentTense}
Prompt: "${currentPrompt}"
Student's answer: "${answer}"`
        }]);
        renderFeedback(feedback);
    } catch (err) {
        renderFeedback(`Could not get AI feedback: ${err.message}. Check your API key and try again.`);
    } finally {
        doneBtnText.textContent = 'Done';
        doneBtn.disabled = false;
    }
}

// ---- Example generation ----

async function generateExample() {
    exampleBtn.disabled = true;
    exampleBtn.innerHTML = '<span class="loading"></span>Generating...';
    hintBox.style.display = 'none';
    try {
        const example = await callGroq([{
            role: 'user',
            content: `Write one example Italian sentence (with English translation in parentheses) that answers this prompt for a ${currentLevel} student using the ${currentTense} tense:
"${currentPrompt}"
Return only the Italian sentence followed by the English translation in parentheses. Nothing else.`
        }], 100);
        hintText.textContent = example;
        hintBox.style.display = 'flex';
    } catch (err) {
        hintText.textContent = `Could not generate example: ${err.message}`;
        hintBox.style.display = 'flex';
    } finally {
        exampleBtn.disabled = false;
        exampleBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>Generate Example (AI)`;
    }
}

// ---- Stats ----

function loadStats() {
    try {
        const saved = JSON.parse(localStorage.getItem(STATS_STORAGE));
        if (saved) stats = { ...stats, ...saved };
    } catch {}
    updateStatsUI();
}

function saveStats() {
    try { localStorage.setItem(STATS_STORAGE, JSON.stringify(stats)); } catch {}
}

function updateStatsUI() {
    statCompleted.textContent = stats.completed;
    statStreak.textContent = stats.streak;
    statWords.textContent = stats.words;
}

function recordCompletion(answer) {
    stats.completed++;
    stats.streak++;
    stats.words += answer.trim().split(/\s+/).length;
    saveStats();
    updateStatsUI();
}

// ---- Vocab ----

function buildVocab() {
    const vocabMap = {
        A0: [
            { it: 'io sono', en: 'I am' }, { it: 'tu sei', en: 'you are' },
            { it: 'lui/lei è', en: 'he/she is' }, { it: 'voglio', en: 'I want' },
            { it: 'mi piace', en: 'I like' }, { it: 'ho', en: 'I have' },
            { it: 'vado', en: 'I go' }, { it: 'mangio', en: 'I eat' }
        ],
        A1: [
            { it: 'di solito', en: 'usually' }, { it: 'ogni giorno', en: 'every day' },
            { it: 'lavoro', en: 'I work' }, { it: 'studio', en: 'I study' },
            { it: 'abito a', en: 'I live in' }, { it: 'mi sveglio', en: 'I wake up' },
            { it: 'faccio', en: 'I do/make' }, { it: 'vivo', en: 'I live' }
        ],
        A2: [
            { it: 'secondo me', en: 'in my opinion' }, { it: 'in realtà', en: 'actually' },
            { it: 'di tanto in tanto', en: 'from time to time' }, { it: 'comunque', en: 'anyway/however' },
            { it: 'preferisco', en: 'I prefer' }, { it: 'mi sembra', en: 'it seems to me' },
            { it: 'spesso', en: 'often' }, { it: 'raramente', en: 'rarely' }
        ],
        B1: [
            { it: 'nonostante', en: 'despite' }, { it: 'tuttavia', en: 'however' },
            { it: 'da un lato...dall\'altro', en: 'on one hand...on the other' },
            { it: 'mi rendo conto', en: 'I realize' }, { it: 'vale la pena', en: 'it\'s worth it' },
            { it: 'tenendo conto di', en: 'taking into account' }, { it: 'inoltre', en: 'furthermore' },
            { it: 'eppure', en: 'yet/still' }
        ],
        B2: [
            { it: 'a prescindere da', en: 'regardless of' }, { it: 'per quanto riguarda', en: 'as far as...is concerned' },
            { it: 'in definitiva', en: 'ultimately' }, { it: 'malgrado', en: 'despite' },
            { it: 'bisognerebbe', en: 'one should' }, { it: 'si potrebbe affermare', en: 'one could argue' },
            { it: 'è fondamentale che', en: 'it is essential that' }, { it: 'nel complesso', en: 'on the whole' }
        ]
    };
    const items = vocabMap[currentLevel] || vocabMap.A0;
    vocabGrid.innerHTML = items.map(v => `
        <div class="vocab-item">
            <div class="vocab-italian">${v.it}</div>
            <div class="vocab-english">${v.en}</div>
        </div>
    `).join('');
}

// ---- Event handlers ----

newPromptBtn.addEventListener('click', () => loadPrompt(true));

levelSelect.addEventListener('change', () => {
    currentLevel = levelSelect.value;
    savePrefs();
    buildVocab();
    loadPrompt(false);
});

tenseSelect.addEventListener('change', () => {
    currentTense = tenseSelect.value;
    savePrefs();
    loadPrompt(false);
});

aiToggle.addEventListener('change', () => {
    aiEnabled = aiToggle.checked;
    if (aiEnabled && !hasApiKey()) {
        openModal();
        aiToggle.checked = false;
        aiEnabled = false;
    }
    updateAiStatus();
    savePrefs();
});

apiKeyBtn.addEventListener('click', openModal);

doneBtn.addEventListener('click', () => {
    const answer = answerInput.value.trim();
    if (!answer) { answerInput.focus(); return; }
    recordCompletion(answer);
    if (aiEnabled && hasApiKey()) {
        getAiFeedback(answer);
    } else {
        feedbackContent.innerHTML = '<p>Turn on AI Feedback for detailed corrections and suggestions.</p>';
        feedbackBox.style.display = 'block';
    }
});

skipBtn.addEventListener('click', () => {
    stats.streak = 0;
    saveStats();
    updateStatsUI();
    loadPrompt(true);
});

closeFeedback.addEventListener('click', () => { feedbackBox.style.display = 'none'; });

challengeBtn.addEventListener('click', () => {
    challengeBox.style.display = 'block';
    challengeInput.focus();
    challengeBtn.style.display = 'none';
});

cancelChallengeBtn.addEventListener('click', () => {
    challengeBox.style.display = 'none';
    challengeBtn.style.display = 'flex';
});

sendChallengeBtn.addEventListener('click', async () => {
    const challenge = challengeInput.value.trim();
    if (!challenge) { challengeInput.focus(); return; }
    challengeBox.style.display = 'none';
    doneBtnText.innerHTML = '<span class="loading"></span>Thinking...';
    doneBtn.disabled = true;
    try {
        const reply = await callGroq([{
            role: 'system',
            content: 'You are a fair and knowledgeable Italian language tutor. A student is challenging your feedback. Consider their argument carefully and respond honestly — agree if they have a point, or explain clearly if they are mistaken. Be concise and respectful.'
        }, {
            role: 'user',
            content: `Original prompt: "${currentPrompt}"
Student's answer: "${answerInput.value}"
Previous feedback: "${feedbackContent.textContent}"
Student's challenge: "${challenge}"`
        }]);
        feedbackContent.innerHTML += `<hr style="border-color:rgba(255,255,255,0.08);margin:1rem 0"><p><strong>Response to your challenge:</strong></p>${reply.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('')}`;
        challengeInput.value = '';
        challengeBtn.style.display = 'none';
    } catch (err) {
        feedbackContent.innerHTML += `<p style="color:#ff9999">Could not process challenge: ${err.message}</p>`;
    } finally {
        doneBtnText.textContent = 'Done';
        doneBtn.disabled = false;
    }
});

tryAnotherBtn.addEventListener('click', () => loadPrompt(true));

exampleBtn.addEventListener('click', () => {
    if (!aiEnabled || !hasApiKey()) {
        hintText.textContent = 'Enable AI features to generate examples.';
        hintBox.style.display = 'flex';
        return;
    }
    generateExample();
});

vocabToggle.addEventListener('click', () => {
    const isVisible = vocabContent.style.display !== 'none';
    vocabContent.style.display = isVisible ? 'none' : 'block';
    vocabToggle.textContent = isVisible ? '❓ Show Example Vocabulary' : '❓ Hide Example Vocabulary';
});

// ---- Modal ----

function openModal() {
    apiKeyInput.value = getApiKey();
    apiModal.style.display = 'flex';
    setTimeout(() => apiKeyInput.focus(), 100);
}

function closeModal() {
    apiModal.style.display = 'none';
}

saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        saveApiKey(key);
        updateAiStatus();
        apiKeyBtn.style.display = 'inline-block';
    }
    closeModal();
});

cancelApiKeyBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

apiKeyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveApiKeyBtn.click();
    if (e.key === 'Escape') closeModal();
});

// ---- Prefs ----

function savePrefs() {
    try {
        localStorage.setItem(PREFS_STORAGE, JSON.stringify({
            level: currentLevel,
            tense: currentTense,
            aiEnabled
        }));
    } catch {}
}

function loadPrefs() {
    try {
        const saved = JSON.parse(localStorage.getItem(PREFS_STORAGE));
        if (saved) {
            currentLevel = saved.level || 'A0';
            currentTense = saved.tense || 'present';
            aiEnabled = hasApiKey() ? (saved.aiEnabled || false) : false;
            levelSelect.value = currentLevel;
            tenseSelect.value = currentTense;
            aiToggle.checked = aiEnabled;
        }
    } catch {}
}

// ---- Init ----

function init() {
    loadPrefs();
    loadStats();
    updateAiStatus();
    buildVocab();
    loadPrompt(false);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
