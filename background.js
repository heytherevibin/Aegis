import { loadEnvVariables } from './config.js';
import { userLearning } from './userLearning.js';

// Constants for configuration
const CONFIG = Object.freeze({
  MAX_SUBDOMAINS: 3,
  SUSPICIOUS_PATTERNS: Object.freeze([
    /^(?!https?:\/\/).*$/i,
    /^https?:\/\/[^\/]+\.(?:php|asp|jsp|html)$/i,
    /^https?:\/\/[^\/]+\.(?:tk|ml|ga|gq|cf)$/i,
  ]),
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  SAFE_BROWSING_ENDPOINT: 'https://safebrowsing.googleapis.com/v4/threatMatches:find',
  CLIENT_ID: 'URL-Guardian-Extension',
  CLIENT_VERSION: '1.0.0',
  THREAT_TYPES: Object.freeze([
    'MALWARE',
    'SOCIAL_ENGINEERING',
    'UNWANTED_SOFTWARE',
    'POTENTIALLY_HARMFUL_APPLICATION'
  ]),
  // TLD Categories for risk assessment
  TLD_CATEGORIES: Object.freeze({
    HIGH_RISK: new Set([
      // Frequently abused free TLDs
      'tk', 'ml', 'ga', 'gq', 'cf', 
      // Common spam TLDs
      'xyz', 'top', 'club', 'work', 'date', 'racing', 'win', 'bid',
      // Newly introduced TLDs with high abuse rates
      'stream', 'download', 'review', 'country', 'science', 'party',
      // Cryptocurrency related (often used in scams)
      'crypto', 'nft', 'coin', 'token', 'wallet',
      // Generic TLDs often used in phishing
      'online', 'site', 'website', 'tech', 'space'
    ]),
    MEDIUM_RISK: new Set([
      // Less common but legitimate TLDs
      'biz', 'info', 'pro', 'name', 'mobi',
      // Regional TLDs sometimes abused
      'cc', 'ws', 'me', 'tv',
      // New gTLDs with moderate abuse rates
      'app', 'dev', 'cloud', 'digital', 'network',
      // Industry specific TLDs
      'shop', 'store', 'market', 'link', 'click'
    ]),
    LOW_RISK: new Set([
      // Traditional gTLDs
      'com', 'org', 'net', 'edu', 'gov', 'mil',
      // Well-established country code TLDs
      'uk', 'us', 'ca', 'au', 'eu', 'de', 'fr', 'jp', 'kr', 'nz',
      // Professional TLDs
      'io', 'co', 'ai', 'dev'
    ])
  })
});

// Cache implementation with automatic cleanup
class URLCache {
  constructor() {
    this.cache = new Map();
    this.startCleanupInterval();
  }

  set(url, result) {
    this.cache.set(url, {
      timestamp: Date.now(),
      result
    });
  }

  get(url) {
    const cached = this.cache.get(url);
    if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_DURATION) {
      return cached.result;
    }
    this.cache.delete(url);
    return null;
  }

  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      for (const [url, data] of this.cache.entries()) {
        if (now - data.timestamp >= CONFIG.CACHE_DURATION) {
          this.cache.delete(url);
        }
      }
    }, CONFIG.CACHE_DURATION);
  }
}

// State management with persistence
const state = {
  settings: {
    enableProtection: true,
    showWarnings: true,
    blockHighRisk: true,
    enableSafeBrowsing: true,
    keepHistory: true
  },
  safeBrowsingKey: '',
  urlCache: new URLCache(),
  analyzingUrls: new Set(),
  stats: {
    totalAnalyzed: 0,
    totalBlocked: 0,
    totalWarnings: 0,
    sessionOverrides: 0  // Track overrides for current session only
  },
  sessionOverrides: new Set()  // Store overridden URLs for current session only
};

