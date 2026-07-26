'use strict';

let translateInited = false;
let lastTranslation = null; // { italian, english, pronunciation }

const PRONOUNS = ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'];
const VERB_CACHE_KEY = 'parlo_v2_verb_cache';

function initTranslate() {
    if (translateInited) return;
    translateInited = true;

    document.getElementById('translateBtn').addEventListener('click', doTranslate);
    document.getElementById('translateInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doTranslate(); }
    });
    const addToCardsEl = document.getElementById('addToCardsBtn');
    if (addToCardsEl) addToCardsEl.addEventListener('click', doAddToCards);
}

function showToast(msg) {
    let toast = document.getElementById('parloToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'parloToast';
        toast.className = 'parlo-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('parlo-toast--show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('parlo-toast--show'), 2500);
}

function doAddToCards() {
    if (!lastTranslation) return;
    const btn = document.getElementById('addToCardsBtn');

    let cards = [];
    try { cards = JSON.parse(localStorage.getItem('parlo_v2_custom') || '[]'); } catch {}

    if (cards.some(c => c.italian === lastTranslation.italian)) {
        showToast('Already in your Cards!');
        btn.textContent = 'Already in Cards';
        btn.disabled = true;
        return;
    }

    cards.push(lastTranslation);
    localStorage.setItem('parlo_v2_custom', JSON.stringify(cards));
    btn.textContent = '✓ Added';
    btn.disabled = true;
    showToast(`"${lastTranslation.italian}" added to Cards!`);
}

