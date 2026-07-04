'use strict';

let translateInited = false;

function initTranslate() {
    if (translateInited) return;
    translateInited = true;

    document.getElementById('translateBtn').addEventListener('click', doTranslate);
    document.getElementById('translateInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doTranslate(); }
    });
}

async function doTranslate() {
    const text = document.getElementById('translateInput').value.trim();
    if (!text) return;

    const btn = document.getElementById('translateBtn');
    btn.disabled    = true;
    btn.textContent = 'Translating…';

    const result = document.getElementById('translateResult');
    result.classList.add('hidden');

    try {
        const data = await parlo.callClaude('translate', [
            { role: 'user', content: text }
        ]);

        const raw    = data.content?.[0]?.text || '{}';
        const parsed = JSON.parse(raw);

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

        result.classList.remove('hidden');

        // Speak Italian: if input looks English (no accented chars), speak the translation
        const hasAccents = /[àèéìòùâêîôûäëïöü]/i.test(text);
        if (!hasAccents && parsed.translation) {
            parlo.speakItalian(parsed.translation);
        } else {
            parlo.speakItalian(text);
        }

    } catch (e) {
        document.getElementById('translateMain').textContent  = 'Translation failed — check your connection.';
        document.getElementById('translatePronun').textContent = '';
        document.getElementById('translateBreakdown').innerHTML = '';
        result.classList.remove('hidden');
    }

    btn.disabled    = false;
    btn.textContent = 'Translate';
}
