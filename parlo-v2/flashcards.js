// ============================================================
// Parlo v2 — Flashcards with Spaced Repetition (SM-2)
// ============================================================

const SRS_KEY      = 'parlo_v2_srs';
const MODE_KEY     = 'parlo_v2_study_mode';
const NEW_PER_DAY  = 20;

let phrases      = [];
let cardData     = {};   // { [phraseIndex]: { interval, ease, reps, lapses, nextReview, introducedDate } }
let sessionQueue = [];   // indices of cards to review this session
let sessionPos   = 0;    // current position in queue
let studyMode    = 'italian-to-english';
let italianTextForSpeech = '';
let isFlipped    = false;
let sessionReviewed = 0;

const today = () => new Date().toISOString().slice(0, 10);

// ---- DOM refs ----
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
const modeButtons     = document.querySelectorAll('.mode-btn');
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

// ---- SRS Persistence ----

function loadSRS() {
    try {
        const saved = JSON.parse(localStorage.getItem(SRS_KEY));
        if (saved) cardData = saved;
    } catch {}
}

function saveSRS() {
    try { localStorage.setItem(SRS_KEY, JSON.stringify(cardData)); } catch {}
}

function getCard(i) {
    return cardData[i] || { interval: 0, ease: 2.5, reps: 0, lapses: 0, nextReview: null, introducedDate: null };
}

// ---- SRS Algorithm (SM-2 simplified) ----

function scheduleCard(i, rating) {
    // rating: 0=Again, 1=Hard, 2=Good, 3=Easy
    const d = getCard(i);
    let { interval, ease, reps, lapses } = d;


    if (rating === 0) {
        // Again — reset, show again this session
        lapses++;
        interval = 1;
        ease = Math.max(1.3, ease - 0.2);
        reps = 0;
        sessionQueue.push(i); // back of queue
    } else if (rating === 1) {
        // Hard
        interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
        ease = Math.max(1.3, ease - 0.15);
        reps++;
    } else if (rating === 2) {
        // Good
        if (reps === 0)      interval = 3;
        else if (reps === 1) interval = 6;
        else                 interval = Math.round(interval * ease);
        reps++;
    } else {
        // Easy
        if (reps === 0)      interval = 4;
        else                 interval = Math.round(interval * ease * 1.3);
        ease = Math.min(3.0, ease + 0.15);
        reps++;
    }

    const next = new Date();
    next.setDate(next.getDate() + interval);

    cardData[i] = { interval, ease, reps, lapses, nextReview: next.toISOString().slice(0, 10) };
    saveSRS();
}

function previewIntervals(i) {
    // Returns what each button would schedule
    const d = getCard(i);
    const { interval, ease, reps } = d;

    const calc = (r) => {
        if (r === 0) return 0; // 0 = "now" (back in session)
        if (r === 1) return reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
        if (r === 2) {
            if (reps === 0) return 3;
            if (reps === 1) return 6;
            return Math.round(interval * ease);
        }
        // easy
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

// ---- Build session queue ----

function buildQueue(includeExtra = false) {
    const t = today();
    const due = [];
    const newCards = [];

    phrases.forEach((_, i) => {
        const d = getCard(i);
        if (d.nextReview && d.nextReview <= t) {
            due.push(i);
        } else if (!d.nextReview) {
            newCards.push(i);
        }
    });

    const newSlots = includeExtra ? newCards.length : NEW_PER_DAY;

    sessionQueue = [...due, ...newCards.slice(0, newSlots)];

    // Shuffle
    for (let i = sessionQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sessionQueue[i], sessionQueue[j]] = [sessionQueue[j], sessionQueue[i]];
    }

    sessionPos = 0;
    return sessionQueue.length;
}

// ---- Stats ----

function updateStats() {
    const t = today();
    let due = 0, newCount = 0, mastered = 0;

    phrases.forEach((_, i) => {
        const d = getCard(i);
        if (!d.nextReview) {
            newCount++;
        } else if (d.nextReview <= t) {
            due++;
        } else if (d.interval >= 21) {
            mastered++;
        }
    });

    statDue.textContent     = due;
    statNew.textContent     = newCount;
    statMastered.textContent = mastered;
}

// ---- Display card ----

function showCard(phraseIndex) {
    const phrase = phrases[phraseIndex];
    const showItalianFirst = studyMode === 'italian-to-english'
        ? true
        : studyMode === 'english-to-italian'
            ? false
            : Math.random() < 0.5;

    if (showItalianFirst) {
        frontLabel.textContent = 'Italiano';
        frontText.textContent  = phrase.italian;
        frontPronun.textContent = phrase.pronunciation || '';
        frontHint.textContent  = 'Click to reveal English';
        backLabel.textContent  = 'English';
        backText.textContent   = phrase.english;
        backPronun.textContent = '';
        speakerFront.classList.remove('hidden');
        speakerBack.classList.add('hidden');
    } else {
        frontLabel.textContent = 'English';
        frontText.textContent  = phrase.english;
        frontPronun.textContent = '';
        frontHint.textContent  = 'Click to reveal Italian';
        backLabel.textContent  = 'Italiano';
        backText.textContent   = phrase.italian;
        backPronun.textContent = phrase.pronunciation || '';
        speakerFront.classList.add('hidden');
        speakerBack.classList.remove('hidden');
    }

    italianTextForSpeech = phrase.italian;
    const lookupUrl = `https://translate.google.com/?sl=it&tl=en&text=${encodeURIComponent(phrase.italian)}&op=translate`;
    forvoBtnFront.href = lookupUrl;
    forvoBtnBack.href  = lookupUrl;

    // Reset flip state
    isFlipped = false;
    flashcard.classList.remove('flipped');

    // Show reveal button, hide ratings
    srsReveal.style.display = 'flex';
    srsRating.style.display = 'none';
    sessionComplete.style.display = 'none';
    flashcard.parentElement.style.display = 'flex';

    // Update interval previews
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
    srsReveal.style.display = 'none';
    srsRating.style.display = 'flex';
}

function showSessionComplete() {
    flashcard.parentElement.style.display = 'none';
    srsReveal.style.display = 'none';
    srsRating.style.display = 'none';
    sessionComplete.style.display = 'flex';
    sessionSummary.textContent = `You reviewed ${sessionReviewed} card${sessionReviewed !== 1 ? 's' : ''} today.`;

    // Find next due card
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const dueTomorrow = phrases.filter((_, i) => {
        const d = getCard(i);
        return d.nextReview === tomorrowStr;
    }).length;

    sessionNext.textContent = dueTomorrow > 0
        ? `${dueBottom(dueTomorrow)} due tomorrow.`
        : 'Nothing due tomorrow — check back in a few days!';
}

function dueBottom(n) {
    return `${n} card${n !== 1 ? 's' : ''}`;
}

// ---- Advance queue ----

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

// ---- Speech ----

function speakItalian(text) {
    if (!text) return;
    if (speechSynthesis.speaking) speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'it-IT';
    utt.rate = 0.85;
    const voices = speechSynthesis.getVoices();
    const italianVoice =
        voices.find(v => v.lang.startsWith('it') && (
            v.name.toLowerCase().includes('luca') ||
            v.name.toLowerCase().includes('diego') ||
            v.name.toLowerCase().includes('cosimo') ||
            v.name.toLowerCase().includes('giorgio')
        )) ||
        voices.find(v => v.lang.startsWith('it'));
    if (italianVoice) utt.voice = italianVoice;
    speechSynthesis.speak(utt);
}

// ---- Mode ----

function saveMode() {
    try { localStorage.setItem(MODE_KEY, studyMode); } catch {}
}

function loadMode() {
    try {
        const s = localStorage.getItem(MODE_KEY);
        if (s) studyMode = s;
    } catch {}
}

function updateModeButtons() {
    modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === studyMode));
}

