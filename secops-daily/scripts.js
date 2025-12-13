// RSS Feed sources
const RSS_FEEDS = {
    krebs: 'https://krebsonsecurity.com/feed/',
    bleeping: 'https://www.bleepingcomputer.com/feed/',
    hackernews: 'https://feeds.feedburner.com/TheHackersNews',
    reddit: 'https://www.reddit.com/r/netsec/.rss'
};

let allArticles = [];
let currentFilter = 'all';

// DOM elements
const newsFeed = document.getElementById('newsFeed');
const feedStatus = document.getElementById('feedStatus');
const lastUpdate = document.getElementById('lastUpdate');
const refreshBtn = document.getElementById('refreshBtn');
const sourceButtons = document.querySelectorAll('.source-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFeeds();
    
    refreshBtn.addEventListener('click', () => {
        loadFeeds();
    });
    
    sourceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            sourceButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.source;
            displayArticles();
        });
    });
});

// Load RSS feeds
async function loadFeeds() {
    feedStatus.textContent = 'LOADING...';
    feedStatus.className = 'status-loading';
    allArticles = [];
    
    newsFeed.innerHTML = `
        <div class="loading-indicator">
            <div class="spinner">[████████████████████] 100%</div>
            <div class="loading-text">Fetching security intelligence...</div>
        </div>
    `;
    
    const feedPromises = Object.entries(RSS_FEEDS).map(([source, url]) => 
        fetchFeed(source, url)
    );
    
    try {
        await Promise.all(feedPromises);
        
        // Sort by date (newest first)
        allArticles.sort((a, b) => b.date - a.date);
        
        feedStatus.textContent = 'ACTIVE';
        feedStatus.className = 'status-active';
        updateTimestamp();
        displayArticles();
    } catch (error) {
        feedStatus.textContent = 'ERROR';
        feedStatus.className = 'status-error';
        showError('Failed to load feeds. Please try again.');
    }
}

// Fetch individual RSS feed using rss2json API
async function fetchFeed(source, feedUrl) {
    try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.status === 'ok' && data.items) {
            data.items.forEach(item => {
                allArticles.push({
                    title: item.title,
                    link: item.link,
                    description: stripHtml(item.description || item.content || ''),
                    date: new Date(item.pubDate),
                    source: source.toUpperCase()
                });
            });
        }
    } catch (error) {
        console.error(`Error fetching ${source}:`, error);
    }
}

// Strip HTML tags and truncate description
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = tmp.textContent || tmp.innerText || '';
    return text.length > 200 ? text.substring(0, 200) + '...' : text;
}

// Display articles based on current filter
function displayArticles() {
    const filtered = currentFilter === 'all' 
        ? allArticles 
        : allArticles.filter(a => a.source.toLowerCase() === currentFilter);
    
    if (filtered.length === 0) {
        newsFeed.innerHTML = `
            <div class="loading-indicator">
                <div class="loading-text">No articles found for this source.</div>
            </div>
        `;
        return;
    }
    
    newsFeed.innerHTML = filtered.map(article => `
        <div class="news-item">
            <div class="news-meta">
                <span class="news-time">[${formatTime(article.date)}]</span>
                <span class="news-source">[${article.source}]</span>
            </div>
            <div class="news-title">
                <a href="${article.link}" target="_blank" rel="noopener">${article.title}</a>
            </div>
            ${article.description ? `<div class="news-description">${article.description}</div>` : ''}
        </div>
    `).join('');
}

// Format timestamp
function formatTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

// Update last update timestamp
function updateTimestamp() {
    const now = new Date();
    lastUpdate.textContent = now.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Show error message
function showError(message) {
    newsFeed.innerHTML = `
        <div class="error-message">
            [ERROR] ${message}
        </div>
    `;
}
