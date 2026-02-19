// RSS Feed sources - NEWS
const NEWS_FEEDS = {
    krebs: 'https://krebsonsecurity.com/feed/',
    bleeping: 'https://www.bleepingcomputer.com/feed/',
    hackernews: 'https://feeds.feedburner.com/TheHackersNews',
    darkreading: 'https://www.darkreading.com/rss.xml',
    register: 'https://www.theregister.com/security/headlines.atom',
    cso: 'https://www.csoonline.com/feed/',
    securityweek: 'https://www.securityweek.com/feed/',
    sans: 'https://isc.sans.edu/rssfeed.xml',
    // SOPHOS REPLACED WITH SCHNEIER (Sophos killed their RSS feed)
    schneier: 'https://www.schneier.com/feed/atom/',
    threatpost: 'https://threatpost.com/feed/'
};

// RSS Feed sources - INTEL FEEDS
const INTEL_FEEDS = {
    cisa_alerts: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    uscert: 'https://www.cisa.gov/uscert/ncas/current-activity.xml',
    talos: 'https://feeds.feedburner.com/feedburner/Talos',
    mitre: 'https://medium.com/feed/mitre-attack',
    // NEW SOURCES ADDED
    crowdstrike: 'https://www.crowdstrike.com/blog/feed/',
    unit42: 'https://unit42.paloaltonetworks.com/feed/',
    // RAW EXPLOIT DATA
    exploitdb: 'https://www.exploit-db.com/rss.xml',
    akamai: 'https://feeds.feedburner.com/akamai/blog'
};

// IMPORTANT: Replace this with your actual Cloudflare Worker URL after deployment
const PROXY_URL = 'https://rss-proxy.adamlarkin.workers.dev';

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
let currentView = 'all'; // 'all' or 'bookmarks'
let showTrends = false; // Toggle for trends panel
let aiAnalysisCache = null; // Cache AI analysis for 1 hour
let aiAnalysisLoading = false; // Loading state for AI analysis

// Bookmark management
function getBookmarks() {
    const bookmarks = localStorage.getItem('secops_bookmarks');
    return bookmarks ? JSON.parse(bookmarks) : [];
}

function isBookmarked(articleLink) {
    const bookmarks = getBookmarks();
    return bookmarks.some(b => b.link === articleLink);
}

function toggleBookmark(article) {
    const bookmarks = getBookmarks();
    const existingIndex = bookmarks.findIndex(b => b.link === article.link);
    
    if (existingIndex >= 0) {
        // Remove bookmark
        bookmarks.splice(existingIndex, 1);
    } else {
        // Add bookmark
        bookmarks.push({
            title: article.title,
            link: article.link,
            source: article.source,
            date: article.date.toISOString(),
            bookmarkedAt: new Date().toISOString()
        });
    }
    
    localStorage.setItem('secops_bookmarks', JSON.stringify(bookmarks));
    displayArticles(); // Refresh display to update bookmark icons
}

