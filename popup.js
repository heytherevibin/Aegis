/**
 * Aegis Security Extension - Popup Script
 * 
 * This script handles user interactions in the extension popup,
 * including settings management, theme switching, and stats display.
 * 
 * @author Vibin Mathew
 * @copyright 2025
 * @license MIT
 */

// Default settings
const defaultSettings = {
  enabled: true,
  showWarnings: true,
  blockHighRisk: true,
  theme: 'system',
  safeBrowsing: true,
  keepHistory: true
};

// Stats
let stats = {
  threatsBlocked: 0,
  urlsChecked: 0
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const warningsToggle = document.getElementById('warningsToggle');
  const blockToggle = document.getElementById('blockToggle');
  const safeBrowsingToggle = document.getElementById('enableSafeBrowsing');
  const keepHistoryToggle = document.getElementById('keepHistory');
  const statsContainer = document.querySelector('.stats');
  const settingsButton = document.getElementById('settingsButton');
  const settingsTab = document.getElementById('settingsTab');
  const closeSettings = document.getElementById('closeSettings');
  const body = document.body;
  const defaultHeight = 220;

  // Initialize settings
  const { settings = defaultSettings } = await chrome.storage.local.get('settings');
  
  // Initialize all toggles with null checks
  if (enableToggle) enableToggle.checked = settings.enabled;
  if (warningsToggle) warningsToggle.checked = settings.showWarnings;
  if (blockToggle) blockToggle.checked = settings.blockHighRisk;
  if (safeBrowsingToggle) safeBrowsingToggle.checked = settings.safeBrowsing;
  if (keepHistoryToggle) keepHistoryToggle.checked = settings.keepHistory;

  // Initialize stats visibility if container exists
  if (statsContainer) {
    updateStatsVisibility(settings.enabled);
  }

  // Initialize theme
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme;
  setTheme(theme);

  /**
   * Update stats container visibility based on extension enabled state
   * @param {boolean} enabled - Whether the extension is enabled
   */
  function updateStatsVisibility(enabled) {
    if (enabled) {
      statsContainer.classList.remove('disabled');
    } else {
      statsContainer.classList.add('disabled');
    }
  }

  /**
   * Update stats display with latest values from background script
   */
  function updateStats() {
    try {
      chrome.runtime.sendMessage({type: 'GET_STATS'}, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Connection error:', chrome.runtime.lastError.message);
          return;
        }
        
        if (response) {
          // Update the threatsBlocked counter
          const threatsBlockedElement = document.getElementById('threatsBlocked');
          if (threatsBlockedElement) {
            threatsBlockedElement.textContent = response.threatsBlocked || 0;
          }
          
          // Update the urlsAllowed counter
          const urlsAllowedElement = document.getElementById('urlsAllowed');
          if (urlsAllowedElement) {
            urlsAllowedElement.textContent = response.urlsAllowed || 0;
          }
          
          // Update the urlsChecked counter
          const urlsCheckedElement = document.getElementById('urlsChecked');
          if (urlsCheckedElement) {
            urlsCheckedElement.textContent = response.urlsChecked || 0;
          }
        }
      });
    } catch (error) {
      console.warn('Error updating stats:', error);
    }
  }

  // Settings toggle handlers
  const toggles = {
    warningsToggle: 'showWarnings',
    blockToggle: 'blockHighRisk',
    enableSafeBrowsing: 'safeBrowsing',
    keepHistory: 'keepHistory'
  };

  // Initialize enable toggle separately since it's in the header
  enableToggle.addEventListener('change', async (e) => {
    try {
      const { settings: currentSettings } = await chrome.storage.local.get('settings');
      const newSettings = { 
        ...currentSettings, 
        enabled: e.target.checked 
      };
      
      // Update storage
      await chrome.storage.local.set({ settings: newSettings });
      
      // Update UI
      updateStatsVisibility(e.target.checked);
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: newSettings
      });
    } catch (error) {
      console.error('Error updating enabled state:', error);
      // Revert toggle if there was an error
      e.target.checked = !e.target.checked;
    }
  });

  // Initialize other toggles
  Object.entries(toggles).forEach(([elementId, settingKey]) => {
    const toggle = document.getElementById(elementId);
    toggle.addEventListener('change', async (e) => {
      try {
        const { settings: currentSettings } = await chrome.storage.local.get('settings');
        const newSettings = { 
          ...currentSettings, 
          [settingKey]: e.target.checked 
        };
        
        // Update storage
        await chrome.storage.local.set({ settings: newSettings });
        
        // Notify background script
        chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          settings: newSettings
        });
      } catch (error) {
        console.error(`Error updating ${settingKey}:`, error);
        // Revert toggle if there was an error
        e.target.checked = !e.target.checked;
      }
    });
  });

  // Settings panel functionality
  function expandSettings() {
    settingsTab.classList.add('active');
    document.body.classList.add('settings-open');
  }

  function collapseSettings() {
    settingsTab.classList.remove('active');
    document.body.classList.remove('settings-open');
  }

  settingsButton.addEventListener('click', expandSettings);
  closeSettings.addEventListener('click', collapseSettings);

  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('click', async () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    const newSettings = { ...settings, theme: newTheme };
    await chrome.storage.local.set({ settings: newSettings });
    setTheme(newTheme);
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (settings.theme === 'system') {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Initial stats update
  updateStats();

  // Quick Site Check functionality
  const quickCheckButton = document.getElementById('quickCheckButton');
  const securityResults = document.getElementById('securityResults');
  const checkingStatus = document.getElementById('checkingStatus');
  const httpsStatus = document.getElementById('httpsStatus');
  const domainStatus = document.getElementById('domainStatus');
  const malwareStatus = document.getElementById('malwareStatus');
  const phishingStatus = document.getElementById('phishingStatus');

  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function updateResultItem(element, status, message, icon) {
    element.className = `result-item ${status}`;
    element.innerHTML = `
      <span class="material-icons">${icon}</span>
      <span>${message}</span>
    `;
  }

  async function checkSiteSecurity() {
    try {
      // Disable button and show results panel
      quickCheckButton.disabled = true;
      securityResults.classList.add('visible');
      
      // Get current tab
      const tab = await getCurrentTab();
      const url = new URL(tab.url);

      // Check HTTPS
      const isHttps = url.protocol === 'https:';
      updateResultItem(
        httpsStatus,
        isHttps ? 'safe' : 'danger',
        isHttps ? 'Secure HTTPS Connection' : 'Insecure Connection',
        isHttps ? 'lock' : 'lock_open'
      );

      // Check domain
      const domainParts = url.hostname.split('.');
      const isSuspiciousDomain = domainParts.length > 3 || url.hostname.includes('--');
      updateResultItem(
        domainStatus,
        isSuspiciousDomain ? 'warning' : 'safe',
        isSuspiciousDomain ? 'Suspicious Domain Structure' : 'Domain Looks Safe',
        isSuspiciousDomain ? 'warning' : 'check_circle'
      );

      // Request security check from background script
      chrome.runtime.sendMessage(
        { type: 'CHECK_SITE_SECURITY', url: tab.url },
        (response) => {
          if (response.malware) {
            updateResultItem(
              malwareStatus,
              response.malware.detected ? 'danger' : 'safe',
              response.malware.message,
              response.malware.detected ? 'dangerous' : 'check_circle'
            );
          }

          if (response.phishing) {
            updateResultItem(
              phishingStatus,
              response.phishing.detected ? 'danger' : 'safe',
              response.phishing.message,
              response.phishing.detected ? 'gpp_bad' : 'check_circle'
            );
          }

          // Remove checking status and re-enable button
          checkingStatus.style.display = 'none';
          quickCheckButton.disabled = false;
        }
      );
    } catch (error) {
      console.error('Error during security check:', error);
      checkingStatus.className = 'result-item danger';
      checkingStatus.innerHTML = `
        <span class="material-icons">error</span>
        <span>Error checking site security</span>
      `;
      quickCheckButton.disabled = false;
    }
  }

  quickCheckButton.addEventListener('click', checkSiteSecurity);

  // Update stats when storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings || changes.stats) {
      updateStats();
      
      // Update UI based on enabled state if it changed
      if (changes.settings?.newValue?.enabled !== undefined) {
        const isEnabled = changes.settings.newValue.enabled;
        enableToggle.checked = isEnabled;
        updateStatsVisibility(isEnabled);
      }
    }
  });
});

