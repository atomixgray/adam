// ============================================================
// Parlo v2 — Practice (Sentence Expansion Ladder)
// ============================================================

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-8b-8192';
const API_KEY_STORAGE = 'parlo_v2_groq_key';
const STATS_STORAGE = 'parlo_v2_practice_stats';
const PREFS_STORAGE = 'parlo_v2_practice_prefs';

// ---- Scenarios: concrete everyday situations with Italian starter sentences ----
const SCENARIOS = [
    { context: 'Your morning routine', starter: 'Ogni mattina mi sveglio tardi', starterEn: 'Every morning I wake up late' },
    { context: 'Your apartment', starter: 'Il mio appartamento non è grande', starterEn: "My apartment isn't big" },
    { context: 'At the café near work', starter: "Di solito vado al bar vicino all'ufficio", starterEn: 'I usually go to the café near the office' },
    { context: 'Weekend plans', starter: 'Questo fine settimana voglio riposarmi', starterEn: 'This weekend I want to rest' },
    { context: 'Italian food', starter: 'Mi piace molto la cucina italiana', starterEn: 'I really like Italian cuisine' },
    { context: 'Learning Italian', starter: "Studio l'italiano da qualche mese", starterEn: "I've been studying Italian for a few months" },
    { context: 'A difficult day at work', starter: 'Oggi ho avuto una riunione difficile', starterEn: 'Today I had a difficult meeting' },
    { context: 'Your neighborhood', starter: 'Il mio quartiere è abbastanza tranquillo', starterEn: 'My neighborhood is quite quiet' },
    { context: 'Making plans with a friend', starter: 'Domani sera sono libero', starterEn: "Tomorrow evening I'm free" },
    { context: 'Wanting to visit Italy', starter: "Vorrei visitare l'Italia un giorno", starterEn: 'I would like to visit Italy one day' },
    { context: 'Your daily commute', starter: 'Vado al lavoro in treno ogni giorno', starterEn: 'I go to work by train every day' },
    { context: 'A film you watched', starter: 'Ieri sera ho guardato un film italiano', starterEn: 'Last night I watched an Italian film' },
    { context: 'The weather today', starter: 'Oggi fa abbastanza freddo', starterEn: "It's quite cold today" },
    { context: 'Your job', starter: 'Lavoro in un ufficio in centro', starterEn: 'I work in an office in the city centre' },
    { context: 'Your health habits', starter: 'Cerco di fare sport ogni settimana', starterEn: 'I try to do sport every week' },
    { context: 'A trip you took', starter: 'La settimana scorsa sono andato a Milano', starterEn: 'Last week I went to Milan' },
];

// ---- Structures: 4 rounds, progressively harder ----
// Each sub-array is a pool for that round — one is picked at random per session.
const STRUCTURES = [
    // Round 1 — A2: basic connectors
    [
        { connector: 'ma / però', label: 'contrast', hint: 'Add a contrast — something that complicates the picture', example: 'però non ho abbastanza tempo.' },
        { connector: 'perché', label: 'reason', hint: 'Add a reason — explain why this is the case', example: "perché mi sveglio sempre in ritardo." },
        { connector: 'e poi', label: 'sequence', hint: 'Add what happens next in the sequence', example: 'e poi vado a fare colazione.' },
        { connector: 'quindi', label: 'consequence', hint: 'Add a result or consequence', example: 'quindi arrivo sempre tardi in ufficio.' },
    ],
    // Round 2 — A2→B1: time and condition
    [
        { connector: 'quando', label: 'time clause', hint: 'Add a time clause — when something happens', example: 'quando ho tempo libero.' },
        { connector: 'invece', label: 'contrast/alternative', hint: 'Introduce an alternative — instead, or on the other hand', example: 'invece il weekend preferisco stare a casa.' },
        { connector: 'mentre', label: 'simultaneous action', hint: 'Add something that happens at the same time', example: 'mentre ascolto la musica.' },
        { connector: 'se', label: 'condition', hint: 'Add a condition — what happens if...', example: 'se ho voglia di uscire.' },
    ],
    // Round 3 — B1: nuance and complexity
    [
        { connector: 'anche se', label: 'concession', hint: 'Acknowledge a complication — even though / even if...', example: "anche se non sono sempre d'accordo." },
        { connector: 'dato che', label: 'cause', hint: "Give a reason using 'since' or 'given that'", example: 'dato che non ho molto tempo.' },
        { connector: 'in realtà', label: 'reframing', hint: 'Reframe or complicate what you just said — actually...', example: 'in realtà la situazione è più complicata.' },
        { connector: 'non solo... ma anche', label: 'amplification', hint: 'Amplify — not only... but also...', example: 'non solo per rilassarmi, ma anche per imparare.' },
    ],
    // Round 4 — B1→B2: formal and nuanced
    [
        { connector: 'nonostante', label: 'despite', hint: 'Show something happens despite an obstacle', example: 'nonostante le difficoltà.' },
        { connector: 'a condizione che', label: 'formal condition', hint: 'Add a condition in a more emphatic way', example: 'a condizione che abbia abbastanza tempo.' },
        { connector: 'per quanto', label: 'however much', hint: 'Express that something happens regardless of effort', example: 'per quanto ci provi, è difficile.' },
        { connector: 'nel complesso', label: 'overall view', hint: 'Wrap up with an overall perspective', example: "nel complesso, è un'esperienza positiva." },
    ],
];

