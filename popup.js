// Default settings
const defaultSettings = {
  enableProtection: true,
  showWarnings: true,
  blockHighRisk: true,
  enableSafeBrowsing: true,
  keepHistory: true
};

// Stats
let stats = {
  threatsBlocked: 0,
  urlsChecked: 0
};

// Load settings from storage
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(defaultSettings);
    
    // Set all checkboxes
    document.getElementById('enableToggle').checked = settings.enableProtection;
    document.getElementById('showWarnings').checked = settings.showWarnings;
    document.getElementById('blockHighRisk').checked = settings.blockHighRisk;
    document.getElementById('enableSafeBrowsing').checked = settings.enableSafeBrowsing;
    document.getElementById('keepHistory').checked = settings.keepHistory;
    
    // Update status and icon
    updateStatus(settings.enableProtection);
    await updateExtensionIcon(settings.enableProtection);

    // Load stats
    const statsData = await chrome.storage.local.get(['stats']);
    if (statsData.stats) {
      stats = statsData.stats;
      updateStats();
    }

    // Load history
    await loadHistory();
  } catch (error) {
    handleError('Error loading settings. Please reload the extension.');
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    const settings = {
      enableProtection: document.getElementById('enableToggle').checked,
      showWarnings: document.getElementById('showWarnings').checked,
      blockHighRisk: document.getElementById('blockHighRisk').checked,
      enableSafeBrowsing: document.getElementById('enableSafeBrowsing').checked,
      keepHistory: document.getElementById('keepHistory').checked
    };
    
    await chrome.storage.sync.set(settings);
    await chrome.storage.local.set({ protectionEnabled: settings.enableProtection });
    
    // Update status and icon
    updateStatus(settings.enableProtection);
    await updateExtensionIcon(settings.enableProtection);
    
    // Notify background script
    await sendMessageWithRetry({
      type: 'SETTINGS_UPDATED',
      settings: settings
    });
  } catch (error) {
    handleError('Error saving settings. Please try again.');
  }
}

// Update status display
function updateStatus(enabled) {
  try {
    // Update main status
    const mainStatusValue = document.querySelector('.stat-value');
    if (mainStatusValue) {
      mainStatusValue.textContent = enabled ? 'Active' : 'Disabled';
      mainStatusValue.style.color = enabled ? '#4CAF50' : '#f44336';
    }

    // Update settings state
    const settingsInputs = document.querySelectorAll('.settings .toggle input[type="checkbox"]');
    settingsInputs.forEach(input => {
      if (input.id !== 'enableToggle') {
        input.disabled = !enabled;
      }
    });
  } catch (error) {
    handleError('Error updating status.');
  }
}

