'use strict';

// ── SM-2 Spaced Repetition ────────────────────────────────────────────────
// Ported from flashcards.js — same algorithm, same localStorage keys

const SRS_KEY       = 'parlo_v2_srs';
const WORDS_SRS_KEY = 'parlo_v2_srs_words';
const MODE_KEY      = 'parlo_v2_study_mode';
const DECK_KEY      = 'parlo_v2_deck';
const CUSTOM_KEY    = 'parlo_v2_custom';
const ACTIVITY_KEY  = 'parlo_v2_activity'; // { 'YYYY-MM-DD': cards studied }
const FLAGS_KEY     = 'parlo_v2_flags';    // cards flagged as wrong/awkward, for Claude to review
const HEATMAP_WEEKS = 26;
const NEW_PER_DAY   = 5;
const KNOWN_INTERVAL = 60; // "I already know this" — check back in ~2 months

// Each deck has its own SRS store. Words are introduced in frequency order;
// phrases are shuffled.
const DECKS = {
    phrases: { file: 'phrases.json?v=3',   srsKey: SRS_KEY,       name: 'Phrases' },
    words:   { file: 'top1000.json?v=5',   srsKey: WORDS_SRS_KEY, name: 'Top 1000' },
};

let deck            = 'phrases';
let deckCache       = {};
let newPool         = []; // new cards not yet pulled into today's session
let phrases         = [];
let phrasesBaseLen  = 0; // length of phrases.json; custom cards come after
let cardData        = {};
let sessionQueue = [];
let sessionPos   = 0;
let studyMode    = 'italian-to-english';
let italianTextForSpeech = '';
let speechText   = '';
let answerAlternates = []; // extra accepted type-in answers (word without its article)
let isFlipped    = false;
let sessionReviewed = 0;
let vocabInited  = false;

const vocabToday = () => parlo.localDateStr();

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
const modeButtons     = document.querySelectorAll('#tab-vocab .mode-btn[data-mode]');
const deckButtons     = document.querySelectorAll('#tab-vocab .mode-btn[data-deck]');
const knowRow         = document.getElementById('knowRow');
const knowBtn         = document.getElementById('knowBtn');
const wordsKnownEl    = document.getElementById('wordsKnown');
const wordsTotalEl    = document.getElementById('wordsTotal');
const wordsFill       = document.getElementById('wordsFill');
const flagButtons     = document.querySelectorAll('#tab-vocab .flag-btn');
const flagCountEl     = document.getElementById('flagCount');
const heatmapEl       = document.getElementById('heatmap');
const heatmapSummary  = document.getElementById('heatmapSummary');
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
    cardData = {};
    try { const s = JSON.parse(localStorage.getItem(DECKS[deck].srsKey)); if (s) cardData = s; } catch {}
}

function saveSRS() {
    try { localStorage.setItem(DECKS[deck].srsKey, JSON.stringify(cardData)); } catch {}
}

function getCard(i) {
    return cardData[i] || { interval: 0, ease: 2.5, reps: 0, lapses: 0, nextReview: null, learningStep: 0 };
}

// Re-insert a card partway through the current session queue instead of at the
// very end, so it resurfaces sooner (roughly simulating Anki's short in-session
// learning-step delays without needing real wall-clock timers).
function requeueSoon(i, offset) {
    const pos = Math.min(sessionPos + offset, sessionQueue.length);
    sessionQueue.splice(pos, 0, i);
}

function graduate(i, d, interval, ease) {
    cardData[i] = { interval, ease, reps: 1, lapses: d.lapses, nextReview: parlo.localDateStr(addDays(interval)), learningStep: 0 };
    saveSRS();
    parlo.incrementWords();
}

function addDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
}

// ── SM-2 Algorithm ────────────────────────────────────────────────────────
//
// Brand-new cards (nextReview === null) go through two short in-session
// "learning steps" before they graduate into real day-based intervals — a
// single lucky Good isn't strong enough evidence you've actually learned it.
// Easy skips straight to graduation, matching Anki. Once graduated, a card
// never re-enters learning (lapses use the existing short-interval reset
// below, unchanged).

