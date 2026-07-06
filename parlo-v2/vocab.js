'use strict';

// ── SM-2 Spaced Repetition ────────────────────────────────────────────────
// Ported from flashcards.js — same algorithm, same localStorage keys

const SRS_KEY     = 'parlo_v2_srs';
const MODE_KEY    = 'parlo_v2_study_mode';
const CUSTOM_KEY  = 'parlo_v2_custom';
const NEW_PER_DAY = 20;

let phrases         = [];
let phrasesBaseLen  = 0; // length of phrases.json; custom cards come after
let cardData        = {};
let sessionQueue = [];
let sessionPos   = 0;
let studyMode    = 'italian-to-english';
let italianTextForSpeech = '';
let isFlipped    = false;
let sessionReviewed = 0;
let vocabInited  = false;

const vocabToday = () => new Date().toISOString().slice(0, 10);

// DOM refs — resolved after DOMContentLoaded (scripts are at end of body)
const flashcard       = document.getElementById('flashcard');
const frontLabel      = document.getElementById('frontLabel');
const frontText       = document.getElementById('frontText');
const frontPronun     = document.getElementById('frontPronunciation');
const frontHint       = document.getElementById('frontHint');
const backLabel       = document.getElementById('backLabel');
const backText        = document.getElementById('backText');
const backPronun      = document.getElementById('backPronunciation');
const speakerFront    = document.getElementById('speakerFront');
const speakerBack     = document.getElementById('speakerBack');
const forvoBtnFront   = document.getElementById('forvoBtnFront');
const forvoBtnBack    = document.getElementById('forvoBtnBack');
const modeButtons     = document.querySelectorAll('#tab-vocab .mode-btn');
const srsReveal       = document.getElementById('srsReveal');
const srsRating       = document.getElementById('srsRating');
const showAnswerBtn   = document.getElementById('showAnswerBtn');
const sessionComplete = document.getElementById('sessionComplete');
const sessionSummary  = document.getElementById('sessionSummary');
const sessionNext     = document.getElementById('sessionNext');
const continueBtn     = document.getElementById('continueBtn');
const resetBtn        = document.getElementById('resetBtn');
const statDue         = document.getElementById('statDue');
const statNew         = document.getElementById('statNew');
const statMastered    = document.getElementById('statMastered');
const cefrBadge       = document.getElementById('cefrBadge');
const tenseBadge      = document.getElementById('tenseBadge');
const typeInArea      = document.getElementById('typeInArea');
const typeInInput     = document.getElementById('typeInInput');
const typeInCheckBtn  = document.getElementById('typeInCheckBtn');
const typeInResult    = document.getElementById('typeInResult');
const exportBtn       = document.getElementById('exportBtn');
const importBtn       = document.getElementById('importBtn');
const importFile      = document.getElementById('importFile');

const TENSE_LABELS = {
    presente:         'Presente',
    passato_prossimo: 'Passato Prossimo',
    imperfetto:       'Imperfetto',
    futuro:           'Futuro',
    condizionale:     'Condizionale',
    congiuntivo:      'Congiuntivo',
    imperativo:       'Imperativo',
    trapassato:       'Trapassato Prossimo',
};

// ── SRS Persistence ───────────────────────────────────────────────────────

function loadSRS() {
    try { const s = JSON.parse(localStorage.getItem(SRS_KEY)); if (s) cardData = s; } catch {}
}

function saveSRS() {
    try { localStorage.setItem(SRS_KEY, JSON.stringify(cardData)); } catch {}
}

function getCard(i) {
    return cardData[i] || { interval: 0, ease: 2.5, reps: 0, lapses: 0, nextReview: null };
}

// ── SM-2 Algorithm ────────────────────────────────────────────────────────

function scheduleCard(i, rating) {
    const d = getCard(i);
    let { interval, ease, reps, lapses } = d;
    const isNew = reps === 0;

    if (rating === 0) {
        lapses++;
        interval = 1;
        ease = Math.max(1.3, ease - 0.2);
        reps = 0;
        sessionQueue.push(i);
    } else if (rating === 1) {
        interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
        ease = Math.max(1.3, ease - 0.15);
        reps++;
    } else if (rating === 2) {
        if (reps === 0)      interval = 3;
        else if (reps === 1) interval = 6;
        else                 interval = Math.round(interval * ease);
        reps++;
    } else {
        if (reps === 0) interval = 4;
        else            interval = Math.round(interval * ease * 1.3);
        ease = Math.min(3.0, ease + 0.15);
        reps++;
    }

    // Fuzz ±10% so cards reviewed together don't all come back on the same day
    if (interval > 1) interval = Math.max(1, Math.round(interval * (0.9 + Math.random() * 0.2)));

    const next = new Date();
    next.setDate(next.getDate() + interval);
    cardData[i] = { interval, ease, reps, lapses, nextReview: next.toISOString().slice(0, 10) };
    saveSRS();

    // Count first-time Good/Easy reviews as words learned
    if (isNew && (rating === 2 || rating === 3)) {
        parlo.incrementWords();
    }
}

