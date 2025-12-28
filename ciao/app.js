// Expanded sentence prompts organized by level and tense
const SENTENCE_PROMPTS = {
    A0: {
        present: [
            "Describe what you are doing right now",
            "Tell me what you like to eat",
            "Say where you live",
            "Describe your family",
            "Tell me what you see in this room",
            "Say what time it is and what you're doing",
            "Describe the weather today",
            "Tell me about your favorite color",
            "Say what you want to drink",
            "Describe how you feel right now"
        ],
        imperfetto: [
            "Describe what you used to do as a child",
            "Tell me about your old house",
            "Describe what you were doing yesterday morning",
            "Say what your daily routine was like last year",
            "Tell me about a toy you used to play with"
        ],
        passato: [
            "Tell me what you did this morning",
            "Describe what you ate yesterday",
            "Say where you went last weekend",
            "Tell me about something you bought recently",
            "Describe a phone call you made today"
        ]
    },
    A1: {
        present: [
            "Describe your daily morning routine",
            "Explain what your friend does for work",
            "Tell me about your hobbies and interests",
            "Describe the weather and seasons in your area",
            "Explain how you spend your weekends",
            "Describe your typical workday or school day",
            "Tell me about your favorite restaurant",
            "Explain what you do to relax",
            "Describe your neighborhood",
            "Tell me about your pet or an animal you like"
        ],
        imperfetto: [
            "Describe your childhood home in detail",
            "Tell me what you used to do every summer",
            "Explain what your life was like last year",
            "Describe a typical day from your past",
            "Tell me about a friend you used to have",
            "Describe how your town used to look",
            "Explain what you used to think about school",
            "Tell me about your old job or school"
        ],
        passato: [
            "Describe your last vacation in detail",
            "Tell me about a party you attended",
            "Explain what you did last birthday",
            "Describe a meal you cooked recently",
            "Tell me about the last movie you watched",
            "Describe a recent conversation with a friend",
            "Explain what you did last night",
            "Tell me about a book you finished reading"
        ]
    },
    A2: {
        present: [
            "Explain why you are learning Italian",
            "Describe a problem you need to solve",
            "Tell me what makes you happy and why",
            "Explain your opinion about social media",
            "Describe your ideal vacation destination",
            "Tell me about your future goals",
            "Explain how you stay healthy",
            "Describe what you think about technology",
            "Tell me about your favorite season and why",
            "Explain what you value most in friendships"
        ],
        imperfetto: [
            "Describe how things were different 10 years ago",
            "Tell me about a place you used to visit regularly",
            "Explain what you were thinking about this morning",
            "Describe a habit you had in the past",
            "Tell me about how you used to spend summers",
            "Describe your thoughts and feelings during a past event",
            "Explain what life was like before smartphones",
            "Tell me about a tradition your family used to have"
        ],
        passato: [
            "Describe a memorable trip you took",
            "Tell me about an important decision you made",
            "Explain how you learned something new recently",
            "Describe a challenge you overcame",
            "Tell me about a surprise you experienced",
            "Explain what happened at a special event",
            "Describe a time you helped someone",
            "Tell me about an interesting person you met"
        ]
    },
    B1: {
        present: [
            "Explain a recent change in your life and its impact",
            "Describe a current event and give your opinion",
            "Explain something you've been learning recently",
            "Describe a challenge you're currently facing",
            "Explain how technology affects your daily life",
            "Describe the balance between work and personal life",
            "Tell me about a skill you're trying to develop",
            "Explain your views on environmental issues",
            "Describe how you handle stress",
            "Tell me about a project you're working on"
        ],
        imperfetto: [
            "Describe how you used to spend your free time before smartphones",
            "Tell me about a period when you were very busy",
            "Explain what life was like in your hometown when you were young",
            "Describe a time when you were learning something difficult",
            "Tell me about a situation that was ongoing in your past",
            "Describe the atmosphere at a place you used to frequent",
            "Explain your thoughts during a significant past period",
            "Tell me about concurrent events from your past"
        ],
        passato: [
            "Describe a significant life change you experienced",
            "Tell me about a problem you solved creatively",
            "Explain how you achieved a personal goal",
            "Describe a series of events that led to something important",
            "Tell me about a time you changed your mind about something",
            "Explain what happened during a difficult situation",
            "Describe how you made a new friend",
            "Tell me about an experience that taught you something valuable"
        ]
    },
    B2: {
        present: [
            "Analyze the benefits and drawbacks of remote work",
            "Explain your perspective on current environmental issues",
            "Describe how cultural differences affect communication",
            "Discuss the role of education in modern society",
            "Explain how social norms are changing",
            "Analyze the impact of globalization on local cultures",
            "Describe the relationship between technology and privacy",
            "Discuss how media influences public opinion",
            "Explain the balance between tradition and innovation",
            "Analyze factors that contribute to personal happiness"
        ],
        imperfetto: [
            "Describe the cultural atmosphere of a past era",
            "Explain how people used to perceive technology",
            "Describe the social dynamics of a community you were part of",
            "Analyze how a past situation was unfolding",
            "Explain the background circumstances of a historical event",
            "Describe ongoing attitudes and beliefs from your past",
            "Tell me about parallel developments happening in your life",
            "Explain the context surrounding a past decision"
        ],
        passato: [
            "Describe how a series of decisions led to an outcome",
            "Explain the complete process of a past achievement",
            "Analyze what happened during a complex situation",
            "Describe how you navigated a challenging period",
            "Tell me about an experience that changed your perspective",
            "Explain the sequence of events in a memorable story",
            "Describe how you resolved a complicated problem",
            "Analyze the factors that led to a significant change"
        ]
    }
};

