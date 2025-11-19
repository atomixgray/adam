class FlashcardApp {
    constructor() {
        this.phrases = [];
        this.currentIndex = 0;
        this.isFlipped = false;
        
        this.initializeElements();
        this.loadPhrases();
        this.bindEvents();
    }
    
    initializeElements() {
        this.flashcard = document.getElementById('flashcard');
        this.italianText = document.getElementById('italianText');
        this.pronunciation = document.getElementById('pronunciation');
        this.englishText = document.getElementById('englishText');
        this.currentCard = document.getElementById('currentCard');
        this.totalCards = document.getElementById('totalCards');
        this.progressFill = document.getElementById('progressFill');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
    }
    
    async loadPhrases() {
        try {
            const response = await fetch('phrases.json');
            this.phrases = await response.json();
            this.shufflePhrases(); // Randomize the order
            this.totalCards.textContent = this.phrases.length;
            this.displayCurrentCard();
            this.updateNavigation();
        } catch (error) {
            console.error('Error loading phrases:', error);
            this.italianText.textContent = 'Error loading phrases';
            this.pronunciation.textContent = '';
        }
    }
    
    // Fisher-Yates shuffle algorithm for random order
    shufflePhrases() {
        for (let i = this.phrases.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.phrases[i], this.phrases[j]] = [this.phrases[j], this.phrases[i]];
        }
    }
    
    bindEvents() {
        this.flashcard.addEventListener('click', () => this.flipCard());
        this.prevBtn.addEventListener('click', () => this.previousCard());
        this.nextBtn.addEventListener('click', () => this.nextCard());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.previousCard();
            if (e.key === 'ArrowRight') this.nextCard();
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.flipCard();
            }
        });
    }
    
    displayCurrentCard() {
        if (this.phrases.length === 0) return;
        
        const phrase = this.phrases[this.currentIndex];
        this.italianText.textContent = phrase.italian;
        this.pronunciation.textContent = phrase.pronunciation;
        this.englishText.textContent = phrase.english;
        
        this.currentCard.textContent = this.currentIndex + 1;
        this.updateProgress();
        
        // Reset flip state
        this.isFlipped = false;
        this.flashcard.classList.remove('flipped');
    }
    
    flipCard() {
        this.isFlipped = !this.isFlipped;
        this.flashcard.classList.toggle('flipped');
    }
    
    nextCard() {
        if (this.currentIndex < this.phrases.length - 1) {
            this.currentIndex++;
            this.displayCurrentCard();
            this.updateNavigation();
        }
    }
    
    previousCard() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.displayCurrentCard();
            this.updateNavigation();
        }
    }
    
    updateNavigation() {
        this.prevBtn.disabled = this.currentIndex === 0;
        this.nextBtn.disabled = this.currentIndex === this.phrases.length - 1;
    }
    
    updateProgress() {
        const progress = ((this.currentIndex + 1) / this.phrases.length) * 100;
        this.progressFill.style.width = `${progress}%`;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FlashcardApp();
});
