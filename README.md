# URL Guardian - Chrome Extension

A powerful Chrome extension that provides advanced URL analysis and phishing protection. URL Guardian helps protect users from malicious websites by analyzing URLs before navigation and providing real-time security warnings.

## Features

- **URL Analysis**: Intercepts and analyzes URLs before navigation
- **Phishing Protection**: Detects suspicious URL patterns and potential phishing attempts
- **Real-time Warnings**: Shows user-friendly warning popups for suspicious URLs
- **Customizable Settings**: Adjust protection levels and warning preferences
- **Performance Optimized**: Uses caching to minimize impact on browsing speed

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the URL Guardian icon in your Chrome toolbar to access settings
2. The extension will automatically analyze URLs as you browse
3. If a suspicious URL is detected, you'll see a warning popup with options to:
   - Proceed Anyway
   - Block
   - Report

## Security Features

- URL structure analysis
- Suspicious pattern detection
- SSL certificate validation
- Phishing indicator analysis
- Local caching of analysis results

## Settings

- **Enable URL Protection**: Toggle the main protection feature
- **Show Warning Popups**: Control visibility of warning messages
- **Block High-Risk Sites**: Automatically block potentially dangerous URLs

## Development

The extension is built using:
- Chrome Extension Manifest V3
- JavaScript (ES6+)
- HTML5/CSS3

### Required Icons

The extension requires the following icons in the `icons` directory:
- `icon16.png` (16x16 pixels)
- `icon128.png` (128x128 pixels)

These icons should be placed in the `icons` directory before loading the extension. You can create your own icons or use placeholder icons for development.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Google Safe Browsing API
- Chrome Extension APIs
- Security research community 