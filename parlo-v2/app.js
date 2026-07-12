'use strict';

const WORKER_URL  = 'https://parlo-proxy.adamlarkin.workers.dev';
const AUTH_KEY    = 'parlo_v2_auth';
const STREAK_KEY  = 'parlo_v2_streak';
const WORDS_KEY   = 'parlo_v2_words';
const EL_KEY_STORE   = 'parlo_v2_el_key';
const EL_VOICE_ID    = 'pNInz6obpgDQGcFmaJgB'; // Adam — free tier compatible
const SYNC_META_KEY  = 'parlo_v2_synced_at';
const SYNC_DATA_KEYS = ['parlo_v2_srs', 'parlo_v2_custom', 'parlo_v2_streak', 'parlo_v2_words'];

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

    async callSync(action, payload = {}) {
        const res = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Parlo-Auth': this.getPassphrase(),
            },
            body: JSON.stringify({ action, ...payload }),
        });
        if (res.status === 401) {
            const body = await res.json().catch(() => ({}));
            sessionStorage.setItem('parlo_auth_err', body.locked ? 'locked' : 'wrong');
            localStorage.removeItem(AUTH_KEY);
            location.reload();
            throw new Error('Unauthorized');
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    },

    async callRepeat(original, userItalian, userEnglish) {
        const res = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Parlo-Auth': this.getPassphrase(),
            },
            body: JSON.stringify({ action: 'repeat', original, userItalian, userEnglish }),
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
                    await new Promise(resolve => {
                        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
                        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
                        audio.play().catch(resolve);
                    });
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
        await new Promise(resolve => {
            const utt = new SpeechSynthesisUtterance(text);
            utt.lang = 'it-IT';
            utt.rate = 0.85;
            utt.onend = resolve;
            utt.onerror = resolve;
            speechSynthesis.speak(utt);
        });
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

    async function attempt() {
        const val = input.value.trim();
        if (!val) return;
        error.classList.add('hidden');
        btn.disabled = true;
        btn.textContent = '…';

        try {
            const res = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Parlo-Auth': val },
                body: JSON.stringify({ action: 'ping' }),
            });

            if (res.status === 401) {
                const body = await res.json().catch(() => ({}));
                error.textContent = body.locked
                    ? 'Access temporarily locked. Please try again later.'
                    : 'Incorrect passphrase — try again';
                error.classList.remove('hidden');
                btn.disabled = false;
                btn.textContent = 'Continue';
                return;
            }

            if (res.ok) {
                localStorage.setItem(AUTH_KEY, val);
                overlay.classList.add('hidden');
                launchApp();
                return;
            }

            throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            if (e.message !== 'Unauthorized') {
                error.textContent = 'Connection error — please try again';
                error.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.textContent = 'Continue';
        }
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
        // If empty, leave existing key alone — don't silently delete it
        close();
    });
}

// ── Cross-device sync ─────────────────────────────────────────────────────

async function syncPull() {
    try {
        const res = await parlo.callSync('syncPull');
        if (!res?.data) return;

        const remoteSyncedAt = res.data.syncedAt || 0;
        const localSyncedAt  = parseInt(localStorage.getItem(SYNC_META_KEY) || '0', 10);
        if (remoteSyncedAt <= localSyncedAt) return; // local is already up to date

        for (const key of SYNC_DATA_KEYS) {
            if (res.data[key] == null) continue;
            if (key === WORDS_KEY) {
                // Words can only grow — take the max across devices
                const remoteVal = parseInt(res.data[key], 10) || 0;
                const localVal  = parseInt(localStorage.getItem(key) || '0', 10);
                localStorage.setItem(key, String(Math.max(remoteVal, localVal)));
            } else {
                const val = res.data[key];
                localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            }
        }
        localStorage.setItem(SYNC_META_KEY, String(remoteSyncedAt));
    } catch (e) {
        console.warn('Sync pull failed:', e);
    }
}

async function syncPush() {
    try {
        const now  = Date.now();
        const data = { syncedAt: now };
        for (const key of SYNC_DATA_KEYS) {
            const raw = localStorage.getItem(key);
            if (raw == null) continue;
            try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
        }
        await parlo.callSync('syncPush', { data });
        localStorage.setItem(SYNC_META_KEY, String(now));
    } catch (e) {
        console.warn('Sync push failed:', e);
    }
}

function initSync() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') syncPush();
    });
    window.addEventListener('pagehide', syncPush);
}

// ── App launch ────────────────────────────────────────────────────────────

async function launchApp() {
    document.getElementById('app').classList.remove('hidden');
    await syncPull(); // pull before rendering so stats and SRS data are current
    loadStats();
    updateStreak();
    initTabs();
    initSettings();
    initSync();
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
