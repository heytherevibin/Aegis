# Aegis - Web Security Extension

Aegis is a powerful browser extension designed to protect users from potentially harmful websites by analyzing URLs for security risks in real-time.

![Aegis Logo](icons/icon128.png)

## Features

- **Real-time URL Analysis**: Checks URLs as you browse and before you navigate to them
- **Smart Risk Detection**: Identifies high-risk, medium-risk, and safe websites
- **Visual Warnings**: Displays clear warnings when visiting potentially dangerous sites
- **Customizable Security**: Adjust security settings to match your browsing preferences
- **Statistics Dashboard**: View and track security stats including threats blocked and safe URLs
- **Dark/Light Mode**: Supports both dark and light themes with system theme detection

## Installation

### From Chrome Web Store
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (link to be updated once published)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. Aegis should now appear in your extensions list

## Usage

After installation, Aegis will automatically begin protecting your browsing experience:

1. **Toolbar Icon**: Click the Aegis shield icon in your toolbar to access controls and statistics
2. **Main Toggle**: Use the main toggle to enable/disable protection
3. **Settings**: Customize your security preferences:
   - Show Warnings: Display warnings for dangerous sites
   - Block High Risk: Automatically block high-risk websites
   - Safe Browsing: Enable advanced protection features
   - Keep History: Maintain a history of security events

## Security Features

Aegis analyzes URLs based on several risk factors:

- Suspicious TLDs (domain extensions)
- Non-HTTPS connections
- IP address URLs
- Authentication pages on suspicious domains
- Phishing keywords
- Excessive subdomains
- Suspicious query parameters

## Privacy

Aegis respects your privacy:
- All URL checking happens locally in your browser
- No browsing data is sent to external servers
- No personal information is collected

## Development

### Project Structure
- `popup.html` / `popup.js` - Extension popup UI and interaction
- `background.js` - Background service worker for URL analysis
- `content.js` - Content script for page interaction and warning display
- `manifest.json` - Extension configuration

### Build Instructions
1. Clone the repository
2. Make your desired changes
3. Load as an unpacked extension in Chrome

## License

[MIT License](LICENSE)

## Author

Created by Vibin Mathew (2025)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please open an issue on the repository.

If you find this extension useful, you can support its development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/X8X31CTHXH)

---

Aegis - Safer browsing for everyone 