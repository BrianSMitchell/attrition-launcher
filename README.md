# Attrition Game Launcher

The official launcher for **Attrition** - a strategic space empire MMO game. The launcher handles game downloads, updates, and provides a unified entry point for the game.

## 🚀 Features

- **Automatic Game Downloads** - Downloads the latest version of Attrition
- **Seamless Updates** - Automatically updates the game in the background
- **Desktop Integration** - Creates desktop shortcuts and Start Menu entries
- **Server Management** - Connects to game servers and handles authentication
- **Cross-Platform** - Available for Windows, macOS, and Linux

## 📥 Download

### For Players
Download the latest launcher from the [Releases page](https://github.com/BrianSMitchell/attrition-launcher/releases/latest) or visit [attritiongame.dev](https://attritiongame.dev).

### Supported Platforms
- **Windows 10+** (64-bit) - `Attrition Launcher-Setup-{version}.exe`
- **macOS 10.14+** - Coming Soon
- **Linux** (AppImage) - Coming Soon

## 🛠️ Development

### Prerequisites
- **Node.js** 18+ 
- **npm** or **yarn**
- **Git**

### Setup
```bash
# Clone the repository
git clone https://github.com/BrianSMitchell/attrition-launcher.git
cd attrition-launcher

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building
```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win     # Windows
npm run build:mac     # macOS  
npm run build:linux   # Linux

# Clean build artifacts
npm run clean
```

### Project Structure
```
attrition-launcher/
├── src/
│   ├── main.js              # Main Electron process
│   ├── preload.js           # Preload script
│   └── utils/               # Utility functions
├── ui/
│   ├── index.html           # Main UI
│   ├── style.css            # Styling
│   └── script.js            # UI logic
├── launcher-builder.yml     # Electron Builder config
├── launcher-shortcuts.nsh   # NSIS installer script
└── package.json             # Project configuration
```

## 🔧 Configuration

The launcher is configured via `launcher-builder.yml` for build settings and includes:

- **NSIS installer** with desktop shortcut creation
- **Auto-updater** integration (disabled - launcher manages game updates)
- **Code signing** (disabled for development)

## 📋 How It Works

1. **Launch** - User starts launcher from desktop shortcut
2. **Check Updates** - Launcher checks for game updates
3. **Download/Update** - Downloads game files if needed
4. **Launch Game** - Starts the main Attrition game
5. **Monitor** - Keeps game updated and manages server connections

## 🤝 Contributing

We welcome contributions! Please:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Issues
Report bugs and request features on the [Issues page](https://github.com/BrianSMitchell/attrition-launcher/issues).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related

- **Main Game**: [Attrition Game Repository](https://github.com/BrianSMitchell/attrition-game)
- **Website**: [attritiongame.dev](https://attritiongame.dev)
- **Community**: [Discord Server](https://discord.gg/attrition) (Coming Soon)

---

**Always launch Attrition through this launcher** - it ensures you have the latest version and proper server connections.

---

© 2025 Attrition Game Studio. All rights reserved.
