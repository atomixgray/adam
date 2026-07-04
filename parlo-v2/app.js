'use strict';

const WORKER_URL  = 'https://parlo-proxy.adamlarkin.workers.dev';
const AUTH_KEY    = 'parlo_v2_auth';
const STREAK_KEY  = 'parlo_v2_streak';
const WORDS_KEY   = 'parlo_v2_words';

// ── Shared API ────────────────────────────────────────────────────────────

const parlo = window.parlo = {

    getPassphrase() {
        return localStorage.getItem(AUTH_KEY) || '';
    },

    async callClaude(action, messages, options = {}) {
        const res = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Parlo-Auth': this.getPassphrase(),
            },
            body: JSON.stringify({ action, messages, ...options }),
        });
        if (res.status === 401) {
            // Wrong passphrase — clear it and reload to re-prompt
            localStorage.removeItem(AUTH_KEY);
            location.reload();
            throw new Error('Unauthorized');
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
    },

    speakItalian(text) {
        if (!text || !window.speechSynthesis) return;
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = 'it-IT';
        utt.rate = 0.85;
        // Voice selection runs after voices are loaded
        const setVoice = () => {
            const voices = speechSynthesis.getVoices();
            const voice =
                voices.find(v => v.lang.startsWith('it') && /luca|alice|cosimo|giorgio|diego/i.test(v.name)) ||
                voices.find(v => v.lang.startsWith('it'));
            if (voice) utt.voice = voice;
            speechSynthesis.speak(utt);
        };
        if (speechSynthesis.getVoices().length) {
            setVoice();
        } else {
            speechSynthesis.onvoiceschanged = setVoice;
        }
    },

    incrementWords(n = 1) {
        const current = parseInt(localStorage.getItem(WORDS_KEY) || '0', 10);
        const next = current + n;
        localStorage.setItem(WORDS_KEY, String(next));
        const el = document.getElementById('wordsCount');
        if (el) el.textContent = next.toLocaleString();
    },
};

// ── Streak ────────────────────────────────────────────────────────────────

function updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
    let streak = JSON.parse(localStorage.getItem(STREAK_KEY) || '{"count":0,"lastDate":null}');

    if (streak.lastDate !== today) {
        streak.count = (streak.lastDate === yesterday) ? streak.count + 1 : 1;
        streak.lastDate = today;
        localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
    }

    const el = document.getElementById('streakCount');
    if (el) el.textContent = streak.count;
}

function loadStats() {
    const words  = parseInt(localStorage.getItem(WORDS_KEY) || '0', 10);
    const streak = JSON.parse(localStorage.getItem(STREAK_KEY) || '{"count":0}');
    document.getElementById('wordsCount').textContent  = words.toLocaleString();
    document.getElementById('streakCount').textContent = streak.count;
}

// ── Auth ──────────────────────────────────────────────────────────────────

function initAuth() {
    const overlay = document.getElementById('authOverlay');
    const input   = document.getElementById('authInput');
    const btn     = document.getElementById('authBtn');
    const error   = document.getElementById('authError');

    if (localStorage.getItem(AUTH_KEY)) {
        overlay.classList.add('hidden');
        launchApp();
        return;
    }

    function attempt() {
        const val = input.value.trim();
        if (!val) return;
        error.classList.add('hidden');
        localStorage.setItem(AUTH_KEY, val);
        overlay.classList.add('hidden');
        launchApp();
    }

    btn.addEventListener('click', attempt);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
    setTimeout(() => input.focus(), 100);
}

// ── App launch ────────────────────────────────────────────────────────────

function launchApp() {
    document.getElementById('app').classList.remove('hidden');
    loadStats();
    updateStreak();
    initTabs();
    // Boot the default tab
    if (typeof initChat === 'function') { tabInited.chat = true; initChat(); }
}

// ── Tabs ──────────────────────────────────────────────────────────────────

const tabInited = {};
const tabInitFns = { chat: 'initChat', alphabet: 'initAlphabet', vocab: 'initVocab', translate: 'initTranslate' };

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => {
        const isActive = p.id === `tab-${name}`;
        p.classList.toggle('active', isActive);
        p.classList.toggle('hidden', !isActive);
    });

    if (!tabInited[name]) {
        tabInited[name] = true;
        const fn = window[tabInitFns[name]];
        if (typeof fn === 'function') fn();
    }
}

// ── Boot ──────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
