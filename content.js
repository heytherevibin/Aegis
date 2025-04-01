/**
 * Aegis Security Extension - Content Script
 * 
 * This script handles URL analysis and warning display within web pages.
 * It communicates with the background script to analyze URLs and display
 * appropriate warnings for potentially dangerous sites.
 * 
 * @author Vibin Mathew
 * @copyright 2025
 * @license MIT
 */

const extensionUrl = chrome.runtime.getURL('');

// State management
let warningOverlay = null;
let warningModal = null;
let isInitialized = false;
let connectionRetries = 0;
const MAX_RETRIES = 3;
let isAnalyzing = false;
let blockedUrl = null;

// Track warning state
let isWarningActive = false;
let currentWarningData = null;

/**
 * Initialize the content script
 * Sets up required elements and analyzes the current URL
 */
async function initialize() {
    if (isInitialized) return;
    
    try {
        // Create warning elements if they don't exist
        if (!warningOverlay || !warningModal) {
            createWarningElements();
        }

        // Analyze current URL on initialization
        const currentUrl = window.location.href;
        await analyzeUrl(currentUrl);
        
        isInitialized = true;
    } catch (error) {
        console.error('Aegis: Initialization error:', error);
        if (connectionRetries < MAX_RETRIES) {
            connectionRetries++;
            setTimeout(initialize, 1000 * connectionRetries);
        }
    }
}

function createWarningElements() {
    // Remove any existing elements first
    const existingOverlay = document.getElementById('url-guardian-overlay');
    const existingModal = document.getElementById('url-guardian-modal');
    if (existingOverlay) existingOverlay.remove();
    if (existingModal) existingModal.remove();

    // Create modal with enhanced glassmorphism styling
    warningModal = document.createElement('div');
    warningModal.id = 'url-guardian-modal';
    warningModal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        padding: clamp(24px, 5vw, 40px);
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 
            0 10px 30px rgba(0, 0, 0, 0.1),
            0 1px 8px rgba(0, 0, 0, 0.2),
            inset 0 0 0 1px rgba(255, 255, 255, 0.15),
            inset 0 0 0 2px rgba(255, 255, 255, 0.1);
        z-index: 2147483647;
        max-width: min(520px, 95vw);
        width: 100%;
        display: none;
        font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        animation: modal-appear 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        transform-origin: center center;
    `;

    // Create overlay with enhanced blur effect
    warningOverlay = document.createElement('div');
    warningOverlay.id = 'url-guardian-overlay';
    warningOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(8, 14, 44, 0.6);
        backdrop-filter: blur(16px) saturate(180%);
        -webkit-backdrop-filter: blur(16px) saturate(180%);
        z-index: 2147483646;
        display: none;
        animation: overlay-appear 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // Add enhanced animation styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes modal-appear {
            0% {
                opacity: 0;
                transform: translate(-50%, -45%) scale(0.95);
                backdrop-filter: blur(0px);
                -webkit-backdrop-filter: blur(0px);
            }
            100% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
            }
        }
        @keyframes overlay-appear {
            0% { 
                opacity: 0;
                backdrop-filter: blur(0px);
                -webkit-backdrop-filter: blur(0px);
            }
            100% { 
                opacity: 1;
                backdrop-filter: blur(16px) saturate(180%);
                -webkit-backdrop-filter: blur(16px) saturate(180%);
            }
        }
        @keyframes button-hover {
            0% { transform: translateY(0); }
            100% { transform: translateY(-2px); }
        }
        .url-guardian-button {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 40px;
            font-weight: 600;
            font-size: 14px;
            border-radius: 10px;
            transition: all 0.2s ease;
            cursor: pointer;
            border: none;
            outline: none;
            white-space: nowrap;
            padding: 0 16px;
        }
        .url-guardian-button:focus-visible {
            outline: 2px solid #4F46E5;
            outline-offset: 2px;
        }
        .url-guardian-button:active {
            transform: scale(0.98);
        }
        .url-guardian-button.primary {
            background: #4F46E5;
            color: white;
            box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
        }
        .url-guardian-button.primary:hover {
            background: #4338CA;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(79, 70, 229, 0.3);
        }
        .url-guardian-button.secondary {
            background: #F1F5F9;
            color: #4F46E5;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .url-guardian-button.secondary:hover {
            background: #E2E8F0;
            transform: translateY(-1px);
        }
        .url-guardian-button.danger {
            background: #EF4444;
            color: white;
            box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
        }
        .url-guardian-button.danger:hover {
            background: #DC2626;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
        }
        @media (max-width: 480px) {
            .url-guardian-button {
                height: 44px;
                font-size: 15px;
            }
            #url-guardian-modal {
                padding: 20px;
            }
            #url-guardian-modal > div:last-child {
                grid-template-columns: 1fr;
                gap: 8px;
            }
        }
    `;
    document.head.appendChild(styleSheet);

    // Append to document body
    document.body.appendChild(warningOverlay);
    document.body.appendChild(warningModal);

    console.log('Warning elements created successfully');
}