// Trends analysis
function analyzeTrends() {
    if (allArticles.length === 0) return null;
    
    // Extract all CVEs
    const cvePattern = /CVE-\d{4}-\d{4,}/gi;
    const cveCount = {};
    
    allArticles.forEach(article => {
        const text = article.title + ' ' + article.description;
        const matches = text.match(cvePattern);
        if (matches) {
            matches.forEach(cve => {
                const normalized = cve.toUpperCase();
                cveCount[normalized] = (cveCount[normalized] || 0) + 1;
            });
        }
    });
    
    // Count critical keywords
    const keywordCount = {};
    const trackKeywords = [
        'ransomware', 'zero-day', '0-day', 'RCE', 'data breach', 
        'critical vulnerability', 'exploit', 'malware', 'APT',
        'phishing', 'supply chain', 'backdoor'
    ];
    
    allArticles.forEach(article => {
        const text = (article.title + ' ' + article.description).toLowerCase();
        trackKeywords.forEach(keyword => {
            if (text.includes(keyword.toLowerCase())) {
                keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
            }
        });
    });
    
    // Get top items
    const topCVEs = Object.entries(cveCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const topKeywords = Object.entries(keywordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    return { topCVEs, topKeywords };
}

function toggleTrendsPanel() {
    showTrends = !showTrends;
    const trendsPanel = document.getElementById('trendsPanel');
    const toggleBtn = document.getElementById('toggleTrendsBtn');
    
    if (showTrends) {
        trendsPanel.style.display = 'block';
        toggleBtn.textContent = 'HIDE TRENDS';
        
        // Show AI analysis option at the top with close button
        const trendsContent = document.getElementById('trendsContent');
        trendsContent.innerHTML = `
            <button class="trends-close-btn" onclick="closeTrendsPanel()" title="Close">×</button>
            <div class="trends-choice">
                <button onclick="generateAIAnalysis()" class="ai-analysis-btn">🤖 AI THREAT ANALYSIS</button>
                <button onclick="updateTrendsPanel()" class="keyword-analysis-btn">📊 KEYWORD TRENDS</button>
            </div>
        `;
    } else {
        closeTrendsPanel();
    }
}

// Close trends panel helper
function closeTrendsPanel() {
    showTrends = false;
    const trendsPanel = document.getElementById('trendsPanel');
    const toggleBtn = document.getElementById('toggleTrendsBtn');
    
    trendsPanel.style.display = 'none';
    toggleBtn.textContent = 'TRENDING';
}

// Make closeTrendsPanel global for onclick
window.closeTrendsPanel = closeTrendsPanel;

function updateTrendsPanel() {
    const trends = analyzeTrends();
    const trendsContent = document.getElementById('trendsContent');
    
    if (!trends || (trends.topCVEs.length === 0 && trends.topKeywords.length === 0)) {
        trendsContent.innerHTML = '<div class="trends-empty">No trend data available yet. Refresh feeds to analyze.</div>';
        return;
    }
    
    const maxCount = Math.max(
        trends.topCVEs.length > 0 ? trends.topCVEs[0][1] : 0,
        trends.topKeywords.length > 0 ? trends.topKeywords[0][1] : 0
    );
    
    let html = '';
    
    // Top CVEs section
    if (trends.topCVEs.length > 0) {
        html += '<div class="trends-section"><h3 class="trends-title">[TOP CVEs TODAY - CLICK TO FILTER]</h3>';
        trends.topCVEs.forEach(([cve, count]) => {
            const percentage = (count / maxCount) * 100;
            html += `
                <div class="trend-item">
                    <div class="trend-label">
                        <span class="trend-cve-filter" onclick="filterByCVE('${cve}')" title="Click to filter articles">${cve}</span>
                        <a href="https://nvd.nist.gov/vuln/detail/${cve}" target="_blank" class="trend-nvd-link" title="View on NVD">[NVD]</a>
                        <span class="trend-count">${count}</span>
                    </div>
                    <div class="trend-bar-container">
                        <div class="trend-bar trend-bar-cve" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Top Keywords section
    if (trends.topKeywords.length > 0) {
        html += '<div class="trends-section"><h3 class="trends-title">[TRENDING THREATS - CLICK TO FILTER]</h3>';
        trends.topKeywords.forEach(([keyword, count]) => {
            const percentage = (count / maxCount) * 100;
            html += `
                <div class="trend-item">
                    <div class="trend-label">
                        <span class="trend-keyword-filter" onclick="filterByKeyword('${keyword}')" title="Click to filter articles">${keyword.toUpperCase()}</span>
                        <span class="trend-count">${count}</span>
                    </div>
                    <div class="trend-bar-container">
                        <div class="trend-bar trend-bar-keyword" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    trendsContent.innerHTML = html;
}

// AI-powered threat analysis
async function generateAIAnalysis() {
    const trendsContent = document.getElementById('trendsContent');
    const toggleBtn = document.getElementById('toggleTrendsBtn');
    
    // Check cache first (1 hour)
    if (aiAnalysisCache && aiAnalysisCache.timestamp > Date.now() - 3600000) {
        displayAIAnalysis(aiAnalysisCache.data);
        return;
    }
    
    if (aiAnalysisLoading) return; // Prevent duplicate requests
    
    aiAnalysisLoading = true;
    toggleBtn.textContent = 'ANALYZING...';
    toggleBtn.disabled = true;
    
    trendsContent.innerHTML = '<div class="ai-loading">🤖 AI analyzing threat landscape...</div>';
    
    try {
        // Prepare articles data for AI
        const articlesData = allArticles.map(a => ({
            title: a.title,
            source: a.source,
            date: a.date.toISOString(),
            description: a.description
        }));
        
        const response = await fetch(`${PROXY_URL}/analyze-trends`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ articles: articlesData })
        });
        
        if (!response.ok) {
            throw new Error(`AI analysis failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Cache the result
        aiAnalysisCache = {
            data,
            timestamp: Date.now()
        };
        
        displayAIAnalysis(data);
        
    } catch (error) {
        console.error('AI analysis error:', error);
        trendsContent.innerHTML = `
            <div class="ai-error">
                ⚠️ AI analysis unavailable. ${error.message}
                <br><br>
                <button onclick="updateTrendsPanel()" class="ai-fallback-btn">Show keyword trends instead</button>
            </div>
        `;
    } finally {
        aiAnalysisLoading = false;
        toggleBtn.textContent = 'AI ANALYSIS';
        toggleBtn.disabled = false;
    }
}

// Display AI analysis results
function displayAIAnalysis(data) {
    const trendsContent = document.getElementById('trendsContent');
    
    if (!data.threats || data.threats.length === 0) {
        trendsContent.innerHTML = '<div class="ai-empty">No significant threats detected in recent articles.</div>';
        return;
    }
    
    let html = '<div class="ai-analysis-header">';
    html += '<h3 class="trends-title">🤖 [AI THREAT ANALYSIS - LAST 24H]</h3>';
    html += `<div class="ai-meta">Analyzed ${data.analyzed_count} articles • Updated ${new Date(data.timestamp).toLocaleTimeString()}</div>`;
    html += '</div>';
    
    html += '<div class="ai-threats">';
    
    data.threats.forEach((threat, index) => {
        const severityClass = `severity-${threat.severity || 'medium'}`;
        const severityIcon = threat.severity === 'critical' ? '🔴' : threat.severity === 'high' ? '🟠' : '🟡';
        
        html += `
            <div class="ai-threat-card ${severityClass}">
                <div class="ai-threat-header">
                    <span class="ai-threat-number">#${index + 1}</span>
                    <span class="ai-threat-severity">${severityIcon} ${(threat.severity || 'medium').toUpperCase()}</span>
                </div>
                <div class="ai-threat-name">${threat.threat}</div>
                <div class="ai-threat-description">${threat.description}</div>
            </div>
        `;
    });
    
    html += '</div>';
    
    html += '<div class="ai-footer">';
    html += '<button onclick="updateTrendsPanel()" class="ai-switch-btn">Switch to keyword trends</button>';
    html += '</div>';
    
    trendsContent.innerHTML = html;
}

// Filter articles by CVE (global for onclick)
window.filterByCVE = function(cve) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = cve;
        searchInput.focus();
        displayArticles();
        
        // Scroll to articles
        document.querySelector('.news-feed')?.scrollIntoView({ behavior: 'smooth' });
    }
}

// Filter articles by keyword (global for onclick)
window.filterByKeyword = function(keyword) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = keyword;
        searchInput.focus();
        displayArticles();
        
        // Scroll to articles
        document.querySelector('.news-feed')?.scrollIntoView({ behavior: 'smooth' });
    }
}

// DOM elements
const newsFeed = document.getElementById('newsFeed');
const feedStatus = document.getElementById('feedStatus');
const lastUpdate = document.getElementById('lastUpdate');
const refreshBtn = document.getElementById('refreshBtn');
const sourceButtons = document.querySelectorAll('.source-btn');
const statsContainer = document.getElementById('stats');
const searchInput = document.getElementById('searchInput');
const searchCount = document.getElementById('searchCount');
const viewButtons = document.querySelectorAll('.view-btn');
const shortcutsModal = document.getElementById('shortcutsModal');
const closeModal = document.querySelector('.close-modal');
const terminalTitle = document.getElementById('terminalTitle');
const backToTopBtn = document.getElementById('backToTop');

// Back to top button functionality
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        backToTopBtn.classList.add('visible');
    } else {
        backToTopBtn.classList.remove('visible');
    }
});

backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// Update timestamps every minute
setInterval(() => {
    const items = document.querySelectorAll('.news-time');
    items.forEach(item => {
        // Find the corresponding article and update its timestamp
        // This is a simplified version - you'd need to store article data to do this properly
    });
}, 60000); // Update every minute

// Set dynamic greeting based on time of day
function setGreeting() {
    const hour = new Date().getHours();
    let greeting;
    
    if (hour >= 5 && hour < 12) {
        greeting = 'Good morning, SecOps.';
    } else if (hour >= 12 && hour < 17) {
        greeting = 'Good afternoon, SecOps.';
    } else if (hour >= 17 && hour < 24) {
        greeting = 'Good evening, SecOps.';
    } else {
        greeting = 'Still hunting? Get some rest.';
    }
    
    if (terminalTitle) {
        terminalTitle.textContent = greeting;
    }
    
    console.log(`Current hour: ${hour}, Greeting: ${greeting}`); // Debug
}

// Keyboard shortcuts handler
function handleKeyboardShortcuts(e) {
    // Don't trigger if user is typing in search
    if (document.activeElement === searchInput) {
        // Allow Esc to blur search
        if (e.key === 'Escape') {
            searchInput.blur();
            searchInput.value = '';
            displayArticles();
        }
        return;
    }
    
    // Keyboard shortcuts
    switch(e.key.toLowerCase()) {
        case 'a':
            // Switch to ALL FEEDS
            document.querySelector('[data-view="all"]')?.click();
            break;
        case 'b':
            // Switch to BOOKMARKS
            document.querySelector('[data-view="bookmarks"]')?.click();
            break;
        case 'r':
            // Refresh
            e.preventDefault();
            refreshBtn.click();
            break;
        case '/':
            // Focus search
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
            }
            break;
        case '?':
            // Show shortcuts
            e.preventDefault();
            if (shortcutsModal) {
                shortcutsModal.style.display = 'flex';
            }
            break;
        case 'escape':
            // Close modal or trends panel
            if (shortcutsModal && shortcutsModal.style.display === 'flex') {
                shortcutsModal.style.display = 'none';
            } else if (showTrends) {
                closeTrendsPanel();
            }
            break;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('SecOps Daily initialized');
    
    // Set greeting immediately
    setGreeting();
    
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
    
    // Search functionality - check if element exists
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            displayArticles();
        });
    }
    
    // Shortcuts modal
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            shortcutsModal.style.display = 'none';
        });
    }
    
    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) {
            shortcutsModal.style.display = 'none';
        }
    });
    
    // View switching (ALL FEEDS vs BOOKMARKS)
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            
            // Reset source filter to ALL when switching views
            currentFilter = 'all';
            document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
            document.querySelector(`[data-source="all"]`).classList.add('active');
            
            displayArticles();
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

// Load RSS feeds
async function loadFeeds() {
    console.log('Loading feeds...');
    feedStatus.textContent = 'LOADING...';
    feedStatus.className = 'status-loading';
    allArticles = [];
    
    // Show loading skeleton
    newsFeed.innerHTML = `
        <div class="skeleton-item">
            <div class="skeleton skeleton-meta"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-description"></div>
        </div>
        <div class="skeleton-item">
            <div class="skeleton skeleton-meta"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-description"></div>
        </div>
        <div class="skeleton-item">
            <div class="skeleton skeleton-meta"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-description"></div>
        </div>
    `;
    
    // Load both NEWS and INTEL feeds
    const allFeeds = { ...NEWS_FEEDS, ...INTEL_FEEDS };
    const feedPromises = Object.entries(allFeeds).map(([source, url]) => 
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
        
        // Update trends panel if visible
        if (showTrends) {
            updateTrendsPanel();
        }
    } catch (error) {
        console.error('Error loading feeds:', error);
        feedStatus.textContent = 'ERROR';
        feedStatus.className = 'status-error';
        showError('Failed to load feeds. Check console for details or try refreshing.');
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
        
        // Handle both RSS (item) and Atom (entry) formats
        let items = xmlDoc.querySelectorAll('item');
        if (items.length === 0) {
            items = xmlDoc.querySelectorAll('entry'); // Atom format (Reddit, etc.)
        }
        
        console.log(`${source}: Found ${items.length} items`);
        
        items.forEach((item, index) => {
            if (index < 20) { // Limit to 20 items per feed
                // Get title (same for both RSS and Atom)
                const title = item.querySelector('title')?.textContent || 'No title';
                
                // Get link (different for RSS vs Atom)
                let link = item.querySelector('link')?.textContent?.trim();
                if (!link || link === '') {
                    // Atom format uses href attribute
                    link = item.querySelector('link')?.getAttribute('href');
                }
                if (!link) link = '#';
                
                // Get description/content (different names in RSS vs Atom)
                let description = item.querySelector('description')?.textContent || 
                                 item.querySelector('summary')?.textContent ||
                                 item.querySelector('content')?.textContent || '';
                
                // Get date (different names in RSS vs Atom)
                let pubDate = item.querySelector('pubDate')?.textContent || 
                             item.querySelector('published')?.textContent ||
                             item.querySelector('updated')?.textContent ||
                             new Date().toISOString();
                
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

// Calculate statistics - COMBINED across ALL feeds
function updateStats() {
    if (allArticles.length === 0) {
        statsContainer.innerHTML = '';
        return;
    }
    
    // CHANGED: Use ALL articles instead of filtering by view
    // This gives a complete threat landscape across both NEWS and INTEL
    
    // Count articles by time
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    const lastHour = allArticles.filter(a => a.date >= oneHourAgo).length;
    const last24h = allArticles.filter(a => a.date >= oneDayAgo).length;
    
    // Count CVEs across all feeds
    const cveCount = allArticles.filter(a => 
        /CVE-\d{4}-\d{4,}/i.test(a.title + ' ' + a.description)
    ).length;
    
    // Count critical articles across all feeds
    const criticalCount = allArticles.filter(a => {
        const text = (a.title + ' ' + a.description).toLowerCase();
        return CRITICAL_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    }).length;
    
    // Most active source across all feeds
    const sourceCounts = {};
    allArticles.forEach(a => {
        sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
    });
    const mostActive = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
    
    // Count by category (NEWS vs INTEL)
    const newsCount = allArticles.filter(a => 
        Object.keys(NEWS_FEEDS).includes(a.source.toLowerCase())
    ).length;
    const intelCount = allArticles.filter(a => 
        Object.keys(INTEL_FEEDS).includes(a.source.toLowerCase())
    ).length;
    
    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">TOTAL:</span>
            <span class="stat-value">${allArticles.length}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">NEWS:</span>
            <span class="stat-value">${newsCount}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">INTEL:</span>
            <span class="stat-value">${intelCount}</span>
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
            <span class="stat-value">${mostActive ? mostActive[0] : 'N/A'}</span>
        </div>
    `;
}

// Display articles based on current filter and search
function displayArticles() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    let filtered;
    
    // Handle bookmarks view
    if (currentView === 'bookmarks') {
        const bookmarks = getBookmarks();
        if (bookmarks.length === 0) {
            newsFeed.innerHTML = `
                <div class="loading-indicator">
                    <div class="loading-text">No bookmarked articles yet. Click the ★ star icon on any article to save it!</div>
                </div>
            `;
            if (searchCount) searchCount.textContent = '';
            return;
        }
        
        // Convert bookmarks back to article format
        filtered = bookmarks.map(b => ({
            title: b.title,
            link: b.link,
            source: b.source,
            description: '',
            date: new Date(b.date)
        }));
        
        // Apply search if present
        if (searchTerm) {
            filtered = filtered.filter(article => {
                const searchableText = (article.title + ' ' + article.description).toLowerCase();
                return searchableText.includes(searchTerm);
            });
        }
        
        // Apply source filter
        if (currentFilter !== 'all') {
            filtered = filtered.filter(a => a.source.toLowerCase() === currentFilter);
        }
        
    } else if (searchTerm) {
        // Search across ALL articles when in 'all' view
        filtered = allArticles.filter(article => {
            const searchableText = (article.title + ' ' + article.description).toLowerCase();
            return searchableText.includes(searchTerm);
        });
    } else {
        // No search - show all articles, filtered by source if needed
        filtered = currentFilter === 'all' 
            ? allArticles 
            : allArticles.filter(a => a.source.toLowerCase() === currentFilter);
    }
    
    console.log(`Displaying ${filtered.length} articles (view: ${currentView}, filter: ${currentFilter}, search: "${searchTerm}")`);
    
    // Update search count
    if (searchCount) {
        if (searchTerm) {
            const newsCount = filtered.filter(a => Object.keys(NEWS_FEEDS).includes(a.source.toLowerCase())).length;
            const intelCount = filtered.filter(a => Object.keys(INTEL_FEEDS).includes(a.source.toLowerCase())).length;
            searchCount.textContent = `Found ${filtered.length} article${filtered.length !== 1 ? 's' : ''} matching "${searchTerm}" (${newsCount} NEWS, ${intelCount} INTEL)`;
        } else {
            searchCount.textContent = '';
        }
    }
    
    if (filtered.length === 0) {
        newsFeed.innerHTML = `
            <div class="loading-indicator">
                <div class="loading-text">No articles found${searchTerm ? ` matching "${searchTerm}"` : ' for this source'}.</div>
            </div>
        `;
        return;
    }
    
    newsFeed.innerHTML = filtered.map(article => {
        // Determine article type for badge
        const articleType = Object.keys(NEWS_FEEDS).includes(article.source.toLowerCase()) ? 'NEWS' : 'INTEL';
        const typeBadge = searchTerm ? `<span class="article-type-badge article-type-${articleType.toLowerCase()}">${articleType}</span>` : '';
        
        // Check if article is bookmarked
        const bookmarked = isBookmarked(article.link);
        const bookmarkIcon = bookmarked ? '★' : '☆';
        const bookmarkClass = bookmarked ? 'bookmarked' : '';
        
        return `
        <div class="news-item" data-link="${article.link}">
            <div class="news-meta">
                <span class="news-time">[${formatTime(article.date)}]</span>
                <span class="news-source">[${article.source}]</span>
                ${typeBadge}
                <button class="bookmark-btn ${bookmarkClass}" onclick="handleBookmarkClick('${article.link.replace(/'/g, "\\'")}', event)" title="${bookmarked ? 'Remove bookmark' : 'Bookmark this article'}">
                    ${bookmarkIcon}
                </button>
            </div>
            <div class="news-title">
                <a href="${article.link}" target="_blank" rel="noopener">${highlightKeywords(article.title)}</a>
            </div>
            ${article.description ? `<div class="news-description">${highlightKeywords(article.description)}</div>` : ''}
        </div>
    `}).join('');
    
    // Make bookmark buttons functional (need to attach after HTML is inserted)
    window.handleBookmarkClick = function(link, event) {
        event.stopPropagation();
        
        // Try to find in allArticles first
        let article = allArticles.find(a => a.link === link);
        
        // If not found (e.g., we're in bookmarks view with filtered articles)
        // reconstruct from the filtered list or bookmarks
        if (!article && currentView === 'bookmarks') {
            const bookmarks = getBookmarks();
            const bookmark = bookmarks.find(b => b.link === link);
            if (bookmark) {
                article = {
                    title: bookmark.title,
                    link: bookmark.link,
                    source: bookmark.source,
                    date: new Date(bookmark.date),
                    description: ''
                };
            }
        }
        
        if (article) {
            toggleBookmark(article);
        }
    };
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
            <div class="loading-text">Try clicking [REFRESH] or check your connection.</div>
        </div>
    `;
}
