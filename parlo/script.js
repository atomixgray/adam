// Flashcard functionality
let phrases = [];
let currentIndex = 0;
let isFlipped = false;
let studyMode = 'italian-to-english'; // 'italian-to-english', 'english-to-italian', 'mixed'

// Storage keys
const STORAGE_KEY = 'parla_progress';
const MODE_STORAGE_KEY = 'parla_study_mode';

const flashcard = document.getElementById('flashcard');
const englishText = document.getElementById('englishText');
const italianText = document.getElementById('italianText');
const pronunciationText = document.getElementById('pronunciationText');
const currentCardSpan = document.getElementById('currentCard');
const totalCardsSpan = document.getElementById('totalCards');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const resetBtn = document.getElementById('resetBtn');
const modeButtons = document.querySelectorAll('.mode-btn');

// Speech synthesis for audio pronunciation
let currentUtterance = null;

function speakItalian(text) {
    // Cancel any ongoing speech
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    // Create new utterance
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'it-IT';
    currentUtterance.rate = 0.85; // Slightly slower for learning
    currentUtterance.pitch = 1.0;
    
    // Try to find an Italian voice, preferring male voices
    const voices = speechSynthesis.getVoices();
    
    // First, try to find a male Italian voice
    let italianVoice = voices.find(voice => 
        voice.lang.startsWith('it') && 
        !voice.name.toLowerCase().includes('female') &&
        (voice.name.toLowerCase().includes('male') || 
         voice.name.toLowerCase().includes('diego') ||
         voice.name.toLowerCase().includes('luca') ||
         voice.name.toLowerCase().includes('cosimo') ||
         voice.name.toLowerCase().includes('giorgio'))
    );
    
    // If no explicitly male voice found, just get any Italian voice
    if (!italianVoice) {
        italianVoice = voices.find(voice => voice.lang.startsWith('it'));
    }
    
    if (italianVoice) {
        currentUtterance.voice = italianVoice;
        console.log('Using voice:', italianVoice.name);
    }
    
    speechSynthesis.speak(currentUtterance);
}

// Load voices when they're ready (some browsers load them async)
speechSynthesis.addEventListener('voiceschanged', () => {
    const voices = speechSynthesis.getVoices();
    const italianVoices = voices.filter(v => v.lang.startsWith('it'));
    console.log('Available Italian voices:');
    italianVoices.forEach(v => {
        console.log(`- ${v.name} (${v.lang}) [${v.localService ? 'Local' : 'Remote'}]`);
    });
});

// Load phrases from JSON file
async function loadPhrases() {
    try {
        console.log('Loading phrases...');
        const response = await fetch('phrases.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        phrases = await response.json();
        console.log(`Loaded ${phrases.length} phrases`);
        totalCardsSpan.textContent = phrases.length;
        
        // Load saved mode and progress
        loadStudyMode();
        loadProgress();
        displayCard();
    } catch (error) {
        console.error('Error loading phrases:', error);
        englishText.textContent = 'Error loading phrases. Check console for details.';
    }
}

// Display current card
function displayCard() {
    if (phrases.length === 0) return;
    
    const phrase = phrases[currentIndex];
    
    // Determine what to show based on study mode
    let showItalianFirst = studyMode === 'italian-to-english';
    if (studyMode === 'mixed') {
        showItalianFirst = Math.random() < 0.5;
    }
    
    if (showItalianFirst) {
        // Italian on front, English on back
        italianText.textContent = phrase.italian;
        pronunciationText.textContent = phrase.pronunciation;
        englishText.textContent = phrase.english;
        document.querySelector('.card-front .language-label').textContent = 'Italiano';
        document.querySelector('.card-back .language-label').textContent = 'English';
        document.querySelector('.card-front .flip-hint').textContent = 'Click to reveal English';
        document.querySelector('.card-back .flip-hint').textContent = 'Click to see Italian';
        
        // Clear pronunciation from back (English side doesn't need it)
        const backPronunciation = document.querySelector('.card-back .pronunciation');
        if (backPronunciation) {
            backPronunciation.textContent = '';
        }
        
        // Store the Italian text for audio button
        document.querySelector('.card-front').setAttribute('data-italian-text', phrase.italian);
    } else {
        // English on front, Italian on back
        italianText.textContent = phrase.english;
        pronunciationText.textContent = '';
        englishText.textContent = phrase.italian;
        document.querySelector('.card-front .language-label').textContent = 'English';
        document.querySelector('.card-back .language-label').textContent = 'Italiano';
        document.querySelector('.card-front .flip-hint').textContent = 'Click to reveal Italian';
        document.querySelector('.card-back .flip-hint').textContent = 'Click to see English';
        
        // Show pronunciation on back for English-to-Italian mode
        const backPronunciation = document.querySelector('.card-back .pronunciation');
        if (backPronunciation) {
            backPronunciation.textContent = phrase.pronunciation;
        }
        
        // Store the Italian text for audio button on back
        document.querySelector('.card-back').setAttribute('data-italian-text', phrase.italian);
    }
    
    currentCardSpan.textContent = currentIndex + 1;
    
    // Reset flip state
    isFlipped = false;
    flashcard.classList.remove('flipped');
    
    // Update button states
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === phrases.length - 1;
    
    // Save progress
    saveProgress();
}

// Save progress to localStorage
function saveProgress() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            currentIndex: currentIndex,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.warn('Could not save progress:', error);
    }
}