function showWarning(analysis) {
    console.log('Showing warning for:', analysis);

    // Create elements if they don't exist
    if (!warningModal || !warningOverlay) {
        createWarningElements();
    }

    // Ensure elements exist in the DOM
    if (!document.getElementById('url-guardian-modal')) {
        createWarningElements();
    }

    const severityColors = {
        high: '#EF4444',
        medium: '#F59E0B',
        low: '#10B981'
    };

    const severityIcons = {
        high: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9V14M12 17.5V18M4.9826 19H19.0174C20.2011 19 20.9715 17.7311 20.3493 16.7066L13.3319 4.29338C12.7097 3.26894 11.2903 3.26894 10.6681 4.29338L3.65074 16.7066C3.02851 17.7311 3.79892 19 4.9826 19Z" stroke="${severityColors[analysis.severity || 'high']}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
        medium: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9V14M12 17.5V18M4.9826 19H19.0174C20.2011 19 20.9715 17.7311 20.3493 16.7066L13.3319 4.29338C12.7097 3.26894 11.2903 3.26894 10.6681 4.29338L3.65074 16.7066C3.02851 17.7311 3.79892 19 4.9826 19Z" stroke="${severityColors[analysis.severity || 'medium']}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
        low: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9V14M12 17.5V18M4.9826 19H19.0174C20.2011 19 20.9715 17.7311 20.3493 16.7066L13.3319 4.29338C12.7097 3.26894 11.2903 3.26894 10.6681 4.29338L3.65074 16.7066C3.02851 17.7311 3.79892 19 4.9826 19Z" stroke="${severityColors[analysis.severity || 'low']}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`
    };

    warningModal.innerHTML = `
        <div style="
            display: flex;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 24px;
        ">
            <div style="
                flex-shrink: 0;
                margin-top: 2px;
                filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
            ">
                ${severityIcons[analysis.severity || 'high']}
            </div>
            <div style="flex-grow: 1;">
                <h2 style="
                    color: ${severityColors[analysis.severity || 'high']};
                    margin: 0 0 8px 0;
                    font-size: 22px;
                    font-weight: 600;
                    line-height: 1.3;
                ">Security Warning</h2>
                <p style="
                    color: #64748B;
                    margin: 0;
                    font-size: 15px;
                    line-height: 1.5;
                ">This website might be unsafe. The following security issues were detected:</p>
            </div>
        </div>
        <div style="
            background: rgba(248, 250, 252, 0.8);
            border: 1px solid rgba(226, 232, 240, 0.8);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
        ">
            <ul style="
                margin: 0;
                padding-left: 20px;
                color: #475569;
                font-size: 14px;
                line-height: 1.5;
            ">
                ${analysis.issues ? analysis.issues.map(issue => `
                    <li style="margin-bottom: 8px;">${issue}</li>
                `).join('') : '<li>Unknown security risk detected</li>'}
            </ul>
        </div>
        <div style="
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            justify-content: center;
            align-items: center;
        ">
            <button class="url-guardian-button secondary" id="url-guardian-block">
                Stay Safe
            </button>
            <button class="url-guardian-button danger" id="url-guardian-proceed">
                Proceed Anyway
            </button>
            <button class="url-guardian-button primary" id="url-guardian-report">
                Report Issue
            </button>
        </div>
    `;

    // Force display with animation
    warningModal.style.display = 'block';
    warningOverlay.style.display = 'block';

    // Add event listeners
    const targetUrl = analysis.url;
    blockedUrl = targetUrl;

    // Remove any existing event listeners
    const oldProceed = document.getElementById('url-guardian-proceed');
    const oldBlock = document.getElementById('url-guardian-block');
    const oldReport = document.getElementById('url-guardian-report');
    
    if (oldProceed) oldProceed.replaceWith(oldProceed.cloneNode(true));
    if (oldBlock) oldBlock.replaceWith(oldBlock.cloneNode(true));
    if (oldReport) oldReport.replaceWith(oldReport.cloneNode(true));

    // Add new event listeners with ripple effect
    document.getElementById('url-guardian-proceed').addEventListener('click', async () => {
        console.log('Proceed clicked for:', targetUrl);
        try {
            await chrome.runtime.sendMessage({
                type: 'USER_OVERRIDE',
                url: targetUrl
            });
            hideWarning();
            if (targetUrl) {
                window.location.href = targetUrl;
            }
        } catch (error) {
            console.error('Failed to process override:', error);
        }
    });

    document.getElementById('url-guardian-block').addEventListener('click', async () => {
        console.log('Block clicked for:', targetUrl);
        try {
            await chrome.runtime.sendMessage({
                type: 'USER_BLOCK',
                url: targetUrl
            });
            hideWarning();
            history.back();
        } catch (error) {
            console.error('Failed to process block:', error);
            hideWarning();
            history.back();
        }
    });

    document.getElementById('url-guardian-report').addEventListener('click', () => {
        alert('Thank you for reporting. This feature will be implemented soon.');
    });

    // Prevent closing when clicking overlay but add subtle feedback
    warningOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        warningModal.style.transform = 'translate(-50%, -50%) scale(0.98)';
        setTimeout(() => {
            warningModal.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 100);
    });

    console.log('Warning displayed successfully');
}

function hideWarning() {
    if (warningModal) {
        warningModal.style.display = 'none';
    }
    if (warningOverlay) {
        warningOverlay.style.display = 'none';
    }
    blockedUrl = null;
}

/**
 * Analyze a URL by communicating with the background script
 * @param {string} url - The URL to analyze
 * @returns {Object} Analysis result
 */
async function analyzeUrl(url) {
    try {
        // Send message to background script to analyze URL
        const response = await chrome.runtime.sendMessage({
            type: 'ANALYZE_URL',
            url: url
        });
        
        // If previously allowed, don't show warning
        if (response && response.previouslyAllowed) {
            return response;
        }
        
        // If the URL is flagged as risky, show warning
        if (response && !response.safe && response.risk === 'high') {
            // Create warning overlay with response data
            createWarningOverlay({
                url: url,
                risk: response.risk,
                reasons: response.reasons || ['Suspicious URL detected']
            });
            
            return response;
        }
        
        return response;
    } catch (error) {
        console.error('Error analyzing URL:', error);
        return { safe: true, risk: 'low' }; // Default to safe on error
    }
}

// Block navigation attempts to unsafe URLs
window.addEventListener('beforeunload', (event) => {
    if (blockedUrl === window.location.href) {
        event.preventDefault();
        event.returnValue = '';
        return event.returnValue;
    }
});

// Add click handler for links
document.addEventListener('click', async (e) => {
    const link = e.target.closest('a');
    if (link && !isAnalyzing) {
        const url = link.href;
        if (!url || url.startsWith('javascript:')) {
            return;
        }
        
        e.preventDefault();
        isAnalyzing = true;
        
        try {
            const isSafe = await analyzeUrl(url);
            if (isSafe) {
                hideWarning();
                window.location.href = url;
            }
        } catch (error) {
            console.error('Error analyzing clicked URL:', error);
            showWarning({
                url: url,
                issues: ['Unable to verify URL safety'],
                severity: 'high'
            });
        } finally {
            isAnalyzing = false;
        }
    }
});

// Initialize when the document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Analyze URL when page loads
window.addEventListener('load', async () => {
    const currentUrl = window.location.href;
    try {
        const isSafe = await analyzeUrl(currentUrl);
        if (!isSafe) {
            blockedUrl = currentUrl;
        }
    } catch (error) {
        console.error('Error during page load analysis:', error);
        showWarning({
            url: currentUrl,
            issues: ['Unable to verify URL safety'],
            severity: 'high'
        });
    }
});

// Handle dynamic URL changes
let lastUrl = window.location.href;
new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl && currentUrl !== 'about:blank') {
        lastUrl = currentUrl;
        analyzeUrl(currentUrl).catch(error => {
            console.error('Error during URL change:', error);
            showWarning({
                url: currentUrl,
                issues: ['Unable to verify URL safety'],
                severity: 'high'
            });
        });
    }
}).observe(document, { subtree: true, childList: true });

/**
 * Create warning overlay and related UI elements
 * @param {Object} data - Data about the risky URL
 */
function createWarningOverlay(data) {
    if (isWarningActive) {
        return; // Prevent multiple warnings
    }

    // Store warning state
    isWarningActive = true;
    currentWarningData = data;

    // Stop page load immediately
    window.stop();

    // Remove any existing overlay
    const existingOverlay = document.getElementById('aegis-warning');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'aegis-warning';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    `;

    // Create warning box
    const warningBox = document.createElement('div');
    warningBox.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 12px;
        max-width: 480px;
        width: 90%;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    // Warning icon and title
    const title = document.createElement('div');
    title.style.cssText = `
        color: #EF4444;
        font-size: 24px;
        font-weight: 600;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    title.innerHTML = '<span style="color: #EF4444; font-size: 28px;" class="material-icons">warning</span> Security Warning';

    // Warning message
    const message = document.createElement('div');
    message.style.cssText = `
        color: #1F2937;
        font-size: 16px;
        line-height: 1.5;
        margin-bottom: 20px;
    `;
    message.textContent = 'This website has been flagged as potentially dangerous. ';
    
    // Add reasons if provided
    if (data.reasons && data.reasons.length > 0) {
        const reasonsList = document.createElement('ul');
        reasonsList.style.cssText = `
            margin: 12px 0;
            padding-left: 20px;
        `;
        data.reasons.forEach(reason => {
            const li = document.createElement('li');
            li.textContent = reason;
            reasonsList.appendChild(li);
        });
        message.appendChild(reasonsList);
    }

    // Buttons container
    const buttons = document.createElement('div');
    buttons.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 24px;
    `;

    // Back button
    const backButton = document.createElement('button');
    backButton.style.cssText = `
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid #E5E7EB;
        background: #F9FAFB;
        color: #374151;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    `;
    backButton.textContent = 'Go Back';
    backButton.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Reset warning state
        isWarningActive = false;
        currentWarningData = null;
        
        // Remove overlay
        overlay.remove();
        
        // Prevent the current navigation
        window.stop();
        
        // Notify background script that navigation was blocked
        chrome.runtime.sendMessage({
            type: 'NAVIGATION_BLOCKED',
            url: data.url
        });
        
        // Go back to the previous page
        history.back();
        return false;
    };

    // Proceed button
    const proceedButton = document.createElement('button');
    proceedButton.style.cssText = `
        padding: 8px 16px;
        border-radius: 6px;
        border: none;
        background: #EF4444;
        color: white;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    `;
    proceedButton.textContent = 'Proceed Anyway';
    proceedButton.onclick = () => {
        // Prevent multiple clicks
        proceedButton.disabled = true;
        proceedButton.textContent = 'Processing...';
        
        // First, remove the overlay to let user know action is being processed
        isWarningActive = false;
        currentWarningData = null;
        overlay.remove();
        
        // Notify background script that URL was allowed (with retry)
        sendAllowedMessage(data.url, 3);
    };

    // Assemble warning box
    warningBox.appendChild(title);
    warningBox.appendChild(message);
    buttons.appendChild(backButton);
    buttons.appendChild(proceedButton);
    warningBox.appendChild(buttons);
    overlay.appendChild(warningBox);

    // Add to page
    document.body.appendChild(overlay);
}

