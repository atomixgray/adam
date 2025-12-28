// Constants
const API_ENDPOINT = 'https://your-vercel-function.vercel.app/api/chat'; // Update this after deploying
const PASSWORD_HASH = '8743b52063cd84097a65d1633f5c74f5'; // MD5 hash of "ciao"

// Sentence prompts organized by level and tense
const SENTENCE_PROMPTS = {
    A0: {
        present: [
            "Describe what you are doing right now",
            "Tell me what you like to eat",
            "Say where you live",
            "Describe your family",
            "Tell me what you see in this room"
        ],
        imperfetto: [
            "Describe what you used to do as a child",
            "Tell me about your old house",
            "Describe what you were doing yesterday"
        ]
    },
    A1: {
        present: [
            "Describe your daily routine",
            "Explain what your friend does for work",
            "Tell me about your hobbies",
            "Describe the weather today",
            "Explain how you spend your weekends"
        ],
        imperfetto: [
            "Describe your childhood home",
            "Tell me what you used to do every summer",
            "Explain what your life was like last year",
            "Describe a typical day from your past"
        ]
    },
    A2: {
        present: [
            "Explain why you are learning Italian",
            "Describe a problem you need to solve",
            "Tell me what makes you happy and why",
            "Explain your opinion about social media",
            "Describe your ideal vacation"
        ],
        imperfetto: [
            "Describe how things were different 10 years ago",
            "Tell me about a place you used to visit regularly",
            "Explain what you were thinking about this morning",
            "Describe a habit you had in the past"
        ]
    },
    B1: {
        present: [
            "Explain a recent change in your life and its impact",
            "Describe a current event and give your opinion",
            "Explain something you've been learning recently",
            "Describe a challenge you're currently facing",
            "Explain how technology affects your daily life"
        ],
        imperfetto: [
            "Describe how you used to spend your free time before smartphones",
            "Tell me about a period when you were very busy",
            "Explain what life was like in your hometown when you were young",
            "Describe a time when you were learning something difficult"
        ]
    },
    B2: {
        present: [
            "Analyze the benefits and drawbacks of remote work",
            "Explain your perspective on environmental issues",
            "Describe how cultural differences affect communication",
            "Discuss the role of education in modern society",
            "Explain how social norms are changing"
        ],
        imperfetto: [
            "Describe the cultural atmosphere of a past era",
            "Explain how people used to perceive technology",
            "Describe the social dynamics of a community you were part of",
            "Analyze how a past situation was unfolding"
        ]
    }
};

// Conversation scenarios
const SCENARIOS = {
    casual: {
        systemPrompt: "You are a friendly Italian conversation partner. Chat casually in Italian, keeping responses natural and conversational. Help the user practice by occasionally correcting errors gently and naturally. Keep responses to 2-3 sentences.",
        greeting: "Ciao! Come stai? Sono qui per aiutarti a praticare l'italiano."
    },
    restaurant: {
        systemPrompt: "You are a waiter in an Italian restaurant. Interact naturally in Italian as you would with a customer. Keep responses to 2-3 sentences. Be helpful and friendly.",
        greeting: "Buonasera! Benvenuto al nostro ristorante. Posso aiutarLa?"
    },
    directions: {
        systemPrompt: "You are a helpful local in Italy. Someone is asking you for directions. Respond naturally in Italian with clear, simple directions. Keep responses to 2-3 sentences.",
        greeting: "Ciao! Sei perso? Posso aiutarti a trovare qualcosa?"
    },
    shopping: {
        systemPrompt: "You are a shopkeeper in Italy. Help the customer find what they need. Respond naturally in Italian. Keep responses to 2-3 sentences.",
        greeting: "Buongiorno! Come posso aiutarLa oggi?"
    },
    hotel: {
        systemPrompt: "You are a hotel receptionist in Italy. Help the guest with their needs. Respond naturally in Italian. Keep responses to 2-3 sentences.",
        greeting: "Benvenuto! Ha una prenotazione con noi?"
    },
    doctor: {
        systemPrompt: "You are a doctor in Italy. Help the patient explain their symptoms. Be professional but friendly. Respond in Italian. Keep responses to 2-3 sentences.",
        greeting: "Buongiorno. Come si sente oggi? Può descrivere il problema?"
    }
};

// State
let currentLevel = 'A0';
let currentTense = 'present';
let currentPrompt = '';
let conversationHistory = [];
let apiKey = localStorage.getItem('anthropic_api_key') || '';
let currentScenario = 'casual';

// Utility functions
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

