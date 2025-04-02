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
  const statsContainer = document.getElementById('statsContainer');
  const settingsButton = document.getElementById('settingsButton');
  const settingsPanel = document.getElementById('settingsPanel');
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  const privacyReportButton = document.getElementById('privacyReportButton');
  const privacyReportPanel = document.getElementById('privacyReportPanel');
  const privacyGraphCard = document.getElementById('privacyGraphCard');
  const refreshPrivacyReport = document.getElementById('refreshPrivacyReport');
  const closeButtons = document.querySelectorAll('.close-button');
  
  // Privacy report elements
  const currentDomainMini = document.getElementById('currentDomainMini');
  const privacyScoreBadge = document.getElementById('privacyScoreBadge');
  const privacyScore = document.getElementById('privacyScore');
  const graphBars = document.querySelectorAll('.graph-bar');
  
  // Settings panel state
  let isSettingsVisible = false;
  
  // Initialize stats and privacy score
  updateStats();
  initializePrivacyData();
  initializeStatCards();
  
  // Function to initialize privacy data
  async function initializePrivacyData() {
    try {
      // Check if extension is enabled before proceeding
      const { settings = defaultSettings } = await chrome.storage.local.get('settings');
      if (!settings.enabled) {
        // Extension is disabled, so just set the initial state of the heatmap
        const heatmapContainer = document.querySelector('.heatmap-container');
        if (heatmapContainer) {
          heatmapContainer.style.opacity = '0.5';
          heatmapContainer.classList.add('disabled');
        }
        return;
      }
      
      const tab = await getCurrentTab();
      if (tab && tab.url) {
        const domain = new URL(tab.url).hostname;
        
        // Update domain display
        if (currentDomainMini) {
          currentDomainMini.textContent = domain;
        }
        
        // Update heatmap domain display
        const domainElement = document.getElementById('privacyDomain');
        if (domainElement) {
          domainElement.textContent = domain;
        }
        
        // Check if we have a cached report for this domain
        chrome.storage.local.get(['privacyReports'], function(result) {
          const reports = result.privacyReports || {};
          
          if (reports[domain]) {
            // We have a cached report
            if (privacyScore) {
              privacyScore.textContent = Math.round(reports[domain].score);
            }
            updatePrivacyHeatmap(reports[domain]);
          } else {
            // Generate a new report
            const reportData = analyzePrivacy(domain, true);
            if (privacyScore) {
              privacyScore.textContent = Math.round(reportData.score);
            }
            updatePrivacyHeatmap(reportData);
          }
        });
      }
    } catch (error) {
      console.error('Error initializing privacy data:', error);
    }
  }
  
  /**
   * Analyze privacy for a domain
   * @param {string} domain - Domain to analyze
   * @param {boolean} quickMode - Whether to do a quick analysis
   * @returns {Object} Privacy report data
   */
  function analyzePrivacy(domain, quickMode = false) {
    // For demo purposes, generate a privacy score based on domain
    // In a real extension, this would analyze the current page
    
    // Create a simple hash of the domain to get consistent but varied results
    const domainHash = Array.from(domain).reduce(
      (hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0
    ) >>> 0; // Convert to unsigned 32-bit integer
    
    // Generate a score between 20 and 95 based on domain hash
    const baseScore = 20 + (domainHash % 76);
    
    // Detect trackers and cookies
    const trackers = detectTrackers(quickMode);
    const cookies = analyzeCookies(quickMode);
    
    // Adjust score based on trackers and cookies
    const trackerPenalty = trackers.length * 3;
    const cookiePenalty = cookies.thirdParty.length * 2;
    
    // Calculate final score (capped between 0-100)
    const score = Math.max(0, Math.min(100, baseScore - trackerPenalty - cookiePenalty));
    
    // Create privacy report
    const report = {
      domain: domain,
      timestamp: Date.now(),
      score: score,
      trackers: trackers,
      cookies: cookies
    };
    
    // Cache the report for future use
    cachePrivacyReport(domain, report);
    
    return report;
  }
  
  /**
   * Cache a privacy report for a domain
   * @param {string} domain - Domain
   * @param {Object} report - Privacy report data
   */
  function cachePrivacyReport(domain, report) {
    chrome.storage.local.get(['privacyReports'], function(result) {
      const reports = result.privacyReports || {};
      
      // Add the report
      reports[domain] = report;
      
      // Limit cache size to 20 domains
      const domains = Object.keys(reports);
      if (domains.length > 20) {
        // Remove oldest domains based on timestamp
        const oldestDomains = domains
          .sort((a, b) => reports[a].timestamp - reports[b].timestamp)
          .slice(0, domains.length - 20);
          
        oldestDomains.forEach(d => delete reports[d]);
      }
      
      // Save back to storage
      chrome.storage.local.set({ privacyReports: reports });
    });
  }
  
  // Toggle settings panel
  function toggleSettings() {
    isSettingsVisible = !isSettingsVisible;
    
    // Toggle settings button active state
    settingsButton.classList.toggle('active', isSettingsVisible);
    
    // Toggle panels with proper visibility
    if (isSettingsVisible) {
      statsContainer.style.opacity = '0';
      setTimeout(() => {
        statsContainer.style.display = 'none';
        settingsPanel.style.display = 'block';
        requestAnimationFrame(() => {
          settingsPanel.style.opacity = '1';
        });
      }, 150);
    } else {
      settingsPanel.style.opacity = '0';
      setTimeout(() => {
        settingsPanel.style.display = 'none';
        statsContainer.style.display = 'block';
        requestAnimationFrame(() => {
          statsContainer.style.opacity = '1';
        });
      }, 150);
    }
  }

  // Initialize settings
  const { settings = defaultSettings } = await chrome.storage.local.get('settings');
  
  // Toggle handler function
  function handleToggleClick(element, settingKey) {
    if (!element) return;
    
    // Set initial state
    element.classList.toggle('active', settings[settingKey]);
    element.setAttribute('aria-checked', settings[settingKey]);

    // For the main enable toggle, also set initial state for heatmap
    if (settingKey === 'enabled') {
      const heatmapContainer = document.querySelector('.heatmap-container');
      if (heatmapContainer) {
        heatmapContainer.style.opacity = settings[settingKey] ? '1' : '0.5';
        heatmapContainer.classList.toggle('disabled', !settings[settingKey]);
      }
    }

    element.addEventListener('click', async () => {
      const newState = !element.classList.contains('active');
      
      // Update visual state immediately
      element.classList.toggle('active', newState);
      element.setAttribute('aria-checked', newState);

      try {
        // Get current settings
        const { settings: currentSettings = defaultSettings } = await chrome.storage.local.get('settings');
        
        // Update settings
        const newSettings = {
          ...currentSettings,
          [settingKey]: newState
        };

        // Save to storage
        await chrome.storage.local.set({ settings: newSettings });

        // Update UI for main toggle
        if (settingKey === 'enabled') {
          statsContainer.style.opacity = newState ? '1' : '0.5';
          
          // Also update the heatmap container
          const heatmapContainer = document.querySelector('.heatmap-container');
          if (heatmapContainer) {
            heatmapContainer.style.opacity = newState ? '1' : '0.5';
            heatmapContainer.classList.toggle('disabled', !newState);
          }
        }

        // Notify background script
        chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          settings: newSettings
        });
      } catch (error) {
        console.error(`Failed to update ${settingKey}:`, error);
        // Revert visual state on error
        element.classList.toggle('active', !newState);
        element.setAttribute('aria-checked', !newState);
      }
    });
  }
  
  // Initialize all toggles
  handleToggleClick(enableToggle, 'enabled');
  handleToggleClick(warningsToggle, 'showWarnings');
  handleToggleClick(blockToggle, 'blockHighRisk');
  handleToggleClick(safeBrowsingToggle, 'safeBrowsing');
  handleToggleClick(keepHistoryToggle, 'keepHistory');

  // Add event listener for the settings button
  if (settingsButton) {
    settingsButton.addEventListener('click', toggleSettings);
  }

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
    if (statsContainer) {
      if (enabled) {
        statsContainer.classList.remove('disabled');
      } else {
        statsContainer.classList.add('disabled');
      }
      statsContainer.style.opacity = enabled ? '1' : '0.5';
    }
    
    // Also update heatmap visibility
    const heatmapContainer = document.querySelector('.heatmap-container');
    if (heatmapContainer) {
      if (enabled) {
        heatmapContainer.classList.remove('disabled');
      } else {
        heatmapContainer.classList.add('disabled');
      }
      heatmapContainer.style.opacity = enabled ? '1' : '0.5';
    }
  }

  // Quick Site Check functionality
  const quickCheckButton = document.getElementById('quickCheckButton');
  const securityResults = document.getElementById('securityResults');
  const checkingStatus = document.getElementById('checkingStatus');
  const httpsStatus = document.getElementById('httpsStatus');
  const domainStatus = document.getElementById('domainStatus');
  const malwareStatus = document.getElementById('malwareStatus');
  const phishingStatus = document.getElementById('phishingStatus');

  async function getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab;
    } catch (error) {
      console.warn('Error getting current tab:', error);
      return null;
    }
  }

  function updateResultItem(elementId, status, message) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Remove existing status classes
    element.classList.remove('safe', 'warning', 'danger');
    // Add new status class
    if (status) {
      element.classList.add(status);
    }

    // Update status text
    const statusSpan = element.querySelector('.status');
    if (statusSpan) {
      switch (status) {
        case 'safe':
          statusSpan.textContent = '✓ Safe';
          break;
        case 'warning':
          statusSpan.textContent = '! Warning';
          break;
        case 'danger':
          statusSpan.textContent = '✕ Risk';
          break;
        default:
          statusSpan.textContent = '...';
          break;
      }
    }
  }

  // Warning Dialog functionality
  function showWarningDialog(threatInfo) {
    const dialog = document.getElementById('warningDialog');
    if (!dialog) return;
    
    // Clear any existing content
    const threatsList = document.getElementById('threatsList');
    const blockedUrl = document.getElementById('blockedUrl');
    const riskLevel = document.getElementById('riskLevel');
    
    if (threatsList) threatsList.innerHTML = '';
    
    // Update blocked URL
    if (blockedUrl) {
      blockedUrl.textContent = threatInfo.url || 'Unknown URL';
    }

    // Add detected threats
    if (threatsList && threatInfo.threats) {
      const threats = new Set(); // Use Set to prevent duplicates
      
      if (threatInfo.malware?.detected) {
        threats.add('Malware or malicious code detected');
      }
      if (threatInfo.phishing?.detected) {
        threats.add('Phishing attempt identified');
      }
      if (threatInfo.suspicious) {
        threats.add('Suspicious behavior patterns detected');
      }
      if (threatInfo.unwanted) {
        threats.add('Potentially unwanted content');
      }
      
      // Add each unique threat to the list
      threats.forEach(threat => {
        const li = document.createElement('li');
        li.textContent = threat;
        threatsList.appendChild(li);
      });
    }

    // Update risk level
    if (riskLevel) {
      const riskScore = calculateRiskScore(threatInfo);
      const riskColor = getRiskColor(riskScore);
      
      riskLevel.innerHTML = `
        <span class="risk-badge" style="background-color: ${riskColor}">
          ${getRiskLabel(riskScore)}
        </span>
      `;
    }

    dialog.hidden = false;
    
    // Handle button clicks
    const goBackButton = document.getElementById('goBackButton');
    const proceedButton = document.getElementById('proceedButton');
    
    function closeDialog() {
      dialog.hidden = true;
      // Clean up event listeners
      goBackButton?.removeEventListener('click', handleGoBack);
      proceedButton?.removeEventListener('click', handleProceed);
    }
    
    function handleGoBack() {
      closeDialog();
      // Navigate back
      window.history.back();
    }
    
    function handleProceed() {
      closeDialog();
      // Add to allowed list if needed
      if (threatInfo.url) {
        chrome.storage.local.get(['allowedSites'], (result) => {
          const allowedSites = result.allowedSites || [];
          if (!allowedSites.includes(threatInfo.url)) {
            allowedSites.push(threatInfo.url);
            chrome.storage.local.set({ allowedSites });
          }
        });
      }
    }
    
    // Add event listeners
    goBackButton?.addEventListener('click', handleGoBack);
    proceedButton?.addEventListener('click', handleProceed);
    
    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        closeDialog();
      }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDialog();
      }
    }, { once: true });
  }

  // Helper functions for risk assessment
  function calculateRiskScore(threatInfo) {
    let score = 0;
    if (threatInfo.malware?.detected) score += 5;
    if (threatInfo.phishing?.detected) score += 4;
    if (threatInfo.suspicious) score += 3;
    if (threatInfo.unwanted) score += 2;
    return Math.min(10, score); // Cap at 10
  }

  function getRiskColor(score) {
    if (score >= 8) return 'hsl(var(--destructive))';
    if (score >= 5) return 'hsl(var(--warning))';
    return 'hsl(var(--muted))';
  }

  function getRiskLabel(score) {
    if (score >= 8) return 'High Risk';
    if (score >= 5) return 'Medium Risk';
    return 'Low Risk';
  }

  async function checkSiteSecurity() {
    if (!quickCheckButton || !securityResults) return;

    try {
      // Hide settings and show security results
      if (isSettingsVisible) {
        isSettingsVisible = false;
        settingsPanel.classList.remove('visible');
        settingsButton.classList.remove('active');
      }
      securityResults.classList.add('visible');
      quickCheckButton.classList.add('active');

      // Reset and show results panel
      quickCheckButton.disabled = true;
      
      // Show checking status
      updateResultItem('checkingStatus', '', 'Checking...');
      updateResultItem('httpsStatus', '', '...');
      updateResultItem('domainStatus', '', '...');
      updateResultItem('malwareStatus', '', '...');
      updateResultItem('phishingStatus', '', '...');

      // Get current tab
      const tab = await getCurrentTab();
      if (!tab?.url) {
        throw new Error('No valid URL found');
      }

      const url = new URL(tab.url);

      // Check HTTPS
      const isHttps = url.protocol === 'https:';
      updateResultItem(
        'httpsStatus',
        isHttps ? 'safe' : 'danger',
        isHttps ? 'Secure Connection' : 'Insecure'
      );

      // Check domain
      const domainParts = url.hostname.split('.');
      const isSuspiciousDomain = domainParts.length > 3 || url.hostname.includes('--');
      updateResultItem(
        'domainStatus',
        isSuspiciousDomain ? 'warning' : 'safe',
        isSuspiciousDomain ? 'Suspicious' : 'Safe'
      );

      // Send security check request to background script
      chrome.runtime.sendMessage(
        { type: 'CHECK_SITE_SECURITY', url: tab.url },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Error:', chrome.runtime.lastError);
            return;
          }

          // Update malware status
          updateResultItem(
            'malwareStatus',
            response?.malware?.detected ? 'danger' : 'safe',
            response?.malware?.detected ? 'Detected' : 'Clean'
          );

          // Update phishing status
          updateResultItem(
            'phishingStatus',
            response?.phishing?.detected ? 'danger' : 'safe',
            response?.phishing?.detected ? 'Detected' : 'Clean'
          );

          // Show warning dialog if high risk is detected
          const hasHighRisk = response?.malware?.detected || response?.phishing?.detected;
          if (hasHighRisk) {
            showWarningDialog({
              url: tab.url,
              malware: response.malware,
              phishing: response.phishing,
              suspicious: response.suspicious,
              unwanted: response.unwanted
            });
          }

          // Hide checking status and re-enable button
          const checkingStatus = document.getElementById('checkingStatus');
          if (checkingStatus) {
            checkingStatus.style.display = 'none';
          }
          quickCheckButton.disabled = false;
          quickCheckButton.classList.add('active');
        }
      );
    } catch (error) {
      console.error('Error during security check:', error);
      updateResultItem('checkingStatus', 'danger', 'Error');
      quickCheckButton.disabled = false;
      quickCheckButton.classList.remove('active');
    }
  }

  if (quickCheckButton) {
    quickCheckButton.addEventListener('click', checkSiteSecurity);
  }

  // Theme toggle
  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      const isDark = document.body.classList.contains('dark');
      const newTheme = isDark ? 'light' : 'dark';
      
      try {
        const newSettings = { ...settings, theme: newTheme };
        await chrome.storage.local.set({ settings: newSettings });
        setTheme(newTheme);
      } catch (error) {
        console.error('Failed to update theme:', error);
      }
    });
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (settings.theme === 'system') {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Update stats
  function updateStats() {
    try {
      chrome.runtime.sendMessage({type: 'GET_STATS'}, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Connection error:', chrome.runtime.lastError.message);
          return;
        }
        
        if (response) {
          // Update stats with animation
          updateStatWithAnimation('threatsBlocked', response.threatsBlocked || 0);
          updateStatWithAnimation('urlsAllowed', response.urlsAllowed || 0);
          updateStatWithAnimation('urlsChecked', response.urlsChecked || 0);
          
          // Update status level based on enabled features
          updateStatusLevel();
        }
      });
    } catch (error) {
      console.warn('Error updating stats:', error);
    }
  }
  
  // Update status level based on enabled features
  function updateStatusLevel() {
    const statusElement = document.querySelector('.stat-card:nth-child(4) .stat-value');
    if (!statusElement) return;
    
    chrome.storage.local.get(['settings'], function(result) {
      const settings = result.settings || defaultSettings;
      
      // Check which features are enabled
      const realTimeEnabled = settings.enabled;
      const blockHighRiskEnabled = settings.blockHighRisk;
      const safeBrowsingEnabled = settings.safeBrowsing;
      
      // Calculate protection level
      let statusLevel = "";
      let statusColor = "";
      
      if (realTimeEnabled && blockHighRiskEnabled && safeBrowsingEnabled) {
        statusLevel = "A+";
        statusColor = "hsl(143, 85%, 40%)"; // Green
      } else if (realTimeEnabled && (blockHighRiskEnabled || safeBrowsingEnabled)) {
        statusLevel = "A";
        statusColor = "hsl(94, 80%, 45%)"; // Light green
      } else if (realTimeEnabled) {
        statusLevel = "B";
        statusColor = "hsl(38, 95%, 50%)"; // Yellow/Orange
      } else {
        statusLevel = "C";
        statusColor = "hsl(0, 90%, 50%)"; // Red
      }
      
      // Update status display
      statusElement.textContent = statusLevel;
      statusElement.style.color = statusColor;
    });
  }

  // Update stats with animation
  function updateStatWithAnimation(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Special handling for threatsBlocked - set color to red
    if (elementId === 'threatsBlocked') {
      element.style.color = 'hsl(0, 90%, 50%)'; // Red color
    }
    
    const currentValue = parseInt(element.textContent, 10) || 0;
    
    // If the value hasn't changed, just update the color for threatsBlocked
    if (currentValue === newValue) return;
    
    // Calculate animation parameters
    const delta = newValue - currentValue;
    const duration = 500; // ms
    const steps = 20;
    const stepValue = delta / steps;
    const stepTime = duration / steps;
    
    // Start animation
    let currentStep = 0;
    
    const animate = () => {
      currentStep++;
      const current = Math.round(currentValue + (stepValue * currentStep));
      element.textContent = current;

      if (currentStep < steps) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = newValue;
      }
    };

    requestAnimationFrame(animate);
  }

  // Initial stats update
  updateStats();

  // Update stats every 5 seconds
  setInterval(updateStats, 5000);

  // Privacy report functionality
  function togglePrivacyReport() {
    privacyReportPanel.classList.toggle('show');
    if (settingsPanel.classList.contains('show')) {
      settingsPanel.classList.remove('show');
    }
    
    if (privacyReportPanel.classList.contains('show')) {
      generatePrivacyReport();
    }
  }

  function openPrivacyReport() {
    privacyReportPanel.classList.add('show');
    if (settingsPanel.classList.contains('show')) {
      settingsPanel.classList.remove('show');
    }
    generatePrivacyReport();
  }

  function updatePrivacyScore() {
    // Get current tab URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        const url = tabs[0].url;
        const domain = new URL(url).hostname;
        
        // Update domain display
        currentDomainMini.textContent = domain;
        
        // Check if we have a cached report for this domain
        chrome.storage.local.get(['privacyReports'], function(result) {
          const reports = result.privacyReports || {};
          
          if (reports[domain]) {
            // We have a cached report
            updateGraphUI(reports[domain].score);
            updatePrivacyHeatmap(reports[domain]);
          } else {
            // Generate a new quick report
            const reportData = analyzePrivacy(domain, true);
            updatePrivacyHeatmap(reportData);
          }
        });
      }
    });
  }

  function updatePrivacyHeatmap(reportData) {
    const heatmapContainer = document.querySelector('.heatmap-grid');
    if (!heatmapContainer) return;
    
    // Clear existing cells
    heatmapContainer.innerHTML = '';
    
    // Use the dense heatmap data generation for a more detailed visualization
    const rows = 4;
    const cols = 10;
    const metrics = generateDenseHeatmapData(reportData, rows * cols);
    
    // Generate the dense grid
    for (let i = 0; i < metrics.length; i++) {
      const metric = metrics[i];
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      
      // Add the row data attribute for styling
      cell.setAttribute('data-row', metric.row);
      
      // Determine intensity - normalized between 0 and 1
      const intensity = metric.value / 100;
      
      // Set the background color using the heatmap color function
      cell.style.backgroundColor = getHeatmapColor(metric.value, 'bad');
      
      // Add tooltip with data details
      cell.title = `${metric.category}: ${metric.value}`;
      
      // Add animation delay for staggered appearance
      cell.style.animationDelay = `${i * 0.01}s`;
      
      // Add the cell to the grid
      heatmapContainer.appendChild(cell);
    }
    
    // Update domain name and score in the header
    const domainElement = document.getElementById('privacyDomain');
    const scoreElement = document.getElementById('privacyScore');
    
    if (domainElement) {
      domainElement.textContent = reportData.domain || 'Current Website';
    }
    
    if (scoreElement) {
      scoreElement.textContent = Math.round(reportData.score || 0);
      
      // Update score badge color based on score
      if (reportData.score >= 70) {
        scoreElement.style.backgroundColor = 'hsl(143, 85%, 40%)'; // Green
      } else if (reportData.score >= 40) {
        scoreElement.style.backgroundColor = 'hsl(38, 95%, 50%)';  // Yellow/Orange
      } else {
        scoreElement.style.backgroundColor = 'hsl(0, 90%, 50%)';   // Red
      }
    }
  }

  function organizeMetricsForGrid(reportData) {
    // Create a 3x2 grid (6 cells) with consistent metrics
    const metrics = [];
    
    // Create consistent, meaningful metrics categories
    const metricCategories = [
      {
        name: 'Privacy',
        shortName: 'Privacy',
        label: 'Overall Score',
        value: reportData.score || 50,
        rawValue: Math.round(reportData.score || 50),
        type: 'good',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
      },
      {
        name: 'Trackers',
        shortName: 'Trackers',
        label: 'All Trackers',
        value: Math.min(100, (reportData.trackers?.length || 0) * 15),
        rawValue: reportData.trackers?.length || 0,
        type: 'bad',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M12 8H7a4 4 0 1 0 0 8h5"></path><line x1="12" y1="16" x2="12" y2="8"></line></svg>'
      },
      {
        name: 'Cookies',
        shortName: '3P Cookies',
        label: 'Third-Party Cookies',
        value: Math.min(100, (reportData.cookies?.thirdParty?.length || 0) * 10),
        rawValue: reportData.cookies?.thirdParty?.length || 0,
        type: 'bad',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M14.31 8l5.74 9.94"></path><path d="M9.69 8h11.48"></path><path d="M7.38 12l5.74-9.94"></path><path d="M9.69 16L3.95 6.06"></path><path d="M14.31 16H2.83"></path><path d="M16.62 12l-5.74 9.94"></path></svg>'
      },
      {
        name: 'Analytics',
        shortName: 'Analytics',
        label: 'Analytics Trackers',
        value: Math.min(100, (reportData.trackers?.filter(t => t.type === 'Analytics').length || 0) * 15),
        rawValue: reportData.trackers?.filter(t => t.type === 'Analytics').length || 0,
        type: 'neutral',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>'
      },
      {
        name: 'Behavior',
        shortName: 'Behavior',
        label: 'Behavior Tracking',
        value: Math.min(100, (reportData.trackers?.filter(t => t.type === 'User Behavior' || t.type === 'Fingerprinting').length || 0) * 25),
        rawValue: reportData.trackers?.filter(t => t.type === 'User Behavior' || t.type === 'Fingerprinting').length || 0,
        type: 'bad',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"></path><rect x="3" y="4" width="18" height="18" rx="2"></rect><circle cx="12" cy="10" r="2"></circle><line x1="8" y1="2" x2="8" y2="4"></line><line x1="16" y1="2" x2="16" y2="4"></line></svg>'
      },
      {
        name: 'FP Cookies',
        shortName: 'Cookies',
        label: 'First-Party Cookies',
        value: Math.min(100, (reportData.cookies?.first?.length || 0) * 5),
        rawValue: reportData.cookies?.first?.length || 0,
        type: 'neutral',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path><path d="M8.5 8.5v.01"></path><path d="M16 15.5v.01"></path><path d="M12 12v.01"></path><path d="M11 17v.01"></path><path d="M7 14v.01"></path></svg>'
      }
    ];
    
    // Add all metrics to the grid
    metrics.push(...metricCategories);
    
    return metrics;
  }

  function getHeatmapColor(value, type) {
    // Normalize value (0-100)
    const normalizedValue = Math.min(100, Math.max(0, value));
    
    // Define green colors from the provided palette
    const greenColors = [
      '#f5ffef', // Very light green
      '#e0f0d0', // Light green
      '#c5e0af', // Medium-light green
      '#92c87d', // Medium green
      '#5cab54', // Medium-dark green 
      '#3d8a3d', // Dark green
      '#1f6e1f', // Very dark green
      '#004d00'  // Darkest green
    ];
    
    // Map the normalized value to the green color array
    const index = Math.floor((normalizedValue / 100) * (greenColors.length - 1));
    return greenColors[index];
  }

  function updateGraphUI(score) {
    // Update the score display
    privacyScore.textContent = Math.round(score);
    
    // Update score badge color
    if (score >= 70) {
      privacyScoreBadge.style.backgroundColor = 'hsl(143, 85%, 40%)'; // Green
    } else if (score >= 40) {
      privacyScoreBadge.style.backgroundColor = 'hsl(38, 95%, 50%)';  // Yellow/Orange
    } else {
      privacyScoreBadge.style.backgroundColor = 'hsl(0, 90%, 50%)';   // Red
    }
    
    // Find which bar in the graph corresponds to the score
    // and highlight it
    let activeBarIndex = Math.floor(score / 100);
    
    graphBars.forEach((bar, index) => {
      const barScore = parseInt(bar.dataset.score);
      if (barScore <= score && barScore > score - 100) {
        bar.setAttribute('data-active', 'true');
        bar.style.backgroundColor = privacyScoreBadge.style.backgroundColor;
      } else {
        bar.removeAttribute('data-active');
        // Keep the default colors from CSS
      }
    });
  }

  function generatePrivacyReport() {
    // Get current domain
    getCurrentTab().then(tab => {
      const url = new URL(tab.url);
      const domain = url.hostname;
      
      // Update domain displays
      const currentDomain = document.getElementById('currentDomain');
      const currentDomainMini = document.getElementById('currentDomainMini');
      
      if (currentDomain) currentDomain.textContent = domain;
      if (currentDomainMini) currentDomainMini.textContent = domain;
      
      // Check if we have cached report for this domain
      chrome.storage.local.get(['privacyReports'], function(result) {
        const reports = result.privacyReports || {};
        let report = reports[domain];
        
        if (!report) {
          // Generate new report
          report = {
            domain: domain,
            timestamp: Date.now(),
            trackers: [],
            cookies: { first: [], thirdParty: [] },
            score: 0
          };
          
          // Add detailed data categories
          report.dataCategories = [
            "User Identity", "Location Data", "Device Info", "Browsing History", 
            "Session Data", "Cookie Storage", "Local Storage", "Fingerprinting",
            "Connection Data", "Third-Party Access", "Cross-Site Tracking", 
            "Canvas Fingerprinting", "Advertising ID", "Form Data", "Credentials"
          ];
          
          // Detect trackers
          const trackers = detectTrackers();
          report.trackers = trackers;
          
          // Analyze cookies
          const cookieAnalysis = analyzeCookies();
          report.cookies = cookieAnalysis;
          
          // Generate more data collection points based on domain
          generateDataCollectionPoints(report);
          
          // Calculate privacy score
          const scoreComponents = [
            { value: trackers.filter(t => t.type === 'Advertising').length * 5, weight: 2 },
            { value: trackers.filter(t => t.type === 'Analytics').length * 3, weight: 1 },
            { value: trackers.filter(t => t.type === 'User Behavior').length * 8, weight: 3 },
            { value: trackers.filter(t => t.type === 'Fingerprinting').length * 10, weight: 4 },
            { value: cookieAnalysis.thirdParty.length * 4, weight: 2 },
            { value: cookieAnalysis.first.length, weight: 1 },
            { value: report.dataCategories.length * 2, weight: 2 }
          ];
          
          const totalWeight = scoreComponents.reduce((sum, component) => sum + component.weight, 0);
          const weightedSum = scoreComponents.reduce((sum, component) => sum + (component.value * component.weight), 0);
          
          // Calculate weighted score and invert (higher values = worse privacy)
          const rawScore = weightedSum / totalWeight;
          report.score = Math.max(0, Math.min(100, 100 - rawScore));
          
          // Cache the report
          reports[domain] = report;
          chrome.storage.local.set({ 'privacyReports': reports });
        }
        
        // Update UI with report data
        updatePrivacyScoreChart(report.score);
        updateDataCollection(report);
        updatePrivacyConcerns(report);
        updateRecommendations(report);
        updateGraphUI(report.score);
        updatePrivacyBarChart(report); // Update the privacy bar chart
      });
    }).catch(error => {
      console.error("Error getting current tab:", error);
      handleError("Could not analyze current page. Please try again.");
    });
  }

  // Generate more detailed data collection points based on domain characteristics
  function generateDataCollectionPoints(report) {
    const domain = report.domain;
    
    // Extract existing data to generate realistic values
    const hasAds = report.trackers.some(t => t.type === 'Advertising');
    const hasAnalytics = report.trackers.some(t => t.type === 'Analytics');
    const hasBehavior = report.trackers.some(t => t.type === 'User Behavior');
    const hasFingerprinting = report.trackers.some(t => t.type === 'Fingerprinting');
    const thirdPartyCookiesCount = report.cookies.thirdParty.length;
    
    // Simple hash function to get consistent results
    function simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    }
    
    const domainHash = simpleHash(domain);
    
    // Add enriched data collection information
    report.dataCollectionDetails = {
      // Basic user data
      userIdentifiers: (hasAds || thirdPartyCookiesCount > 2) ? {
        collected: true,
        types: ["Browser Fingerprint", "Cookie ID", "Session ID"],
        persistence: "30-90 days"
      } : {
        collected: false,
        types: [],
        persistence: "None"
      },
      
      // Location data
      locationData: (hasAnalytics || hasBehavior) ? {
        collected: true,
        types: ["IP-based", "Time Zone"],
        precision: "City Level"
      } : {
        collected: false,
        types: [],
        precision: "None"
      },
      
      // Device information
      deviceInfo: {
        collected: true,
        types: ["Browser Type", "OS", "Screen Resolution", "Language"],
        detail: hasFingerprinting ? "High" : "Medium"
      },
      
      // Browsing habits
      browsingHabits: (hasAnalytics || hasBehavior) ? {
        collected: true,
        types: ["Page Views", "Time on Site", "Navigation Paths"],
        retention: "60-90 days"
      } : {
        collected: false,
        types: [],
        retention: "None"
      },
      
      // Cross-site tracking
      crossSiteTracking: (hasAds && thirdPartyCookiesCount > 1) ? {
        present: true,
        networks: ["Ad Networks", "Social Media", "Analytics"],
        extent: thirdPartyCookiesCount > 3 ? "Extensive" : "Moderate"
      } : {
        present: false,
        networks: [],
        extent: "None"
      },
      
      // First-party data
      firstPartyData: {
        collected: report.cookies.first.length > 0,
        types: ["Session State", "Preferences"],
        retention: "Browser Session"
      }
    };
    
    // Generate more detailed tracking information based on domain hash
    report.trackingTechnologies = {
      cookies: {
        used: report.cookies.first.length > 0 || report.cookies.thirdParty.length > 0,
        count: report.cookies.first.length + report.cookies.thirdParty.length,
        types: thirdPartyCookiesCount > 0 ? ["Session", "Persistent", "Third-Party"] : ["Session", "Persistent"]
      },
      localStorage: {
        used: (domainHash % 10) < 8, // 80% chance
        size: ((domainHash % 50) + 1) * 5, // 5-250KB
        persistence: "Until Cleared" 
      },
      fingerprinting: {
        used: hasFingerprinting,
        techniques: hasFingerprinting ? ["Canvas", "WebGL", "Audio", "Font Detection"] : []
      },
      trackers: {
        count: report.trackers.length,
        types: [...new Set(report.trackers.map(t => t.type))]
      }
    };
    
    // Add privacy implications
    report.privacyImplications = {
      profiling: hasAds || hasBehavior,
      targeted: hasAds,
      retention: thirdPartyCookiesCount > 2 ? "Long Term" : "Short Term",
      shared: thirdPartyCookiesCount > 3
    };
  }

  // Simulated data for demo purposes
  function detectTrackers(quickMode = false) {
    // In a real extension, this would analyze the current page
    // For demo, return simulated data
    
    const commonTrackers = [
      { name: 'Google Analytics', type: 'Analytics' },
      { name: 'Facebook Pixel', type: 'Advertising' },
      { name: 'DoubleClick', type: 'Advertising' }
    ];
    
    if (quickMode) {
      return commonTrackers;
    }
    
    // More detailed analysis for the full report
    return [
      ...commonTrackers,
      { name: 'Twitter Pixel', type: 'Advertising' },
      { name: 'HotJar', type: 'User Behavior' },
      { name: 'Mixpanel', type: 'Analytics' },
      { name: 'Amplitude', type: 'Analytics' }
    ];
  }

  function analyzeCookies(quickMode = false) {
    // In a real extension, this would analyze cookies
    // For demo, return simulated data
    
    const commonCookies = {
      first: [
        { name: 'session_id', domain: 'current-domain.com' },
        { name: 'user_prefs', domain: 'current-domain.com' }
      ],
      thirdParty: [
        { name: '_ga', domain: 'google-analytics.com' },
        { name: '_fbp', domain: 'facebook.com' },
        { name: 'ads', domain: 'doubleclick.net' }
      ]
    };
    
    if (quickMode) {
      return commonCookies;
    }
    
    // More detailed analysis for the full report
    return {
      first: [
        ...commonCookies.first,
        { name: 'csrf_token', domain: 'current-domain.com' },
        { name: 'theme', domain: 'current-domain.com' }
      ],
      thirdParty: [
        ...commonCookies.thirdParty,
        { name: '_tw', domain: 'twitter.com' },
        { name: 'uid', domain: 'hotjar.com' },
        { name: 'mp_id', domain: 'mixpanel.com' },
        { name: 'amp_user', domain: 'amplitude.com' }
      ]
    };
  }

  // Event listeners for privacy report
  if (privacyReportButton) {
    privacyReportButton.addEventListener('click', togglePrivacyReport);
  }

  if (privacyGraphCard) {
    privacyGraphCard.addEventListener('click', function(e) {
      // Only open if not clicking the shield button
      if (!e.target.closest('.privacy-shield-icon')) {
        openPrivacyReport();
      }
    });
  }

  if (refreshPrivacyReport) {
    refreshPrivacyReport.addEventListener('click', function() {
      // Clear cache for current domain and regenerate report
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          const url = tabs[0].url;
          const domain = new URL(url).hostname;
          
          chrome.storage.local.get(['privacyReports'], function(result) {
            const reports = result.privacyReports || {};
            delete reports[domain];
            chrome.storage.local.set({privacyReports: reports}, function() {
              generatePrivacyReport();
              updatePrivacyScore();
            });
          });
        }
      });
    });
  }

  // Close buttons
  closeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const panel = this.closest('.panel');
      if (panel) {
        panel.classList.remove('show');
      }
    });
  });

  // Automatically generate privacy report on load
  generatePrivacyReport();
  
  // Initialize drag and drop functionality for the sortable items
  // initDragAndDrop();
  
  // Initialize heatmap zoom functionality
  initializeHeatmapZoom();
  
  /**
   * Initialize drag and drop functionality for rearranging cards
   */
  /*
  function initDragAndDrop() {
    const container = document.querySelector('.sortable-container');
    if (!container) return;
    
    const sortableItems = container.querySelectorAll('.sortable-item');
    let draggedItem = null;
    let placeholder = null;
    let itemPositions = [];
    let startY = 0;
    let isDragging = false;
    let animationFrame = null;
    let lastY = 0;
    
    // Initialize the sortable items
    sortableItems.forEach(item => {
      // Make the entire card draggable
      item.addEventListener('mousedown', e => {
        // Don't start drag on buttons or interactive elements
        if (e.target.closest('button') || e.target.closest('svg') || e.target.closest('input')) {
          return;
        }
        
        e.preventDefault();
        startY = e.clientY;
        
        // Add a small delay before activating drag to prevent accidental drags
        const dragTimeout = setTimeout(() => {
          if (Math.abs(e.clientY - startY) < 5) {
            // Start dragging
            startDrag(item, e.clientY);
            isDragging = true;
          }
        }, 50); // Reduced delay for better responsiveness
        
        // Add listeners to detect movement and cancel drag if needed
        const moveListener = e => {
          if (Math.abs(e.clientY - startY) > 5 && !isDragging) {
            clearTimeout(dragTimeout);
            startDrag(item, e.clientY);
            isDragging = true;
          }
        };
        
        const upListener = () => {
          clearTimeout(dragTimeout);
          document.removeEventListener('mousemove', moveListener);
          document.removeEventListener('mouseup', upListener);
          if (!isDragging) {
            isDragging = false;
          }
        };
        
        document.addEventListener('mousemove', moveListener);
        document.addEventListener('mouseup', upListener);
      });
    });
    
    function startDrag(item, clientY) {
      // Cancel any ongoing animation
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      
      // Set the dragged item
      draggedItem = item;
      
      // Store initial positions of all sortable items before adding the dragging class
      itemPositions = Array.from(sortableItems).map(item => {
        const rect = item.getBoundingClientRect();
        return {
          item,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height
        };
      });
      
      // Create placeholder first, before modifying the dragged item's styles
      placeholder = document.createElement('div');
      placeholder.className = 'drag-placeholder';
      placeholder.style.height = `${draggedItem.offsetHeight}px`;
      
      // Insert placeholder
      container.insertBefore(placeholder, draggedItem);
      
      // Now add the dragging class which will trigger CSS transitions
      draggedItem.classList.add('dragging');
      
      // Set initial position without transitions for immediate response
      const initialStyles = {
        position: 'absolute',
        zIndex: '1000',
        width: `${draggedItem.offsetWidth}px`,
        top: `${clientY - container.getBoundingClientRect().top - (draggedItem.offsetHeight / 2)}px`,
        left: '0px'
      };
      
      // Apply all styles at once to reduce layout thrashing
      Object.assign(draggedItem.style, initialStyles);
      
      lastY = clientY;
      
      // Add event listeners for dragging
      document.addEventListener('mousemove', handleDragMove, { passive: false });
      document.addEventListener('mouseup', handleDragEnd);
    }
    
    function handleDragMove(e) {
      if (!draggedItem) return;
      
      e.preventDefault();
      
      // Store the Y position for the animation frame
      lastY = e.clientY;
      
      // Use requestAnimationFrame to throttle updates
      if (!animationFrame) {
        animationFrame = requestAnimationFrame(updateDraggedItemPosition);
      }
    }
    
    function updateDraggedItemPosition() {
      animationFrame = null;
      
      if (!draggedItem) return;
      
      // Update position using the stored Y value
      updateDraggedPosition(lastY);
      
      // Find the item being dragged over
      const draggedRect = placeholder.getBoundingClientRect();
      const draggedMiddle = (draggedRect.top + draggedRect.bottom) / 2;
      
      // Efficiently find the target position
      let targetItem = null;
      const currentIndex = Array.from(container.children).indexOf(placeholder);
      
      for (const pos of itemPositions) {
        if (pos.item !== draggedItem && 
            lastY >= pos.top && 
            lastY <= pos.bottom) {
          targetItem = pos.item;
          break;
        }
      }
      
      // Move the placeholder if needed
      if (targetItem) {
        const targetIndex = Array.from(container.children).indexOf(targetItem);
        
        // Only move if the position actually changed
        if (currentIndex !== targetIndex && targetIndex !== -1) {
          // Batch DOM operations
          if (currentIndex < targetIndex) {
            container.insertBefore(placeholder, targetItem.nextSibling);
          } else {
            container.insertBefore(placeholder, targetItem);
          }
        }
      }
    }
    
    function handleDragEnd() {
      if (!draggedItem) return;
      
      // Cancel any ongoing animation
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      
      // Prepare for animation back to normal
      const finalPosition = placeholder.getBoundingClientRect();
      
      // Remove event listeners first
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      
      // Replace placeholder with dragged item
      container.insertBefore(draggedItem, placeholder);
      container.removeChild(placeholder);
      
      // Reset dragged item style in a way that allows for smooth animation
      // First transition to the placeholder position
      draggedItem.style.position = 'relative';
      draggedItem.style.top = '';
      draggedItem.style.left = '';
      draggedItem.style.width = '';
      draggedItem.style.zIndex = '';
      
      // Finally remove the dragging class to complete the transition
      requestAnimationFrame(() => {
        draggedItem.classList.remove('dragging');
        
        // Clean up
        draggedItem = null;
        placeholder = null;
        isDragging = false;
        
        // Save the new order to storage
        saveCardOrder();
      });
    }
    
    function updateDraggedPosition(y) {
      if (!draggedItem) return;
      
      const containerRect = container.getBoundingClientRect();
      const draggedRect = draggedItem.getBoundingClientRect();
      
      // Keep the item within the container
      let top = y - containerRect.top - (draggedRect.height / 2);
      top = Math.max(0, Math.min(top, containerRect.height - draggedRect.height));
      
      // Apply transformation directly rather than changing style properties
      draggedItem.style.transform = `translate3d(0, ${top}px, 0)`;
    }
    
    function saveCardOrder() {
      // Get the current order of items
      const items = Array.from(container.children)
        .filter(item => item.classList.contains('sortable-item'))
        .map(item => item.id || item.className.split(' ')[0]);
      
      // Save to chrome storage
      chrome.storage.local.set({ cardOrder: items }, function() {
        console.log('Card order saved:', items);
      });
    }
    
    // Load the saved order
    loadCardOrder();
    
    function loadCardOrder() {
      chrome.storage.local.get(['cardOrder'], function(result) {
        if (result.cardOrder && result.cardOrder.length > 0) {
          const cardOrder = result.cardOrder;
          
          // Create a document fragment to batch DOM operations
          const fragment = document.createDocumentFragment();
          const orderedItems = [];
          
          // First collect all the items in the right order
          cardOrder.forEach(itemId => {
            // Find the item
            let item = document.getElementById(itemId);
            
            // If no ID match, try class name
            if (!item) {
              item = document.querySelector(`.${itemId}`);
            }
            
            if (item) {
              orderedItems.push(item);
            }
          });
          
          // Then append them all at once
          orderedItems.forEach(item => {
            fragment.appendChild(item);
          });
          
          // Clear and repopulate the container
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
          
          container.appendChild(fragment);
        }
      });
    }
  }
  */

  // Initialize zoom functionality for heatmap
  function initializeHeatmapZoom() {
    const zoomInButton = document.getElementById('zoomIn');
    const zoomOutButton = document.getElementById('zoomOut');
    const resetZoomButton = document.getElementById('resetZoom');
    const heatmapGrid = document.getElementById('privacyHeatmap');
    const heatmapWrapper = document.querySelector('.heatmap-wrapper');
    
    let currentZoom = 1;
    let isDragging = false;
    let startX, startY, translateX = 0, translateY = 0;
    
    // Zoom in handler
    if (zoomInButton) {
      zoomInButton.addEventListener('click', () => {
        if (currentZoom < 3) { // Max zoom limit
          currentZoom += 0.5;
          updateHeatmapTransform();
        }
      });
    }
    
    // Zoom out handler
    if (zoomOutButton) {
      zoomOutButton.addEventListener('click', () => {
        if (currentZoom > 1) { // Min zoom limit
          currentZoom -= 0.5;
          // If zooming out to 1, reset translation too
          if (currentZoom === 1) {
            translateX = 0;
            translateY = 0;
          }
          updateHeatmapTransform();
        }
      });
    }
    
    // Reset zoom handler
    if (resetZoomButton) {
      resetZoomButton.addEventListener('click', () => {
        currentZoom = 1;
        translateX = 0;
        translateY = 0;
        updateHeatmapTransform();
      });
    }
    
    // Enable panning when zoomed in
    if (heatmapWrapper && heatmapGrid) {
      // Mouse events for desktop
      heatmapWrapper.addEventListener('mousedown', (e) => {
        if (currentZoom > 1) {
          isDragging = true;
          startX = e.clientX - translateX;
          startY = e.clientY - translateY;
          heatmapWrapper.style.cursor = 'grabbing';
        }
      });
      
      heatmapWrapper.addEventListener('mousemove', (e) => {
        if (isDragging) {
          const newX = e.clientX - startX;
          const newY = e.clientY - startY;
          
          // Calculate bounds to prevent panning outside content
          const maxX = (currentZoom - 1) * heatmapWrapper.offsetWidth;
          const maxY = (currentZoom - 1) * heatmapWrapper.offsetHeight;
          
          translateX = Math.max(Math.min(newX, maxX), -maxX);
          translateY = Math.max(Math.min(newY, maxY), -maxY);
          
          updateHeatmapTransform();
        }
      });
      
      heatmapWrapper.addEventListener('mouseup', () => {
        isDragging = false;
        heatmapWrapper.style.cursor = 'grab';
      });
      
      heatmapWrapper.addEventListener('mouseleave', () => {
        isDragging = false;
        heatmapWrapper.style.cursor = '';
      });
      
      // Touch events for mobile
      heatmapWrapper.addEventListener('touchstart', (e) => {
        if (currentZoom > 1 && e.touches.length === 1) {
          isDragging = true;
          startX = e.touches[0].clientX - translateX;
          startY = e.touches[0].clientY - translateY;
        }
      });
      
      heatmapWrapper.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
          const newX = e.touches[0].clientX - startX;
          const newY = e.touches[0].clientY - startY;
          
          // Calculate bounds
          const maxX = (currentZoom - 1) * heatmapWrapper.offsetWidth;
          const maxY = (currentZoom - 1) * heatmapWrapper.offsetHeight;
          
          translateX = Math.max(Math.min(newX, maxX), -maxX);
          translateY = Math.max(Math.min(newY, maxY), -maxY);
          
          updateHeatmapTransform();
          e.preventDefault(); // Prevent page scrolling
        }
      });
      
      heatmapWrapper.addEventListener('touchend', () => {
        isDragging = false;
      });
    }
    
    // Update the transform style of the heatmap
    function updateHeatmapTransform() {
      if (heatmapGrid) {
        heatmapGrid.style.transform = `scale(${currentZoom}) translate(${translateX / currentZoom}px, ${translateY / currentZoom}px)`;
        
        // Update cursor style based on zoom level
        if (heatmapWrapper) {
          heatmapWrapper.style.cursor = currentZoom > 1 ? 'grab' : '';
        }
        
        // Update buttons state
        if (zoomInButton) zoomInButton.disabled = currentZoom >= 3;
        if (zoomOutButton) zoomOutButton.disabled = currentZoom <= 1;
        if (resetZoomButton) resetZoomButton.disabled = currentZoom === 1 && translateX === 0 && translateY === 0;
      }
    }
  }

  // Call this after generating the heatmap
  document.addEventListener('DOMContentLoaded', () => {
    // ... other initialization code
    
    // Initialize heatmap zoom functionality
    initializeHeatmapZoom();
  });

  // Initialize stats and privacy score
  updateStats();
  initializePrivacyData();
  initializeStatCards();
  
  // Function to initialize stat cards as clickable
  function initializeStatCards() {
    // Get all stat cards
    const statCards = document.querySelectorAll('.stat-card');
    
    // Add click handlers to each stat card
    statCards.forEach((card, index) => {
      card.addEventListener('click', () => {
        // Determine which dialog to show based on the card
        const statLabel = card.querySelector('.stat-label').textContent.trim();
        
        switch(statLabel) {
          case 'Threats Blocked':
            showDetailDialog('threatDetailDialog');
            updateThreatDetailDialog();
            break;
          case 'URLs Allowed':
            showDetailDialog('urlsAllowedDialog');
            updateURLsAllowedDialog();
            break;
          case 'URLs Checked':
            showDetailDialog('urlsCheckedDialog');
            updateURLsCheckedDialog();
            break;
          case 'Status':
            showDetailDialog('statusDetailDialog');
            updateStatusDetailDialog();
            break;
          default:
            break;
        }
      });
    });
    
    // Add event listeners to close buttons
    document.querySelectorAll('.close-detail-button').forEach(button => {
      button.addEventListener('click', () => {
        const dialog = button.closest('.detail-dialog');
        if (dialog) {
          dialog.setAttribute('hidden', '');
        }
      });
    });
    
    // Close dialogs when clicking outside
    document.querySelectorAll('.detail-dialog').forEach(dialog => {
      dialog.addEventListener('click', event => {
        if (event.target === dialog) {
          dialog.setAttribute('hidden', '');
        }
      });
    });
  }
  
  // Show a specific detail dialog
  function showDetailDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (dialog) {
      dialog.removeAttribute('hidden');
    }
  }
  
  // Update the threats blocked detail dialog
  function updateThreatDetailDialog() {
    const threatsBlockedDetail = document.getElementById('threatsBlockedDetail');
    const threatsBlockedList = document.getElementById('threatsBlockedList');
    
    if (threatsBlockedDetail && threatsBlockedList) {
      // Get the current value from the stat card
      const currentValue = document.getElementById('threatsBlocked').textContent;
      threatsBlockedDetail.textContent = currentValue;
      
      // Clear the existing list
      threatsBlockedList.innerHTML = '';
      
      // Get threats data from storage
      chrome.storage.local.get(['blockedThreats'], function(result) {
        const threats = result.blockedThreats || [];
        
        if (threats.length === 0) {
          // Show empty state
          const emptyItem = document.createElement('li');
          emptyItem.className = 'detail-empty';
          emptyItem.textContent = 'No threats have been blocked yet.';
          threatsBlockedList.appendChild(emptyItem);
        } else {
          // Add each threat to the list
          threats.forEach(threat => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
              <span>${threat.url}</span>
              <span>${formatDate(threat.date)}</span>
            `;
            threatsBlockedList.appendChild(listItem);
          });
        }
      });
    }
  }
  
  // Update the URLs allowed detail dialog
  function updateURLsAllowedDialog() {
    const urlsAllowedDetail = document.getElementById('urlsAllowedDetail');
    const urlsAllowedList = document.getElementById('urlsAllowedList');
    
    if (urlsAllowedDetail && urlsAllowedList) {
      // Get the current value from the stat card
      const currentValue = document.getElementById('urlsAllowed').textContent;
      urlsAllowedDetail.textContent = currentValue;
      
      // Clear the existing list
      urlsAllowedList.innerHTML = '';
      
      // Get allowed URLs from storage
      chrome.storage.local.get(['allowedSites'], function(result) {
        const sites = result.allowedSites || [];
        
        if (sites.length === 0) {
          // Show empty state
          const emptyItem = document.createElement('li');
          emptyItem.className = 'detail-empty';
          emptyItem.textContent = 'No websites have been explicitly allowed yet.';
          urlsAllowedList.appendChild(emptyItem);
        } else {
          // Add each site to the list
          sites.forEach(site => {
            const listItem = document.createElement('li');
            listItem.textContent = site;
            urlsAllowedList.appendChild(listItem);
          });
        }
      });
    }
  }
  
  // Update the URLs checked detail dialog
  function updateURLsCheckedDialog() {
    const urlsCheckedDetail = document.getElementById('urlsCheckedDetail');
    const urlHistoryChart = document.getElementById('urlHistoryChart');
    const urlsCheckedToday = document.getElementById('urlsCheckedToday');
    const urlsCheckedWeek = document.getElementById('urlsCheckedWeek');
    const urlsCheckedMonth = document.getElementById('urlsCheckedMonth');
    
    if (urlsCheckedDetail) {
      // Get the current value from the stat card
      const currentValue = document.getElementById('urlsChecked').textContent;
      urlsCheckedDetail.textContent = currentValue;
      
      // Get URL history data
      chrome.storage.local.get(['urlHistory'], function(result) {
        const history = result.urlHistory || {
          today: 0,
          week: 0,
          month: 0,
          daily: [0, 0, 0, 0, 0, 0, 0] // Last 7 days
        };
        
        // Update the time period stats
        if (urlsCheckedToday) urlsCheckedToday.textContent = history.today;
        if (urlsCheckedWeek) urlsCheckedWeek.textContent = history.week;
        if (urlsCheckedMonth) urlsCheckedMonth.textContent = history.month;
        
        // Update the chart
        if (urlHistoryChart) {
          urlHistoryChart.innerHTML = '';
          
          // Generate bars for the last 7 days
          const maxValue = Math.max(...history.daily, 1);
          history.daily.forEach((value, index) => {
            const height = (value / maxValue) * 100;
            const bar = document.createElement('div');
            bar.className = 'history-bar';
            bar.style.height = `${Math.max(height, 5)}%`;
            bar.style.width = '8%';
            bar.style.backgroundColor = 'var(--primary)';
            bar.style.borderRadius = '2px';
            bar.title = `${value} URLs checked`;
            
            urlHistoryChart.appendChild(bar);
          });
        }
      });
    }
  }
  
  // Update the status detail dialog
  function updateStatusDetailDialog() {
    const statusLabel = document.getElementById('statusLabel');
    const statusIcon = document.getElementById('statusIcon');
    const featureStatuses = {
      realtimeStatus: document.getElementById('realtimeStatus'),
      privacyStatus: document.getElementById('privacyStatus'),
      malwareStatus: document.getElementById('malwareStatus'),
      phishingStatus: document.getElementById('phishingStatus')
    };
    const versionInfo = document.getElementById('versionInfo');
    const lastUpdated = document.getElementById('lastUpdated');
    const databaseStatus = document.getElementById('databaseStatus');
    
    // Update based on current extension state
    chrome.storage.local.get(['settings', 'lastUpdated', 'dbVersion'], function(result) {
      const settings = result.settings || defaultSettings;
      
      // Calculate protection level
      let protectionLevel = "";
      let statusColor = "";
      
      const realTimeEnabled = settings.enabled;
      const warningsEnabled = settings.showWarnings;
      const blockHighRiskEnabled = settings.blockHighRisk;
      const safeBrowsingEnabled = settings.safeBrowsing;
      
      if (realTimeEnabled && blockHighRiskEnabled && safeBrowsingEnabled) {
        protectionLevel = "Maximum Protection";
        statusColor = "hsl(143, 85%, 40%)"; // Green
      } else if (realTimeEnabled && (blockHighRiskEnabled || safeBrowsingEnabled)) {
        protectionLevel = "High Protection";
        statusColor = "hsl(94, 80%, 45%)"; // Light green
      } else if (realTimeEnabled) {
        protectionLevel = "Standard Protection";
        statusColor = "hsl(38, 95%, 50%)"; // Yellow/Orange
      } else {
        protectionLevel = "Minimal Protection";
        statusColor = "hsl(0, 90%, 50%)"; // Red
      }
      
      // Update overall status
      if (statusLabel && statusIcon) {
        statusLabel.textContent = protectionLevel;
        statusLabel.style.color = statusColor;
        
        if (settings.enabled) {
          statusIcon.style.backgroundColor = statusColor;
          statusIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          `;
        } else {
          statusIcon.style.backgroundColor = 'hsl(0, 62.8%, 30.6%)'; // Red
          statusIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          `;
        }
      }
      
      // Update feature statuses
      if (featureStatuses.realtimeStatus) {
        featureStatuses.realtimeStatus.textContent = settings.enabled ? 'Active' : 'Disabled';
        featureStatuses.realtimeStatus.style.color = settings.enabled ? 'hsl(142, 76%, 36%)' : 'hsl(0, 62.8%, 30.6%)';
      }
      
      if (featureStatuses.privacyStatus) {
        featureStatuses.privacyStatus.textContent = settings.enabled ? 'Active' : 'Disabled';
        featureStatuses.privacyStatus.style.color = settings.enabled ? 'hsl(142, 76%, 36%)' : 'hsl(0, 62.8%, 30.6%)';
      }
      
      if (featureStatuses.malwareStatus) {
        featureStatuses.malwareStatus.textContent = settings.blockHighRisk ? 'Active' : 'Disabled';
        featureStatuses.malwareStatus.style.color = settings.blockHighRisk ? 'hsl(142, 76%, 36%)' : 'hsl(0, 62.8%, 30.6%)';
      }
      
      if (featureStatuses.phishingStatus) {
        featureStatuses.phishingStatus.textContent = settings.safeBrowsing ? 'Active' : 'Disabled';
        featureStatuses.phishingStatus.style.color = settings.safeBrowsing ? 'hsl(142, 76%, 36%)' : 'hsl(0, 62.8%, 30.6%)';
      }
      
      // Update system info
      if (versionInfo) {
        // Get extension version
        chrome.management.getSelf(info => {
          versionInfo.textContent = info.version;
        });
      }
      
      if (lastUpdated) {
        const lastUpdateDate = result.lastUpdated || Date.now();
        lastUpdated.textContent = formatDate(lastUpdateDate);
      }
      
      if (databaseStatus) {
        const dbVersion = result.dbVersion || { version: '1.0.0', updated: Date.now() };
        const daysSinceUpdate = Math.floor((Date.now() - dbVersion.updated) / (1000 * 60 * 60 * 24));
        
        if (daysSinceUpdate <= 7) {
          databaseStatus.textContent = 'Up to date';
          databaseStatus.style.color = 'hsl(142, 76%, 36%)';
        } else {
          databaseStatus.textContent = 'Update available';
          databaseStatus.style.color = 'hsl(38, 95%, 50%)';
        }
      }
    });
  }
  
  // Helper function to format dates
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
});

/**
 * Set the theme for the extension popup
 * @param {string} theme - Theme to apply ('light' or 'dark')
 */
function setTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
    document.documentElement.classList.add('dark');
    document.body.classList.remove('light');
    document.documentElement.classList.remove('light');
    
    // Update theme toggle icon to show moon (shadcn style)
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
        </svg>
      `;
      themeToggle.setAttribute('title', 'Switch to light mode');
      themeToggle.setAttribute('aria-label', 'Switch to light mode');
    }
  } else {
    document.body.classList.add('light');
    document.documentElement.classList.add('light');
    document.body.classList.remove('dark');
    document.documentElement.classList.remove('dark');
    
    // Update theme toggle icon to show sun (shadcn style)
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path>
          <path d="M12 20v2"></path>
          <path d="m4.93 4.93 1.41 1.41"></path>
          <path d="m17.66 17.66 1.41 1.41"></path>
          <path d="M2 12h2"></path>
          <path d="M20 12h2"></path>
          <path d="m6.34 17.66-1.41 1.41"></path>
          <path d="m19.07 4.93-1.41 1.41"></path>
        </svg>
      `;
      themeToggle.setAttribute('title', 'Switch to dark mode');
      themeToggle.setAttribute('aria-label', 'Switch to dark mode');
    }
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

// Function to open privacy report with focus on a specific metric
function openPrivacyReportWithFocus(metricName) {
  // First open the privacy report
  openPrivacyReport();
  
  // Then scroll to the relevant section based on metric name
  setTimeout(() => {
    let section;
    
    if (metricName === 'Ads' || metricName === 'Analytics' || metricName === 'All Trackers') {
      // For tracker-related metrics, focus on data collection section
      section = document.querySelector('.report-section:nth-child(1)');
      
      // Highlight the specific tracker type
      const trackerItems = document.querySelectorAll('.data-item');
      trackerItems.forEach(item => {
        const type = item.querySelector('.data-type');
        if (type && (
          (metricName === 'Ads' && type.textContent.includes('Advertising')) ||
          (metricName === 'Analytics' && type.textContent.includes('Analytics'))
        )) {
          item.style.backgroundColor = 'hsla(var(--primary), 0.1)';
          setTimeout(() => {
            item.style.backgroundColor = '';
          }, 2000);
        }
      });
    } else if (metricName === '3P Cookies' || metricName === 'Cookies') {
      // For cookie-related metrics, focus on data collection section
      section = document.querySelector('.report-section:nth-child(1)');
      
      // Highlight cookie items
      const cookieItems = document.querySelectorAll('.data-item');
      cookieItems.forEach(item => {
        const type = item.querySelector('.data-type');
        if (type && type.textContent.includes('Cookie')) {
          item.style.backgroundColor = 'hsla(var(--primary), 0.1)';
          setTimeout(() => {
            item.style.backgroundColor = '';
          }, 2000);
        }
      });
    } else if (metricName === 'Privacy') {
      // For privacy score, focus on the score chart
      section = document.querySelector('.privacy-score-container');
    }
    
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 300); // Small delay to ensure the panel has opened
}

function updatePrivacyBarChart(reportData) {
  if (!reportData) return;
  
  const heatmapGrid = document.querySelector('.heatmap-grid');
  const privacyGraphCard = document.getElementById('privacyGraphCard');
  const statsContainer = document.getElementById('statsContainer');
  
  if (!heatmapGrid) return;
  
  // Clear existing content
  heatmapGrid.innerHTML = '';
  
  // Create a grid with 4 rows and 10 columns (40 cells)
  const rows = 4;
  const cols = 10;
  const metrics = generateDenseHeatmapData(reportData, rows * cols);
  
  // Define green colors from the provided palette
  const greenColors = [
    '#f5ffef', // Very light green
    '#e0f0d0', // Light green
    '#c5e0af', // Medium-light green
    '#92c87d', // Medium green
    '#5cab54', // Medium-dark green 
    '#3d8a3d', // Dark green
    '#1f6e1f', // Very dark green
    '#004d00'  // Darkest green
  ];
  
  // Generate the dense grid
  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i];
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    
    // Add the row data attribute for styling
    cell.setAttribute('data-row', metric.row);
    
    // Determine color index based on value - normalize to green palette
    // Higher value = darker color (0 is lightest, 100 is darkest)
    const colorIndex = Math.floor((metric.value / 100) * (greenColors.length - 1));
    const color = greenColors[colorIndex];
    
    // Set the background color to the green value
    cell.style.backgroundColor = color;
    
    // Add tooltip with data details
    cell.title = `${metric.category}: ${metric.value}`;
    
    // Add animation delay for staggered appearance
    cell.style.animationDelay = `${i * 0.003}s`;
    
    // Add the cell to the grid
    heatmapGrid.appendChild(cell);
  }
  
  // Always make sure card is visible
  if (privacyGraphCard) {
    privacyGraphCard.style.display = 'block';
  }
  
  // Always ensure card is above the stats in the DOM
  if (privacyGraphCard && statsContainer) {
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      // Check if we need to reposition the card
      if (appContainer.children[1] !== privacyGraphCard) {
        appContainer.insertBefore(privacyGraphCard, statsContainer);
      }
    }
  }
}

// Generate dense heatmap data with many more data points
function generateDenseHeatmapData(reportData, cellCount) {
  const metrics = [];
  const domain = reportData.domain || 'unknown';
  
  // Seed values from existing data
  const adTrackers = reportData.trackers?.filter(t => t.type === 'Advertising').length || 0;
  const analyticsTrackers = reportData.trackers?.filter(t => t.type === 'Analytics').length || 0;
  const behaviorTrackers = reportData.trackers?.filter(t => t.type === 'User Behavior' || t.type === 'Fingerprinting').length || 0;
  const thirdPartyCookies = reportData.cookies?.thirdParty?.length || 0;
  const firstPartyCookies = reportData.cookies?.first?.length || 0;
  
  // Data categories organized by row - 4 rows, each with distinct data types
  const dataCategories = [
    // Row 1: User Identifiers
    { name: "User ID", baseValue: 15 + (adTrackers * 5), row: 0 },
    { name: "Browser Fingerprint", baseValue: 30 + (behaviorTrackers * 8), row: 0 },
    { name: "Device ID", baseValue: 25 + (thirdPartyCookies * 3), row: 0 },
    { name: "Authentication", baseValue: 10 + (analyticsTrackers * 2), row: 0 },
    { name: "Session IDs", baseValue: 20 + (firstPartyCookies * 3), row: 0 },
    { name: "Email Hash", baseValue: 40 + (adTrackers * 10), row: 0 },
    { name: "Ad Tracking ID", baseValue: 50 + (adTrackers * 12), row: 0 },
    { name: "Persistent Cookies", baseValue: 35 + (thirdPartyCookies * 5), row: 0 },
    { name: "Cookie Matching", baseValue: 45 + (thirdPartyCookies * 8), row: 0 },
    { name: "Social Media ID", baseValue: 30 + (adTrackers * 7), row: 0 },
    
    // Row 2: Location & Device Data
    { name: "Location", baseValue: 40 + (behaviorTrackers * 10), row: 1 },
    { name: "IP Address", baseValue: 30 + (analyticsTrackers * 5), row: 1 },
    { name: "Time Zone", baseValue: 15 + (analyticsTrackers * 2), row: 1 },
    { name: "GPS Data", baseValue: 60 + (behaviorTrackers * 15), row: 1 },
    { name: "Device Model", baseValue: 20 + (thirdPartyCookies * 2), row: 1 },
    { name: "Screen Size", baseValue: 15 + (analyticsTrackers * 3), row: 1 },
    { name: "Operating System", baseValue: 10 + (analyticsTrackers * 1), row: 1 },
    { name: "Browser Type", baseValue: 10 + (analyticsTrackers * 1), row: 1 },
    { name: "Network Info", baseValue: 25 + (behaviorTrackers * 5), row: 1 },
    { name: "ISP Data", baseValue: 30 + (analyticsTrackers * 6), row: 1 },
    
    // Row 3: Behavior Tracking
    { name: "Click Tracking", baseValue: 50 + (behaviorTrackers * 12), row: 2 },
    { name: "Scroll Depth", baseValue: 30 + (analyticsTrackers * 7), row: 2 },
    { name: "Mouse Movement", baseValue: 45 + (behaviorTrackers * 10), row: 2 },
    { name: "Session Duration", baseValue: 20 + (analyticsTrackers * 4), row: 2 },
    { name: "Page Views", baseValue: 25 + (analyticsTrackers * 5), row: 2 },
    { name: "Conversion Events", baseValue: 35 + (adTrackers * 8), row: 2 },
    { name: "Form Inputs", baseValue: 40 + (behaviorTrackers * 9), row: 2 },
    { name: "Video Interaction", baseValue: 30 + (analyticsTrackers * 6), row: 2 },
    { name: "Link Tracking", baseValue: 25 + (analyticsTrackers * 5), row: 2 },
    { name: "Purchase History", baseValue: 55 + (adTrackers * 15), row: 2 },
    
    // Row 4: Advanced Tracking & Cross-site
    { name: "Canvas Fingerprinting", baseValue: 70 + (behaviorTrackers * 20), row: 3 },
    { name: "WebGL Fingerprinting", baseValue: 65 + (behaviorTrackers * 18), row: 3 },
    { name: "Audio Fingerprinting", baseValue: 60 + (behaviorTrackers * 16), row: 3 },
    { name: "Font Detection", baseValue: 50 + (behaviorTrackers * 12), row: 3 },
    { name: "Battery API", baseValue: 40 + (behaviorTrackers * 10), row: 3 },
    { name: "Third-Party Sync", baseValue: 75 + (adTrackers * 20), row: 3 },
    { name: "Ad Network Sharing", baseValue: 80 + (adTrackers * 22), row: 3 },
    { name: "Data Broker Feeds", baseValue: 70 + (thirdPartyCookies * 15), row: 3 },
    { name: "Cross-Site Script", baseValue: 65 + (thirdPartyCookies * 12), row: 3 },
    { name: "Cross-Device Tracking", baseValue: 85 + (adTrackers * 25), row: 3 }
  ];
  
  // Hash function to get consistent results for the same domain
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Create a hash from the domain to get consistent but varied values
  const domainHash = simpleHash(domain);
  
  // Generate cells, ensuring we have the right number for each row
  const cellsPerRow = cellCount / 4; // With 4 rows
  
  for (let row = 0; row < 4; row++) {
    // Get categories for this row
    const rowCategories = dataCategories.filter(cat => cat.row === row);
    
    // Generate cells for this row
    for (let col = 0; col < cellsPerRow; col++) {
      // Select a category for this cell
      const categoryIndex = (col + domainHash + row * 7) % rowCategories.length;
      const category = rowCategories[categoryIndex];
      
      // Apply variations based on position and domain
      const positionFactor = Math.sin((col + row * 10) * 0.4) * 15;
      const rowFactor = row * 5; // Higher rows have slightly higher values
      const domainFactor = (domainHash % 20) * 0.5;
      
      // Calculate value - constrain between 0-100
      let value = Math.min(100, Math.max(0, 
        category.baseValue + positionFactor + domainFactor + rowFactor + (Math.random() * 10)
      ));
      
      // Create the metric entry
      metrics.push({
        category: category.name,
        value: Math.round(value),
        row: row
      });
    }
  }
  
  return metrics;
}

function updatePrivacyScoreChart(score) {
  const scoreElement = document.getElementById('privacyScore');
  const scoreChart = document.getElementById('privacyScoreChart');
  const scoreColor = document.getElementById('privacyScoreColor');
  
  if (scoreElement) scoreElement.textContent = Math.round(score);
  
  // Update the circular progress chart
  if (scoreChart) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    
    scoreChart.setAttribute('stroke-dasharray', circumference);
    scoreChart.setAttribute('stroke-dashoffset', offset);
    
    // Update color
    if (score >= 70) {
      scoreChart.setAttribute('stroke', 'hsl(143, 85%, 40%)'); // Green
      if (scoreColor) scoreColor.textContent = 'Good';
    } else if (score >= 40) {
      scoreChart.setAttribute('stroke', 'hsl(38, 95%, 50%)');  // Yellow/Orange
      if (scoreColor) scoreColor.textContent = 'Fair';
    } else {
      scoreChart.setAttribute('stroke', 'hsl(0, 90%, 50%)');   // Red
      if (scoreColor) scoreColor.textContent = 'Poor';
    }
  }
}

function updateDataCollection(reportData) {
  const dataCollectionList = document.getElementById('dataCollectionList');
  if (!dataCollectionList) return;
  
  dataCollectionList.innerHTML = '';
  
  // Add data from dataCollectionDetails if available
  if (reportData.dataCollectionDetails) {
    for (const [category, details] of Object.entries(reportData.dataCollectionDetails)) {
      if (details.collected || details.present) {
        const item = document.createElement('li');
        item.className = 'data-item';
        item.innerHTML = `
          <span class="data-name">${formatCategoryName(category)}</span>
          <span class="data-type">${getCollectionType(details)}</span>
        `;
        dataCollectionList.appendChild(item);
      }
    }
  } else {
    // Fall back to trackers if detailed data isn't available
    reportData.trackers?.forEach(tracker => {
      const item = document.createElement('li');
      item.className = 'data-item';
      item.innerHTML = `
        <span class="data-name">${tracker.name}</span>
        <span class="data-type">${tracker.type}</span>
      `;
      dataCollectionList.appendChild(item);
    });
    
    // Add third-party cookies
    reportData.cookies?.thirdParty?.forEach(cookie => {
      const item = document.createElement('li');
      item.className = 'data-item';
      item.innerHTML = `
        <span class="data-name">${cookie.name}</span>
        <span class="data-type">Cookie</span>
      `;
      dataCollectionList.appendChild(item);
    });
  }
  
  // If no items, show a message
  if (dataCollectionList.children.length === 0) {
    const item = document.createElement('li');
    item.className = 'data-item';
    item.innerHTML = `
      <span class="data-name">No data collection detected</span>
      <span class="data-type">-</span>
    `;
    dataCollectionList.appendChild(item);
  }
  
  // Helper functions for formatting
  function formatCategoryName(name) {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }
  
  function getCollectionType(details) {
    if (details.types && details.types.length > 0) {
      return details.types.length > 1 ? 'Multiple' : details.types[0];
    }
    if (details.networks && details.networks.length > 0) {
      return details.networks.length > 1 ? 'Multiple' : details.networks[0];
    }
    return 'Collected';
  }
}

function updatePrivacyConcerns(reportData) {
  const concernsList = document.getElementById('privacyConcernsList');
  if (!concernsList) return;
  
  concernsList.innerHTML = '';
  
  // Generate concerns based on the data
  const concerns = [];
  
  // Add concerns based on detailed data if available
  if (reportData.dataCollectionDetails && reportData.privacyImplications) {
    if (reportData.privacyImplications.profiling) {
      concerns.push({
        level: 'high',
        text: 'User behavior profiling detected'
      });
    }
    
    if (reportData.privacyImplications.shared) {
      concerns.push({
        level: 'high',
        text: 'Data shared with third parties'
      });
    }
    
    if (reportData.dataCollectionDetails.userIdentifiers?.collected) {
      concerns.push({
        level: 'medium',
        text: 'Collects user identification data'
      });
    }
    
    if (reportData.dataCollectionDetails.locationData?.collected) {
      concerns.push({
        level: 'medium',
        text: `Location tracking (${reportData.dataCollectionDetails.locationData.precision})`
      });
    }
    
    if (reportData.trackingTechnologies?.fingerprinting?.used) {
      concerns.push({
        level: 'high',
        text: 'Uses browser fingerprinting techniques'
      });
    }
    
    if (reportData.dataCollectionDetails.crossSiteTracking?.present) {
      concerns.push({
        level: 'high',
        text: `Cross-site tracking (${reportData.dataCollectionDetails.crossSiteTracking.extent})`
      });
    }
  } else {
    // Generate concerns based on basic data
    if (reportData.trackers?.length > 5) {
      concerns.push({
        level: 'high',
        text: 'Excessive tracking detected'
      });
    } else if (reportData.trackers?.length > 2) {
      concerns.push({
        level: 'medium',
        text: 'Multiple trackers found'
      });
    }
    
    if (reportData.cookies?.thirdParty?.length > 10) {
      concerns.push({
        level: 'high',
        text: 'Numerous third-party cookies'
      });
    } else if (reportData.cookies?.thirdParty?.length > 5) {
      concerns.push({
        level: 'medium',
        text: 'Several third-party cookies'
      });
    }
    
    // Add any tracking-specific concerns
    const adTrackers = reportData.trackers?.filter(t => t.type === 'Advertising') || [];
    if (adTrackers.length > 3) {
      concerns.push({
        level: 'high',
        text: 'Heavy advertising tracking'
      });
    }
    
    const analyticsTrackers = reportData.trackers?.filter(t => t.type === 'Analytics') || [];
    if (analyticsTrackers.length > 2) {
      concerns.push({
        level: 'medium',
        text: 'Detailed analytics tracking'
      });
    }
  }
  
  // Add concerns to the list
  concerns.forEach(concern => {
    const item = document.createElement('li');
    item.className = `concern-item ${concern.level}`;
    item.textContent = concern.text;
    concernsList.appendChild(item);
  });
  
  // If no concerns, add a positive message
  if (concernsList.children.length === 0) {
    const item = document.createElement('li');
    item.className = 'concern-item low';
    item.textContent = 'No significant privacy concerns detected';
    concernsList.appendChild(item);
  }
}

function updateRecommendations(reportData) {
  const recommendationsList = document.getElementById('recommendationsList');
  if (!recommendationsList) return;
  
  recommendationsList.innerHTML = '';
  
  // Generate recommendations based on the report data
  const recommendations = [];
  
  if (reportData.trackers?.length > 0) {
    recommendations.push('Use a tracker blocker extension');
  }
  
  if (reportData.cookies?.thirdParty?.length > 0) {
    recommendations.push('Consider clearing cookies regularly');
  }
  
  // Add detailed recommendations if available
  if (reportData.trackingTechnologies) {
    if (reportData.trackingTechnologies.fingerprinting?.used) {
      recommendations.push('Use a browser with fingerprinting protection');
    }
    
    if (reportData.dataCollectionDetails?.locationData?.collected) {
      recommendations.push('Consider using a VPN to mask your location');
    }
    
    if (reportData.privacyImplications?.targeted) {
      recommendations.push('Disable personalized ads in your browser settings');
    }
    
    if (reportData.trackingTechnologies.localStorage?.used) {
      recommendations.push('Clear local storage data periodically');
    }
  }
  
  // Add some default recommendations
  if (recommendations.length < 3) {
    recommendations.push('Use a privacy-focused browser');
    recommendations.push('Consider using a VPN for additional privacy');
  }
  
  // Add recommendations to the list
  recommendations.forEach(recommendation => {
    const item = document.createElement('li');
    item.className = 'recommendation-item';
    item.textContent = recommendation;
    recommendationsList.appendChild(item);
  });
}