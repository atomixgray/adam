// This worker fetches RSS feeds and adds CORS headers with geo-fencing and referer checks
// Also handles AI-powered threat analysis using Google Gemini

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

    // NEW: AI threat analysis endpoint
    if (url.pathname === '/analyze-trends' && request.method === 'POST') {
      return handleAIAnalysis(request, env, ctx);
    }

    // TEST ENDPOINT: Check if Gemini API is accessible
    if (url.pathname === '/test-gemini' && request.method === 'GET') {
      return testGeminiAPI(env);
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
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
        headers: { 'Access-Control-Allow-Origin': '*' }
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
        headers: { 'Access-Control-Allow-Origin': '*' }
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
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Validate URL
    let parsedFeedUrl;
    try {
      parsedFeedUrl = new URL(feedUrl);
    } catch (e) {
      return new Response('Invalid URL', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Security Check 3: Domain whitelist (more flexible matching)
    const hostname = parsedFeedUrl.hostname.toLowerCase();
    const isAllowed = ALLOWED_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      console.log(`Blocked request for unauthorized domain: ${hostname}`);
      console.log(`Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
      return new Response('Domain not allowed', {
        status: 403,
        headers: { 'Access-Control-Allow-Origin': '*' }
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
          headers: { 'Access-Control-Allow-Origin': '*' }
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

// AI Threat Analysis Handler
async function handleAIAnalysis(request, env, ctx) {
  // Security checks (reuse same logic)
  const country = request.cf?.country;
  if (country && !ALLOWED_COUNTRIES.includes(country)) {
    return new Response('Access denied: Geographic restriction', {
      status: 403,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  const referer = request.headers.get('Referer') || '';
  const isAllowedReferer = ALLOWED_REFERERS.some(domain =>
    referer.includes(domain)
  );

  if (!isAllowedReferer && referer !== '') {
    return new Response('Access denied: Invalid referer', {
      status: 403,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Check if API key is configured
  if (!env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY not set in environment variables');
    return new Response(JSON.stringify({
      error: 'AI analysis not configured. Set GROQ_API_KEY environment variable.'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Check cache first (cache AI responses for 1 hour to save API calls)
  const cache = caches.default;
  const cacheKey = new Request(request.url + '-ai-cache', request);
  let cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    console.log('AI analysis cache hit');
    return cachedResponse;
  }

  try {
    console.log('=== AI Analysis Starting ===');
    console.log('API Key exists:', !!env.GEMINI_API_KEY);
    console.log('API Key length:', env.GEMINI_API_KEY?.length);

    // Parse request body
    const { articles } = await request.json();
    console.log('Received articles count:', articles?.length);

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid request: articles array required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Limit to last 24 hours of articles for context
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const recentArticles = articles
      .filter(a => new Date(a.date) >= oneDayAgo)
      .slice(0, 50); // Limit to 50 most recent to stay under token limits

    if (recentArticles.length === 0) {
      return new Response(JSON.stringify({
        threats: [],
        analyzed_count: 0,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Build article summary for prompt
    const articleSummary = recentArticles
      .map((a, i) => `${i + 1}. [${a.source}] ${a.title}`)
      .join('\n');

    // Construct prompt for Gemini
    const prompt = `You are a cybersecurity SOC analyst reviewing today's threat intelligence feeds.

Here are the latest security headlines from the past 24 hours:

${articleSummary}

Based on these headlines, identify the TOP 3 MOST SIGNIFICANT security threats or trends RIGHT NOW. For each threat:
- Give it a clear, specific name (2-4 words)
- Explain the threat and its impact in ONE concise sentence
- Focus on: active exploits, zero-days, ransomware campaigns, widespread vulnerabilities, or major incidents

Format your response as a JSON array with this structure:
[
  {
    "threat": "Threat Name Here",
    "description": "One sentence explaining threat and impact.",
    "severity": "critical" or "high" or "medium"
  }
]

Only return the JSON array, no other text.`;

    console.log('Calling Groq API with', recentArticles.length, 'articles');
    console.log('Using model: llama-3.3-70b-versatile');

    // Call Groq API - Llama 3.3 70B
    const groqResponse = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'system',
            content: 'You are a cybersecurity SOC analyst. Respond only with valid JSON, no markdown formatting.'
          }, {
            role: 'user',
            content: prompt
          }],
          temperature: 0.7,
          max_tokens: 1000,
        })
      }
    );

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', groqResponse.status, errorText);
      throw new Error(`Groq API returned ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    console.log('Groq response received');

    // Extract generated text from Groq response
    let analysisText = groqData.choices?.[0]?.message?.content || '';

    if (!analysisText) {
      console.error('No text in Groq response:', JSON.stringify(groqData));
      throw new Error('No response text from Groq');
    }

    // Parse JSON from response (remove markdown if present)
    analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let threats = [];
    try {
      threats = JSON.parse(analysisText);
    } catch (e) {
      console.error('Failed to parse Gemini JSON response:', analysisText);
      // Fallback: return raw text
      threats = [{
        threat: 'Analysis Available',
        description: analysisText.substring(0, 200),
        severity: 'medium'
      }];
    }

    const responseData = {
      threats,
      analyzed_count: recentArticles.length,
      timestamp: new Date().toISOString()
    };

    const response = new Response(JSON.stringify(responseData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });

    // Cache the response
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    console.log('AI analysis completed successfully');
    return response;

  } catch (error) {
    console.error('AI analysis error:', error.message, error.stack);
    return new Response(JSON.stringify({
      error: 'Failed to generate AI analysis',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Test endpoint to verify Groq API connectivity
async function testGeminiAPI(env) {
  if (!env.GROQ_API_KEY) {
    return new Response(JSON.stringify({
      error: 'GROQ_API_KEY not configured',
      hasKey: false
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'user',
            content: 'Say "API works" in one word.'
          }],
          max_tokens: 10
        })
      }
    );

    const data = await response.json();

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      hasKey: true,
      keyLength: env.GROQ_API_KEY.length,
      response: data
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      hasKey: true
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