/**
 * Send message to allow a URL with retry capability
 * @param {string} url - The URL to allow
 * @param {number} retries - Number of retry attempts
 */
function sendAllowedMessage(url, retries) {
    chrome.runtime.sendMessage({
        type: 'URL_ALLOWED',
        url: url
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error sending URL_ALLOWED message:', chrome.runtime.lastError);
            
            // Retry if we have retries left
            if (retries > 0) {
                setTimeout(() => sendAllowedMessage(url, retries - 1), 200);
            }
        } else {
            // Allow navigation to continue
            setTimeout(() => {
                try {
                    window.location.reload();
                } catch (error) {
                    console.error('Error reloading page:', error);
                    window.location.href = url;
                }
            }, 100);
        }
    });
}

// Prevent page unload while warning is active
window.addEventListener('beforeunload', (e) => {
    if (isWarningActive) {
        e.preventDefault();
        e.returnValue = '';
        window.stop();
        return '';
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isWarningActive && currentWarningData) {
        createWarningOverlay(currentWarningData);
    }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHOW_WARNING') {
        window.stop(); // Stop page load immediately
        createWarningOverlay(message.data);
        sendResponse({ success: true });
        return true;
    }
});

// Ensure warning persists on DOM changes
const observer = new MutationObserver(() => {
    if (isWarningActive && currentWarningData && !document.getElementById('aegis-warning')) {
        createWarningOverlay(currentWarningData);
    }
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});