function previewIntervals(i) {
    const { interval, ease, reps } = getCard(i);
    const calc = r => {
        if (r === 0) return 0;
        if (r === 1) return reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
        if (r === 2) { if (reps === 0) return 3; if (reps === 1) return 6; return Math.round(interval * ease); }
        if (reps === 0) return 4;
        return Math.round(interval * ease * 1.3);
    };
    return [calc(0), calc(1), calc(2), calc(3)];
}

function formatInterval(days) {
    if (days === 0) return 'now';
    if (days === 1) return '1d';
    if (days < 30)  return `${days}d`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${Math.round(days / 365)}yr`;
}

// ── Session queue ─────────────────────────────────────────────────────────

function buildQueue(includeExtra = false) {
    const t = vocabToday();
    const due = [], newCards = [];

    phrases.forEach((_, i) => {
        const d = getCard(i);
        if (d.nextReview && d.nextReview <= t)  due.push(i);
        else if (!d.nextReview)                 newCards.push(i);
    });

    // Shuffle new cards so introduction order isn't always phrases.json order
    for (let i = newCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
    }
    const newSlots = includeExtra ? newCards.length : NEW_PER_DAY;
    sessionQueue = [...due, ...newCards.slice(0, newSlots)];

    for (let i = sessionQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sessionQueue[i], sessionQueue[j]] = [sessionQueue[j], sessionQueue[i]];
    }

    sessionPos = 0;
    return sessionQueue.length;
}

// ── Stats ─────────────────────────────────────────────────────────────────

function updateStats() {
    const t = vocabToday();
    let due = 0, newCount = 0, mastered = 0;

    phrases.forEach((_, i) => {
        const d = getCard(i);
        if (!d.nextReview)             newCount++;
        else if (d.nextReview <= t)    due++;
        else if (d.interval >= 21)     mastered++;
    });

    statDue.textContent      = due;
    statNew.textContent      = newCount;
    statMastered.textContent = mastered;
}

// ── Card display ──────────────────────────────────────────────────────────

function showCard(phraseIndex) {
    const phrase = phrases[phraseIndex];
    const showItalianFirst = studyMode === 'italian-to-english'
        ? true
        : (studyMode === 'english-to-italian' || studyMode === 'type-in')
            ? false
            : Math.random() < 0.5;

    if (showItalianFirst) {
        frontLabel.textContent  = 'Italiano';
        frontText.textContent   = phrase.italian;
        frontPronun.textContent = phrase.pronunciation || '';
        frontHint.textContent   = 'Click to reveal English';
        backLabel.textContent   = 'English';
        backText.textContent    = phrase.english;
        backPronun.textContent  = '';
        speakerFront.classList.remove('hidden');
        speakerBack.classList.add('hidden');
    } else {
        frontLabel.textContent  = 'English';
        frontText.textContent   = phrase.english;
        frontPronun.textContent = '';
        frontHint.textContent   = 'Click to reveal Italian';
        backLabel.textContent   = 'Italiano';
        backText.textContent    = phrase.italian;
        backPronun.textContent  = phrase.pronunciation || '';
        speakerFront.classList.add('hidden');
        speakerBack.classList.remove('hidden');
    }

    const isCustom = phraseIndex >= phrasesBaseLen;
    const level = (phrase.difficulty || '').toLowerCase();
    cefrBadge.textContent = isCustom ? 'Custom' : (phrase.difficulty || '');
    cefrBadge.className   = isCustom ? 'cefr-badge cefr-custom' : 'cefr-badge cefr-' + level;
    tenseBadge.textContent = TENSE_LABELS[phrase.tense] || '';

    italianTextForSpeech = phrase.italian;
    const lookupUrl = `https://translate.google.com/?sl=it&tl=en&text=${encodeURIComponent(phrase.italian)}&op=translate`;
    forvoBtnFront.href = lookupUrl;
    forvoBtnBack.href  = lookupUrl;

    isFlipped = false;
    flashcard.classList.remove('flipped');

    const isTypeIn = studyMode === 'type-in';
    srsReveal.style.display  = isTypeIn ? 'none' : 'flex';
    typeInArea.style.display = isTypeIn ? 'flex' : 'none';
    typeInInput.value        = '';
    typeInResult.style.display = 'none';
    srsRating.style.display    = 'none';
    sessionComplete.style.display = 'none';
    flashcard.parentElement.style.display = 'flex';

    if (isTypeIn) setTimeout(() => typeInInput.focus(), 50);

    const intervals = previewIntervals(phraseIndex);
    document.getElementById('intervalAgain').textContent = formatInterval(intervals[0]);
    document.getElementById('intervalHard').textContent  = formatInterval(intervals[1]);
    document.getElementById('intervalGood').textContent  = formatInterval(intervals[2]);
    document.getElementById('intervalEasy').textContent  = formatInterval(intervals[3]);
}