// ---- State ----
let session = {
    scenario: null,
    builtSentence: '',
    round: 0,
    roundStructures: [],
    aiNextChallenge: '',
};
let aiEnabled = false;
let stats = { completed: 0, sessions: 0, streak: 0 };

// ---- DOM refs ----
const scenarioContext = document.getElementById('scenarioContext');
const paragraphLabel  = document.getElementById('paragraphLabel');
const builtText       = document.getElementById('builtText');
const targetConnector = document.getElementById('targetConnector');
const targetHint      = document.getElementById('targetHint');
const roundDots       = document.getElementById('roundDots').querySelectorAll('.round-dot');
const answerInput     = document.getElementById('answerInput');
const checkBtn        = document.getElementById('checkBtn');
const checkBtnText    = document.getElementById('checkBtnText');
const newScenarioBtn  = document.getElementById('newScenarioBtn');
const newScenarioBtn2 = document.getElementById('newScenarioBtn2');
const feedbackBox     = document.getElementById('feedbackBox');
const feedbackContent = document.getElementById('feedbackContent');
const continueBtn     = document.getElementById('continueBtn');
const completionBox   = document.getElementById('completionBox');
const completionText  = document.getElementById('completionText');
const aiToggle        = document.getElementById('aiToggle');
const aiStatus        = document.getElementById('aiStatus');
const apiKeyBtn       = document.getElementById('apiKeyBtn');
const apiModal        = document.getElementById('apiModal');
const modalOverlay    = document.getElementById('modalOverlay');
const apiKeyInput     = document.getElementById('apiKeyInput');
const saveApiKeyBtn   = document.getElementById('saveApiKeyBtn');
const cancelApiKeyBtn = document.getElementById('cancelApiKeyBtn');
const statCompleted   = document.getElementById('statCompleted');
const statSessions    = document.getElementById('statSessions');
const statStreak      = document.getElementById('statStreak');

// ---- API key ----
function getApiKey() { return localStorage.getItem(API_KEY_STORAGE) || ''; }
function saveApiKey(k) { localStorage.setItem(API_KEY_STORAGE, k); }
function hasApiKey() { return !!getApiKey(); }

// ---- AI status ----
function updateAiStatus() {
    if (hasApiKey() && aiEnabled) {
        aiStatus.textContent = 'AI feedback active';
        aiStatus.className = 'ai-status ready';
        apiKeyBtn.classList.remove('hidden');
    } else if (hasApiKey()) {
        aiStatus.textContent = 'API key saved — toggle on to enable';
        aiStatus.className = 'ai-status';
        apiKeyBtn.classList.remove('hidden');
    } else {
        aiStatus.textContent = 'Setup your API key to enable AI features';
        aiStatus.className = 'ai-status';
        apiKeyBtn.classList.add('hidden');
    }
}

