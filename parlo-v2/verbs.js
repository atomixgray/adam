'use strict';

const PRONOUNS = ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'];
const VERB_CACHE_KEY = 'parlo_v2_verb_cache';

const COMMON_VERBS = [
    { verb: 'essere',         english: 'to be' },
    { verb: 'avere',          english: 'to have' },
    { verb: 'fare',           english: 'to do / make' },
    { verb: 'dire',           english: 'to say' },
    { verb: 'andare',         english: 'to go' },
    { verb: 'venire',         english: 'to come' },
    { verb: 'vedere',         english: 'to see' },
    { verb: 'sapere',         english: 'to know (fact)' },
    { verb: 'volere',         english: 'to want' },
    { verb: 'potere',         english: 'to be able / can' },
    { verb: 'dovere',         english: 'to have to / must' },
    { verb: 'dare',           english: 'to give' },
    { verb: 'stare',          english: 'to stay / be' },
    { verb: 'parlare',        english: 'to speak' },
    { verb: 'mangiare',       english: 'to eat' },
    { verb: 'bere',           english: 'to drink' },
    { verb: 'dormire',        english: 'to sleep' },
    { verb: 'lavorare',       english: 'to work' },
    { verb: 'studiare',       english: 'to study' },
    { verb: 'leggere',        english: 'to read' },
    { verb: 'scrivere',       english: 'to write' },
    { verb: 'capire',         english: 'to understand' },
    { verb: 'sentire',        english: 'to hear / feel' },
    { verb: 'aprire',         english: 'to open' },
    { verb: 'chiudere',       english: 'to close' },
    { verb: 'partire',        english: 'to leave / depart' },
    { verb: 'arrivare',       english: 'to arrive' },
    { verb: 'tornare',        english: 'to return' },
    { verb: 'uscire',         english: 'to go out' },
    { verb: 'entrare',        english: 'to enter' },
    { verb: 'portare',        english: 'to carry / bring' },
    { verb: 'prendere',       english: 'to take' },
    { verb: 'mettere',        english: 'to put' },
    { verb: 'trovare',        english: 'to find' },
    { verb: 'lasciare',       english: 'to leave / let' },
    { verb: 'aspettare',      english: 'to wait' },
    { verb: 'chiamare',       english: 'to call' },
    { verb: 'pagare',         english: 'to pay' },
    { verb: 'comprare',       english: 'to buy' },
    { verb: 'vendere',        english: 'to sell' },
    { verb: 'abitare',        english: 'to live / reside' },
    { verb: 'vivere',         english: 'to live' },
    { verb: 'camminare',      english: 'to walk' },
    { verb: 'correre',        english: 'to run' },
    { verb: 'giocare',        english: 'to play' },
    { verb: 'cantare',        english: 'to sing' },
    { verb: 'ballare',        english: 'to dance' },
    { verb: 'ridere',         english: 'to laugh' },
    { verb: 'piangere',       english: 'to cry' },
    { verb: 'pensare',        english: 'to think' },
    { verb: 'credere',        english: 'to believe' },
    { verb: 'conoscere',      english: 'to know (person)' },
    { verb: 'ricordare',      english: 'to remember' },
    { verb: 'dimenticare',    english: 'to forget' },
    { verb: 'aiutare',        english: 'to help' },
    { verb: 'rispondere',     english: 'to answer' },
    { verb: 'chiedere',       english: 'to ask' },
    { verb: 'spiegare',       english: 'to explain' },
    { verb: 'imparare',       english: 'to learn' },
    { verb: 'insegnare',      english: 'to teach' },
    { verb: 'finire',         english: 'to finish' },
    { verb: 'iniziare',       english: 'to start' },
    { verb: 'cominciare',     english: 'to begin' },
    { verb: 'smettere',       english: 'to stop doing' },
    { verb: 'continuare',     english: 'to continue' },
    { verb: 'cadere',         english: 'to fall' },
    { verb: 'alzarsi',        english: 'to get up' },
    { verb: 'sedersi',        english: 'to sit down' },
    { verb: 'svegliarsi',     english: 'to wake up' },
    { verb: 'addormentarsi',  english: 'to fall asleep' },
    { verb: 'vestirsi',       english: 'to get dressed' },
    { verb: 'lavarsi',        english: 'to wash oneself' },
    { verb: 'cucinare',       english: 'to cook' },
    { verb: 'pulire',         english: 'to clean' },
    { verb: 'guardare',       english: 'to watch / look' },
    { verb: 'ascoltare',      english: 'to listen' },
    { verb: 'incontrare',     english: 'to meet' },
    { verb: 'seguire',        english: 'to follow' },
    { verb: 'perdere',        english: 'to lose' },
    { verb: 'vincere',        english: 'to win' },
    { verb: 'scegliere',      english: 'to choose' },
    { verb: 'provare',        english: 'to try' },
    { verb: 'cercare',        english: 'to look for' },
    { verb: 'mostrare',       english: 'to show' },
    { verb: 'usare',          english: 'to use' },
    { verb: 'mandare',        english: 'to send' },
    { verb: 'ricevere',       english: 'to receive' },
    { verb: 'salire',         english: 'to go up / board' },
    { verb: 'scendere',       english: 'to go down / get off' },
    { verb: 'guidare',        english: 'to drive' },
    { verb: 'viaggiare',      english: 'to travel' },
    { verb: 'nuotare',        english: 'to swim' },
    { verb: 'sorridere',      english: 'to smile' },
    { verb: 'cambiare',       english: 'to change' },
    { verb: 'costruire',      english: 'to build' },
    { verb: 'crescere',       english: 'to grow' },
    { verb: 'decidere',       english: 'to decide' },
    { verb: 'diventare',      english: 'to become' },
    { verb: 'offrire',        english: 'to offer' },
    { verb: 'preferire',      english: 'to prefer' },
    { verb: 'passare',        english: 'to pass / spend time' },
    { verb: 'spendere',       english: 'to spend money' },
    { verb: 'succedere',      english: 'to happen' },
    { verb: 'fermarsi',       english: 'to stop / halt' },
];