function revealAnswer() {
    if (isFlipped) return;
    isFlipped = true;
    flashcard.classList.add('flipped');
    srsReveal.style.display    = 'none';
    typeInArea.style.display   = 'none';
    srsRating.style.display    = 'flex';
}

function showSessionComplete() {
    flashcard.parentElement.style.display = 'none';
    srsReveal.style.display    = 'none';
    typeInArea.style.display   = 'none';
    typeInResult.style.display = 'none';
    srsRating.style.display    = 'none';
    sessionComplete.style.display = 'flex';
    sessionSummary.textContent = `You reviewed ${sessionReviewed} card${sessionReviewed !== 1 ? 's' : ''} today.`;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const dueTomorrow = phrases.filter((_, i) => getCard(i).nextReview === tomorrowStr).length;
    sessionNext.textContent = dueTomorrow > 0
        ? `${dueTomorrow} card${dueTomorrow !== 1 ? 's' : ''} due tomorrow.`
        : 'Nothing due tomorrow — check back in a few days!';
}

function nextCard() {
    sessionPos++;
    if (sessionPos >= sessionQueue.length) {
        updateStats();
        showSessionComplete();
        return;
    }
    showCard(sessionQueue[sessionPos]);
    updateStats();
}

// ── Speech ────────────────────────────────────────────────────────────────

function vocabSpeak(text) {
    parlo.speakItalian(text);
}

// ── Events ────────────────────────────────────────────────────────────────

flashcard.addEventListener('click', e => {
    if (e.target.closest('.speaker-btn')) return;
    if (!isFlipped) revealAnswer(); else { isFlipped = false; flashcard.classList.remove('flipped'); }
});

showAnswerBtn.addEventListener('click', revealAnswer);
speakerFront.addEventListener('click', () => vocabSpeak(italianTextForSpeech));
speakerBack.addEventListener('click',  () => vocabSpeak(italianTextForSpeech));

document.querySelectorAll('#tab-vocab [data-rating]').forEach(btn => {
    btn.addEventListener('click', () => {
        scheduleCard(sessionQueue[sessionPos], parseInt(btn.dataset.rating));
        sessionReviewed++;
        nextCard();
    });
});

modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        studyMode = btn.dataset.mode;
        modeButtons.forEach(b => b.classList.toggle('active', b === btn));
        try { localStorage.setItem(MODE_KEY, studyMode); } catch {}
        if (sessionQueue.length && sessionPos < sessionQueue.length) showCard(sessionQueue[sessionPos]);
    });
});

resetBtn.addEventListener('click', () => {
    if (!confirm('Reset all SRS progress? This cannot be undone.')) return;
    cardData = {};
    saveSRS();
    sessionReviewed = 0;
    buildQueue();
    updateStats();
    if (sessionQueue.length) showCard(sessionQueue[0]);
});

continueBtn.addEventListener('click', () => {
    const extra = buildQueue(true);
    if (extra > 0) { sessionReviewed = 0; showCard(sessionQueue[0]); }
});

document.addEventListener('keydown', e => {
    if (!document.getElementById('tab-vocab').classList.contains('active')) return;
    if (document.activeElement === typeInInput) return;
    if ((e.key === ' ' || e.key === 'Enter') && !isFlipped) { e.preventDefault(); revealAnswer(); }
    if (isFlipped) {
        if (e.key === '1') document.querySelector('#tab-vocab [data-rating="0"]').click();
        if (e.key === '2') document.querySelector('#tab-vocab [data-rating="1"]').click();
        if (e.key === '3') document.querySelector('#tab-vocab [data-rating="2"]').click();
        if (e.key === '4') document.querySelector('#tab-vocab [data-rating="3"]').click();
    }
});