// ---- Session ----
function startSession() {
    const idx = Math.floor(Math.random() * SCENARIOS.length);
    session.scenario = SCENARIOS[idx];
    session.builtSentence = session.scenario.starter;
    session.round = 0;
    session.roundStructures = STRUCTURES.map(tier => tier[Math.floor(Math.random() * tier.length)]);
    session.aiNextChallenge = '';

    stats.sessions++;
    saveStats();
    updateStatsUI();

    renderRound();
}

function renderRound() {
    const { scenario, builtSentence, round, roundStructures, aiNextChallenge } = session;
    const structure = roundStructures[round];

    scenarioContext.textContent = scenario.context;

    builtText.textContent = builtSentence;
    paragraphLabel.textContent = round === 0
        ? `Starter sentence — ${scenario.starterEn}`
        : `Your sentence — ${round} addition${round !== 1 ? 's' : ''} so far`;

    targetConnector.textContent = structure.connector;
    targetHint.textContent = (round > 0 && aiNextChallenge)
        ? aiNextChallenge
        : `${structure.hint} — e.g. "${structure.example}"`;

    roundDots.forEach((dot, i) => {
        dot.classList.toggle('active', i === round);
        dot.classList.toggle('done', i < round);
    });

    answerInput.value = '';
    answerInput.placeholder = `Continue using "${structure.connector}"...`;
    feedbackBox.classList.add('hidden');
    completionBox.classList.add('hidden');
    checkBtn.disabled = false;
    checkBtnText.textContent = 'Check';

    setTimeout(() => answerInput.focus(), 100);
}

// ---- Groq API ----
async function callGroq(messages, maxTokens = 200) {
    const key = getApiKey();
    if (!key) throw new Error('No API key');
    const res = await fetch(GROQ_API, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: maxTokens, temperature: 0.7 }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'API request failed');
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

// ---- Check answer ----
async function checkAnswer() {
    const addition = answerInput.value.trim();
    if (!addition) { answerInput.focus(); return; }

    checkBtnText.innerHTML = '<span class="loading"></span>Checking...';
    checkBtn.disabled = true;

    const structure = session.roundStructures[session.round];
    const isLast = session.round === 3;
    const nextStructure = isLast ? null : session.roundStructures[session.round + 1];

    // Commit addition to built sentence
    const cleaned = addition.replace(/^[,;\s]+/, '');
    session.builtSentence += ' ' + cleaned;

    stats.completed++;
    stats.streak++;
    saveStats();
    updateStatsUI();

    if (aiEnabled && hasApiKey()) {
        try {
            let promptText;
            if (isLast) {
                promptText = `You are a warm Italian language tutor.
A student is building a sentence by adding clauses step by step.

Target connector for this addition: "${structure.connector}"
Student's addition: "${addition}"
Full sentence built: "${session.builtSentence}"

This is the final round. In 2-3 sentences: evaluate their addition (correct any errors, or praise if correct), then briefly celebrate that they completed the full paragraph. Be warm and specific. Max 80 words.`;
            } else {
                promptText = `You are a warm Italian language tutor.
A student is building a sentence by adding clauses step by step.

Target connector for this addition: "${structure.connector}"
Student's addition: "${addition}"
Sentence so far: "${session.builtSentence}"
Next target connector: "${nextStructure.connector}" (${nextStructure.label})

Reply in this exact format (use the pipe character to separate): [evaluation] | [next challenge]
- [evaluation]: 1 sentence. Correct any Italian error briefly, or say "Perfetto!" if correct.
- [next challenge]: Start with "Ora," and give a specific instruction to continue the sentence using "${nextStructure.connector}". Reference the sentence content if possible. 1 sentence.
Max 60 words total.`;
            }

            const response = await callGroq([{ role: 'user', content: promptText }]);

            let evaluation = response;
            let nextChallenge = '';

            if (!isLast) {
                const pipe = response.indexOf('|');
                if (pipe !== -1) {
                    evaluation = response.slice(0, pipe).trim();
                    nextChallenge = response.slice(pipe + 1).trim();
                } else {
                    nextChallenge = `Ora, usa "${nextStructure.connector}" per continuare.`;
                }
            }

            session.aiNextChallenge = nextChallenge;
            showFeedback(evaluation, isLast);
        } catch (err) {
            session.aiNextChallenge = '';
            showFeedback(`Couldn't reach AI (${err.message}). Keep going!`, isLast);
        }
    } else {
        session.aiNextChallenge = '';
        const noAiMsg = isLast
            ? `Session complete! One example ending: "${structure.example}"`
            : `One way to use "${structure.connector}": "${structure.example}"`;
        showFeedback(noAiMsg, isLast);
    }
}