// Vocabulary helpers by level
const VOCABULARY_HELPERS = {
    A0: {
        present: [
            { italian: "io sono", english: "I am" },
            { italian: "tu sei", english: "you are" },
            { italian: "lui/lei è", english: "he/she is" },
            { italian: "mi piace", english: "I like" },
            { italian: "voglio", english: "I want" },
            { italian: "ho", english: "I have" },
            { italian: "vedo", english: "I see" },
            { italian: "mangio", english: "I eat" },
            { italian: "bevo", english: "I drink" },
            { italian: "oggi", english: "today" }
        ],
        imperfetto: [
            { italian: "ero", english: "I was" },
            { italian: "avevo", english: "I had" },
            { italian: "facevo", english: "I used to do" },
            { italian: "giocavo", english: "I used to play" },
            { italian: "quando ero piccolo/a", english: "when I was little" },
            { italian: "sempre", english: "always" },
            { italian: "ogni giorno", english: "every day" }
        ],
        passato: [
            { italian: "ho fatto", english: "I did/made" },
            { italian: "sono andato/a", english: "I went" },
            { italian: "ho mangiato", english: "I ate" },
            { italian: "ho comprato", english: "I bought" },
            { italian: "ieri", english: "yesterday" },
            { italian: "stamattina", english: "this morning" },
            { italian: "la settimana scorsa", english: "last week" }
        ]
    },
    A1: {
        present: [
            { italian: "di solito", english: "usually" },
            { italian: "lavoro", english: "I work" },
            { italian: "studio", english: "I study" },
            { italian: "mi alzo", english: "I wake up" },
            { italian: "vado", english: "I go" },
            { italian: "mi piace molto", english: "I really like" },
            { italian: "preferisco", english: "I prefer" },
            { italian: "spesso", english: "often" },
            { italian: "qualche volta", english: "sometimes" }
        ],
        imperfetto: [
            { italian: "abitavo", english: "I used to live" },
            { italian: "andavo", english: "I used to go" },
            { italian: "mi piaceva", english: "I used to like" },
            { italian: "pensavo", english: "I used to think" },
            { italian: "volevo", english: "I wanted" },
            { italian: "lavoravo", english: "I used to work" },
            { italian: "di solito", english: "usually" },
            { italian: "ogni tanto", english: "every now and then" }
        ],
        passato: [
            { italian: "sono stato/a", english: "I was/I have been" },
            { italian: "ho visto", english: "I saw/watched" },
            { italian: "ho parlato", english: "I spoke" },
            { italian: "ho letto", english: "I read" },
            { italian: "ho cucinato", english: "I cooked" },
            { italian: "sono tornato/a", english: "I returned" },
            { italian: "il mese scorso", english: "last month" }
        ]
    },
    A2: {
        present: [
            { italian: "secondo me", english: "in my opinion" },
            { italian: "penso che", english: "I think that" },
            { italian: "credo che", english: "I believe that" },
            { italian: "mi sembra", english: "it seems to me" },
            { italian: "vorrei", english: "I would like" },
            { italian: "dovrei", english: "I should" },
            { italian: "potrei", english: "I could" },
            { italian: "è importante", english: "it's important" }
        ],
        imperfetto: [
            { italian: "credevo che", english: "I believed that" },
            { italian: "sapevo", english: "I knew" },
            { italian: "mi sembrava", english: "it seemed to me" },
            { italian: "mentre", english: "while" },
            { italian: "di solito", english: "usually" },
            { italian: "ogni volta che", english: "every time that" }
        ],
        passato: [
            { italian: "ho deciso di", english: "I decided to" },
            { italian: "ho imparato", english: "I learned" },
            { italian: "sono riuscito/a a", english: "I managed to" },
            { italian: "ho cominciato a", english: "I started to" },
            { italian: "ho finito di", english: "I finished" },
            { italian: "mi è piaciuto", english: "I liked it" }
        ]
    },
    B1: {
        present: [
            { italian: "attualmente", english: "currently" },
            { italian: "oggigiorno", english: "nowadays" },
            { italian: "sto cercando di", english: "I'm trying to" },
            { italian: "mi impegno a", english: "I commit to" },
            { italian: "tendo a", english: "I tend to" },
            { italian: "mi rendo conto che", english: "I realize that" },
            { italian: "vale la pena", english: "it's worth it" }
        ],
        imperfetto: [
            { italian: "stavo per", english: "I was about to" },
            { italian: "avevo intenzione di", english: "I intended to" },
            { italian: "mi aspettavo che", english: "I expected that" },
            { italian: "continuavo a", english: "I kept on" },
            { italian: "nonostante", english: "despite/although" }
        ],
        passato: [
            { italian: "sono riuscito/a a superare", english: "I managed to overcome" },
            { italian: "ho affrontato", english: "I faced" },
            { italian: "mi sono reso/a conto", english: "I realized" },
            { italian: "ho dovuto", english: "I had to" },
            { italian: "è successo che", english: "it happened that" }
        ]
    },
    B2: {
        present: [
            { italian: "per quanto riguarda", english: "as far as...is concerned" },
            { italian: "da un lato...dall'altro", english: "on one hand...on the other" },
            { italian: "nonostante ciò", english: "nevertheless" },
            { italian: "inoltre", english: "moreover" },
            { italian: "d'altra parte", english: "on the other hand" },
            { italian: "di conseguenza", english: "consequently" }
        ],
        imperfetto: [
            { italian: "si diceva che", english: "it was said that" },
            { italian: "si credeva che", english: "it was believed that" },
            { italian: "nell'ambiente in cui", english: "in the environment where" },
            { italian: "all'epoca", english: "at that time" },
            { italian: "man mano che", english: "as/gradually as" }
        ],
        passato: [
            { italian: "in seguito a", english: "following" },
            { italian: "grazie al fatto che", english: "thanks to the fact that" },
            { italian: "di conseguenza", english: "as a result" },
            { italian: "alla fine", english: "in the end" },
            { italian: "dopo aver", english: "after having" }
        ]
    }
};

