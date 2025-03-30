import { passwordChecker } from './features/password/passwordChecker.js';

// State management
let warningModal = null;
let warningOverlay = null;
let isInitialized = false;
let connectionRetries = 0;
const MAX_RETRIES = 3;
let isWarningShown = false;

// Initialize the content script
function initialize() {
    if (isInitialized) return;
    
    try {
        createWarningElements();
        // Initialize password checker
        passwordChecker.initialize();
        isInitialized = true;
        console.log('URL Guardian: Content script initialized');
    } catch (error) {
        console.error('Failed to initialize warning system:', error);
    }
}

// Create warning elements
function createWarningElements() {
    // Create modal
    warningModal = document.createElement('div');
    warningModal.id = 'url-guardian-modal';
    warningModal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 2147483647;
        max-width: 500px;
        width: 90%;
        display: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    `;

    // Create overlay
    warningOverlay = document.createElement('div');
    warningOverlay.id = 'url-guardian-overlay';
    warningOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 2147483646;
        display: none;
    `;

    document.body.appendChild(warningOverlay);
    document.body.appendChild(warningModal);
}

// Show warning with analysis results
function showWarning(analysis) {
    if (!isInitialized) {
        initialize();
    }

    if (isWarningShown || !warningModal || !warningOverlay) {
        return;
    }

    isWarningShown = true;
    const severityColors = {
        high: '#ff4444',
        medium: '#ffbb33',
        low: '#00C851'
    };

    // Get learning recommendation info
    const learningInfo = analysis.learningRecommendation || {};
    const confidence = (learningInfo.learningConfidence * 100).toFixed(0);
    const stats = learningInfo.domainStats || { safe: 0, unsafe: 0, total: 0 };
    
    // Determine warning level based on both analysis and learning
    let warningLevel = 'high';
    if (learningInfo.recommendation === 'TRUST') {
        warningLevel = 'low';
    } else if (learningInfo.recommendation === 'PROBABLY_SAFE') {
        warningLevel = 'medium';
    }

    warningModal.innerHTML = `
        <style>
            .warning-title {
                color: ${severityColors[warningLevel]};
                margin: 0 0 15px 0;
                font-size: 20px;
                font-weight: 600;
            }
            .warning-content {
                color: #333;
                margin-bottom: 20px;
                font-size: 14px;
                line-height: 1.5;
            }
            .warning-issues {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 6px;
                margin-bottom: 20px;
                font-size: 13px;
            }
            .warning-issues ul {
                margin: 8px 0;
                padding-left: 20px;
                color: #666;
            }
            .learning-info {
                background: #e3f2fd;
                padding: 12px;
                border-radius: 6px;
                margin-bottom: 20px;
                font-size: 13px;
                color: #1976d2;
            }
            .learning-stats {
                display: flex;
                gap: 15px;
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid rgba(25, 118, 210, 0.1);
            }
            .stat-item {
                flex: 1;
                text-align: center;
            }
            .stat-value {
                font-size: 16px;
                font-weight: 600;
                color: #1976d2;
            }
            .stat-label {
                font-size: 11px;
                color: #666;
                margin-top: 2px;
            }
            .warning-buttons {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .warning-button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: opacity 0.2s;
            }
            .warning-button:hover {
                opacity: 0.9;
            }
            .proceed-button {
                background: #ff4444;
                color: white;
            }
            .block-button {
                background: #4CAF50;
                color: white;
            }
            .report-button {
                background: #2196F3;
                color: white;
            }
            .confidence-indicator {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 12px;
                font-weight: 500;
                background: rgba(25, 118, 210, 0.1);
                margin-left: 5px;
            }
        </style>
        <h2 class="warning-title">Security Warning</h2>
        <div class="warning-content">
            This website might be unsafe. The following security issues were detected:
        </div>
        <div class="warning-issues">
            <ul>
                ${analysis.issues ? analysis.issues.map(issue => `<li>${issue}</li>`).join('') : ''}
            </ul>
        </div>
        ${learningInfo.recommendation ? `
        <div class="learning-info">
            <strong>Based on your browsing patterns:</strong>
            <div>This domain appears to be ${learningInfo.recommendation.toLowerCase().replace('_', ' ')}
            <span class="confidence-indicator">${confidence}% confidence</span></div>
            <div class="learning-stats">
                <div class="stat-item">
                    <div class="stat-value">${stats.safe}</div>
                    <div class="stat-label">Safe Visits</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${stats.unsafe}</div>
                    <div class="stat-label">Blocked Visits</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">Total Visits</div>
                </div>
            </div>
        </div>
        ` : ''}
        <div class="warning-buttons">
            <button class="warning-button block-button" id="url-guardian-block">Stay Safe</button>
            <button class="warning-button proceed-button" id="url-guardian-proceed">Proceed Anyway</button>
            <button class="warning-button report-button" id="url-guardian-report">Report</button>
        </div>
    `;

    const targetUrl = analysis.url;

    // Show the warning elements
    warningModal.style.display = 'block';
    warningOverlay.style.display = 'block';

    // Event listeners for buttons
    document.getElementById('url-guardian-proceed').addEventListener('click', async () => {
        try {
            // Send override message to background script
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
        try {
            // Send block action to background script
            await chrome.runtime.sendMessage({
                type: 'USER_BLOCK',
                url: targetUrl
            });
            hideWarning();
        } catch (error) {
            console.error('Failed to process block:', error);
            hideWarning();
        }
    });

    document.getElementById('url-guardian-report').addEventListener('click', () => {
        // Open report dialog or form
        alert('Thank you for reporting. This feature will be implemented soon.');
    });

    warningOverlay.addEventListener('click', hideWarning);
}

// Hide warning
function hideWarning() {
    if (warningModal) {
        warningModal.style.display = 'none';
    }
    if (warningOverlay) {
        warningOverlay.style.display = 'none';
    }
    isWarningShown = false;
}

// Function to analyze URL with retry
async function analyzeUrl(url, retries = 0) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'ANALYZE_URL',
            url: url
        });

        if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message);
        }

        if (response && !response.safe && !response.overridden) {
            showWarning(response);
            return false;
        }
        
        // Reset connection retries on successful communication
        connectionRetries = 0;
        return true;
    } catch (error) {
        console.error('Error analyzing URL:', error);
        
        if (error.message.includes('Extension context invalidated') && retries < MAX_RETRIES) {
            connectionRetries++;
            await new Promise(resolve => setTimeout(resolve, 1000));
            return analyzeUrl(url, retries + 1);
        }
        
        // If all retries failed, allow navigation
        return true;
    }
}

