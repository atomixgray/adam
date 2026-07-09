'use strict';

const WORKER_URL  = 'https://parlo-proxy.adamlarkin.workers.dev';
const AUTH_KEY    = 'parlo_v2_auth';
const STREAK_KEY  = 'parlo_v2_streak';
const WORDS_KEY   = 'parlo_v2_words';
const EL_KEY_STORE   = 'parlo_v2_el_key';
const EL_VOICE_ID    = 'pNInz6obpgDQGcFmaJgB'; // Adam — free tier compatible

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
            const body = await res.json().catch(() => ({}));
            sessionStorage.setItem('parlo_auth_err', body.locked ? 'locked' : 'wrong');
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

    async speakItalian(text) {
        if (!text) return;

        const elKey = localStorage.getItem(EL_KEY_STORE);
        if (elKey) {
            try {
                const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE_ID}`, {
                    method: 'POST',
                    headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                    }),
                });
                if (res.ok) {
                    const blob = await res.blob();
                    const url  = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    audio.onended = () => URL.revokeObjectURL(url);
                    await audio.play();
                    return;
                }
                console.warn('ElevenLabs failed:', res.status, await res.text());
            } catch (e) {
                console.warn('ElevenLabs error, falling back to system TTS:', e);
            }
        }

        // Fallback: system TTS (Luca Enhanced on iPhone, Alice on Mac)
        if (!window.speechSynthesis) return;
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = 'it-IT';
        utt.rate = 0.85;
        speechSynthesis.speak(utt);
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

    const prevErr = sessionStorage.getItem('parlo_auth_err');
    if (prevErr) {
        sessionStorage.removeItem('parlo_auth_err');
        error.textContent = prevErr === 'locked'
            ? 'Access temporarily locked. Please try again later.'
            : 'Incorrect passphrase — try again';
        error.classList.remove('hidden');
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

// ── Settings ──────────────────────────────────────────────────────────────

function initSettings() {
    const btn     = document.getElementById('settingsBtn');
    const modal   = document.getElementById('settingsModal');
    const overlay = document.getElementById('settingsOverlay');
    const input   = document.getElementById('elKeyInput');
    const save    = document.getElementById('settingsSaveBtn');
    const cancel  = document.getElementById('settingsCancelBtn');

    const open  = () => { input.value = localStorage.getItem(EL_KEY_STORE) || ''; modal.classList.remove('hidden'); };
    const close = () => modal.classList.add('hidden');

    btn.addEventListener('click', open);
    overlay.addEventListener('click', close);
    cancel.addEventListener('click', close);
    save.addEventListener('click', () => {
        const val = input.value.trim();
        if (val) localStorage.setItem(EL_KEY_STORE, val);
        else localStorage.removeItem(EL_KEY_STORE);
        close();
    });
}

// ── App launch ────────────────────────────────────────────────────────────

function launchApp() {
    document.getElementById('app').classList.remove('hidden');
    loadStats();
    updateStreak();
    initTabs();
    initSettings();
    // Boot the default tab (Cards/vocab)
    if (typeof initVocab === 'function') { tabInited.vocab = true; initVocab(); }
}

// ── Tabs ──────────────────────────────────────────────────────────────────

const tabInited = {};
const tabInitFns = { chat: 'initChat', vocab: 'initVocab', translate: 'initTranslate', verbs: 'initVerbs' };

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