// Initialize content script
document.addEventListener('DOMContentLoaded', () => {
    console.log('Aegis content script loaded');
    
    // Check current URL
    checkCurrentUrl();
});

// Also run on document load complete to catch any late-loading elements
window.addEventListener('load', () => {
    checkCurrentUrl();
});

/**
 * Check the current page URL for security risks
 */
async function checkCurrentUrl() {
    const url = window.location.href;
    if (url && !url.startsWith('chrome-extension:') && !url.startsWith('chrome:')) {
        try {
            // Only check the URL if there's no active warning
            if (!isWarningActive) {
                await analyzeUrl(url);
            }
        } catch (error) {
            console.error('Error checking current URL:', error);
        }
    }
}

// Listen for navigation events when available
if (typeof navigation !== 'undefined' && navigation.addEventListener) {
    navigation.addEventListener('navigate', (event) => {
        // Check new URL on navigation
        const url = event.destination.url;
        if (url) {
            analyzeUrl(url);
        }
    });
}

// Monitor link clicks to check URLs before navigation
document.addEventListener('click', async (e) => {
    // Find closest anchor element
    const link = e.target.closest('a');
    if (!link || !link.href) return;
    
    // Skip browser internal links
    if (link.href.startsWith('chrome:') || 
        link.href.startsWith('chrome-extension:') || 
        link.href.startsWith('javascript:') || 
        link.href.startsWith('about:')) {
        return;
    }
    
    try {
        // Analyze the URL the user is trying to navigate to
        const analysis = await analyzeUrl(link.href);
        
        // If it's risky and analysis is shown with overlay, prevent default navigation
        if (analysis && !analysis.safe && isWarningActive) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    } catch (error) {
        console.error('Error analyzing link URL:', error);
    }
}); 