// Grammar tips by tense
const GRAMMAR_TIPS = {
    present: "Use the present tense for actions happening now or habits. Regular verbs: -are → -o, -i, -a; -ere → -o, -i, -e; -ire → -o, -i, -e",
    imperfetto: "Use imperfetto for ongoing actions in the past, habits, or descriptions. Regular endings: -avo, -avi, -ava, -avamo, -avate, -avano",
    passato: "Use passato prossimo for completed actions. Use 'avere' + past participle for most verbs, 'essere' + past participle for movement/state verbs",
    mixed: "Combine tenses naturally! Use imperfetto for background/ongoing actions, passato prossimo for completed actions, and present for current states"
};

// State
let currentLevel = 'A0';
let currentTense = 'present';
let currentPrompt = '';
let feedbackEnabled = false;
let apiKey = localStorage.getItem('groq_api_key') || '';
let stats = {
    completed: parseInt(localStorage.getItem('prompts_completed') || '0'),
    streak: 0,
    words: parseInt(localStorage.getItem('total_words') || '0')
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadNewPrompt();
    updateStats();
    updateFeedbackStatus();
    initializeParticles();
    
    // Event listeners
    document.getElementById('new-prompt-btn').addEventListener('click', loadNewPrompt);
    document.getElementById('level-select').addEventListener('change', (e) => {
        currentLevel = e.target.value;
        loadNewPrompt();
    });
    document.getElementById('tense-select').addEventListener('change', (e) => {
        currentTense = e.target.value;
        loadNewPrompt();
    });
    document.getElementById('done-btn').addEventListener('click', handleDoneClick);
    document.getElementById('skip-btn').addEventListener('click', loadNewPrompt);
    document.getElementById('toggle-examples').addEventListener('click', toggleExamples);
    
    // Feedback toggle
    document.getElementById('feedback-toggle').addEventListener('change', (e) => {
        feedbackEnabled = e.target.checked;
        updateFeedbackStatus();
        updateDoneButton();
    });
    
    // API key management
    document.getElementById('setup-feedback-btn').addEventListener('click', () => {
        document.getElementById('api-modal').style.display = 'flex';
    });
    document.getElementById('save-api-key-btn').addEventListener('click', saveAPIKey);
    document.getElementById('cancel-api-key-btn').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', closeModal);
    
    // Feedback section
    document.getElementById('close-feedback').addEventListener('click', () => {
        document.getElementById('ai-feedback-section').style.display = 'none';
    });
    document.getElementById('try-another-btn').addEventListener('click', () => {
        document.getElementById('ai-feedback-section').style.display = 'none';
        loadNewPrompt();
    });
});