let verbInited = false;

function initVerbs() {
    if (verbInited) return;
    verbInited = true;

    const input        = document.getElementById('verbInput');
    const suggestions  = document.getElementById('verbSuggestions');
    const randomBtn    = document.getElementById('verbRandomBtn');
    const conjugateBtn = document.getElementById('verbConjugateBtn');

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        if (!val) { suggestions.classList.add('hidden'); return; }
        const matches = COMMON_VERBS.filter(v =>
            v.verb.startsWith(val) || v.english.includes(val)
        ).slice(0, 6);
        if (!matches.length) { suggestions.classList.add('hidden'); return; }
        suggestions.innerHTML = '';
        matches.forEach(m => {
            const item = document.createElement('button');
            item.className = 'verb-suggestion-item';
            const verbEl = document.createElement('span');
            verbEl.className = 'verb-sug-verb';
            verbEl.textContent = m.verb;
            const enEl = document.createElement('span');
            enEl.className = 'verb-sug-en';
            enEl.textContent = m.english;
            item.appendChild(verbEl);
            item.appendChild(enEl);
            item.addEventListener('click', () => {
                input.value = m.verb;
                suggestions.classList.add('hidden');
                conjugateVerb(m.verb);
            });
            suggestions.appendChild(item);
        });
        suggestions.classList.remove('hidden');
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); suggestions.classList.add('hidden'); conjugateVerb(input.value.trim()); }
        if (e.key === 'Escape') suggestions.classList.add('hidden');
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.verb-search-wrap')) suggestions.classList.add('hidden');
    });

    randomBtn.addEventListener('click', () => {
        const v = COMMON_VERBS[Math.floor(Math.random() * COMMON_VERBS.length)];
        input.value = v.verb;
        suggestions.classList.add('hidden');
        conjugateVerb(v.verb);
    });

    conjugateBtn.addEventListener('click', () => {
        suggestions.classList.add('hidden');
        conjugateVerb(input.value.trim());
    });
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

async function conjugateVerb(verb) {
    if (!verb) return;
    const result = document.getElementById('verbResult');
    result.classList.remove('hidden');

    const cached = getCachedVerb(verb);
    if (cached) {
        renderConjugation(result, cached);
        return;
    }

    result.innerHTML = '<div class="verb-loading"><span></span><span></span><span></span></div>';

    try {
        const data = await parlo.callClaude('conjugate', [{ role: 'user', content: verb }]);
        const raw     = data.content?.[0]?.text || '{}';
        const match   = raw.match(/\{[\s\S]*\}/);
        const parsed  = JSON.parse(match ? match[0] : raw);

        if (parsed.error) {
            result.innerHTML = '';
            const errEl = document.createElement('div');
            errEl.className = 'verb-error';
            errEl.textContent = parsed.error;
            result.appendChild(errEl);
            return;
        }

        setCachedVerb(verb, parsed);
        renderConjugation(result, parsed);
    } catch {
        result.innerHTML = '';
        const errEl = document.createElement('div');
        errEl.className = 'verb-error';
        errEl.textContent = 'Could not load conjugation — check your connection.';
        result.appendChild(errEl);
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