function showFeedback(text, isLast) {
    feedbackContent.textContent = text;
    feedbackBox.classList.remove('hidden');

    if (isLast) {
        continueBtn.textContent = 'See your paragraph →';
        continueBtn.onclick = showCompletion;
    } else {
        continueBtn.textContent = `Continue to round ${session.round + 2} of 4 →`;
        continueBtn.onclick = nextRound;
    }

    checkBtnText.textContent = 'Check';
    checkBtn.disabled = false;
    feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nextRound() {
    session.round++;
    renderRound();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCompletion() {
    feedbackBox.classList.add('hidden');
    completionText.textContent = session.builtSentence;
    completionBox.classList.remove('hidden');
    completionBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---- Stats ----
function loadStats() {
    try {
        const saved = JSON.parse(localStorage.getItem(STATS_STORAGE));
        if (saved) stats = { ...stats, ...saved };
    } catch {}
    updateStatsUI();
}

function saveStats() {
    try { localStorage.setItem(STATS_STORAGE, JSON.stringify(stats)); } catch {}
}

function updateStatsUI() {
    statCompleted.textContent = stats.completed;
    statSessions.textContent = stats.sessions;
    statStreak.textContent = stats.streak;
}

// ---- Events ----
checkBtn.addEventListener('click', checkAnswer);
answerInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) checkAnswer();
});

newScenarioBtn.addEventListener('click', () => {
    stats.streak = 0;
    saveStats();
    updateStatsUI();
    startSession();
});
newScenarioBtn2.addEventListener('click', startSession);

aiToggle.addEventListener('change', () => {
    aiEnabled = aiToggle.checked;
    if (aiEnabled && !hasApiKey()) {
        openModal();
        aiToggle.checked = false;
        aiEnabled = false;
    }
    updateAiStatus();
    savePrefs();
});

apiKeyBtn.addEventListener('click', openModal);

// ---- Modal ----
function openModal() {
    apiKeyInput.value = getApiKey();
    apiModal.classList.remove('hidden');
    setTimeout(() => apiKeyInput.focus(), 100);
}

function closeModal() { apiModal.classList.add('hidden'); }

saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) { saveApiKey(key); updateAiStatus(); }
    closeModal();
});
cancelApiKeyBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);
apiKeyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveApiKeyBtn.click();
    if (e.key === 'Escape') closeModal();
});

// ---- Prefs ----
function savePrefs() {
    try { localStorage.setItem(PREFS_STORAGE, JSON.stringify({ aiEnabled })); } catch {}
}

function loadPrefs() {
    try {
        const saved = JSON.parse(localStorage.getItem(PREFS_STORAGE));
        if (saved) {
            aiEnabled = hasApiKey() ? (saved.aiEnabled || false) : false;
            aiToggle.checked = aiEnabled;
        }
    } catch {}
}

// ---- Mode switching ----
let practiceMode = 'build';

document.getElementById('modeBuildBtn').addEventListener('click', () => setMode('build'));
document.getElementById('modeDrillBtn').addEventListener('click', () => setMode('drill'));

function setMode(mode) {
    practiceMode = mode;
    document.getElementById('buildSection').classList.toggle('hidden', mode !== 'build');
    document.getElementById('drillSection').classList.toggle('hidden', mode !== 'drill');
    document.getElementById('modeBuildBtn').classList.toggle('active', mode === 'build');
    document.getElementById('modeDrillBtn').classList.toggle('active', mode === 'drill');
    if (mode === 'drill' && drillQueue.length === 0) initDrill();
}

