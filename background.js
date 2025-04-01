/**
 * Aegis Security Extension - Background Script
 * 
 * Handles URL analysis, security checks, and stats tracking.
 * 
 * @author Vibin Mathew
 * @copyright 2025
 * @license MIT
 */

// Initialize default settings and stats
chrome.runtime.onInstalled.addListener(async () => {
    try {
        const result = await chrome.storage.local.get(['settings', 'stats', 'allowedUrls', 'checkedDomains']);
        const currentSettings = result.settings || {};
        
        // Merge with defaults while preserving existing values
        const defaultSettings = {
            enabled: true,
            showWarnings: true,
            blockHighRisk: true,
            theme: 'light',
            safeBrowsing: true,
            keepHistory: true
        };

        const newSettings = { ...defaultSettings, ...currentSettings };
        
        // Always ensure enabled state is preserved or defaulted to true
        if (typeof newSettings.enabled !== 'boolean') {
            newSettings.enabled = true;
        }

        await chrome.storage.local.set({
            settings: newSettings,
            stats: result.stats || {
                threatsBlocked: 0,
                urlsAllowed: 0,
                urlsChecked: 0
            },
            allowedUrls: result.allowedUrls || {},
            checkedDomains: result.checkedDomains || {}
        });

        // Set initial badge
        await chrome.action.setBadgeText({
            text: (result.stats?.threatsBlocked || '0').toString()
        });
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
});

// Track unique domains for stats
let allowedUrls = {};
let checkedDomains = {};

// Load allowed URLs and checked domains from storage
chrome.storage.local.get(['allowedUrls', 'checkedDomains'], (result) => {
    if (result.allowedUrls) {
        allowedUrls = result.allowedUrls;
    }
    if (result.checkedDomains) {
        checkedDomains = result.checkedDomains;
    }
});

// Extract domain from URL
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (error) {
        console.error('Error extracting domain:', error);
        return url; // Fallback to full URL
    }
}

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Processing message: message.type
    
    if (message.type === 'ANALYZE_URL') {
        try {
            // Extract domain
            const domain = extractDomain(message.url);
            
            // Check if URL was previously allowed
            if (allowedUrls[domain]) {
                sendResponse({ 
                    safe: true, 
                    risk: 'allowed',
                    previouslyAllowed: true,
                    reasons: ['URL previously allowed by user']
                });
                return true;
            }
            
            // Analyze the URL
            const analysis = analyzeURL(message.url);
            
            // Track checked domain if it's a new domain
            if (!checkedDomains[domain] && analysis) {
                checkedDomains[domain] = true;
                currentStats.urlsChecked++;
                
                // Save updated checked domains
                chrome.storage.local.set({ 
                    checkedDomains: checkedDomains,
                    stats: currentStats
                });
            }
            
            // Send response back to content script
            sendResponse(analysis);
        } catch (error) {
            console.error('Error in ANALYZE_URL handler:', error);
            sendResponse({ safe: true, risk: 'low', reasons: ['Error analyzing URL'] });
        }
        
        return true; // Indicate we'll send response asynchronously
    }
    
    if (message.type === 'GET_STATS') {
        chrome.storage.local.get('stats', (result) => {
            sendResponse(result.stats || {
                threatsBlocked: 0,
                urlsAllowed: 0,
                urlsChecked: 0
            });
        });
        return true;
    }
    
    if (message.type === 'UPDATE_SETTINGS') {
        chrome.storage.local.get('settings', (result) => {
            const currentSettings = result.settings || {};
            const newSettings = { ...currentSettings, ...message.settings };
            
            if (typeof newSettings.enabled !== 'boolean') {
                newSettings.enabled = true;
            }
            
            chrome.storage.local.set({ settings: newSettings }, () => {
                chrome.action.setBadgeText({
                    text: newSettings.enabled ? (result.stats?.threatsBlocked || '0').toString() : ''
                });
                if (sendResponse) sendResponse({ success: true });
            });
        });
        return true;
    }

    if (message.type === 'URL_ALLOWED') {
        // Extract domain from URL
        const domain = extractDomain(message.url);
        
        // Store domain as allowed if not already allowed
        if (!allowedUrls[domain]) {
            allowedUrls[domain] = true;
            
            // Increment allowed URLs counter only for new domains
            currentStats.urlsAllowed++;
            
            // Save to storage
            chrome.storage.local.set({ 
                allowedUrls: allowedUrls,
                stats: currentStats 
            });
        }
        
        // Always send success response
        if (sendResponse) sendResponse({ success: true, stats: currentStats });
        return true;
    }

    if (message.type === 'NAVIGATION_BLOCKED') {
        currentStats.threatsBlocked = (currentStats.threatsBlocked || 0) + 1;
        chrome.storage.local.set({ stats: currentStats }, () => {
            // Update badge
            chrome.action.setBadgeText({
                text: currentStats.threatsBlocked.toString()
            });
            if (sendResponse) sendResponse({ success: true });
        });
        return true;
    }
});