/**
 * Set the theme for the extension popup
 * @param {string} theme - Theme to apply ('light' or 'dark')
 */
function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  
  // Update theme toggle icon
  const themeIcon = document.querySelector('#themeToggle .material-icons');
  if (themeIcon) {
    themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
  }
  
  // Update CSS variables for the theme
  const root = document.documentElement;
  if (theme === 'dark') {
    root.style.setProperty('--primary', '#818CF8');
    root.style.setProperty('--primary-hover', '#6366F1');
    root.style.setProperty('--danger', '#FB7185');
    root.style.setProperty('--danger-hover', '#F43F5E');
    root.style.setProperty('--success', '#34D399');
    root.style.setProperty('--warning', '#FBBF24');
    root.style.setProperty('--text-primary', '#F8FAFC');
    root.style.setProperty('--text-secondary', '#CBD5E1');
    root.style.setProperty('--bg-primary', '#1E293B');
    root.style.setProperty('--bg-secondary', '#0F172A');
    root.style.setProperty('--border', '#334155');
    root.style.setProperty('--disabled', '#64748B');
    root.style.setProperty('--card-bg', 'rgba(31, 41, 55, 1)');
    root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.2)');
    root.style.setProperty('--blur-bg', 'rgba(17, 24, 39, 1)');
    root.style.setProperty('--ring-color', 'rgba(99, 102, 241, 0.2)');
    root.style.setProperty('--bg-hover', '#334155');
  } else {
    root.style.setProperty('--primary', '#6366F1');
    root.style.setProperty('--primary-hover', '#4F46E5');
    root.style.setProperty('--danger', '#EF4444');
    root.style.setProperty('--danger-hover', '#DC2626');
    root.style.setProperty('--success', '#10B981');
    root.style.setProperty('--warning', '#F59E0B');
    root.style.setProperty('--text-primary', '#1E293B');
    root.style.setProperty('--text-secondary', '#64748B');
    root.style.setProperty('--bg-primary', '#FFFFFF');
    root.style.setProperty('--bg-secondary', '#F8FAFC');
    root.style.setProperty('--border', '#E2E8F0');
    root.style.setProperty('--disabled', '#94A3B8');
    root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 1)');
    root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.05)');
    root.style.setProperty('--blur-bg', 'rgba(255, 255, 255, 1)');
    root.style.setProperty('--ring-color', 'rgba(99, 102, 241, 0.2)');
    root.style.setProperty('--bg-hover', '#F1F5F9');
  }
}

/**
 * Handle errors in the UI
 * @param {string} message - Error message to display
 */
function handleError(message) {
  const errorDiv = document.getElementById('error-message') || createErrorElement();
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  // Hide after 5 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

/**
 * Create error message element
 * @returns {HTMLElement} Error element
 */
function createErrorElement() {
  const errorDiv = document.createElement('div');
  errorDiv.id = 'error-message';
  errorDiv.style.cssText = `
    position: fixed;
    bottom: 16px;
    left: 16px;
    right: 16px;
    background: var(--danger);
    color: white;
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 1000;
    display: none;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;
  document.body.appendChild(errorDiv);
  return errorDiv;
}