// This worker fetches RSS feeds and adds CORS headers with geo-fencing and referer checks
// Also handles AI-powered threat analysis using Google Gemini

// Private/loopback IP ranges to block (SSRF protection)
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,   // link-local / AWS metadata
  /^::1$/,         // IPv6 loopback
  /^fc00:/i,       // IPv6 unique local
  /^fe80:/i,       // IPv6 link-local
];

// Allowed RSS feed domains (whitelist for security)
const ALLOWED_DOMAINS = [
  'krebsonsecurity.com',
  'bleepingcomputer.com',
  'feedburner.com',
  'darkreading.com',
  'theregister.com',
  'csoonline.com',
  'securityweek.com',
  'sans.edu',
  'isc.sans.edu',
  'cisa.gov',
  'talosintelligence.com',
  'medium.com',
  'schneier.com',
  'crowdstrike.com',
  'paloaltonetworks.com',
  'exploit-db.com',
  'reddit.com',
  'threatpost.com',
  'akamai.com',
  'microsoft.com',                    // MSRC
  'googleprojectzero.blogspot.com'    // Google Project Zero
];

// Allowed countries (ISO 3166-1 alpha-2 codes)
const ALLOWED_COUNTRIES = ['US', 'CA', 'IT'];

// Allowed referers (your domain)
const ALLOWED_REFERERS = ['adamlarkin.com', 'www.adamlarkin.com', 'localhost'];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://adamlarkin.com',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Security Check 1: Geo-fence
    const country = request.cf?.country;
    if (country && !ALLOWED_COUNTRIES.includes(country)) {
      console.log(`Blocked request from country: ${country}`);
      return new Response('Access denied: Geographic restriction', {
        status: 403,
        headers: { 'Access-Control-Allow-Origin': 'https://adamlarkin.com' }
      });
    }

    // Security Check 2: Referer check
    const referer = request.headers.get('Referer') || '';
    const isAllowedReferer = ALLOWED_REFERERS.some(domain =>
      referer.includes(domain)
    );

    if (!isAllowedReferer && referer !== '') {
      console.log(`Blocked request with invalid referer: ${referer}`);
      return new Response('Access denied: Invalid referer', {
        status: 403,
        headers: { 'Access-Control-Allow-Origin': 'https://adamlarkin.com' }
      });
    }

    // Only allow GET requests for RSS proxy
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Get the feed URL from query parameter
    const feedUrl = url.searchParams.get('url');

    if (!feedUrl) {
      return new Response('Missing "url" parameter', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://adamlarkin.com' }
      });
    }

    // Validate URL
    let parsedFeedUrl;
    try {
      parsedFeedUrl = new URL(feedUrl);
    } catch (e) {
      return new Response('Invalid URL', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://adamlarkin.com' }
      });
    }

    // Security Check 3: HTTPS only — block http://, file://, ftp://, etc.
    if (parsedFeedUrl.protocol !== 'https:') {
      console.log(`Blocked non-HTTPS URL: ${feedUrl}`);
      return new Response('Only HTTPS URLs are allowed', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://adamlarkin.com' }
      });
    }

    // Security Check 4: Block private/loopback IPs (SSRF protection)
    const hostname = parsedFeedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || PRIVATE_IP_PATTERNS.some(p => p.test(hostname))) {
      console.log(`Blocked private/loopback host: ${hostname}`);
      return new Response('Domain not allowed', {
        status: 403,
        headers: { 'Access-Control-Allow-Origin': 'https://adamlarkin.com' }
      });
    }

    // Security Check 5: Domain whitelist (more flexible matching)
    const isAllowed = ALLOWED_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      console.log(`Blocked request for unauthorized domain: ${hostname}`);
      return new Response('Domain not allowed', {
        status: 403,
        headers: { 'Access-Control-Allow-Origin': 'https://adamlarkin.com' }
      });
    }

    // Log successful request (useful for monitoring)
    console.log(`Fetching ${feedUrl} from ${country || 'unknown'}`);

    // Create cache key
    const cacheKey = new Request(feedUrl, request);
    const cache = caches.default;

    // Check cache first
    let response = await cache.match(cacheKey);

    if (!response) {
      // Cache miss - fetch from origin
      console.log(`Cache miss for ${feedUrl}`);

      try {
        // Use a real browser User-Agent for sites that block bots (e.g. exploit-db)
        // Fall back to custom UA for everything else
        const userAgent = hostname.includes('exploit-db.com')
          ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          : 'SecOps-Daily-RSS-Reader/1.0';

        response = await fetch(feedUrl, {
          headers: {
            'User-Agent': userAgent,
          },
        });

        // Clone response to cache it
        const responseToCache = response.clone();

        // Only cache successful responses
        if (response.ok) {
          // Cache for 10 minutes (600 seconds)
          const cacheResponse = new Response(responseToCache.body, responseToCache);
          cacheResponse.headers.set('Cache-Control', 'public, max-age=600');

          // Store in cache
          ctx.waitUntil(cache.put(cacheKey, cacheResponse));
        }
      } catch (error) {
        console.error(`Error fetching feed: ${error.message}`);
        return new Response(`Error fetching feed: ${error.message}`, {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': 'https://adamlarkin.com' }
        });
      }
    } else {
      console.log(`Cache hit for ${feedUrl}`);
    }

    // Add CORS headers to response
    const corsResponse = new Response(response.body, response);
    corsResponse.headers.set('Access-Control-Allow-Origin', '*');
    corsResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    corsResponse.headers.set('Cache-Control', 'public, max-age=600');

    return corsResponse;
  },
};