// Initialize state from storage
async function initializeState() {
  try {
    // Load settings
    const storedSettings = await chrome.storage.sync.get(state.settings);
    state.settings = { ...state.settings, ...storedSettings };
    
    // Load environment variables
    const env = await loadEnvVariables();
    state.safeBrowsingKey = env.SAFE_BROWSING_API_KEY;
    
    // Load stats
    const storedStats = await chrome.storage.local.get(['urlHistory', 'stats']);
    if (storedStats.stats) {
      state.stats = storedStats.stats;
    }
    
    // Initialize learning system
    await userLearning.initialize();
    
    // Set initial protection state
    await chrome.storage.local.set({ protectionEnabled: state.settings.enableProtection });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize state:', error);
    return false;
  }
}

// Safe Browsing API integration
async function checkSafeBrowsing(url) {
  if (!state.safeBrowsingKey) {
    return { isSafe: true, threats: [] };
  }

  try {
    const response = await fetch(`${CONFIG.SAFE_BROWSING_ENDPOINT}?key=${state.safeBrowsingKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client: {
          clientId: CONFIG.CLIENT_ID,
          clientVersion: CONFIG.CLIENT_VERSION
        },
        threatInfo: {
          threatTypes: CONFIG.THREAT_TYPES,
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }]
        }
      })
    });

    if (!response.ok) {
      throw new Error('Safe Browsing API request failed');
    }

    const data = await response.json();
    return {
      isSafe: !data.matches || data.matches.length === 0,
      threats: data.matches || []
    };
  } catch (error) {
    console.error('Safe Browsing API error:', error);
    return { isSafe: true, threats: [] };
  }
}

// URL analysis
function analyzeUrlStructure(urlString) {
  try {
    const urlObj = new URL(urlString.startsWith('http') ? urlString : `http://${urlString}`);
    const issues = [];

    // Check for excessive subdomains
    const subdomainCount = urlObj.hostname.split('.').length - 2;
    if (subdomainCount > CONFIG.MAX_SUBDOMAINS) {
      issues.push(`Excessive subdomains (${subdomainCount})`);
    }

    // Enhanced TLD Analysis
    const tld = urlObj.hostname.split('.').pop().toLowerCase();
    
    // Check TLD risk level
    if (CONFIG.TLD_CATEGORIES.HIGH_RISK.has(tld)) {
      issues.push(`High-risk top-level domain (.${tld})`);
    } else if (CONFIG.TLD_CATEGORIES.MEDIUM_RISK.has(tld)) {
      if (subdomainCount > 0 || urlObj.hostname.length > 30) {
        issues.push(`Potentially risky domain (.${tld} with complex structure)`);
      }
    } else if (!CONFIG.TLD_CATEGORIES.LOW_RISK.has(tld)) {
      // Unknown TLD - could be new or uncommon
      issues.push(`Uncommon top-level domain (.${tld})`);
    }

    // Check for suspicious patterns
    if (CONFIG.SUSPICIOUS_PATTERNS.some(pattern => pattern.test(urlString))) {
      issues.push('Suspicious URL pattern detected');
    }

    // Improved URL encoding check
    const suspiciousEncodingPattern = /%(?!20|2D|2E|5F|2F|3F|3D|26|25)[0-9A-Fa-f]{2}/;
    if (suspiciousEncodingPattern.test(urlString)) {
      issues.push('Suspicious URL encoding detected');
    }

    // Check for IP address instead of domain name
    const ipv4Pattern = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}/;
    const privateIpRanges = [
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^127\./
    ];

    if (ipv4Pattern.test(urlString)) {
      const ip = urlObj.hostname;
      if (!privateIpRanges.some(range => range.test(ip))) {
        issues.push('Public IP address used instead of domain name');
      }
    }

    // Check for uncommon ports
    const commonPorts = ['80', '443', '8080', '8443'];
    if (urlObj.port && !commonPorts.includes(urlObj.port)) {
      issues.push(`Unusual port number (${urlObj.port})`);
    }

    // Check for long hostnames
    if (urlObj.hostname.length > 50) {
      issues.push('Excessively long hostname');
    }

    // Check for mixed case domain
    const mixedCaseDomain = /[A-Z]/.test(urlObj.hostname);
    if (mixedCaseDomain) {
      issues.push('Suspicious mixed-case domain name');
    }

    // Enhanced severity calculation based on combined factors
    let severity = 'low';
    if (issues.length > 0) {
      if (issues.length > 2 || 
          issues.some(issue => 
            issue.includes('High-risk') ||
            issue.includes('Suspicious URL encoding') ||
            issue.includes('Public IP address')
          )) {
        severity = 'high';
      } else if (issues.some(issue =>
          issue.includes('Potentially risky') ||
          issue.includes('Uncommon top-level domain')
        )) {
        severity = 'medium';
      }
    }

    return { issues, severity };
  } catch (error) {
    return {
      issues: ['Invalid URL format'],
      severity: 'high'
    };
  }
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_URL') {
    (async () => {
      try {
        const result = await handleUrlAnalysis(message.url);
        sendResponse(result);
      } catch (error) {
        sendResponse({ error: error.message, safe: true });
      }
    })();
    return true;
  } else if (message.type === 'USER_OVERRIDE') {
    (async () => {
      try {
        const result = await handleUserOverride(message.url);
        sendResponse(result);
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  } else if (message.type === 'SETTINGS_UPDATED') {
    (async () => {
      try {
        const result = await handleSettingsUpdate(message.settings);
        sendResponse(result);
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  } else if (message.type === 'GET_STATS') {
    sendResponse({
      stats: {
        ...state.stats,
        overridesInSession: state.sessionOverrides.size
      },
      success: true
    });
    return false;
  } else if (message.type === 'GET_HISTORY') {
    (async () => {
      try {
        const { urlHistory = [] } = await chrome.storage.local.get('urlHistory');
        // Add session override status to history entries
        const historyWithOverrides = urlHistory.map(entry => ({
          ...entry,
          overriddenInSession: state.sessionOverrides.has(entry.url)
        }));
        sendResponse({
          history: historyWithOverrides,
          success: true
        });
      } catch (error) {
        sendResponse({ error: error.message, success: false });
      }
    })();
    return true;
  }
  return false;
});

// Handle URL analysis
async function handleUrlAnalysis(url) {
  if (!state.settings.enableProtection) {
    return { safe: true };
  }

  // Check if URL has been overridden in current session
  if (state.sessionOverrides.has(url)) {
    return { 
      safe: true, 
      overridden: true,
      originalAnalysis: state.urlCache.get(url)
    };
  }

  // Check cache first
  const cachedResult = state.urlCache.get(url);
  if (cachedResult) {
    // Get learning recommendations for cached result
    const learningRecommendation = await userLearning.getRecommendations(url, cachedResult);
    
    // If we have high confidence in the URL being safe, return cached result
    if (learningRecommendation.recommendation === 'TRUST' && 
        learningRecommendation.learningConfidence > 0.7) {
      return { ...cachedResult, learningRecommendation };
    }
    
    // For unsafe URLs, perform fresh analysis unless highly trusted
    if (!cachedResult.safe && learningRecommendation.recommendation !== 'TRUST') {
      const freshAnalysis = await analyzeUrl(url);
      state.urlCache.set(url, freshAnalysis);
      return { ...freshAnalysis, learningRecommendation };
    }
    
    return { ...cachedResult, learningRecommendation };
  }

  if (state.analyzingUrls.has(url)) {
    return { safe: true, cached: true };
  }

  try {
    state.analyzingUrls.add(url);
    const analysis = await analyzeUrl(url);
    
    // Get learning recommendations
    const learningRecommendation = await userLearning.getRecommendations(url, analysis);
    
    // Adjust analysis based on learning
    if (learningRecommendation.recommendation === 'TRUST' && 
        learningRecommendation.learningConfidence > 0.8) {
      analysis.safe = true;
      analysis.adjustedBySafety = true;
    } else if (learningRecommendation.recommendation === 'UNSAFE' && 
               learningRecommendation.learningConfidence > 0.8) {
      analysis.safe = false;
      analysis.adjustedBySafety = true;
    }
    
    // Update statistics
    state.stats.totalAnalyzed++;
    if (!analysis.safe) {
      state.stats.totalWarnings++;
    }
    
    // Store the analysis in history if enabled
    if (state.settings.keepHistory) {
      const historyEntry = {
        url,
        timestamp: Date.now(),
        analysis: { ...analysis, learningRecommendation },
        overridden: false
      };
      
      // Get existing history
      const { urlHistory = [] } = await chrome.storage.local.get('urlHistory');
      
      // Add new entry and limit to last 100 entries
      urlHistory.unshift(historyEntry);
      if (urlHistory.length > 100) {
        urlHistory.pop();
      }
      
      // Save updated history and stats
      await chrome.storage.local.set({
        urlHistory,
        stats: state.stats
      });
    }
    
    analysis.learningRecommendation = learningRecommendation;
    state.urlCache.set(url, analysis);
    return analysis;
  } finally {
    state.analyzingUrls.delete(url);
  }
}

// Handle settings update
async function handleSettingsUpdate(newSettings) {
  try {
    state.settings = { ...state.settings, ...newSettings };
    await chrome.storage.sync.set(state.settings);
    await chrome.storage.local.set({ protectionEnabled: state.settings.enableProtection });
    return { success: true };
  } catch (error) {
    throw new Error('Failed to update settings');
  }
}

// URL analysis function
async function analyzeUrl(url) {
  try {
    const [structureAnalysis, safeBrowsingResult] = await Promise.all([
      analyzeUrlStructure(url),
      checkSafeBrowsing(url)
    ]);

    const issues = [
      ...structureAnalysis.issues,
      ...(safeBrowsingResult.threats.map(threat => 
        `Google Safe Browsing: ${threat.threatType} detected`
      ))
    ];

    // Improved severity calculation
    let severity = 'low';
    if (safeBrowsingResult.threats.length > 0) {
      severity = 'high';
    } else if (structureAnalysis.severity === 'high') {
      severity = 'high';
    } else if (structureAnalysis.severity === 'medium') {
      severity = 'medium';
    }

    const result = {
      url,
      timestamp: Date.now(),
      issues,
      severity,
      safe: severity === 'low'
    };

    // Update blocked count if the URL is unsafe
    if (!result.safe) {
      state.stats.totalBlocked = (state.stats.totalBlocked || 0) + 1;
    }

    return result;
  } catch (error) {
    console.error('URL analysis error:', error);
    throw new Error('Failed to analyze URL');
  }
}

// Navigation handling
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0 || !state.settings.enableProtection) {
    return;
  }

  try {
    const analysis = await handleUrlAnalysis(details.url);
    if (!analysis.safe) {
      const tab = await chrome.tabs.get(details.tabId);
      if (tab && tab.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_WARNING',
          analysis
        }).catch(() => {
          // Ignore errors if content script isn't ready
        });
      }
    }
  } catch (error) {
    console.error('Navigation analysis error:', error);
  }
});