function md5(str) {
    // Proper MD5 implementation
    function rotateLeft(value, shift) {
        return (value << shift) | (value >>> (32 - shift));
    }
    
    function addUnsigned(x, y) {
        const lsw = (x & 0xFFFF) + (y & 0xFFFF);
        const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }
    
    function md5cycle(x, k) {
        let a = x[0], b = x[1], c = x[2], d = x[3];
        
        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22, 1236535329);
        
        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);
        
        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);
        
        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);
        
        x[0] = addUnsigned(a, x[0]);
        x[1] = addUnsigned(b, x[1]);
        x[2] = addUnsigned(c, x[2]);
        x[3] = addUnsigned(d, x[3]);
    }
    
    function cmn(q, a, b, x, s, t) {
        a = addUnsigned(addUnsigned(a, q), addUnsigned(x, t));
        return addUnsigned(rotateLeft(a, s), b);
    }
    
    function ff(a, b, c, d, x, s, t) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }
    
    function gg(a, b, c, d, x, s, t) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }
    
    function hh(a, b, c, d, x, s, t) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    }
    
    function ii(a, b, c, d, x, s, t) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }
    
    function md51(s) {
        const n = s.length;
        const state = [1732584193, -271733879, -1732584194, 271733878];
        let i;
        for (i = 64; i <= s.length; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < s.length; i++)
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i++) tail[i] = 0;
        }
        tail[14] = n * 8;
        md5cycle(state, tail);
        return state;
    }
    
    function md5blk(s) {
        const md5blks = [];
        for (let i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }
    
    const hex_chr = '0123456789abcdef'.split('');
    
    function rhex(n) {
        let s = '', j = 0;
        for (; j < 4; j++)
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        return s;
    }
    
    function hex(x) {
        for (let i = 0; i < x.length; i++)
            x[i] = rhex(x[i]);
        return x.join('');
    }
    
    return hex(md51(str));
}

// Login handling
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('password-input').value;
    const hash = md5(password);
    
    if (hash === PASSWORD_HASH) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        initializeApp();
    } else {
        alert('Incorrect password. Hint: It\'s a simple Italian greeting!');
    }
});

// Initialize app
function initializeApp() {
    loadNewPrompt();
    updateAPIKeyStatus();
    
    // Mode switching
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            switchMode(mode);
        });
    });
    
    // Sentence Builder controls
    document.getElementById('new-prompt-btn').addEventListener('click', loadNewPrompt);
    document.getElementById('level-select').addEventListener('change', (e) => {
        currentLevel = e.target.value;
        loadNewPrompt();
    });
    document.getElementById('check-answer-btn').addEventListener('click', checkAnswer);
    document.getElementById('try-again-btn').addEventListener('click', () => {
        document.getElementById('feedback-area').style.display = 'none';
        document.getElementById('answer-input').value = '';
        loadNewPrompt();
    });
    
    // Conversation controls
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    document.getElementById('clear-chat-btn').addEventListener('click', clearChat);
    document.getElementById('scenario-select').addEventListener('change', (e) => {
        currentScenario = e.target.value;
        clearChat();
    });
    
    // API Key management
    document.getElementById('set-api-key-btn').addEventListener('click', () => {
        document.getElementById('api-modal').style.display = 'flex';
    });
    document.getElementById('save-api-key-btn').addEventListener('click', saveAPIKey);
    document.getElementById('cancel-api-key-btn').addEventListener('click', () => {
        document.getElementById('api-modal').style.display = 'none';
    });
}

// Mode switching
function switchMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    document.getElementById('builder-mode').style.display = mode === 'builder' ? 'block' : 'none';
    document.getElementById('conversation-mode').style.display = mode === 'conversation' ? 'block' : 'none';
}

// Sentence Builder functions
function loadNewPrompt() {
    // Randomly choose tense (80% present, 20% imperfetto for variety)
    currentTense = Math.random() < 0.8 ? 'present' : 'imperfetto';
    
    const prompts = SENTENCE_PROMPTS[currentLevel][currentTense];
    currentPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    
    document.getElementById('prompt-text').textContent = currentPrompt;
    document.getElementById('tense-label').textContent = currentTense === 'present' ? 'Present Tense' : 'Imperfetto';
    document.getElementById('difficulty-label').textContent = currentLevel;
    document.getElementById('answer-input').value = '';
    document.getElementById('feedback-area').style.display = 'none';
}

