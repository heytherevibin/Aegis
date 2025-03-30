// Password Security Checker Module
class PasswordSecurityChecker {
    constructor() {
        this.passwordCache = new Map();
        this.MIN_PASSWORD_LENGTH = 12;
        this.HIBP_API_URL = 'https://api.pwnedpasswords.com/range/';
    }

    // Initialize password monitoring
    initialize() {
        this.setupPasswordFieldMonitoring();
        this.setupFormSubmissionMonitoring();
    }

    // Monitor password fields
    setupPasswordFieldMonitoring() {
        document.addEventListener('input', async (event) => {
            if (this.isPasswordField(event.target)) {
                const password = event.target.value;
                if (password.length > 0) {
                    const analysis = await this.analyzePassword(password);
                    this.showPasswordFeedback(event.target, analysis);
                }
            }
        });
    }

    // Monitor form submissions
    setupFormSubmissionMonitoring() {
        document.addEventListener('submit', async (event) => {
            const passwordFields = Array.from(event.target.querySelectorAll('input[type="password"]'));
            if (passwordFields.length > 0) {
                event.preventDefault();
                
                const analyses = await Promise.all(
                    passwordFields.map(field => this.analyzePassword(field.value))
                );

                if (analyses.some(analysis => analysis.compromised)) {
                    this.showCompromisedWarning(passwordFields[0]);
                    return;
                }

                if (analyses.some(analysis => !analysis.strong)) {
                    this.showWeakPasswordWarning(passwordFields[0]);
                    return;
                }

                // Check for password reuse
                if (passwordFields.length > 1 && this.arePasswordsReused(passwordFields)) {
                    this.showPasswordReuseWarning(passwordFields[0]);
                    return;
                }

                event.target.submit();
            }
        });
    }

    // Check if element is a password field
    isPasswordField(element) {
        return element.tagName === 'INPUT' && 
               (element.type === 'password' || 
                element.getAttribute('autocomplete')?.includes('password'));
    }

    // Analyze password security
    async analyzePassword(password) {
        const analysis = {
            length: password.length,
            strong: this.checkPasswordStrength(password),
            compromised: false,
            timeToCrack: this.estimatePasswordCrackTime(password),
            suggestions: this.generatePasswordSuggestions(password)
        };

        // Check if password has been compromised
        try {
            analysis.compromised = await this.checkHaveIBeenPwned(password);
        } catch (error) {
            console.error('Error checking HaveIBeenPwned:', error);
        }

        return analysis;
    }

    // Check password strength
    checkPasswordStrength(password) {
        const hasLength = password.length >= this.MIN_PASSWORD_LENGTH;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        const score = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial]
            .filter(Boolean).length;

