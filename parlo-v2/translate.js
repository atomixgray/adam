'use strict';

let translateInited = false;
let lastTranslation = null; // { italian, english, pronunciation }

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

    try {
        const data = await parlo.callClaude('translate', [
            { role: 'user', content: text }
        ]);

        const raw    = data.content?.[0]?.text || '{}';
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);

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