// ============================================================
// Drill mode — verb conjugation practice
// ============================================================

// Helper: generate drill cards for a verb across all 6 persons.
// altForms = feminine/plural variants for essere-aux verbs.
function mkd(verb, tense, forms, examples, altForms) {
    return ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'].map((p, i) => ({
        verb, person: p, tense,
        answers: altForms ? [forms[i], altForms[i]] : [forms[i]],
        display: altForms ? forms[i] + ' / ' + altForms[i] : forms[i],
        example: examples[i]
    }));
}

const DRILLS = {
    congiuntivo: [
        ...mkd('essere', 'congiuntivo presente',
            ['sia', 'sia', 'sia', 'siamo', 'siate', 'siano'],
            ['Penso che io sia troppo stanco per uscire.', 'Non credo che tu sia pronto.', 'Sembra che lei sia già partita.', 'Bisogna che noi siamo puntuali.', 'Voglio che voi siate onesti.', 'È importante che loro siano presenti.']),
        ...mkd('avere', 'congiuntivo presente',
            ['abbia', 'abbia', 'abbia', 'abbiamo', 'abbiate', 'abbiano'],
            ['Spero che io abbia capito bene.', 'Non credo che tu abbia ragione.', 'Pare che lui abbia cambiato idea.', 'È necessario che noi abbiamo pazienza.', 'Voglio che voi abbiate rispetto.', 'Speriamo che loro abbiano successo.']),
        ...mkd('fare', 'congiuntivo presente',
            ['faccia', 'faccia', 'faccia', 'facciamo', 'facciate', 'facciano'],
            ['Dubito che io faccia in tempo.', 'Voglio che tu faccia del tuo meglio.', 'Sembra che lei faccia yoga ogni giorno.', 'Bisogna che noi facciamo presto.', 'È ora che voi facciate qualcosa.', 'Spero che loro facciano attenzione.']),
        ...mkd('andare', 'congiuntivo presente',
            ['vada', 'vada', 'vada', 'andiamo', 'andiate', 'vadano'],
            ['Non credo che io vada al lavoro domani.', 'Voglio che tu vada a letto presto.', 'Sembra che lei vada in Italia questa estate.', 'È importante che noi andiamo insieme.', 'Spero che voi andiate d\'accordo.', 'Bisogna che loro vadano via subito.']),
        ...mkd('venire', 'congiuntivo presente',
            ['venga', 'venga', 'venga', 'veniamo', 'veniate', 'vengano'],
            ['Non so se io venga alla festa.', 'Voglio che tu venga con me.', 'Sembra che lui venga da Milano.', 'È bello che noi veniamo tutti insieme.', 'Spero che voi veniate presto.', 'Voglio che loro vengano alla riunione.']),
        ...mkd('potere', 'congiuntivo presente',
            ['possa', 'possa', 'possa', 'possiamo', 'possiate', 'possano'],
            ['Non credo che io possa venire.', 'Spero che tu possa aiutarmi.', 'Sembra che lei non possa dormire.', 'Bisogna che noi possiamo parlare.', 'È strano che voi non possiate entrare.', 'Spero che loro possano capire.']),
        ...mkd('volere', 'congiuntivo presente',
            ['voglia', 'voglia', 'voglia', 'vogliamo', 'vogliate', 'vogliano'],
            ['Non so se io voglia davvero andare.', 'È strano che tu voglia restare a casa.', 'Sembra che lui voglia cambiare lavoro.', 'È bene che noi vogliamo migliorare.', 'Spero che voi vogliate provare.', 'Sembra che loro vogliano partire.']),
        ...mkd('dovere', 'congiuntivo presente',
            ['debba', 'debba', 'debba', 'dobbiamo', 'dobbiate', 'debbano'],
            ['Non credo che io debba preoccuparmi.', 'È importante che tu debba sapere.', 'Sembra che lui debba lavorare di più.', 'È strano che noi dobbiamo aspettare ancora.', 'Non credo che voi dobbiate pagare.', 'Sembra che loro debbano ricominciare.']),
        ...mkd('sapere', 'congiuntivo presente',
            ['sappia', 'sappia', 'sappia', 'sappiamo', 'sappiate', 'sappiano'],
            ['Non credo che io sappia la risposta.', 'È importante che tu sappia la verità.', 'Sembra che lei sappia già tutto.', 'Bisogna che noi sappiamo cosa fare.', 'È strano che voi non sappiate niente.', 'Spero che loro sappiano cavarsela.']),
        ...mkd('dire', 'congiuntivo presente',
            ['dica', 'dica', 'dica', 'diciamo', 'diciate', 'dicano'],
            ['Non credo che io dica la cosa giusta.', 'Voglio che tu dica la verità.', 'Sembra che lei dica sempre bugie.', 'È importante che noi diciamo la verità.', 'Voglio che voi diciate cosa pensate.', 'Spero che loro dicano di sì.']),
    ],

    condizionale: [
        ...mkd('essere', 'condizionale presente',
            ['sarei', 'saresti', 'sarebbe', 'saremmo', 'sareste', 'sarebbero'],
            ['Sarei molto felice di venire.', 'Saresti un ottimo professore.', 'Sarebbe bello vivere in Italia.', 'Saremmo più felici in campagna.', 'Sareste benvenuti a casa mia.', 'Sarebbero perfetti per questo lavoro.']),
        ...mkd('avere', 'condizionale presente',
            ['avrei', 'avresti', 'avrebbe', 'avremmo', 'avreste', 'avrebbero'],
            ['Avrei voglia di un caffè.', 'Avresti il tempo di aiutarmi?', 'Avrebbe bisogno di riposo.', 'Avremmo bisogno di più tempo.', 'Avreste paura di parlare in pubblico?', 'Avrebbero tutto ciò che vogliono.']),
        ...mkd('fare', 'condizionale presente',
            ['farei', 'faresti', 'farebbe', 'faremmo', 'fareste', 'farebbero'],
            ['Farei volentieri una passeggiata.', 'Faresti lo stesso al mio posto?', 'Farebbe di tutto per aiutarti.', 'Faremmo meglio ad aspettare.', 'Fareste bene a studiare di più.', 'Farebbero qualsiasi cosa per riuscire.']),
        ...mkd('andare', 'condizionale presente',
            ['andrei', 'andresti', 'andrebbe', 'andremmo', 'andreste', 'andrebbero'],
            ['Andrei volentieri in vacanza adesso.', 'Andresti a vivere in Italia?', 'Andrebbe tutto bene con più pratica.', 'Andremmo al mare se non piovesse.', 'Andreste a piedi o in macchina?', 'Andrebbero d\'accordo se si conoscessero.']),
        ...mkd('venire', 'condizionale presente',
            ['verrei', 'verresti', 'verrebbe', 'verremmo', 'verreste', 'verrebbero'],
            ['Verrei alla festa, ma sono stanco.', 'Verresti con me a Roma?', 'Verrebbe, ma ha altri impegni.', 'Verremmo volentieri alla cena.', 'Verreste a trovarci in estate?', 'Verrebbero subito se li chiamassi.']),
        ...mkd('potere', 'condizionale presente',
            ['potrei', 'potresti', 'potrebbe', 'potremmo', 'potreste', 'potrebbero'],
            ['Potrei aiutarti domani mattina.', 'Potresti parlarmi più lentamente?', 'Potrebbe essere una buona idea.', 'Potremmo provare un approccio diverso.', 'Potreste ripetere, per favore?', 'Potrebbero arrivare in ritardo.']),
        ...mkd('volere', 'condizionale presente',
            ['vorrei', 'vorresti', 'vorrebbe', 'vorremmo', 'vorreste', 'vorrebbero'],
            ['Vorrei un caffè e un cornetto.', 'Vorresti venire al cinema stasera?', 'Vorrebbe imparare a cucinare.', 'Vorremmo prenotare un tavolo.', 'Vorreste vivere in Italia?', 'Vorrebbero partire prima possibile.']),
        ...mkd('dovere', 'condizionale presente',
            ['dovrei', 'dovresti', 'dovrebbe', 'dovremmo', 'dovreste', 'dovrebbero'],
            ['Dovrei studiare di più.', 'Dovresti dormire di più.', 'Dovrebbe chiamare i suoi genitori.', 'Dovremmo arrivare entro le nove.', 'Dovreste fare più attenzione.', 'Dovrebbero scusarsi per il ritardo.']),
        ...mkd('sapere', 'condizionale presente',
            ['saprei', 'sapresti', 'saprebbe', 'sapremmo', 'sapreste', 'saprebbero'],
            ['Saprei come risolvere il problema.', 'Sapresti spiegarmi come funziona?', 'Saprebbe cosa fare in questa situazione.', 'Sapremmo dove andare con una mappa.', 'Sapreste guidare in Italia?', 'Saprebbero la risposta se studiassero.']),
        ...mkd('stare', 'condizionale presente',
            ['starei', 'staresti', 'starebbe', 'staremmo', 'stareste', 'starebbero'],
            ['Starei meglio con un po\' di riposo.', 'Staresti bene in montagna.', 'Starebbe meglio se mangiasse di più.', 'Staremmo volentieri ancora un po\'.', 'Stareste più comodi in albergo.', 'Starebbero meglio con meno stress.']),
    ],

    passato: [
        ...mkd('fare', 'passato prossimo',
            ['ho fatto', 'hai fatto', 'ha fatto', 'abbiamo fatto', 'avete fatto', 'hanno fatto'],
            ['Ho fatto colazione tardi questa mattina.', 'Hai fatto bene a dirmelo.', 'Ha fatto una passeggiata nel parco.', 'Abbiamo fatto un ottimo lavoro.', 'Avete fatto una bella scelta.', 'Hanno fatto tardi ieri sera.']),
        ...mkd('venire', 'passato prossimo',
            ['sono venuto', 'sei venuto', 'è venuto', 'siamo venuti', 'siete venuti', 'sono venuti'],
            ['Sono venuto a piedi dall\'ufficio.', 'Sei venuto alla festa di sabato?', 'È venuto da Roma apposta.', 'Siamo venuti prima del previsto.', 'Siete venuti con la macchina?', 'Sono venuti tutti e tre insieme.'],
            ['sono venuta', 'sei venuta', 'è venuta', 'siamo venute', 'siete venute', 'sono venute']),
        ...mkd('essere', 'passato prossimo',
            ['sono stato', 'sei stato', 'è stato', 'siamo stati', 'siete stati', 'sono stati'],
            ['Sono stato in Italia l\'anno scorso.', 'Sei stato mai a Firenze?', 'È stato molto gentile.', 'Siamo stati in ritardo per il traffico.', 'Siete stati bravi questa settimana.', 'Sono stati i migliori della classe.'],
            ['sono stata', 'sei stata', 'è stata', 'siamo state', 'siete state', 'sono state']),
        ...mkd('dire', 'passato prossimo',
            ['ho detto', 'hai detto', 'ha detto', 'abbiamo detto', 'avete detto', 'hanno detto'],
            ['Ho detto la verità a tutti.', 'Hai detto una cosa molto importante.', 'Ha detto che arriverà tardi.', 'Abbiamo detto di sì alla proposta.', 'Avete detto tutto quello che pensavate?', 'Hanno detto che non possono venire.']),
        ...mkd('vedere', 'passato prossimo',
            ['ho visto', 'hai visto', 'ha visto', 'abbiamo visto', 'avete visto', 'hanno visto'],
            ['Ho visto un bel film ieri sera.', 'Hai visto Marco ultimamente?', 'Ha visto la partita ieri sera?', 'Abbiamo visto una cosa incredibile.', 'Avete visto l\'ultimo episodio?', 'Hanno visto il problema troppo tardi.']),
        ...mkd('prendere', 'passato prossimo',
            ['ho preso', 'hai preso', 'ha preso', 'abbiamo preso', 'avete preso', 'hanno preso'],
            ['Ho preso il treno delle otto.', 'Hai preso la decisione giusta.', 'Ha preso un caffè al bar.', 'Abbiamo preso un appartamento in centro.', 'Avete preso troppo sole oggi.', 'Hanno preso la strada sbagliata.']),
    ],
};

