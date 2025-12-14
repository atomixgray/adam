// RSS Feed sources
const RSS_FEEDS = {
    krebs: 'https://krebsonsecurity.com/feed/',
    bleeping: 'https://www.bleepingcomputer.com/feed/',
    hackernews: 'https://feeds.feedburner.com/TheHackersNews',
    darkreading: 'https://www.darkreading.com/rss.xml',
    threatpost: 'https://threatpost.com/feed/',
    securityweek: 'https://www.securityweek.com/feed/',
    sans: 'https://isc.sans.edu/rssfeed.xml'
};

// IMPORTANT: Replace this with your actual Cloudflare Worker URL after deployment
const PROXY_URL = 'https://rss-proxy.adamlarkin.workers.dev;

// Critical security keywords to highlight
const CRITICAL_KEYWORDS = [
    'zero-day', 'zero day', '0day', '0-day',
    'RCE', 'remote code execution',
    'critical vulnerability', 'critical flaw',
    'ransomware', 'data breach', 'breach',
    'actively exploited', 'in the wild',
    'emergency patch', 'critical patch'
];

const HIGH_KEYWORDS = [
    'vulnerability', 'exploit', 'malware',
    'backdoor', 'trojan', 'botnet',
    'phishing', 'attack', 'compromised',
    'threat actor', 'APT', 'targeted attack'
];

let allArticles = [];
let currentFilter = 'all';

// DOM elements
const newsFeed = document.getElementById('newsFeed');
const feedStatus = document.getElementById('feedStatus');
const lastUpdate = document.getElementById('lastUpdate');
const refreshBtn = document.getElementById('refreshBtn');
const sourceButtons = document.querySelectorAll('.source-btn');
const statsContainer = document.getElementById('stats');
const searchInput = document.getElementById('searchInput');
const searchCount = document.getElementById('searchCount');

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
    
    // Search functionality
    searchInput.addEventListener('input', (e) => {
        displayArticles();
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
        updateStats();
        displayArticles();
    } catch (error) {
        console.error('Error loading feeds:', error);
        feedStatus.textContent = 'ERROR';
        feedStatus.className = 'status-error';
        showError('Unable to load feeds due to CORS restrictions. This app requires a backend proxy to work reliably. See console for details.');
    }
}

// Fetch individual RSS feed via Cloudflare Worker proxy
async function fetchFeed(source, feedUrl) {
    try {
        console.log(`Fetching ${source}...`);
        
        // Use Cloudflare Worker proxy
        const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(feedUrl)}`;
        
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        
        // Parse XML RSS feed
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
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

// Highlight critical keywords and CVEs
function highlightKeywords(text) {
    let highlighted = text;
    
    // Highlight CVEs and make them clickable
    highlighted = highlighted.replace(/CVE-\d{4}-\d{4,}/gi, (match) => {
        const cveId = match.toUpperCase();
        const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cveId}`;
        return `<a href="${nvdUrl}" target="_blank" rel="noopener" class="cve-link" title="View on NVD">${cveId}</a>`;
    });
    
    // Highlight critical keywords in red
    CRITICAL_KEYWORDS.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        highlighted = highlighted.replace(regex, (match) => `<span class="keyword-critical">${match}</span>`);
    });
    
    // Highlight high keywords in orange
    HIGH_KEYWORDS.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        highlighted = highlighted.replace(regex, (match) => `<span class="keyword-high">${match}</span>`);
    });
    
    return highlighted;
}

// Calculate statistics
function updateStats() {
    if (allArticles.length === 0) {
        statsContainer.innerHTML = '';
        return;
    }
    
    // Count articles by time
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    const lastHour = allArticles.filter(a => a.date >= oneHourAgo).length;
    const last24h = allArticles.filter(a => a.date >= oneDayAgo).length;
    
    // Count CVEs
    const cveCount = allArticles.filter(a => 
        /CVE-\d{4}-\d{4,}/i.test(a.title + ' ' + a.description)
    ).length;
    
    // Count critical articles
    const criticalCount = allArticles.filter(a => {
        const text = (a.title + ' ' + a.description).toLowerCase();
        return CRITICAL_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    }).length;
    
    // Most active source
    const sourceCounts = {};
    allArticles.forEach(a => {
        sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
    });
    const mostActive = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
    
    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">TOTAL:</span>
            <span class="stat-value">${allArticles.length}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">1H:</span>
            <span class="stat-value">${lastHour}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">24H:</span>
            <span class="stat-value">${last24h}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">CVEs:</span>
            <span class="stat-value stat-cve">${cveCount}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">CRITICAL:</span>
            <span class="stat-value stat-critical">${criticalCount}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">TOP:</span>
            <span class="stat-value">${mostActive[0]}</span>
        </div>
    `;
}

// Display articles based on current filter and search
function displayArticles() {
    // Filter by source
    let filtered = currentFilter === 'all' 
        ? allArticles 
        : allArticles.filter(a => a.source.toLowerCase() === currentFilter);
    
    // Filter by search term
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(article => {
            const searchableText = (article.title + ' ' + article.description).toLowerCase();
            return searchableText.includes(searchTerm);
        });
    }
    
    console.log(`Displaying ${filtered.length} articles (filter: ${currentFilter}, search: "${searchTerm}")`);
    
    // Update search count
    if (searchTerm) {
        searchCount.textContent = `Found ${filtered.length} article${filtered.length !== 1 ? 's' : ''} matching "${searchTerm}"`;
    } else {
        searchCount.textContent = '';
    }
    
    if (filtered.length === 0) {
        newsFeed.innerHTML = `
            <div class="loading-indicator">
                <div class="loading-text">No articles found${searchTerm ? ` matching "${searchTerm}"` : ' for this source'}.</div>
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
                <a href="${article.link}" target="_blank" rel="noopener">${highlightKeywords(article.title)}</a>
            </div>
            ${article.description ? `<div class="news-description">${highlightKeywords(article.description)}</div>` : ''}
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