// Load new prompt
function loadNewPrompt() {
    const level = currentLevel;
    let tense = currentTense;
    
    // Handle mixed tenses
    if (tense === 'mixed') {
        const tenses = ['present', 'imperfetto', 'passato'];
        tense = tenses[Math.floor(Math.random() * tenses.length)];
    }
    
    const prompts = SENTENCE_PROMPTS[level][tense];
    currentPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    
    document.getElementById('prompt-text').textContent = currentPrompt;
    document.getElementById('tense-label').textContent = getTenseLabel(tense);
    document.getElementById('difficulty-label').textContent = level;
    document.getElementById('answer-input').value = '';
    
    // Hide AI feedback section
    document.getElementById('ai-feedback-section').style.display = 'none';
    
    // Update tip
    document.getElementById('tips-content').textContent = GRAMMAR_TIPS[tense];
    
    // Update vocabulary if examples are shown
    if (document.getElementById('examples-content').style.display !== 'none') {
        updateVocabulary(level, tense);
    }
    
    // Hide examples by default on new prompt
    document.getElementById('examples-content').style.display = 'none';
    document.getElementById('toggle-examples').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Show Example Vocabulary
    `;
}

function getTenseLabel(tense) {
    const labels = {
        present: 'Present',
        imperfetto: 'Imperfetto',
        passato: 'Passato Prossimo',
        mixed: 'Mixed Tenses'
    };
    return labels[tense] || tense;
}

function toggleExamples() {
    const content = document.getElementById('examples-content');
    const btn = document.getElementById('toggle-examples');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        let tense = currentTense === 'mixed' ? 'present' : currentTense;
        updateVocabulary(currentLevel, tense);
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
            </svg>
            Hide Example Vocabulary
        `;
    } else {
        content.style.display = 'none';
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Show Example Vocabulary
        `;
    }
}

function updateVocabulary(level, tense) {
    const vocab = VOCABULARY_HELPERS[level][tense];
    const vocabList = document.getElementById('vocab-list');
    
    vocabList.innerHTML = vocab.map(item => `
        <div class="vocab-item">
            <div class="vocab-italian">${item.italian}</div>
            <div class="vocab-english">${item.english}</div>
        </div>
    `).join('');
}

function handleDoneClick() {
    const answer = document.getElementById('answer-input').value.trim();
    
    if (!answer) {
        alert('Please write something first!');
        return;
    }
    
    if (feedbackEnabled) {
        checkAnswerWithAI(answer);
    } else {
        markDone(answer);
    }
}

function markDone(answer) {
    // Count words
    const wordCount = answer.split(/\s+/).filter(w => w.length > 0).length;
    
    // Update stats
    stats.completed++;
    stats.streak++;
    stats.words += wordCount;
    
    // Save to localStorage
    localStorage.setItem('prompts_completed', stats.completed.toString());
    localStorage.setItem('total_words', stats.words.toString());
    
    updateStats();
    
    // Celebrate!
    celebrateCompletion();
    
    // Load next prompt after a moment
    setTimeout(loadNewPrompt, 800);
}

async function checkAnswerWithAI(answer) {
    if (!apiKey) {
        alert('Please set up your API key first!');
        document.getElementById('api-modal').style.display = 'flex';
        return;
    }
    
    const btn = document.getElementById('done-btn');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="0">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </circle>
        </svg>
        <span>Checking...</span>
    `;
    
    try {
        let tense = currentTense;
        if (tense === 'mixed') {
            tense = document.getElementById('tense-label').textContent.toLowerCase();
        }
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{
                    role: 'user',
                    content: `You are an Italian language teacher. A ${currentLevel} level student was asked to: "${currentPrompt}" using ${tense}.

They wrote: "${answer}"

Provide friendly feedback in 3-4 short paragraphs:
1. First, acknowledge what they did well
2. Point out any grammar or vocabulary issues
3. Provide the corrected version in Italian (if needed)
4. Give encouragement

Be supportive and constructive. Keep it concise.`
                }],
                temperature: 0.7,
                max_tokens: 800
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }
        
        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const feedback = data.choices[0].message.content;
            displayFeedback(feedback);
            
            // Still count it as completed
            const wordCount = answer.split(/\s+/).filter(w => w.length > 0).length;
            stats.completed++;
            stats.streak++;
            stats.words += wordCount;
            localStorage.setItem('prompts_completed', stats.completed.toString());
            localStorage.setItem('total_words', stats.words.toString());
            updateStats();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error checking answer. Please check your API key and try again.\n\nError: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

