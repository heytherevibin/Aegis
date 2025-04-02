document.addEventListener('DOMContentLoaded', async () => {
  // Get the tab ID from the current window
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (!currentTab) return;

  // Get the warning info for this tab
  const warningKey = `warning_${currentTab.id}`;
  const { [warningKey]: warningInfo } = await chrome.storage.session.get(warningKey);

  if (!warningInfo) {
    console.error('No warning info found');
    return;
  }

  // Update the UI with warning info
  const { originalUrl, threatInfo } = warningInfo;

  // Set the blocked URL
  const blockedUrlElement = document.getElementById('blockedUrl');
  if (blockedUrlElement) {
    blockedUrlElement.textContent = originalUrl;
  }

  // Update threats list
  const threatsListElement = document.getElementById('threatsList');
  if (threatsListElement) {
    const threats = [];
    
    if (threatInfo.malware?.detected) {
      threats.push('Malware or malicious code detected');
    }
    if (threatInfo.phishing?.detected) {
      threats.push('Phishing attempt identified');
    }
    if (threatInfo.suspicious) {
      threats.push('Suspicious behavior patterns detected');
    }
    if (threatInfo.unwanted) {
      threats.push('Potentially unwanted content');
    }

    threatsListElement.innerHTML = threats
      .map(threat => `<li>${threat}</li>`)
      .join('');
  }

  // Update risk level
  const riskLevelElement = document.getElementById('riskLevel');
  if (riskLevelElement) {
    const riskScore = calculateRiskScore(threatInfo);
    const riskColor = getRiskColor(riskScore);
    
    riskLevelElement.innerHTML = `
      <span class="risk-badge" style="background-color: ${riskColor}">
        ${getRiskLabel(riskScore)}
      </span>
    `;
  }

  // Handle button clicks
  const goBackButton = document.getElementById('goBackButton');
  const proceedButton = document.getElementById('proceedButton');

  if (goBackButton) {
    goBackButton.addEventListener('click', async () => {
      try {
        // Get the current tab
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Try to go back in history first
        const historyItems = await chrome.history.search({
          text: '',
          maxResults: 2,
          startTime: Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
        });

        // Find the last safe page visited
        const previousSafeUrl = historyItems.find(item => 
          item.url !== originalUrl && 
          !item.url.includes('warning.html')
        );

        if (previousSafeUrl) {
          // Navigate to the previous safe page
          chrome.tabs.update(currentTab.id, { url: previousSafeUrl.url });
        } else {
          // If no previous safe page found, go to default homepage
          chrome.tabs.update(currentTab.id, { url: 'chrome://newtab' });
        }

        // Clean up warning info
        await chrome.storage.session.remove(warningKey);
      } catch (error) {
        console.error('Error navigating back:', error);
        // Fallback to default homepage if anything fails
        chrome.tabs.update(currentTab.id, { url: 'chrome://newtab' });
      }
    });
  }

  if (proceedButton) {
    proceedButton.addEventListener('click', async () => {
      try {
        // Add to allowed sites
        const { allowedSites = [] } = await chrome.storage.local.get('allowedSites');
        if (!allowedSites.includes(originalUrl)) {
          allowedSites.push(originalUrl);
          await chrome.storage.local.set({ allowedSites });
        }

        // Navigate to the original URL
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.update(currentTab.id, { url: originalUrl });

        // Clean up warning info
        await chrome.storage.session.remove(warningKey);
      } catch (error) {
        console.error('Error proceeding to site:', error);
      }
    });
  }

  // Set theme based on system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('dark', prefersDark);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.matches);
  });
});

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