// Update badge when threats blocked changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.stats || changes.settings) {
        chrome.storage.local.get(['stats', 'settings'], (result) => {
            const isEnabled = result.settings?.enabled !== false;
            const threatsBlocked = result.stats?.threatsBlocked || 0;
            
            chrome.action.setBadgeText({
                text: isEnabled ? threatsBlocked.toString() : ''
            });
        });
    }
});

// URL patterns for risk detection
const URL_PATTERNS = {
    highRisk: {
        suspiciousTlds: /\.(xyz|tk|ml|ga|cf|gq|top|wang|win|loan|online|site|club|work|bid|racing|date|party|download|stream|gdn|icu)$/i,
        ipAddress: /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
        authPages: /(login|signin|account|password|credential|banking|payment|verify|secure|auth)/i,
        phishingKeywords: /(verify|confirm|update|secure|recover|unlock|authenticate|validation|suspended|unusual|activity|security|restore|protect)/i,
    },
    mediumRisk: {
        nonHttps: /^http:\/\//i,
        marketingTerms: /(free|win|prize|lucky|bonus|discount|deal|offer|special|limited|exclusive|now|urgent|act|expires|today)/i,
        numericDomain: /^https?:\/\/[^\/]*\d+[^\/]*\//i,
        longSubdomains: /^https?:\/\/([^\/]*\.){4,}/
    }
};

// Initialize stats
let currentStats = {
    threatsBlocked: 0,
    urlsAllowed: 0,
    urlsChecked: 0
};

// Load stats from storage
chrome.storage.local.get('stats', (result) => {
    if (result.stats) {
        currentStats = result.stats;
    }
});

// Check if URL matches any patterns in the given category
function matchesPatterns(url, patterns) {
    return Object.values(patterns).some(pattern => pattern.test(url));
}

// Analyze URL for potential risks
function analyzeURL(url) {
    try {
        const result = {
            safe: true,
            risk: 'low',
            reasons: []
        };

        // Check high-risk patterns
        if (matchesPatterns(url, URL_PATTERNS.highRisk)) {
            result.safe = false;
            result.risk = 'high';
            result.reasons.push('Matches high-risk patterns');
        }
        // Check medium-risk patterns
        else if (matchesPatterns(url, URL_PATTERNS.mediumRisk)) {
            result.safe = true;
            result.risk = 'medium';
            result.reasons.push('Matches medium-risk patterns');
        }

        // Additional checks
        try {
            const urlObj = new URL(url);
            
            if (urlObj.search.length > 100) {
                result.reasons.push('Long query string');
                if (result.risk !== 'high') {
                    result.risk = 'medium';
                }
            }

            if (urlObj.hostname.split('.').length > 4) {
                result.reasons.push('Multiple subdomains');
                if (result.risk !== 'high') {
                    result.risk = 'medium';
                }
            }
        } catch (error) {
            console.error('Error parsing URL:', error);
            result.reasons.push('Invalid URL format');
            result.risk = 'high';
            result.safe = false;
        }

        return result;
    } catch (error) {
        console.error('Error in analyzeURL:', error);
        return { safe: true, risk: 'low', reasons: ['Error analyzing URL'] };
    }
}

// Check URL and handle blocking/warnings
async function checkURL(tabId, url) {
    try {
        // Skip internal browser URLs
        if (url.startsWith('chrome:') || url.startsWith('chrome-extension:') || 
            url.startsWith('about:') || url.startsWith('edge:') || url.startsWith('brave:')) {
            return;
        }

        // Get current settings
        const { settings } = await chrome.storage.local.get('settings');
        if (!settings?.enabled) {
            return;
        }

        // Increment URLs checked
        currentStats.urlsChecked++;
        
        // Analyze the URL
        const analysis = analyzeURL(url);
        console.log('URL Analysis:', { url, analysis });

        if (!analysis.safe && analysis.risk === 'high' && settings.blockHighRisk) {
            // High-risk URL detected
            currentStats.threatsBlocked++;
            
            if (settings.showWarnings) {
                // Show warning to user
                try {
                    // Check if tab exists and is available
                    const tabExists = await chrome.tabs.get(tabId).catch(() => null);
                    if (!tabExists) {
                        console.log('Tab not available, skipping warning');
                        return { blocked: true };
                    }
                    
                    await chrome.tabs.sendMessage(tabId, {
                        type: 'SHOW_WARNING',
                        data: {
                            url: url,
                            risk: analysis.risk,
                            reasons: analysis.reasons
                        }
                    });
                } catch (error) {
                    console.error('Error showing warning:', error);
                }
            }

            // Update stats in storage
            await chrome.storage.local.set({ stats: currentStats });
            
            // Update badge
            await chrome.action.setBadgeText({
                text: currentStats.threatsBlocked.toString()
            });

            return { blocked: true };
        }

        // Update stats in storage
        await chrome.storage.local.set({ stats: currentStats });
        return { blocked: false };
    } catch (error) {
        console.error('Error in checkURL:', error);
        return { blocked: false };
    }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url) {
        checkURL(tabId, tab.url);
    }
});

// Listen for web navigation
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) { // Main frame only
        checkURL(details.tabId, details.url);
    }
}); 