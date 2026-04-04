// ============================================================
// Parlo v2 — Practice (Sentence Expansion Ladder)
// ============================================================

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
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
    presente: [
        ...mkd('essere', 'presente',
            ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'],
            ['Io sono di New York.', 'Tu sei molto gentile.', 'Lei è una brava professoressa.', 'Noi siamo pronti.', 'Voi siete in ritardo.', 'Loro sono stanchi.']),
        ...mkd('avere', 'presente',
            ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'],
            ['Io ho fame.', 'Hai un momento?', 'Lei ha una bella macchina.', 'Abbiamo un problema.', 'Avete il biglietto?', 'Hanno molti amici.']),
        ...mkd('fare', 'presente',
            ['faccio', 'fai', 'fa', 'facciamo', 'fate', 'fanno'],
            ['Cosa faccio adesso?', 'Cosa fai questo weekend?', 'Lui fa sport ogni giorno.', 'Facciamo una pausa.', 'Cosa fate stasera?', 'Fanno sempre tardi.']),
        ...mkd('andare', 'presente',
            ['vado', 'vai', 'va', 'andiamo', 'andate', 'vanno'],
            ['Vado a lavorare in bici.', 'Dove vai?', 'Va al mercato ogni sabato.', 'Andiamo al cinema stasera?', 'Andate spesso in vacanza?', 'Vanno a scuola a piedi.']),
        ...mkd('venire', 'presente',
            ['vengo', 'vieni', 'viene', 'veniamo', 'venite', 'vengono'],
            ['Vengo subito.', 'Vieni con noi?', 'Viene da Milano.', 'Veniamo da Roma.', 'A che ora venite?', 'Vengono alla festa stasera.']),
        ...mkd('potere', 'presente',
            ['posso', 'puoi', 'può', 'possiamo', 'potete', 'possono'],
            ['Posso aiutarti?', 'Puoi ripetere, per favore?', 'Non può venire oggi.', 'Possiamo parlare domani.', 'Potete aspettare un attimo?', 'Non possono uscire stasera.']),
        ...mkd('volere', 'presente',
            ['voglio', 'vuoi', 'vuole', 'vogliamo', 'volete', 'vogliono'],
            ['Voglio un caffè.', 'Cosa vuoi mangiare?', 'Vuole imparare l\'italiano.', 'Vogliamo partire presto.', 'Volete venire con noi?', 'Vogliono un tavolo per due.']),
        ...mkd('dovere', 'presente',
            ['devo', 'devi', 'deve', 'dobbiamo', 'dovete', 'devono'],
            ['Devo andare adesso.', 'Devi studiare di più.', 'Deve lavorare fino alle sei.', 'Dobbiamo prenotare.', 'Dovete essere qui alle otto.', 'Devono partire domani.']),
        ...mkd('sapere', 'presente',
            ['so', 'sai', 'sa', 'sappiamo', 'sapete', 'sanno'],
            ['Non so dove siamo.', 'Sai parlare italiano?', 'Sa cucinare benissimo.', 'Sappiamo già la risposta.', 'Sapete come si arriva?', 'Sanno la verità.']),
        ...mkd('dire', 'presente',
            ['dico', 'dici', 'dice', 'diciamo', 'dite', 'dicono'],
            ['Dico sempre la verità.', 'Cosa dici?', 'Dice che arriva tardi.', 'Diciamo di sì.', 'Cosa dite di questa idea?', 'Dicono che il ristorante è ottimo.']),
        ...mkd('stare', 'presente',
            ['sto', 'stai', 'sta', 'stiamo', 'state', 'stanno'],
            ['Come sto?', 'Come stai?', 'Sta bene, grazie.', 'Stiamo imparando l\'italiano.', 'State attenti!', 'Stanno studiando in biblioteca.']),
        ...mkd('uscire', 'presente',
            ['esco', 'esci', 'esce', 'usciamo', 'uscite', 'escono'],
            ['Esco di casa alle otto.', 'A che ora esci?', 'Esce sempre con gli amici.', 'Usciamo stasera?', 'A che ora uscite dall\'ufficio?', 'Escono ogni venerdì sera.']),
        // -are regular verbs
        ...mkd('parlare', 'presente',
            ['parlo', 'parli', 'parla', 'parliamo', 'parlate', 'parlano'],
            ['Parlo italiano un po\'.', 'Parli troppo veloce.', 'Parla tre lingue.', 'Parliamo dopo.', 'Di cosa parlate?', 'Parlano sempre di calcio.']),
        ...mkd('mangiare', 'presente',
            ['mangio', 'mangi', 'mangia', 'mangiamo', 'mangiate', 'mangiano'],
            ['Mangio la pasta ogni giorno.', 'Cosa mangi a pranzo?', 'Mangia sempre tardi.', 'Mangiamo fuori stasera?', 'Mangiate carne?', 'Mangiano molto pesce.']),
        ...mkd('lavorare', 'presente',
            ['lavoro', 'lavori', 'lavora', 'lavoriamo', 'lavorate', 'lavorano'],
            ['Lavoro in centro.', 'Dove lavori?', 'Lavora da casa.', 'Lavoriamo insieme da anni.', 'Lavorate il sabato?', 'Lavorano in un\'agenzia.']),
        ...mkd('abitare', 'presente',
            ['abito', 'abiti', 'abita', 'abitiamo', 'abitate', 'abitano'],
            ['Abito vicino al centro.', 'Dove abiti?', 'Abita con i suoi genitori.', 'Abitiamo in un appartamento grande.', 'Abitate in città o in campagna?', 'Abitano in periferia.']),
        ...mkd('ascoltare', 'presente',
            ['ascolto', 'ascolti', 'ascolta', 'ascoltiamo', 'ascoltate', 'ascoltano'],
            ['Ascolto musica mentre cammino.', 'Ascolti mai i podcast in italiano?', 'Ascolta sempre i consigli degli amici.', 'Ascoltiamo la radio in macchina.', 'Ascoltate musica italiana?', 'Ascoltano le lezioni con attenzione.']),
        ...mkd('comprare', 'presente',
            ['compro', 'compri', 'compra', 'compriamo', 'comprate', 'comprano'],
            ['Compro il pane ogni mattina.', 'Cosa compri al mercato?', 'Compra sempre troppo.', 'Compriamo i biglietti online.', 'Dove comprate la frutta?', 'Comprano tutto al supermercato.']),
        // -ere regular verbs
        ...mkd('leggere', 'presente',
            ['leggo', 'leggi', 'legge', 'leggiamo', 'leggete', 'leggono'],
            ['Leggo un libro alla settimana.', 'Leggi il giornale?', 'Legge molto prima di dormire.', 'Leggiamo lo stesso romanzo.', 'Leggete in italiano?', 'Leggono articoli online.']),
        ...mkd('scrivere', 'presente',
            ['scrivo', 'scrivi', 'scrive', 'scriviamo', 'scrivete', 'scrivono'],
            ['Scrivo una email adesso.', 'Scrivi spesso a mano?', 'Scrive molto bene.', 'Scriviamo in italiano.', 'Scrivete i compiti a casa?', 'Scrivono un libro insieme.']),
        ...mkd('vivere', 'presente',
            ['vivo', 'vivi', 'vive', 'viviamo', 'vivete', 'vivono'],
            ['Vivo a Roma da tre anni.', 'Dove vivi adesso?', 'Vive da sola.', 'Viviamo bene qui.', 'Vivete ancora in città?', 'Vivono in una bella casa.']),
        ...mkd('credere', 'presente',
            ['credo', 'credi', 'crede', 'crediamo', 'credete', 'credono'],
            ['Non credo sia vero.', 'Credi in quello che dici?', 'Crede di avere ragione.', 'Crediamo che sia possibile.', 'Credete a questa storia?', 'Credono di essere i migliori.']),
        // -ire regular verbs
        ...mkd('dormire', 'presente',
            ['dormo', 'dormi', 'dorme', 'dormiamo', 'dormite', 'dormono'],
            ['Dormo poco durante la settimana.', 'Dormi bene di solito?', 'Dorme ancora.', 'Dormiamo tardi il weekend.', 'Dormite con la finestra aperta?', 'Dormono sempre fino a tardi.']),
        ...mkd('partire', 'presente',
            ['parto', 'parti', 'parte', 'partiamo', 'partite', 'partono'],
            ['Parto domani mattina.', 'A che ora parti?', 'Parte per Milano oggi.', 'Partiamo presto.', 'Da dove partite?', 'Partono con il treno delle nove.']),
        ...mkd('sentire', 'presente',
            ['sento', 'senti', 'sente', 'sentiamo', 'sentite', 'sentono'],
            ['Sento della musica.', 'Senti quel rumore?', 'Sente freddo.', 'Sentiamo le ultime notizie.', 'Sentite qualcosa di strano?', 'Sentono solo quello che vogliono.']),
        ...mkd('finire', 'presente',
            ['finisco', 'finisci', 'finisce', 'finiamo', 'finite', 'finiscono'],
            ['Finisco di lavorare alle sei.', 'Quando finisci la scuola?', 'Finisce sempre in ritardo.', 'Finiamo presto stasera.', 'A che ora finite?', 'Finiscono la riunione alle tre.']),
        ...mkd('capire', 'presente',
            ['capisco', 'capisci', 'capisce', 'capiamo', 'capite', 'capiscono'],
            ['Capisco l\'italiano abbastanza bene.', 'Capisci quando parlano veloce?', 'Capisce tutto ma non parla.', 'Capiamo il problema.', 'Capite quello che dice?', 'Capiscono subito.']),
    ],

    imperfetto: [
        ...mkd('essere', 'imperfetto',
            ['ero', 'eri', 'era', 'eravamo', 'eravate', 'erano'],
            ['Da bambino ero molto timido.', 'Eri sempre così puntuale?', 'Era una bella giornata.', 'Eravamo stanchi dopo il viaggio.', 'Eravate amici da tanto tempo.', 'Erano tutti seduti al tavolo.']),
        ...mkd('avere', 'imperfetto',
            ['avevo', 'avevi', 'aveva', 'avevamo', 'avevate', 'avevano'],
            ['Avevo sempre fame da ragazzo.', 'Avevi un cane quando eri piccolo?', 'Aveva i capelli lunghi.', 'Avevamo tanto tempo libero.', 'Avevate una casa in campagna?', 'Avevano molti problemi.']),
        ...mkd('fare', 'imperfetto',
            ['facevo', 'facevi', 'faceva', 'facevamo', 'facevate', 'facevano'],
            ['Da giovane facevo sport ogni giorno.', 'Cosa facevi nel tempo libero?', 'Faceva sempre tardi la sera.', 'Facevamo lunghe passeggiate.', 'Cosa facevate la domenica?', 'Facevano colazione insieme ogni mattina.']),
        ...mkd('andare', 'imperfetto',
            ['andavo', 'andavi', 'andava', 'andavamo', 'andavate', 'andavano'],
            ['Da bambino andavo a scuola a piedi.', 'Andavi spesso al mare?', 'Andava in biblioteca ogni pomeriggio.', 'Andavamo in vacanza ogni estate.', 'Andavate in chiesa la domenica?', 'Andavano al mercato tutte le settimane.']),
        ...mkd('venire', 'imperfetto',
            ['venivo', 'venivi', 'veniva', 'venivamo', 'venivate', 'venivano'],
            ['Venivo qui spesso da piccolo.', 'Venivi a trovarmi ogni estate.', 'Veniva sempre in anticipo.', 'Venivamo a piedi dall\'ufficio.', 'Venivate spesso a cena da noi.', 'Venivano da lontano per vederci.']),
        ...mkd('potere', 'imperfetto',
            ['potevo', 'potevi', 'poteva', 'potevamo', 'potevate', 'potevano'],
            ['Non potevo dormire bene.', 'Potevi uscire la sera?', 'Non poteva mangiare certi cibi.', 'Potevamo lavorare da casa.', 'Potevate restare più a lungo?', 'Non potevano permettersi una vacanza.']),
        ...mkd('volere', 'imperfetto',
            ['volevo', 'volevi', 'voleva', 'volevamo', 'volevate', 'volevano'],
            ['Volevo diventare un medico.', 'Cosa volevi fare da grande?', 'Voleva sempre avere ragione.', 'Volevamo restare ancora un po\'.', 'Volevate un tavolo vicino alla finestra?', 'Volevano partire prima ma non è stato possibile.']),
        ...mkd('dovere', 'imperfetto',
            ['dovevo', 'dovevi', 'doveva', 'dovevamo', 'dovevate', 'dovevano'],
            ['Dovevo alzarmi presto ogni giorno.', 'Dovevi studiare anche il sabato?', 'Doveva lavorare per mantenere la famiglia.', 'Dovevamo prendere il treno delle sei.', 'Dovevate rispettare molte regole.', 'Dovevano consegnare il progetto entro venerdì.']),
        ...mkd('dire', 'imperfetto',
            ['dicevo', 'dicevi', 'diceva', 'dicevamo', 'dicevate', 'dicevano'],
            ['Ti dicevo sempre la verità.', 'Cosa dicevi prima?', 'Diceva sempre cose interessanti.', 'Dicevamo spesso quella battuta.', 'Cosa dicevate di lui?', 'Dicevano che era una brava persona.']),
        ...mkd('stare', 'imperfetto',
            ['stavo', 'stavi', 'stava', 'stavamo', 'stavate', 'stavano'],
            ['Stavo male ieri sera.', 'Come stavi prima di ammalarti?', 'Stava leggendo quando è arrivato.', 'Stavamo aspettando il tuo arrivo.', 'Stavate parlando di me?', 'Stavano mangiando quando ho chiamato.']),
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

const VERB_EN = {
    essere: 'to be', avere: 'to have', fare: 'to do / make',
    andare: 'to go', venire: 'to come', potere: 'can / to be able to',
    volere: 'to want', dovere: 'must / to have to', sapere: 'to know',
    dire: 'to say / tell', stare: 'to stay / be', vedere: 'to see',
    prendere: 'to take',
    uscire: 'to go out',
    parlare: 'to speak', mangiare: 'to eat', lavorare: 'to work',
    abitare: 'to live / reside', ascoltare: 'to listen', comprare: 'to buy',
    leggere: 'to read', scrivere: 'to write', vivere: 'to live',
    credere: 'to believe', dormire: 'to sleep', partire: 'to leave / depart',
    sentire: 'to hear / feel', finire: 'to finish', capire: 'to understand',
};

// ---- Drill state ----
let drillQueue = [];
let drillCurrent = null;
let drillSessionStats = { correct: 0, wrong: 0, streak: 0, total: 0 };

// ---- Drill DOM refs ----
const drillFocusEl    = document.getElementById('drillFocus');
const drillVerbEl     = document.getElementById('drillVerb');
const drillVerbEnEl   = document.getElementById('drillVerbEn');
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
        ? [...DRILLS.presente, ...DRILLS.passato, ...DRILLS.imperfetto]
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
    drillVerbEnEl.textContent = VERB_EN[drillCurrent.verb] || '';
    drillPersonEl.textContent = drillCurrent.person;
    drillTenseBadge.textContent = drillCurrent.tense;
    drillFeedback.classList.add('hidden');
    document.getElementById('drillAiFeedback').classList.add('hidden');
    drillInput.value = '';
    drillCheckBtn.disabled = false;
    drillCheckBtnTx.textContent = 'Check';
    setTimeout(() => drillInput.focus(), 100);
}