async function checkAnswer() {
    const answer = document.getElementById('answer-input').value.trim();
    
    if (!answer) {
        alert('Please write a sentence first!');
        return;
    }
    
    if (!apiKey) {
        alert('Please set your API key first!');
        document.getElementById('api-modal').style.display = 'flex';
        return;
    }
    
    const btn = document.getElementById('check-answer-btn');
    btn.disabled = true;
    btn.textContent = 'Checking...';
    
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': apiKey
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: `You are an Italian language teacher. A ${currentLevel} level student was asked to: "${currentPrompt}" using ${currentTense === 'present' ? 'present tense' : 'imperfetto'}. They wrote: "${answer}"

Please provide feedback in English that:
1. Notes if the grammar and tense usage are correct
2. Suggests corrections if needed
3. Provides the corrected version in Italian
4. Gives encouragement

Keep it friendly and concise (3-4 sentences max).`
                }]
            })
        });
        
        const data = await response.json();
        
        if (data.content && data.content[0]) {
            const feedback = data.content[0].text;
            document.getElementById('feedback-area').style.display = 'block';
            document.querySelector('.feedback-content').innerHTML = feedback.replace(/\n/g, '<br>');
        }
    } catch (error) {
        alert('Error checking answer. Please check your API key and try again.');
        console.error(error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Check Answer';
    }
}

// Conversation functions
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    if (!apiKey) {
        alert('Please set your API key first!');
        document.getElementById('api-modal').style.display = 'flex';
        return;
    }
    
    // Add user message
    addMessage(message, 'user');
    input.value = '';
    
    // Show loading
    const loadingId = addLoadingMessage();
    
    // Build conversation context
    const scenario = SCENARIOS[currentScenario];
    const messages = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
    
    messages.push({
        role: 'user',
        content: message
    });
    
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': apiKey
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 500,
                system: scenario.systemPrompt,
                messages: messages
            })
        });
        
        const data = await response.json();
        
        // Remove loading
        removeLoadingMessage(loadingId);
        
        if (data.content && data.content[0]) {
            const aiResponse = data.content[0].text;
            addMessage(aiResponse, 'ai');
        }
    } catch (error) {
        removeLoadingMessage(loadingId);
        alert('Error sending message. Please check your API key and try again.');
        console.error(error);
    }
}

function addMessage(text, type) {
    const messagesContainer = document.getElementById('chat-messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = type === 'user' ? '👤' : '🤖';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = text;
    
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Add to history
    conversationHistory.push({
        role: type === 'user' ? 'user' : 'assistant',
        content: text
    });
}

function addLoadingMessage() {
    const messagesContainer = document.getElementById('chat-messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message ai-message';
    messageDiv.id = 'loading-message';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message-loading';
    loadingDiv.innerHTML = '<div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div>';
    
    contentDiv.appendChild(loadingDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return 'loading-message';
}

function removeLoadingMessage(id) {
    const loadingMsg = document.getElementById(id);
    if (loadingMsg) {
        loadingMsg.remove();
    }
}

function clearChat() {
    conversationHistory = [];
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';
    
    // Add initial greeting
    const scenario = SCENARIOS[currentScenario];
    addMessage(scenario.greeting, 'ai');
}

// API Key management
function updateAPIKeyStatus() {
    const statusText = document.getElementById('api-status-text');
    const setBtn = document.getElementById('set-api-key-btn');
    
    if (apiKey) {
        statusText.textContent = `API Key: ${apiKey.slice(0, 8)}...`;
        setBtn.textContent = 'Change';
    } else {
        statusText.textContent = 'No API key set';
        setBtn.textContent = 'Set Key';
    }
}

function saveAPIKey() {
    const input = document.getElementById('api-key-input');
    const key = input.value.trim();
    
    if (!key) {
        alert('Please enter an API key');
        return;
    }
    
    if (!key.startsWith('sk-ant-')) {
        alert('Invalid API key format. It should start with "sk-ant-"');
        return;
    }
    
    apiKey = key;
    localStorage.setItem('anthropic_api_key', key);
    updateAPIKeyStatus();
    
    document.getElementById('api-modal').style.display = 'none';
    input.value = '';
}
// Particle animation for background
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');

let particles = [];
let animationId;

function setCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.opacity = Math.random() * 0.5 + 0.2;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
    }

    draw() {
        ctx.fillStyle = `rgba(102, 126, 234, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function init() {
    setCanvasSize();
    particles = [];
    
    const particleCount = Math.floor((canvas.width * canvas.height) / 15000);
    
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

function connectParticles() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 120) {
                const opacity = (1 - distance / 120) * 0.15;
                ctx.strokeStyle = `rgba(118, 75, 162, ${opacity})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });

    connectParticles();
    animationId = requestAnimationFrame(animate);
}

// Initialize and start animation
init();
animate();

// Handle window resize
window.addEventListener('resize', () => {
    cancelAnimationFrame(animationId);
    init();
    animate();
});
-e 

// Particles code integrated above