// Load progress from localStorage
function loadProgress() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.currentIndex >= 0 && data.currentIndex < phrases.length) {
                currentIndex = data.currentIndex;
                console.log(`Restored progress: card ${currentIndex + 1}`);
            }
        }
    } catch (error) {
        console.warn('Could not load progress:', error);
    }
}

// Save study mode
function saveStudyMode() {
    try {
        localStorage.setItem(MODE_STORAGE_KEY, studyMode);
    } catch (error) {
        console.warn('Could not save study mode:', error);
    }
}

// Load study mode
function loadStudyMode() {
    try {
        const saved = localStorage.getItem(MODE_STORAGE_KEY);
        if (saved) {
            studyMode = saved;
            updateModeButtons();
            console.log(`Restored study mode: ${studyMode}`);
        }
    } catch (error) {
        console.warn('Could not load study mode:', error);
    }
}

// Update mode button states
function updateModeButtons() {
    modeButtons.forEach(btn => {
        if (btn.dataset.mode === studyMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Reset progress
function resetProgress() {
    if (confirm('Reset your progress and start from the beginning?')) {
        currentIndex = 0;
        localStorage.removeItem(STORAGE_KEY);
        displayCard();
        console.log('Progress reset');
    }
}

// Flip card (but not if clicking speaker button)
flashcard.addEventListener('click', (e) => {
    // Don't flip if clicking speaker button
    if (e.target.closest('.speaker-btn')) {
        return;
    }
    isFlipped = !isFlipped;
    flashcard.classList.toggle('flipped');
});

// Navigation
prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        displayCard();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentIndex < phrases.length - 1) {
        currentIndex++;
        displayCard();
    }
});

// Shuffle
shuffleBtn.addEventListener('click', () => {
    // Fisher-Yates shuffle
    for (let i = phrases.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [phrases[i], phrases[j]] = [phrases[j], phrases[i]];
    }
    currentIndex = 0;
    displayCard();
});

// Reset progress
resetBtn.addEventListener('click', resetProgress);

// Study mode selection
modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        studyMode = btn.dataset.mode;
        updateModeButtons();
        saveStudyMode();
        displayCard();
    });
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && currentIndex > 0) {
        currentIndex--;
        displayCard();
    } else if (e.key === 'ArrowRight' && currentIndex < phrases.length - 1) {
        currentIndex++;
        displayCard();
    } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        isFlipped = !isFlipped;
        flashcard.classList.toggle('flipped');
    }
});

// Touch/Swipe support for mobile
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let isSwiping = false;

flashcard.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    isSwiping = false;
}, { passive: true });

flashcard.addEventListener('touchmove', (e) => {
    if (!isSwiping) {
        const currentX = e.changedTouches[0].screenX;
        const currentY = e.changedTouches[0].screenY;
        const diffX = Math.abs(currentX - touchStartX);
        const diffY = Math.abs(currentY - touchStartY);
        
        // Detect horizontal swipe
        if (diffX > diffY && diffX > 10) {
            isSwiping = true;
        }
    }
}, { passive: true });

flashcard.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
    isSwiping = false;
}, { passive: true });

function handleSwipe() {
    const swipeThreshold = 50; // minimum distance for a swipe
    const horizontalSwipe = Math.abs(touchEndX - touchStartX);
    const verticalSwipe = Math.abs(touchEndY - touchStartY);
    
    // Only register horizontal swipes (not vertical scrolling)
    if (horizontalSwipe > verticalSwipe && horizontalSwipe > swipeThreshold) {
        if (touchEndX < touchStartX) {
            // Swiped left - go to next card
            if (currentIndex < phrases.length - 1) {
                currentIndex++;
                displayCard();
            }
        }
        
        if (touchEndX > touchStartX) {
            // Swiped right - go to previous card
            if (currentIndex > 0) {
                currentIndex--;
                displayCard();
            }
        }
    }
}

// Particle background animation
function initParticles() {
    const canvas = document.getElementById('particles');
    if (!canvas) {
        console.warn('Particles canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const particleCount = 80;
    const connectionDistance = 150;
    
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.radius = Math.random() * 2 + 1;
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }
        
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(102, 126, 234, 0.5)';
            ctx.fill();
        }
    }
    
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < connectionDistance) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(102, 126, 234, ${0.2 * (1 - distance / connectionDistance)})`;
                    ctx.lineWidth = 1;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    console.log('Initializing app...');
    initParticles();
    loadPhrases();
}