// ---- Drill state ----
let drillQueue = [];
let drillCurrent = null;
let drillSessionStats = { correct: 0, wrong: 0, streak: 0, total: 0 };

// ---- Drill DOM refs ----
const drillFocusEl    = document.getElementById('drillFocus');
const drillVerbEl     = document.getElementById('drillVerb');
const drillPersonEl   = document.getElementById('drillPerson');
const drillTenseBadge = document.getElementById('drillTenseBadge');
const drillInput      = document.getElementById('drillInput');
const drillCheckBtn   = document.getElementById('drillCheckBtn');
const drillCheckBtnTx = document.getElementById('drillCheckBtnText');
const drillFeedback   = document.getElementById('drillFeedback');
const drillResult     = document.getElementById('drillResult');
const drillExample    = document.getElementById('drillExample');
const drillNextBtn    = document.getElementById('drillNextBtn');
const drillResetBtn   = document.getElementById('drillResetBtn');
const drillCorrectEl  = document.getElementById('drillCorrectCount');
const drillStreakEl   = document.getElementById('drillStreak');
const drillAccEl      = document.getElementById('drillAccuracy');

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function initDrill() {
    const focus = drillFocusEl.value;
    const pool = focus === 'mixed'
        ? [...DRILLS.congiuntivo, ...DRILLS.condizionale, ...DRILLS.passato]
        : DRILLS[focus];
    drillQueue = shuffle(pool);
    drillSessionStats = { correct: 0, wrong: 0, streak: 0, total: 0 };
    updateDrillStats();
    nextDrillCard();
}

