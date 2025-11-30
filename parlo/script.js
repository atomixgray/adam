// Particle background animation
const canvas = document.getElementById('particles');
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

// Flashcard functionality
let phrases = [];
let currentIndex = 0;
let isFlipped = false;

const flashcard = document.getElementById('flashcard');
const englishText = document.getElementById('englishText');
const italianText = document.getElementById('italianText');
const pronunciationText = document.getElementById('pronunciationText');
const currentCardSpan = document.getElementById('currentCard');
const totalCardsSpan = document.getElementById('totalCards');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');

// Load phrases from JSON file
async function loadPhrases() {
    try {
        const response = await fetch('phrases.json');
        phrases = await response.json();
        totalCardsSpan.textContent = phrases.length;
        displayCard();
    } catch (error) {
        console.error('Error loading phrases:', error);
        englishText.textContent = 'Error loading phrases. Please check phrases.json file.';
    }
}

// Display current card
function displayCard() {
    if (phrases.length === 0) return;
    
    const phrase = phrases[currentIndex];
    englishText.textContent = phrase.english;
    italianText.textContent = phrase.italian;
    pronunciationText.textContent = phrase.pronunciation;
    currentCardSpan.textContent = currentIndex + 1;
    
    // Reset flip state
    isFlipped = false;
    flashcard.classList.remove('flipped');
    
    // Update button states
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === phrases.length - 1;
}

// Flip card
flashcard.addEventListener('click', () => {
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

// Initialize
loadPhrases();
