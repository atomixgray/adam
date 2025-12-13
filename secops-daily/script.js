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
    console.log('SecOps Daily initialized');
    loadFeeds();
    
    refreshBtn.addEventListener('click', () => {
        console.log('Refresh button clicked');
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
    console.log('Loading feeds...');
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
        const results = await Promise.allSettled(feedPromises);
        console.log('Feed results:', results);
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        console.log(`Successfully loaded ${successCount}/${results.length} feeds`);
        
        if (allArticles.length === 0) {
            throw new Error('No articles loaded from any source');
        }
        
        // Sort by date (newest first)
        allArticles.sort((a, b) => b.date - a.date);
        
        feedStatus.textContent = `ACTIVE (${successCount}/${results.length})`;
        feedStatus.className = 'status-active';
        updateTimestamp();
        displayArticles();
    } catch (error) {
        console.error('Error loading feeds:', error);
        feedStatus.textContent = 'ERROR';
        feedStatus.className = 'status-error';
        showError('Unable to load feeds due to CORS restrictions. This app requires a backend proxy to work reliably. See console for details.');
    }
}

// Fetch individual RSS feed using AllOrigins as CORS proxy
async function fetchFeed(source, feedUrl) {
    try {
        console.log(`Fetching ${source}...`);
        
        // Try AllOrigins CORS proxy
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
        
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`${source} response received`);
        
        if (data.contents) {
            // Parse XML RSS feed
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data.contents, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('XML parsing error');
            }
            
            const items = xmlDoc.querySelectorAll('item');
            console.log(`${source}: Found ${items.length} items`);
            
            items.forEach((item, index) => {
                if (index < 20) { // Limit to 20 items per feed
                    const title = item.querySelector('title')?.textContent || 'No title';
                    const link = item.querySelector('link')?.textContent || '#';
                    const description = item.querySelector('description')?.textContent || '';
                    const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
                    
                    allArticles.push({
                        title: title.trim(),
                        link: link.trim(),
                        description: stripHtml(description),
                        date: new Date(pubDate),
                        source: source.toUpperCase()
                    });
                }
            });
            
            console.log(`${source}: Loaded ${Math.min(items.length, 20)} articles`);
        } else {
            console.warn(`${source}: No contents in response`, data);
        }
    } catch (error) {
        console.error(`Error fetching ${source}:`, error);
        throw error;
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
    
    console.log(`Displaying ${filtered.length} articles (filter: ${currentFilter})`);
    
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
        <div class="loading-indicator">
            <div class="loading-text">This is a limitation of client-side RSS fetching. The app works as a proof-of-concept but needs a backend proxy for production use.</div>
        </div>
    `;
}