function nextDrillCard() {
    if (drillQueue.length === 0) { initDrill(); return; }
    drillCurrent = drillQueue.shift();
    drillVerbEl.textContent = drillCurrent.verb;
    drillPersonEl.textContent = drillCurrent.person;
    drillTenseBadge.textContent = drillCurrent.tense;
    drillFeedback.classList.add('hidden');
    drillInput.value = '';
    drillCheckBtn.disabled = false;
    drillCheckBtnTx.textContent = 'Check';
    setTimeout(() => drillInput.focus(), 100);
}

function checkDrillAnswer() {
    const typed = drillInput.value.trim().toLowerCase();
    if (!typed) { drillInput.focus(); return; }

    drillCheckBtn.disabled = true;
    drillSessionStats.total++;

    const correct = drillCurrent.answers.some(a => a.toLowerCase() === typed);

    if (correct) {
        drillSessionStats.correct++;
        drillSessionStats.streak++;
        drillResult.textContent = '✓ Correct — ' + drillCurrent.display;
        drillResult.className = 'drill-result drill-result--correct';
    } else {
        drillSessionStats.wrong++;
        drillSessionStats.streak = 0;
        drillResult.textContent = '✗ You wrote "' + typed + '" — correct: ' + drillCurrent.display;
        drillResult.className = 'drill-result drill-result--wrong';
        drillQueue.push(drillCurrent); // re-queue wrong answers
    }

    drillExample.textContent = drillCurrent.example;
    drillFeedback.classList.remove('hidden');
    updateDrillStats();
    drillFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateDrillStats() {
    drillCorrectEl.textContent = drillSessionStats.correct;
    drillStreakEl.textContent  = drillSessionStats.streak;
    drillAccEl.textContent     = drillSessionStats.total > 0
        ? Math.round((drillSessionStats.correct / drillSessionStats.total) * 100) + '%'
        : '—';
}

// ---- Drill events ----
drillCheckBtn.addEventListener('click', checkDrillAnswer);
drillInput.addEventListener('keydown', e => { if (e.key === 'Enter') checkDrillAnswer(); });
drillNextBtn.addEventListener('click', nextDrillCard);
drillResetBtn.addEventListener('click', initDrill);
drillFocusEl.addEventListener('change', initDrill);

// ---- Init ----
function init() {
    loadPrefs();
    loadStats();
    updateAiStatus();
    startSession();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