function scheduleCard(i, rating) {
    const d = getCard(i);
    const inLearning = d.nextReview === null;

    if (inLearning) {
        const learningStep = d.learningStep || 0;

        if (rating === 0) {
            requeueSoon(i, 3);
            cardData[i] = { ...d, learningStep: 0 };
            saveSRS();
        } else if (rating === 1) {
            requeueSoon(i, 6);
            cardData[i] = { ...d, learningStep };
            saveSRS();
        } else if (rating === 2) {
            if (learningStep === 0) {
                requeueSoon(i, 12);
                cardData[i] = { ...d, learningStep: 1 };
                saveSRS();
            } else {
                graduate(i, d, 3, d.ease);
            }
        } else {
            graduate(i, d, 4, Math.min(3.0, d.ease + 0.15));
        }
        return;
    }

    // Already graduated — standard SM-2 update, unchanged from before.
    let { interval, ease, reps, lapses } = d;

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
        interval = reps === 0 ? 4 : Math.round(interval * ease * 1.3);
        ease = Math.min(3.0, ease + 0.15);
        reps++;
    }

    // Fuzz ±10% so cards reviewed together don't all come back on the same day
    if (interval > 1) interval = Math.max(1, Math.round(interval * (0.9 + Math.random() * 0.2)));

    cardData[i] = { interval, ease, reps, lapses, nextReview: parlo.localDateStr(addDays(interval)), learningStep: 0 };
    saveSRS();
}

function previewIntervals(i) {
    const d = getCard(i);
    if (d.nextReview === null) {
        // Still in learning steps — Again/Hard/first Good all requeue within this session
        // rather than producing a real day-based interval, but at staggered distances
        // (see requeueSoon offsets in scheduleCard), so label them distinctly rather
        // than showing the same "soon" three times.
        const learningStep = d.learningStep || 0;
        return ['soon', 'a bit', learningStep === 0 ? 'later' : 3, 4];
    }
    const { interval, ease, reps } = d;
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
    if (typeof days === 'string') return days;
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

    // Shuffle new phrases so introduction order isn't always phrases.json order.
    // Words stay in frequency order — most common first is the whole point.
    if (deck === 'phrases') {
        for (let i = newCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
        }
    }
    const newSlots = includeExtra ? newCards.length : NEW_PER_DAY;
    sessionQueue = [...due, ...newCards.slice(0, newSlots)];
    newPool = newCards.slice(newSlots);

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
    const showItalianFirst = studyMode === 'italian-to-english';

    // Word cards show their example sentence where phrases show pronunciation
    const isWord = !!phrase.isWord;
    const italianSub = isWord ? phrase.example : (phrase.pronunciation || '');
    const englishSub = isWord ? phrase.example_en : '';

    if (showItalianFirst) {
        frontLabel.textContent  = 'Italiano';
        frontText.textContent   = phrase.italian;
        frontPronun.textContent = italianSub;
        frontHint.textContent   = 'Click to reveal English';
        backLabel.textContent   = 'English';
        backText.textContent    = phrase.english;
        backPronun.textContent  = englishSub;
        speakerFront.classList.remove('hidden');
        speakerBack.classList.add('hidden');
    } else {
        frontLabel.textContent  = 'English';
        frontText.textContent   = phrase.english;
        frontPronun.textContent = englishSub;
        frontHint.textContent   = 'Click to reveal Italian';
        backLabel.textContent   = 'Italiano';
        backText.textContent    = phrase.italian;
        backPronun.textContent  = italianSub;
        speakerFront.classList.add('hidden');
        speakerBack.classList.remove('hidden');
    }

    const isCustom = phraseIndex >= phrasesBaseLen;
    const level = (phrase.difficulty || '').toLowerCase();
    if (isWord) {
        cefrBadge.textContent = '#' + phrase.rank;
        cefrBadge.className   = 'cefr-badge cefr-word';
        tenseBadge.textContent = phrase.note || '';
    } else {
        cefrBadge.textContent = isCustom ? 'Custom' : (phrase.difficulty || '');
        cefrBadge.className   = isCustom ? 'cefr-badge cefr-custom' : 'cefr-badge cefr-' + level;
        tenseBadge.textContent = TENSE_LABELS[phrase.tense] || '';
    }

    italianTextForSpeech = phrase.italian;
    speechText = isWord ? `${phrase.italian.replace(' / ', ', ')}. ${phrase.example}` : phrase.italian;
    typeInInput.placeholder = isWord ? 'Type the Italian word…' : 'Type the Italian phrase…';
    answerAlternates = isWord && phrase.bare !== phrase.italian ? [phrase.bare] : [];
    updateFlagButtons();
    knowRow.classList.toggle('hidden', !(isWord && getCard(phraseIndex).nextReview === null));
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
    knowRow.classList.add('hidden');
    srsRating.style.display    = 'flex';
}