async function checkDrillAnswer() {
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
        drillResult.textContent = '✗ Incorrect — the correct form is: ' + drillCurrent.display;
        drillResult.className = 'drill-result drill-result--wrong';
        drillQueue.push(drillCurrent); // re-queue wrong answers
    }

    drillExample.textContent = drillCurrent.example;
    drillFeedback.classList.remove('hidden');
    updateDrillStats();
    drillFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // AI feedback — only if API key is set
    const drillAiFeedbackEl = document.getElementById('drillAiFeedback');
    if (getApiKey()) {
        drillAiFeedbackEl.textContent = 'Thinking…';
        drillAiFeedbackEl.classList.remove('hidden');
        drillAiFeedbackEl.classList.add('loading');
        try {
            const verbEn = VERB_EN[drillCurrent.verb] || drillCurrent.verb;
            let prompt;
            if (correct) {
                prompt = `The student correctly conjugated the Italian verb "${drillCurrent.verb}" (${verbEn}) in the ${drillCurrent.tense} for "${drillCurrent.person}" as "${drillCurrent.display}". Give one short tip (max 15 words) about when or how this form is used in natural speech.`;
            } else {
                prompt = `Italian verb conjugation drill. Verb: "${drillCurrent.verb}" (${verbEn}), tense: ${drillCurrent.tense}, person: "${drillCurrent.person}". The student answered "${typed}" but the correct form is "${drillCurrent.display}". In one short sentence (max 20 words), explain what went wrong or the pattern to remember. Be direct and encouraging.`;
            }
            const feedback = await callGroq([{ role: 'user', content: prompt }], 80);
            drillAiFeedbackEl.textContent = feedback;
        } catch (_) {
            drillAiFeedbackEl.classList.add('hidden');
        } finally {
            drillAiFeedbackEl.classList.remove('loading');
        }
    } else {
        drillAiFeedbackEl.classList.add('hidden');
    }
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