// ---- Events ----

flashcard.addEventListener('click', e => {
    if (e.target.closest('.speaker-btn')) return;
    if (!isFlipped) {
        revealAnswer();
    } else {
        isFlipped = false;
        flashcard.classList.remove('flipped');
    }
});

showAnswerBtn.addEventListener('click', revealAnswer);

speakerFront.addEventListener('click', () => speakItalian(italianTextForSpeech));
speakerBack.addEventListener('click',  () => speakItalian(italianTextForSpeech));

document.querySelectorAll('.btn-srs').forEach(btn => {
    btn.addEventListener('click', () => {
        const rating = parseInt(btn.dataset.rating);
        const phraseIndex = sessionQueue[sessionPos];
        scheduleCard(phraseIndex, rating);
        sessionReviewed++;
        nextCard();
    });
});

modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        studyMode = btn.dataset.mode;
        updateModeButtons();
        saveMode();
        if (sessionQueue.length && sessionPos < sessionQueue.length) {
            showCard(sessionQueue[sessionPos]);
        }
    });
});

resetBtn.addEventListener('click', () => {
    if (confirm('Reset all SRS progress? This cannot be undone.')) {
        cardData = {};
        saveSRS();
        sessionReviewed = 0;
        buildQueue();
        updateStats();
        if (sessionQueue.length) {
            showCard(sessionQueue[0]);
        }
    }
});

continueBtn.addEventListener('click', () => {
    // Study extra new cards if user wants more
    const extra = buildQueue(true);
    if (extra > 0) {
        sessionReviewed = 0;
        showCard(sessionQueue[0]);
    }
});

document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isFlipped) {
            revealAnswer();
        }
    }
    // Number keys to rate after flip
    if (isFlipped) {
        if (e.key === '1') document.querySelector('[data-rating="0"]').click();
        if (e.key === '2') document.querySelector('[data-rating="1"]').click();
        if (e.key === '3') document.querySelector('[data-rating="2"]').click();
        if (e.key === '4') document.querySelector('[data-rating="3"]').click();
    }
});

// Touch swipe (left = easy, right = again) — only after flip
let touchStartX = 0;
flashcard.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

flashcard.addEventListener('touchend', e => {
    if (!isFlipped) { revealAnswer(); return; }
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) > 60) {
        if (dx > 0) document.querySelector('[data-rating="3"]').click(); // swipe right = easy
        else        document.querySelector('[data-rating="0"]').click(); // swipe left = again
    }
}, { passive: true });

// ---- Init ----

async function init() {
    loadMode();
    updateModeButtons();
    loadSRS();

    try {
        const res = await fetch('phrases.json');
        phrases = await res.json();
    } catch {
        frontText.textContent = 'Error loading phrases.';
        return;
    }

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