// Initialize extension
async function initialize() {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      const success = await initializeState();
      if (success) {
        console.log('Extension initialized successfully');
        break;
      }
    } catch (error) {
      console.error('Initialization attempt failed:', error);
    }
    retries++;
    if (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Start initialization
initialize();

// Handle user override
async function handleUserOverride(url) {
  try {
    const analysis = state.urlCache.get(url);
    if (analysis) {
      // Record the override in learning system
      await userLearning.recordInteraction(url, 'proceed', analysis);
      
      // Update session overrides
      state.sessionOverrides.add(url);
      state.stats.sessionOverrides++;
      
      // Update history if enabled
      if (state.settings.keepHistory) {
        const { urlHistory = [] } = await chrome.storage.local.get('urlHistory');
        const historyEntry = urlHistory.find(entry => entry.url === url);
        if (historyEntry) {
          historyEntry.overridden = true;
          await chrome.storage.local.set({ urlHistory });
        }
      }
    }
  } catch (error) {
    console.error('Failed to handle override:', error);
  }
}

// Handle user block action
async function handleUserBlock(url) {
  try {
    const analysis = state.urlCache.get(url);
    if (analysis) {
      // Record the block in learning system
      await userLearning.recordInteraction(url, 'block', analysis);
    }
  } catch (error) {
    console.error('Failed to handle block:', error);
  }
} 