// Message listener with automatic reconnection
function setupMessageListener() {
    try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'SHOW_WARNING' && message.analysis) {
                showWarning(message.analysis);
            }
            return false;
        });
    } catch (error) {
        console.error('Error setting up message listener:', error);
        if (connectionRetries < MAX_RETRIES) {
            connectionRetries++;
            setTimeout(setupMessageListener, 1000);
        }
    }
}

// Initialize when the document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Set up message listener
setupMessageListener();

// Analyze URL when page loads
window.addEventListener('load', () => {
    analyzeUrl(window.location.href).catch(error => {
        console.error('Error during page load analysis:', error);
    });
});

// Analyze URL when history state changes (for single-page applications)
window.addEventListener('popstate', () => {
    analyzeUrl(window.location.href).catch(error => {
        console.error('Error during history state change:', error);
    });
});

// Handle dynamic URL changes
let lastUrl = window.location.href;
new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        analyzeUrl(currentUrl).catch(error => {
            console.error('Error during URL change:', error);
        });
    }
}).observe(document, { subtree: true, childList: true });

// Add click handler for links
document.addEventListener('click', async (e) => {
    const link = e.target.closest('a');
    if (link && !isWarningShown) {
        const url = link.href;
        if (!url || url.startsWith('javascript:')) {
            return;
        }
        
        e.preventDefault();
        try {
            const isSafe = await analyzeUrl(url);
            if (isSafe) {
                window.location.href = url;
            }
        } catch (error) {
            console.error('Error analyzing clicked URL:', error);
            // In case of error, allow the navigation
            window.location.href = url;
        }
    }
}); 