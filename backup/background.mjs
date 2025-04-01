// State management
const currentState = {
    enabled: true,
    theme: 'system',
    iconState: 'default'
};

// Icon update debouncing
let iconUpdateTimeout = null;
const ICON_UPDATE_DELAY = 100;

// Constants for configuration
const CONFIG = {
    MAX_SUBDOMAINS: 3,
    SUSPICIOUS_PATTERNS: [
        /^(?!https?:\/\/).*$/i,
        /^https?:\/\/[^\/]+\.(?:php|asp|jsp|html)$/i,
        /^https?:\/\/[^\/]+\.(?:tk|ml|ga|gq|cf)$/i,
    ],
    CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
    SAFE_BROWSING_ENDPOINT: 'https://safebrowsing.googleapis.com/v4/threatMatches:find',
    CLIENT_ID: 'URL-Guardian-Extension',
    CLIENT_VERSION: '1.0.0',
    THREAT_TYPES: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION'
    ]
};

// Cache implementation
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

// Initialize state
const state = {
    settings: {
        enableProtection: true,
        showWarnings: true,
        blockHighRisk: true,
        enableSafeBrowsing: true,
        keepHistory: true
    },
    urlCache: new URLCache(),
    analyzingUrls: new Set(),
    stats: {
        totalAnalyzed: 0,
        totalBlocked: 0,
        totalWarnings: 0,
        sessionOverrides: 0
    },
    sessionOverrides: new Set()
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
    try {
        const stored = await chrome.storage.local.get(['enabled', 'theme', 'settings']);
        
        // Update current state
        Object.assign(currentState, {
            enabled: stored.enabled !== false,
            theme: stored.theme || 'system'
        });
        
        // Update settings
        if (stored.settings) {
            Object.assign(state.settings, stored.settings);
        }
        
        // Set initial state
        await chrome.storage.local.set({ 
            protectionEnabled: state.settings.enableProtection,
            theme: currentState.theme,
            enabled: currentState.enabled
        });
        
        // Update icon
        await updateIcon();
        
        console.log('Extension initialized successfully');
    } catch (error) {
        console.error('Failed to initialize extension:', error);
    }
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.theme) {
        currentState.theme = changes.theme.newValue;
        updateIcon();
    }
    if (changes.enabled !== undefined) {
        currentState.enabled = changes.enabled.newValue;
        updateIcon();
    }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'TOGGLE_THEME':
            handleThemeToggle(message).then(sendResponse);
            break;
            
        case 'PROTECTION_TOGGLE':
            handleProtectionToggle(message).then(sendResponse);
            break;
            
        case 'ANALYZE_URL':
            analyzeUrl(message.url)
                .then(sendResponse)
                .catch(error => {
                    console.error('URL analysis error:', error);
                    sendResponse({
                        safe: false,
                        issues: ['Error analyzing URL'],
                        severity: 'high'
                    });
                });
            break;
            
        default:
            sendResponse({ error: 'Unknown message type' });
    }
    return true;
});

// Update icon
async function updateIcon() {
    if (iconUpdateTimeout) {
        clearTimeout(iconUpdateTimeout);
    }

    iconUpdateTimeout = setTimeout(async () => {
        const iconPath = !currentState.enabled ? {
            16: 'icons/icon16_disabled.png',
            48: 'icons/icon48_disabled.png',
            128: 'icons/icon128_disabled.png'
        } : {
            16: 'icons/icon16.png',
            48: 'icons/icon48.png',
            128: 'icons/icon128.png'
        };

        try {
            await chrome.action.setIcon({ path: iconPath });
        } catch (error) {
            console.error('Error updating icon:', error);
        }
    }, ICON_UPDATE_DELAY);
}

// Theme toggle handler
async function handleThemeToggle(message) {
    try {
        currentState.theme = message.theme;
        await chrome.storage.local.set({ theme: message.theme });
        await updateIcon();
        return { success: true };
    } catch (error) {
        console.error('Theme toggle error:', error);
        return { success: false, error: error.message };
    }
}

// Protection toggle handler
async function handleProtectionToggle(message) {
    try {
        currentState.enabled = message.enabled;
        await chrome.storage.local.set({ enabled: message.enabled });
        await updateIcon();
        
        const tabs = await chrome.tabs.query({});
        await Promise.all(tabs.map(tab => 
            chrome.tabs.sendMessage(tab.id, {
                type: 'STATE_UPDATE',
                enabled: currentState.enabled
            }).catch(() => {})
        ));
        
        return { success: true };
    } catch (error) {
        console.error('Protection toggle error:', error);
        return { success: false, error: error.message };
    }
}

// URL analysis
async function analyzeUrl(url) {
    try {
        const cached = state.urlCache.get(url);
        if (cached) {
            return cached;
        }

        const urlObj = new URL(url);
        const issues = [];
        let isSafe = true;
        let severity = 'low';

        if (CONFIG.SUSPICIOUS_PATTERNS.some(pattern => pattern.test(url))) {
            issues.push('Suspicious URL pattern detected');
            severity = 'medium';
            isSafe = false;
        }

        state.stats.totalAnalyzed++;
        if (!isSafe) {
            state.stats.totalWarnings++;
        }

        const result = { safe: isSafe, issues, severity, url };
        state.urlCache.set(url, result);
        return result;

    } catch (error) {
        console.error('URL analysis error:', error);
        return {
            safe: false,
            issues: ['Error analyzing URL: ' + error.message],
            severity: 'high',
            url
        };
    }
}

// Navigation handling
chrome.webNavigation.onBeforeNavigate.addListener(details => {
    if (details.frameId !== 0 || !state.settings.enableProtection) {
        return;
    }

    analyzeUrl(details.url)
        .then(analysis => {
            if (!analysis.safe && !state.sessionOverrides.has(details.url)) {
                return chrome.tabs.get(details.tabId)
                    .then(tab => {
                        if (tab && tab.id) {
                            return chrome.tabs.sendMessage(tab.id, {
                                type: 'SHOW_WARNING',
                                analysis
                            });
                        }
                    });
            }
        })
        .catch(error => {
            console.error('Navigation analysis error:', error);
        });
}); 