        return score >= 4;
    }

    // Check HaveIBeenPwned API
    async checkHaveIBeenPwned(password) {
        try {
            const hash = await this.sha1(password);
            const prefix = hash.substring(0, 5);
            const suffix = hash.substring(5);

            const response = await fetch(`${this.HIBP_API_URL}${prefix}`);
            const text = await response.text();
            
            return text.split('\n')
                .some(line => line.split(':')[0].toLowerCase() === suffix.toLowerCase());
        } catch (error) {
            console.error('HaveIBeenPwned API error:', error);
            return false;
        }
    }

    // Generate SHA-1 hash
    async sha1(str) {
        const buffer = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    }

    // Estimate password crack time
    estimatePasswordCrackTime(password) {
        const charset = this.getCharacterSet(password);
        const combinations = Math.pow(charset, password.length);
        const guessesPerSecond = 1000000000; // Assume 1 billion guesses per second
        const seconds = combinations / guessesPerSecond;

        return this.formatCrackTime(seconds);
    }

    // Get character set size for password
    getCharacterSet(password) {
        let charset = 0;
        if (/[a-z]/.test(password)) charset += 26;
        if (/[A-Z]/.test(password)) charset += 26;
        if (/\d/.test(password)) charset += 10;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) charset += 32;
        return charset || 26; // Default to lowercase if no matches
    }

    // Format crack time into human-readable string
    formatCrackTime(seconds) {
        if (seconds < 60) return 'less than a minute';
        if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
        if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
        if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
        return `${Math.round(seconds / 31536000)} years`;
    }

    // Generate password suggestions
    generatePasswordSuggestions(currentPassword) {
        const suggestions = [];
        const length = Math.max(currentPassword.length, this.MIN_PASSWORD_LENGTH);

        // Generate three strong password suggestions
        for (let i = 0; i < 3; i++) {
            suggestions.push(this.generateStrongPassword(length));
        }

        return suggestions;
    }

    // Generate a strong password
    generateStrongPassword(length) {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const special = '!@#$%^&*(),.?":{}|<>';
        
        let password = '';
        const allChars = lowercase + uppercase + numbers + special;
        
        // Ensure at least one of each type
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += special[Math.floor(Math.random() * special.length)];
        
        // Fill the rest randomly
        for (let i = password.length; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    // Check if passwords are being reused
    arePasswordsReused(passwordFields) {
        const passwords = new Set(passwordFields.map(field => field.value));
        return passwords.size < passwordFields.length;
    }

    // UI Feedback Methods
    showPasswordFeedback(element, analysis) {
        let feedback = document.getElementById('password-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.id = 'password-feedback';
            feedback.style.cssText = `
                position: absolute;
                background: white;
                padding: 10px;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                font-size: 12px;
                max-width: 250px;
                z-index: 10000;
            `;
            document.body.appendChild(feedback);
        }

        const rect = element.getBoundingClientRect();
        feedback.style.left = `${rect.left}px`;
        feedback.style.top = `${rect.bottom + 5}px`;

        let color = analysis.strong ? '#4CAF50' : '#f44336';
        if (analysis.compromised) color = '#ff9800';

        feedback.innerHTML = `
            <div style="color: ${color}; font-weight: bold; margin-bottom: 5px;">
                ${this.getStrengthMessage(analysis)}
            </div>
            <div style="margin-bottom: 5px;">
                Estimated crack time: ${analysis.timeToCrack}
            </div>
            ${analysis.compromised ? `
                <div style="color: #ff9800; margin-bottom: 5px;">
                    ⚠️ This password has been found in data breaches
                </div>
            ` : ''}
            ${!analysis.strong ? `
                <div style="margin-top: 5px;">
                    Suggestions:
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        ${analysis.suggestions.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        `;
    }

    // Get strength message
    getStrengthMessage(analysis) {
        if (analysis.compromised) return '⚠️ Compromised Password';
        if (analysis.strong) return '✅ Strong Password';
        return '❌ Weak Password';
    }

    // Show compromised password warning
    showCompromisedWarning(element) {
        this.showWarningModal(
            'Compromised Password Detected',
            'This password has been found in known data breaches. Using it puts your account at risk. Please choose a different password.',
            element
        );
    }

    // Show weak password warning
    showWeakPasswordWarning(element) {
        this.showWarningModal(
            'Weak Password Detected',
            'This password is not strong enough. Please choose a stronger password that includes uppercase and lowercase letters, numbers, and special characters.',
            element
        );
    }

    // Show password reuse warning
    showPasswordReuseWarning(element) {
        this.showWarningModal(
            'Password Reuse Detected',
            'Using the same password multiple times is not secure. Please use different passwords for each field.',
            element
        );
    }

    // Show warning modal
    showWarningModal(title, message, element) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            z-index: 10001;
            max-width: 400px;
            width: 90%;
        `;

        modal.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #f44336;">${title}</h3>
            <p style="margin: 0 0 15px 0;">${message}</p>
            <button style="
                background: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
            ">OK</button>
        `;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        const closeModal = () => {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
            element.focus();
        };

        modal.querySelector('button').addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);
    }
}

// Export the password checker
export const passwordChecker = new PasswordSecurityChecker(); 