async function doTranslate() {
    const text = document.getElementById('translateInput').value.trim();
    if (!text) return;

    const btn    = document.getElementById('translateBtn');
    const addBtn = document.getElementById('addToCardsBtn');
    btn.disabled    = true;
    btn.textContent = 'Translating…';
    if (addBtn) { addBtn.textContent = '+ Add to Cards'; addBtn.disabled = false; }
    lastTranslation = null;

    const result = document.getElementById('translateResult');
    result.classList.add('hidden');

    const verbSection = document.getElementById('translateVerbSection');
    verbSection.classList.add('hidden');
    verbSection.innerHTML = '';

    try {
        const data = await parlo.callClaude('translate', [
            { role: 'user', content: text }
        ]);

        const raw    = data.content?.[0]?.text || '{}';
        const parsed = parlo.parseJSON(raw) || {};

        document.getElementById('translateMain').textContent  = parsed.translation || '';
        document.getElementById('translatePronun').textContent = parsed.pronunciation
            ? '/' + parsed.pronunciation + '/'
            : '';

        const breakdownEl = document.getElementById('translateBreakdown');
        breakdownEl.innerHTML = '';

        if (Array.isArray(parsed.breakdown) && parsed.breakdown.length) {
            const table = document.createElement('table');
            table.className = 'breakdown-table';

            const thead = document.createElement('thead');
            const hr    = document.createElement('tr');
            ['Word', 'Meaning', 'Grammar'].forEach(h => {
                const th = document.createElement('th');
                th.textContent = h;
                hr.appendChild(th);
            });
            thead.appendChild(hr);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            parsed.breakdown.forEach(item => {
                const row = document.createElement('tr');
                [item.word || '', item.translation || '', item.grammar || ''].forEach(val => {
                    const td = document.createElement('td');
                    td.textContent = val;
                    row.appendChild(td);
                });
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            breakdownEl.appendChild(table);
        }

        const examplesEl = document.getElementById('translateExamples');
        examplesEl.innerHTML = '';
        if (Array.isArray(parsed.examples) && parsed.examples.length) {
            const heading = document.createElement('div');
            heading.className = 'examples-heading';
            heading.textContent = 'Examples';
            examplesEl.appendChild(heading);
            parsed.examples.forEach(ex => {
                const item = document.createElement('div');
                item.className = 'example-item';
                const itEl = document.createElement('div');
                itEl.className = 'example-italian';
                itEl.textContent = ex.italian || '';
                const enEl = document.createElement('div');
                enEl.className = 'example-english';
                enEl.textContent = ex.english || '';
                const speakBtn = document.createElement('button');
                speakBtn.className = 'example-speak-btn';
                speakBtn.title = 'Listen';
                speakBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
                speakBtn.addEventListener('click', () => parlo.speakItalian(ex.italian));
                item.append(speakBtn, itEl, enEl);
                examplesEl.appendChild(item);
            });
        }

        result.classList.remove('hidden');

        // Speak Italian + store card data (italian always on front)
        const hasAccents = /[àèéìòùâêîôûäëïöü]/i.test(text);
        if (!hasAccents && parsed.translation) {
            parlo.speakItalian(parsed.translation);
            lastTranslation = { italian: parsed.translation, english: text, pronunciation: parsed.pronunciation || '' };
        } else {
            parlo.speakItalian(text);
            lastTranslation = { italian: text, english: parsed.translation || '', pronunciation: parsed.pronunciation || '' };
        }

        if (looksLikeVerb(text, parsed.breakdown) && lastTranslation) {
            maybeAutoConjugate(lastTranslation.italian);
        }

    } catch (e) {
        console.error('Translate error:', e);
        document.getElementById('translateMain').textContent  = 'Translation failed — check your connection.';
        document.getElementById('translatePronun').textContent = '';
        document.getElementById('translateBreakdown').innerHTML = '';
        result.classList.remove('hidden');
    }

    btn.disabled    = false;
    btn.textContent = 'Translate';
}

// ── Auto-conjugation (folded in from the old Verbs tab) ────────────────────

function looksLikeVerb(text, breakdown) {
    const words = text.trim().split(/\s+/);
    if (words.length !== 1) return false;
    const first = Array.isArray(breakdown) && breakdown[0];
    return !!(first && /\bverb\b/i.test(first.grammar || ''));
}

function getCachedVerb(verb) {
    try {
        const cache = JSON.parse(localStorage.getItem(VERB_CACHE_KEY) || '{}');
        return cache[verb.toLowerCase()] || null;
    } catch { return null; }
}

function setCachedVerb(verb, data) {
    try {
        const cache = JSON.parse(localStorage.getItem(VERB_CACHE_KEY) || '{}');
        cache[verb.toLowerCase()] = data;
        localStorage.setItem(VERB_CACHE_KEY, JSON.stringify(cache));
    } catch {}
}

async function maybeAutoConjugate(verb) {
    const section = document.getElementById('translateVerbSection');
    section.classList.remove('hidden');
    section.innerHTML = '<div class="verb-loading"><span></span><span></span><span></span></div>';

    const cached = getCachedVerb(verb);
    if (cached) { renderConjugation(section, cached); return; }

    try {
        const data = await parlo.callClaude('conjugate', [{ role: 'user', content: verb }]);
        const raw     = data.content?.[0]?.text || '{}';
        const parsed  = parlo.parseJSON(raw) || {};
        if (parsed.error) { section.classList.add('hidden'); section.innerHTML = ''; return; }
        setCachedVerb(verb, parsed);
        renderConjugation(section, parsed);
    } catch {
        section.classList.add('hidden');
        section.innerHTML = '';
    }
}

function renderConjugation(container, data) {
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'verb-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'verb-title';
    titleEl.textContent = data.verb;

    const englishEl = document.createElement('span');
    englishEl.className = 'verb-english';
    englishEl.textContent = data.english;

    const speakBtn = document.createElement('button');
    speakBtn.className = 'verb-speak-btn';
    speakBtn.title = 'Listen';
    speakBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    speakBtn.addEventListener('click', () => parlo.speakItalian(data.verb));

    header.appendChild(titleEl);
    header.appendChild(englishEl);
    header.appendChild(speakBtn);
    container.appendChild(header);

    const wrap = document.createElement('div');
    wrap.className = 'verb-table-wrap';

    const table = document.createElement('table');
    table.className = 'verb-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const emptyTh = document.createElement('th');
    headerRow.appendChild(emptyTh);
    data.tenses.forEach(t => {
        const th = document.createElement('th');
        const nameEl = document.createElement('span');
        nameEl.className = 'tense-name';
        nameEl.textContent = t.name;
        const enEl = document.createElement('span');
        enEl.className = 'tense-english';
        enEl.textContent = t.english;
        th.appendChild(nameEl);
        th.appendChild(enEl);
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    PRONOUNS.forEach(pronoun => {
        const tr = document.createElement('tr');

        const tdPronoun = document.createElement('td');
        tdPronoun.className = 'verb-pronoun';
        tdPronoun.textContent = pronoun;
        tr.appendChild(tdPronoun);

        data.tenses.forEach(t => {
            const td = document.createElement('td');
            td.className = 'verb-form';
            const raw = t.forms && t.forms[pronoun];
            const italian = raw ? (raw.italian || raw) : '—';
            const english = raw && raw.english ? raw.english : null;

            const itEl = document.createElement('span');
            itEl.className = 'verb-form-it';
            itEl.textContent = italian;
            td.appendChild(itEl);

            if (english) {
                const enEl = document.createElement('span');
                enEl.className = 'verb-form-en';
                enEl.textContent = english;
                td.appendChild(enEl);
            }

            td.title = 'Tap to hear';
            td.addEventListener('click', () => parlo.speakItalian(italian));
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
}
