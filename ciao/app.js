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
    // Simple MD5-like hash for demo purposes
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(32, '0').slice(0, 32);
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