let touchStartX = 0;
flashcard.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
flashcard.addEventListener('touchend', e => {
    if (!isFlipped) { revealAnswer(); return; }
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) > 60) {
        if (dx > 0) document.querySelector('#tab-vocab [data-rating="3"]').click();
        else        document.querySelector('#tab-vocab [data-rating="0"]').click();
    }
}, { passive: true });

// ── Type-in mode ──────────────────────────────────────────────────────────

function normalizeAnswer(s) {
    return s.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
}

function normalizeLoose(s) {
    return normalizeAnswer(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function checkTypeIn() {
    const typed   = typeInInput.value;
    const correct = italianTextForSpeech;
    const isExact = normalizeAnswer(typed) === normalizeAnswer(correct);
    const isClose = !isExact && normalizeLoose(typed) === normalizeLoose(correct);

    typeInResult.className = 'typein-result';
    typeInResult.innerHTML = '';

    const statusEl = document.createElement('span');
    statusEl.className = 'typein-status';

    if (isExact) {
        typeInResult.classList.add('typein-result--correct');
        statusEl.textContent = '✓ Correct!';
        typeInResult.appendChild(statusEl);
    } else {
        typeInResult.classList.add(isClose ? 'typein-result--close' : 'typein-result--wrong');
        statusEl.textContent = isClose ? '~ Almost — check the accents' : '✗ Not quite';

        const yoursEl  = document.createElement('span');
        yoursEl.className = 'typein-yours';
        const yoursEm = document.createElement('em');
        yoursEm.textContent = typed || '—';
        yoursEl.append('You: ', yoursEm);

        const answerEl = document.createElement('span');
        answerEl.className = 'typein-answer';
        answerEl.textContent = '✓ ' + correct;

        typeInResult.append(statusEl, yoursEl, answerEl);
    }

    typeInResult.style.display = 'flex';
    revealAnswer();
}

typeInInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkTypeIn(); } });
typeInCheckBtn.addEventListener('click', checkTypeIn);

// ── Export / Import ───────────────────────────────────────────────────────

exportBtn.addEventListener('click', () => {
    let customCards = [];
    try { customCards = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch {}
    const blob = new Blob([JSON.stringify({ version: 2, exported: vocabToday(), cardData, customCards }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `parlo-srs-${vocabToday()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const raw = JSON.parse(ev.target.result);
            const imported = raw.cardData ?? raw;
            if (typeof imported !== 'object' || Array.isArray(imported)) throw new Error();
            const dateStr = raw.exported ? ` from ${raw.exported}` : '';
            if (!confirm(`Import backup${dateStr}? This replaces your current progress.`)) return;
            cardData = imported;
            saveSRS();
            if (Array.isArray(raw.customCards)) {
                localStorage.setItem(CUSTOM_KEY, JSON.stringify(raw.customCards));
                phrases = phrases.slice(0, phrasesBaseLen).concat(raw.customCards);
            }
            sessionReviewed = 0;
            const count = buildQueue();
            updateStats();
            if (count > 0) showCard(sessionQueue[0]);
            else { showSessionComplete(); sessionSummary.textContent = "Progress restored! All caught up for today."; sessionNext.textContent = ''; }
        } catch { alert('Could not import: invalid or corrupted file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// ── Init ──────────────────────────────────────────────────────────────────

async function initVocab() {
    if (vocabInited) return;
    vocabInited = true;

    try { studyMode = localStorage.getItem(MODE_KEY) || 'italian-to-english'; } catch {}
    modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === studyMode));

    loadSRS();

    try {
        const res = await fetch('phrases.json?v=2');
        phrases = await res.json();
    } catch {
        frontText.textContent = 'Error loading phrases.';
        return;
    }
    phrasesBaseLen = phrases.length;

    try {
        const custom = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
        if (custom.length) phrases = phrases.concat(custom);
    } catch {}

    updateStats();
    const count = buildQueue();

    if (count === 0) {
        showSessionComplete();
        sessionSummary.textContent = "You're all caught up for today!";
        sessionNext.textContent = '';
    } else {
        showCard(sessionQueue[0]);
    }
}