function displayFeedback(feedback) {
    const feedbackSection = document.getElementById('ai-feedback-section');
    const feedbackContent = document.getElementById('ai-feedback-content');
    
    // Convert line breaks to paragraphs
    const paragraphs = feedback.split('\n\n').filter(p => p.trim());
    feedbackContent.innerHTML = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
    
    feedbackSection.style.display = 'block';
    feedbackSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateStats() {
    document.getElementById('prompts-completed').textContent = stats.completed;
    document.getElementById('current-streak').textContent = stats.streak;
    document.getElementById('words-written').textContent = stats.words;
}

function celebrateCompletion() {
    const btn = document.getElementById('done-btn');
    const originalContent = btn.innerHTML;
    
    btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Great job!
    `;
    btn.style.transform = 'scale(1.05)';
    
    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.style.transform = '';
    }, 800);
}

function updateFeedbackStatus() {
    const statusText = document.getElementById('feedback-status').querySelector('.status-text');
    const setupBtn = document.getElementById('setup-feedback-btn');
    
    if (feedbackEnabled) {
        if (apiKey) {
            statusText.textContent = `Ready! Using API key: ${apiKey.slice(0, 8)}...`;
            statusText.classList.add('active');
            setupBtn.style.display = 'inline-block';
            setupBtn.textContent = 'Change Key';
        } else {
            statusText.textContent = 'API key required for feedback';
            statusText.classList.remove('active');
            setupBtn.style.display = 'inline-block';
            setupBtn.textContent = 'Setup';
            // Auto-open modal if enabled but no key
            document.getElementById('api-modal').style.display = 'flex';
        }
    } else {
        statusText.textContent = 'Enable AI feedback to get corrections';
        statusText.classList.remove('active');
        setupBtn.style.display = 'none';
    }
}

function updateDoneButton() {
    const btnText = document.getElementById('done-btn-text');
    if (feedbackEnabled && apiKey) {
        btnText.textContent = 'Check Answer';
    } else {
        btnText.textContent = 'Done';
    }
}

function saveAPIKey() {
    const input = document.getElementById('api-key-input');
    const key = input.value.trim();
    
    if (!key) {
        alert('Please enter an API key');
        return;
    }
    
    if (!key.startsWith('gsk_')) {
        alert('Invalid API key format. Groq API keys should start with "gsk_"');
        return;
    }
    
    apiKey = key;
    localStorage.setItem('groq_api_key', key);
    updateFeedbackStatus();
    updateDoneButton();
    closeModal();
}

function closeModal() {
    document.getElementById('api-modal').style.display = 'none';
    document.getElementById('api-key-input').value = '';
    
    // If feedback was enabled but no key saved, disable feedback
    if (feedbackEnabled && !apiKey) {
        document.getElementById('feedback-toggle').checked = false;
        feedbackEnabled = false;
        updateFeedbackStatus();
        updateDoneButton();
    }
}

// Particle animation
function initializeParticles() {
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

    init();
    animate();

    window.addEventListener('resize', () => {
        cancelAnimationFrame(animationId);
        init();
        animate();
    });
}
