// User Learning System for URL Guardian
class UserLearningSystem {
    constructor() {
        this.userPatterns = {
            safeOverrides: new Map(), // URLs user consistently marks as safe
            categoryPreferences: new Map(), // User's preferences for different URL categories
            timeBasedActivity: new Map(), // Time-based access patterns
            domainTrust: new Map(), // Trust levels for different domains
            sessionData: {
                startTime: Date.now(),
                interactions: []
            }
        };
        this.weights = {
            overrideFrequency: 0.3,
            categoryTrust: 0.25,
            domainHistory: 0.25,
            timePattern: 0.2
        };
    }

    // Initialize or load existing learning data
    async initialize() {
        try {
            const stored = await chrome.storage.local.get('userLearningData');
            if (stored.userLearningData) {
                this.userPatterns = {
                    ...this.userPatterns,
                    ...stored.userLearningData,
                    sessionData: {
                        startTime: Date.now(),
                        interactions: []
                    }
                };
            }
            return true;
        } catch (error) {
            console.error('Failed to initialize learning system:', error);
            return false;
        }
    }

    // Record user interaction with a URL
    async recordInteraction(url, action, analysis) {
        const domain = new URL(url).hostname;
        const timestamp = Date.now();
        const hour = new Date().getHours();

        // Record the interaction
        this.userPatterns.sessionData.interactions.push({
            url,
            domain,
            action,
            timestamp,
            hour,
            analysis
        });

        // Update domain trust
        this.updateDomainTrust(domain, action);

        // Update category preferences
        if (analysis.category) {
            this.updateCategoryPreference(analysis.category, action);
        }

        // Update time-based patterns
        this.updateTimePattern(hour, action);

        // Save updated patterns
        await this.savePatterns();
    }

    // Update domain trust levels
    updateDomainTrust(domain, action) {
        const currentTrust = this.userPatterns.domainTrust.get(domain) || {
            safe: 0,
            unsafe: 0,
            total: 0
        };

        if (action === 'proceed') {
            currentTrust.safe++;
        } else if (action === 'block') {
            currentTrust.unsafe++;
        }
        currentTrust.total++;

        this.userPatterns.domainTrust.set(domain, currentTrust);
    }

    // Update category preferences
    updateCategoryPreference(category, action) {
        const current = this.userPatterns.categoryPreferences.get(category) || {
            trusted: 0,
            blocked: 0
        };

        if (action === 'proceed') {
            current.trusted++;
        } else if (action === 'block') {
            current.blocked++;
        }

        this.userPatterns.categoryPreferences.set(category, current);
    }

    // Update time-based patterns
    updateTimePattern(hour, action) {
        const current = this.userPatterns.timeBasedActivity.get(hour) || {
            safe: 0,
            unsafe: 0
        };

        if (action === 'proceed') {
            current.safe++;
        } else if (action === 'block') {
            current.unsafe++;
        }

        this.userPatterns.timeBasedActivity.set(hour, current);
    }

    // Calculate trust score for a URL based on learned patterns
    async calculateTrustScore(url, analysis) {
        const domain = new URL(url).hostname;
        const hour = new Date().getHours();
        let score = 0;

        // Domain trust score
        const domainTrust = this.userPatterns.domainTrust.get(domain);
        if (domainTrust) {
            const trustRatio = domainTrust.safe / domainTrust.total;
            score += trustRatio * this.weights.domainHistory;
        }

        // Category preference score
        if (analysis.category) {
            const categoryPref = this.userPatterns.categoryPreferences.get(analysis.category);
            if (categoryPref) {
                const categoryTrust = categoryPref.trusted / (categoryPref.trusted + categoryPref.blocked);
                score += categoryTrust * this.weights.categoryTrust;
            }
        }

        // Time-based pattern score
        const timePattern = this.userPatterns.timeBasedActivity.get(hour);
        if (timePattern) {
            const timeScore = timePattern.safe / (timePattern.safe + timePattern.unsafe);
            score += timeScore * this.weights.timePattern;
        }

        // Override frequency score
        const overrideScore = this.calculateOverrideScore(domain);
        score += overrideScore * this.weights.overrideFrequency;

        return score;
    }

    // Calculate score based on override frequency
    calculateOverrideScore(domain) {
        const overrides = this.userPatterns.safeOverrides.get(domain);
        if (!overrides) return 0;

        const frequency = overrides.frequency;
        const recency = (Date.now() - overrides.lastOverride) / (24 * 60 * 60 * 1000); // Days since last override

        return Math.min(frequency * Math.exp(-recency / 30), 1); // Decay over time
    }

    // Get recommendations based on learned patterns
    async getRecommendations(url, analysis) {
        const trustScore = await this.calculateTrustScore(url, analysis);
        const domain = new URL(url).hostname;
        const domainTrust = this.userPatterns.domainTrust.get(domain);

        return {
            trustScore,
            recommendation: this.interpretTrustScore(trustScore),
            domainStats: domainTrust || { safe: 0, unsafe: 0, total: 0 },
            learningConfidence: this.calculateConfidence(domain)
        };
    }

    // Interpret trust score into a recommendation
    interpretTrustScore(score) {
        if (score >= 0.8) return 'TRUST';
        if (score >= 0.6) return 'PROBABLY_SAFE';
        if (score >= 0.4) return 'NEUTRAL';
        if (score >= 0.2) return 'PROBABLY_UNSAFE';
        return 'UNSAFE';
    }

    // Calculate confidence in the learning system's recommendation
    calculateConfidence(domain) {
        const domainTrust = this.userPatterns.domainTrust.get(domain);
        if (!domainTrust) return 0;

        // More interactions = higher confidence, but with diminishing returns
        return Math.min(Math.log10(domainTrust.total + 1) / 2, 1);
    }

    // Save patterns to storage
    async savePatterns() {
        try {
            await chrome.storage.local.set({
                userLearningData: {
                    safeOverrides: this.userPatterns.safeOverrides,
                    categoryPreferences: this.userPatterns.categoryPreferences,
                    timeBasedActivity: this.userPatterns.timeBasedActivity,
                    domainTrust: this.userPatterns.domainTrust
                }
            });
        } catch (error) {
            console.error('Failed to save learning data:', error);
        }
    }
}

export const userLearning = new UserLearningSystem(); 