function showSessionComplete(celebrate = false) {
    flashcard.parentElement.style.display = 'none';
    srsReveal.style.display    = 'none';
    typeInArea.style.display   = 'none';
    typeInResult.style.display = 'none';
    srsRating.style.display    = 'none';
    knowRow.classList.add('hidden');
    sessionComplete.style.display = 'flex';
    sessionSummary.textContent = `You reviewed ${sessionReviewed} card${sessionReviewed !== 1 ? 's' : ''} today.`;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = parlo.localDateStr(tomorrow);
    const dueTomorrow = phrases.filter((_, i) => getCard(i).nextReview === tomorrowStr).length;
    sessionNext.textContent = dueTomorrow > 0
        ? `${dueTomorrow} card${dueTomorrow !== 1 ? 's' : ''} due tomorrow.`
        : 'Nothing due tomorrow — check back in a few days!';

    if (celebrate) {
        sessionComplete.classList.add('session-complete--celebrate');
        confettiBurst();
        setTimeout(() => sessionComplete.classList.remove('session-complete--celebrate'), 900);
    }
}

function confettiBurst() {
    const colors = ['#667eea', '#f093fb', '#34d399', '#60a5fa', '#fbbf24'];
    const burst = document.createElement('div');
    burst.className = 'confetti-burst';
    for (let i = 0; i < 26; i++) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        piece.style.setProperty('--x', `${(Math.random() - 0.5) * 260}px`);
        piece.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`);
        piece.style.setProperty('--delay', `${(Math.random() * 0.15).toFixed(2)}s`);
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        burst.appendChild(piece);
    }
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 1400);
}

function nextCard() {
    sessionPos++;
    if (sessionPos >= sessionQueue.length) {
        updateStats();
        showSessionComplete(true);
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
    if (e.target.closest('.speaker-btn, .flag-btn')) return;
    if (!isFlipped) revealAnswer(); else { isFlipped = false; flashcard.classList.remove('flipped'); }
});

showAnswerBtn.addEventListener('click', revealAnswer);
speakerFront.addEventListener('click', () => vocabSpeak(speechText));
speakerBack.addEventListener('click',  () => vocabSpeak(speechText));

// "I already know this" — skip a new word for ~2 months, and pull in the next
// new word so it doesn't eat one of today's new-card slots.
function markKnown() {
    const i = sessionQueue[sessionPos];
    const nextReview = parlo.localDateStr(addDays(KNOWN_INTERVAL));
    cardData[i] = { interval: KNOWN_INTERVAL, ease: 2.8, reps: 3, lapses: 0, nextReview, learningStep: 0 };
    saveSRS();
    parlo.incrementWords();
    // Drop any in-session repeats of this card, then backfill today's new slot
    sessionQueue = sessionQueue.filter((c, idx) => idx <= sessionPos || c !== i);
    if (newPool.length) sessionQueue.push(newPool.shift());
    logActivity();
    nextCard();
    renderProgress();
}

knowBtn.addEventListener('click', markKnown);

document.querySelectorAll('#tab-vocab [data-rating]').forEach(btn => {
    btn.addEventListener('click', () => {
        scheduleCard(sessionQueue[sessionPos], parseInt(btn.dataset.rating));
        sessionReviewed++;
        logActivity();
        nextCard();
        renderProgress();
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
    if (!confirm(`Reset all progress for the ${DECKS[deck].name} deck? This cannot be undone.`)) return;
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
    if (e.key === 'k' && !isFlipped && !knowRow.classList.contains('hidden')) markKnown();
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
    // Some words list alternatives ("il / la") — any one counts
    const answers = correct.split(' / ').concat(answerAlternates);
    const isExact = answers.some(a => normalizeAnswer(typed) === normalizeAnswer(a));
    const isClose = !isExact && answers.some(a => normalizeLoose(typed) === normalizeLoose(a));

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

// ── Progress: words known + activity heatmap ─────────────────────────────

function loadActivity() {
    try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || {}; } catch { return {}; }
}

function logActivity() {
    const activity = loadActivity();
    const t = vocabToday();
    activity[t] = (activity[t] || 0) + 1;
    try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity)); } catch {}
}

// A Top 1000 word counts as known once it has left the learning steps
// (or was marked "I already know this").
async function renderProgress() {
    let words;
    try { words = await fetchDeck('words'); } catch { return; }
    let wordData = cardData;
    if (deck !== 'words') {
        try { wordData = JSON.parse(localStorage.getItem(WORDS_SRS_KEY)) || {}; } catch { wordData = {}; }
    }

    const known = words.filter((_, i) => wordData[i]?.nextReview).length;
    wordsKnownEl.textContent = known.toLocaleString();
    wordsTotalEl.textContent = `of ${words.length.toLocaleString()} words known`;
    wordsFill.style.width    = `${(known / words.length) * 100}%`;

    renderHeatmap();
}

function renderHeatmap() {
    const activity = loadActivity();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Start on the Sunday HEATMAP_WEEKS-1 weeks back so columns are whole weeks
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() - (HEATMAP_WEEKS - 1) * 7);

    heatmapEl.textContent = '';
    let daysActive = 0;
    for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
        const key = parlo.localDateStr(d);
        const n = activity[key] || 0;
        if (n) daysActive++;
        const level = n === 0 ? 0 : n < 10 ? 1 : n < 25 ? 2 : n < 50 ? 3 : 4;
        const cell = document.createElement('span');
        cell.className = `hm-cell hm-${level}`;
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        cell.title = `${label}: ${n} card${n !== 1 ? 's' : ''}`;
        heatmapEl.appendChild(cell);
    }

    // Streak counts back from today, or from yesterday if today isn't done yet
    let streak = 0;
    const d = new Date(today);
    if (!activity[parlo.localDateStr(d)]) d.setDate(d.getDate() - 1);
    while (activity[parlo.localDateStr(d)]) { streak++; d.setDate(d.getDate() - 1); }

    heatmapSummary.textContent = streak > 1
        ? `🔥 ${streak}-day streak · ${daysActive} days in the last 6 months`
        : `${daysActive} day${daysActive !== 1 ? 's' : ''} practiced in the last 6 months`;
    heatmapEl.parentElement.scrollLeft = heatmapEl.parentElement.scrollWidth;
}

// ── Flags ─────────────────────────────────────────────────────────────────

function loadFlags() {
    try { return JSON.parse(localStorage.getItem(FLAGS_KEY)) || []; } catch { return []; }
}

function saveFlags(flags) {
    try { localStorage.setItem(FLAGS_KEY, JSON.stringify(flags)); } catch {}
}

function isFlagged(flags, i) {
    return flags.some(f => f.deck === deck && f.index === i);
}

function updateFlagButtons() {
    const flags = loadFlags();
    const on = sessionPos < sessionQueue.length && isFlagged(flags, sessionQueue[sessionPos]);
    flagButtons.forEach(b => {
        b.classList.toggle('flag-btn--on', on);
        b.title = on ? 'Flagged — tap to unflag' : 'Flag this card for review';
    });
    flagCountEl.textContent = `🚩 ${flags.length} flagged`;
    flagCountEl.classList.toggle('hidden', flags.length === 0);
}

function toggleFlag() {
    if (sessionPos >= sessionQueue.length) return;
    const i = sessionQueue[sessionPos];
    let flags = loadFlags();
    if (isFlagged(flags, i)) {
        flags = flags.filter(f => !(f.deck === deck && f.index === i));
    } else {
        const p = phrases[i];
        flags.push({ deck, index: i, italian: p.italian, english: p.english, date: vocabToday() });
    }
    saveFlags(flags);
    updateFlagButtons();
}

flagButtons.forEach(b => b.addEventListener('click', toggleFlag));

// ── Export / Import ───────────────────────────────────────────────────────

exportBtn.addEventListener('click', () => {
    const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
    const backup = {
        version: 3,
        exported: vocabToday(),
        cardData: read(SRS_KEY, {}),
        wordData: read(WORDS_SRS_KEY, {}),
        customCards: read(CUSTOM_KEY, []),
        activity: read(ACTIVITY_KEY, {}),
        flags: read(FLAGS_KEY, []),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
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
    reader.onload = async ev => {
        try {
            const raw = JSON.parse(ev.target.result);
            const imported = raw.cardData ?? raw;
            if (typeof imported !== 'object' || Array.isArray(imported)) throw new Error();
            const dateStr = raw.exported ? ` from ${raw.exported}` : '';
            if (!confirm(`Import backup${dateStr}? This replaces your current progress.`)) return;
            localStorage.setItem(SRS_KEY, JSON.stringify(imported));
            if (raw.wordData && typeof raw.wordData === 'object') {
                localStorage.setItem(WORDS_SRS_KEY, JSON.stringify(raw.wordData));
            }
            if (Array.isArray(raw.customCards)) {
                localStorage.setItem(CUSTOM_KEY, JSON.stringify(raw.customCards));
            }
            if (raw.activity && typeof raw.activity === 'object') {
                localStorage.setItem(ACTIVITY_KEY, JSON.stringify(raw.activity));
            }
            if (Array.isArray(raw.flags)) saveFlags(raw.flags);
            const count = await loadDeck();
            if (count === 0) sessionSummary.textContent = "Progress restored! All caught up for today.";
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
    if (studyMode === 'random') studyMode = 'italian-to-english'; // mode removed — fall back for returning users
    modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === studyMode));

    try { deck = localStorage.getItem(DECK_KEY) === 'words' ? 'words' : 'phrases'; } catch {}
    await loadDeck();
}

// "il problema", "l'acqua" — nouns are shown with their article so the gender sticks
function withArticle(w) {
    if (!w.article) return w.word;
    return w.article.endsWith("'") ? w.article + w.word : `${w.article} ${w.word}`;
}

async function fetchDeck(name) {
    if (!deckCache[name]) {
        const res = await fetch(DECKS[name].file);
        const data = await res.json();
        deckCache[name] = name === 'words'
            ? data.map(w => ({ italian: withArticle(w), bare: w.word, english: w.english, example: w.example, example_en: w.example_en, note: w.note, rank: w.rank, isWord: true }))
            : data;
    }
    return deckCache[name];
}

// Loads the active deck and its progress, then starts a session. Returns the queue length.
async function loadDeck() {
    deckButtons.forEach(b => b.classList.toggle('active', b.dataset.deck === deck));
    loadSRS();

    try {
        phrases = await fetchDeck(deck);
    } catch {
        frontText.textContent = 'Error loading cards.';
        return 0;
    }
    phrasesBaseLen = phrases.length;

    if (deck === 'phrases') {
        try {
            const custom = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
            if (custom.length) phrases = phrases.concat(custom);
        } catch {}
    }

    sessionReviewed = 0;
    updateStats();
    const count = buildQueue();

    if (count === 0) {
        showSessionComplete();
        sessionSummary.textContent = "You're all caught up for today!";
        sessionNext.textContent = '';
    } else {
        showCard(sessionQueue[0]);
    }
    renderProgress();
    updateFlagButtons();
    return count;
}

deckButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.deck === deck) return;
        deck = btn.dataset.deck;
        try { localStorage.setItem(DECK_KEY, deck); } catch {}
        loadDeck();
    });
});
