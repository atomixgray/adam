'use strict';

const IMMERSION_TOPICS = [
    { id: 'day',     emoji: '☀️', title: "Marco's Day", prompt: 'Narrate what your day has been like today, from morning to now — ordinary details, in first person.' },
    { id: 'story',   emoji: '📖', title: 'A Story',      prompt: 'Tell a short original story or anecdote — something that could have happened to you or someone you know.' },
    { id: 'news',    emoji: '📰', title: 'Local News',   prompt: 'Talk about a piece of local news or something happening in your neighborhood or city, as if commenting on it casually.' },
    { id: 'memory',  emoji: '🕰️', title: 'A Memory',     prompt: 'Share a memory from your past — something from childhood or a past trip or experience.' },
    { id: 'opinion', emoji: '💭', title: 'An Opinion',   prompt: 'Share your opinion about something everyday — food, weather, a habit, a small pet peeve.' },
    { id: 'weekend', emoji: '🎉', title: 'The Weekend',  prompt: 'Talk about what you did last weekend or what you are planning to do next weekend.' },
];

let immerseInited  = false;
let immerseLevel   = 'A2';
let immerseSegments = [];
let immersePlaying  = false;

function initImmerse() {
    if (immerseInited) return;
    immerseInited = true;

    renderImmerseLevels();
    renderImmerseChips();

    document.getElementById('immerseNewBtn').addEventListener('click', immerseShowTopics);
    document.getElementById('immersePlayBtn').addEventListener('click', immersePlayAll);
}

function renderImmerseLevels() {
    document.querySelectorAll('#immerseLevelRow .level-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#immerseLevelRow .level-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            immerseLevel = btn.dataset.level;
        });
    });
}

function renderImmerseChips() {
    const container = document.getElementById('immerseChips');
    container.innerHTML = '';
    IMMERSION_TOPICS.forEach(t => {
        const chip = document.createElement('button');
        chip.className = 'chat-chip chat-chip--immerse';
        chip.innerHTML = `<span class="chip-emoji">${t.emoji}</span><span class="chip-title">${t.title}</span>`;
        chip.addEventListener('click', () => immerseStart(t));
        container.appendChild(chip);
    });
}

async function immerseStart(topic) {
    document.getElementById('immerseTopicView').classList.add('hidden');
    document.getElementById('immerseEpisodeView').classList.remove('hidden');
    document.getElementById('immerseWindow').innerHTML = '';
    document.getElementById('immerseTitle').textContent = topic.title;
    immerseSegments = [];

    const thinking = immerseAppendThinking();

    try {
        const data = await parlo.callClaude('narrate', [
            { role: 'user', content: `Topic: ${topic.prompt}\nLevel: ${immerseLevel}` }
        ], { max_tokens: 1024 });

        thinking.remove();

        const raw    = data.content?.[0]?.text || '{}';
        const parsed = parlo.parseJSON(raw);

        if (!parsed || !Array.isArray(parsed.segments) || !parsed.segments.length) {
            immerseAppendError('Marco couldn’t come up with anything — try again.');
            return;
        }

        immerseSegments = parsed.segments;
        document.getElementById('immerseTitle').textContent = parsed.title || topic.title;
        parsed.segments.forEach(seg => immerseAppendBubble(seg.italian, seg.english));

    } catch (e) {
        thinking.remove();
        immerseAppendError('Could not connect — check your connection and try again.');
    }
}

function immerseShowTopics() {
    document.getElementById('immerseEpisodeView').classList.add('hidden');
    document.getElementById('immerseTopicView').classList.remove('hidden');
    immerseSegments = [];
}

async function immersePlayAll() {
    if (immersePlaying || !immerseSegments.length) return;
    immersePlaying = true;
    const btn = document.getElementById('immersePlayBtn');
    btn.disabled = true;
    btn.textContent = 'Listening…';

    try {
        for (const seg of immerseSegments) {
            await parlo.speakItalian(seg.italian);
            await new Promise(resolve => setTimeout(resolve, 400));
        }
    } finally {
        immersePlaying = false;
        btn.disabled = false;
        btn.textContent = '▶ Listen';
    }
}

function immerseAppendBubble(italian, english) {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg--ai';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    const italianRow = document.createElement('div');
    italianRow.className = 'chat-italian-row';
    const italianEl = document.createElement('div');
    italianEl.className = 'chat-italian';
    italianEl.textContent = italian;
    italianRow.appendChild(italianEl);
    bubble.appendChild(italianRow);

    if (english) {
        const revealBtn = document.createElement('button');
        revealBtn.className = 'chat-reveal-btn';
        revealBtn.textContent = 'show translation';

        const engEl = document.createElement('div');
        engEl.className = 'chat-translation';
        engEl.style.display = 'none';
        engEl.textContent = english;

        revealBtn.addEventListener('click', () => {
            const visible = engEl.style.display !== 'none';
            engEl.style.display = visible ? 'none' : 'block';
            revealBtn.textContent = visible ? 'show translation' : 'hide';
        });

        bubble.appendChild(revealBtn);
        bubble.appendChild(engEl);
    }

    el.appendChild(bubble);
    document.getElementById('immerseWindow').appendChild(el);
    immerseScrollBottom();
    return el;
}

function immerseAppendThinking() {
    const el     = document.createElement('div');
    el.className = 'chat-msg chat-msg--ai';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble--thinking';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    el.appendChild(bubble);
    document.getElementById('immerseWindow').appendChild(el);
    immerseScrollBottom();
    return el;
}

function immerseAppendError(msg) {
    const el = document.createElement('div');
    el.className = 'chat-error';
    el.textContent = msg;
    document.getElementById('immerseWindow').appendChild(el);
    immerseScrollBottom();
}

function immerseScrollBottom() {
    const w = document.getElementById('immerseWindow');
    w.scrollTop = w.scrollHeight;
}