// Send message with retry
async function sendMessageWithRetry(message, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Handle errors
function handleError(message) {
  const errorDiv = document.getElementById('error-message') || createErrorElement();
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  // Hide error after 5 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Create error element if it doesn't exist
function createErrorElement() {
  const errorDiv = document.createElement('div');
  errorDiv.id = 'error-message';
  errorDiv.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #f44336;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 1000;
    display: none;
    text-align: center;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(errorDiv);
  return errorDiv;
}

// Update stats display
function updateStats() {
  try {
    const threatsElement = document.getElementById('threats-blocked');
    const urlsElement = document.getElementById('urls-checked');
    
    if (threatsElement) threatsElement.textContent = stats.threatsBlocked;
    if (urlsElement) urlsElement.textContent = stats.urlsChecked;
  } catch (error) {
    handleError('Error updating stats.');
  }
}

// Load and display URL history
async function loadHistory() {
  try {
    const result = await chrome.storage.local.get(['urlHistory']);
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    historyList.innerHTML = '';

    if (result.urlHistory && result.urlHistory.length > 0) {
      result.urlHistory.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
          <div class="url">${item.url}</div>
          <span class="status ${item.safe ? 'status-safe' : 'status-unsafe'}">
            ${item.safe ? 'Safe' : 'Blocked'}
          </span>
          <div class="timestamp">${new Date(item.timestamp).toLocaleString()}</div>
        `;
        historyList.appendChild(historyItem);
      });
    } else {
      historyList.innerHTML = '<div class="history-item">No history available</div>';
    }
  } catch (error) {
    handleError('Error loading history.');
  }
}

// Handle tab switching
function setupTabs() {
  try {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const contentId = tab.getAttribute('data-tab');
        const content = document.getElementById(contentId);
        if (content) {
          content.classList.add('active');
          if (contentId === 'history') {
            loadHistory();
          }
        }
      });
    });
  } catch (error) {
    handleError('Error setting up tabs.');
  }
}

// Update extension icon
async function updateExtensionIcon(isEnabled) {
  try {
    const iconPath = isEnabled ? {
      16: "icons/icon16.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png"
    } : {
      16: "icons/icon16_disabled.png",
      48: "icons/icon48_disabled.png",
      128: "icons/icon128_disabled.png"
    };

    await chrome.action.setIcon({ path: iconPath });
  } catch (error) {
    handleError('Error updating extension icon.');
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize UI elements
    const enableToggle = document.getElementById('enableToggle');
    const urlsCheckedElement = document.getElementById('urls-checked');
    const threatsBlockedElement = document.getElementById('threats-blocked');
    const historyList = document.getElementById('history-list');

    // Load initial state
    const { protectionEnabled } = await chrome.storage.local.get('protectionEnabled');
    enableToggle.checked = protectionEnabled;

    // Update stats display
    async function updateStats() {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
      if (response && response.success) {
        urlsCheckedElement.textContent = response.stats.totalAnalyzed || 0;
        threatsBlockedElement.textContent = response.stats.totalWarnings || 0;
      }
    }

    // Update history display
    async function updateHistory() {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
        if (!response || !response.success) {
          historyList.innerHTML = '<div class="history-item">No recent activity</div>';
          return;
        }

        const history = response.history || [];
        if (history.length === 0) {
          historyList.innerHTML = '<div class="history-item">No recent activity</div>';
          return;
        }

        historyList.innerHTML = history
          .slice(0, 5)
          .map(entry => {
            const url = truncateUrl(entry.url);
            const date = new Date(entry.timestamp).toLocaleString();
            const isSafe = entry.analysis.safe;
            const isOverriddenInSession = entry.overriddenInSession;
            
            let statusClass = isSafe ? 'status-safe' : 'status-unsafe';
            let statusText = isSafe ? 'Safe' : 'Warning';
            let statusIcon = isSafe ? '&check;' : '&#9888;';
            
            // If URL is overridden in current session, show override status
            if (isOverriddenInSession) {
              statusClass = 'status-override';
              statusText = 'Allowed';
              statusIcon = '&rarr;';
            }
            
            return `
              <div class="history-item">
                <div class="history-url" title="${entry.url}">${url}</div>
                <div class="history-status ${statusClass}">
                  <span class="status-icon" aria-hidden="true">${statusIcon}</span>
                  <span class="status-text">${statusText}</span>
                </div>
                <div class="history-time">${date}</div>
              </div>
            `;
          })
          .join('');

        // Add styles for status elements
        const style = document.createElement('style');
        style.textContent = `
          .history-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
            margin: 2px 0;
            white-space: nowrap;
          }
          .status-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            font-size: 14px;
            line-height: 1;
          }
          .status-text {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1;
            font-weight: 600;
            letter-spacing: -0.01em;
          }
          .status-safe {
            color: #00C851;
            background-color: rgba(0, 200, 81, 0.1);
          }
          .status-unsafe {
            color: #ff4444;
            background-color: rgba(255, 68, 68, 0.1);
          }
          .status-override {
            color: #2196F3;
            background-color: rgba(33, 150, 243, 0.1);
          }
          .history-url {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #333;
            font-size: 13px;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 280px;
          }
          .history-time {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #666;
            font-size: 12px;
          }
        `;
        document.head.appendChild(style);
      } catch (error) {
        console.error('Error updating history:', error);
        historyList.innerHTML = '<div class="history-item">Error loading history</div>';
      }
    }

    // Helper function to truncate URLs
    function truncateUrl(url) {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const path = urlObj.pathname;
        if (domain.length + path.length > 40) {
          return domain + path.substring(0, Math.max(0, 37 - domain.length)) + '...';
        }
        return domain + path;
      } catch (e) {
        return url.length > 40 ? url.substring(0, 37) + '...' : url;
      }
    }

    // Handle enable/disable toggle
    enableToggle.addEventListener('change', async () => {
      const newState = enableToggle.checked;
      try {
        await chrome.storage.local.set({ protectionEnabled: newState });
        await chrome.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
          settings: { enableProtection: newState }
        });
      } catch (error) {
        console.error('Error updating protection state:', error);
        enableToggle.checked = !newState; // Revert on error
      }
    });

    // Initial update
    await updateStats();
    await updateHistory();

    // Periodic updates
    setInterval(async () => {
      await updateStats();
      await updateHistory();
    }, 2000); // Update every 2 seconds

  } catch (error) {
    console.error('Error initializing popup:', error);
  }
});

// Update status every minute
setInterval(updateStatus, 60000); 