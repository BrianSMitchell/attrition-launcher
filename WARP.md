# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

The **Attrition Game Launcher** is an Electron-based desktop application that manages downloads, updates, and launching of the Attrition space strategy MMO game. This launcher is part of the larger **Attrition** project - a real-time multiplayer strategic space empire game built as a monorepo.

### Launcher's Role in the Ecosystem
- **Distribution System**: Primary entry point for players (v1.0.7+)
- **Auto-update Management**: Downloads and installs game updates from GitHub releases
- **Launch Protection**: Ensures players run the game through the launcher for proper updates
- **Installation Management**: Handles game installation at `%LOCALAPPDATA%\Programs\Attrition\`

### Parent Project Context
- **Main Game**: Strategic desktop space empire game with Electron + React frontend, Node.js + MongoDB backend
- **Architecture**: Monorepo with packages for desktop, client, server, and shared utilities
- **Current Versions**: Game v1.0.9, Launcher v1.0.7
- **Technology**: Uses pnpm (>=8.0.0) and Node.js (>=18.0.0)

## Common Development Commands

### Development Setup
```bash
# Install dependencies
npm install

# Run in development mode (hot-reload enabled)
npm run dev
# OR
npm start
```

### Building
```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win     # Windows installer (.exe)
npm run build:mac     # macOS (future)
npm run build:linux   # Linux AppImage (future)

# Create distribution packages
npm run dist
```

### Maintenance
```bash
# Clean all build artifacts and dependencies
npm run clean

# Install app dependencies after changes
npm run postinstall
```

### Release Management
```powershell
# Create GitHub release (PowerShell script)
./create-release.ps1 -Version "1.1.2" -InstallerPath "releases/Attrition Launcher-Setup-1.1.2.exe"
```

### Parent Project Integration Commands
```bash
# From parent Attrition directory - launcher development
pnpm launcher:dev           # Develop launcher
pnpm launcher:build         # Build launcher
pnpm launcher:dist          # Create launcher installer

# Main game development (requires launcher)
pnpm dev                     # Start server + desktop app
pnpm --filter @game/shared build  # Build shared package first
pnpm release:prepare        # Build + create distribution for launcher updates
```

## Architecture Overview

### Core Components

**Main Process (`src/main.js`)**
- Electron main process controller
- Manages launcher window lifecycle
- Handles IPC communication with renderer
- Controls game process spawning and monitoring
- Coordinates update checking and installation

**Renderer Process (`ui/launcher.html`)**
- Web-based UI with custom CSS styling
- Real-time status updates and progress tracking
- Interactive launch button and error handling
- Download progress visualization with speed calculation

**Preload Script (`src/preload.js`)**
- Secure bridge between main and renderer processes
- Exposes `launcherAPI` object to the renderer
- Implements context isolation for security

**Update Service (`src/services/updateChecker.js`)**
- Handles GitHub API integration for release checking
- Manages download progress tracking with axios streams
- Performs automatic installation via NSIS installer
- Semantic versioning comparison using semver library

### Key Workflows

**Startup Sequence**
1. Main process creates launcher window
2. Renderer loads and sets up event listeners
3. Update checker automatically scans for game updates
4. UI updates in real-time based on status messages
5. Launch button enabled when game is ready

**Update Process**
1. Check GitHub API for latest release
2. Compare versions using semantic versioning
3. Download installer with progress tracking
4. Silent installation via NSIS (`/S` flag)
5. Update version tracking file
6. Enable game launch

**Game Launch**
1. Locate game executable (AppData/Local/Programs/Attrition)
2. Spawn detached game process with monitoring
3. Minimize launcher window
4. Auto-close launcher after game stabilizes (5 seconds)

### Build Configuration

**Electron Builder (`launcher-builder.yml`)**
- NSIS installer for Windows with desktop shortcuts
- Cross-platform build targets (Windows ready, macOS/Linux planned)
- Code signing disabled for development
- Custom installer scripts for shortcut management

**NSIS Shortcuts (`launcher-shortcuts.nsh`)**
- Creates desktop and Start Menu shortcuts
- Handles old shortcut cleanup during updates
- Provides installation summary and user guidance
- Robust error handling for shortcut creation

## Development Patterns

### IPC Communication
- All main-to-renderer communication uses `webContents.send()`
- All renderer-to-main communication uses `ipcRenderer.invoke()`
- Status updates follow consistent message format with `status`, `message`, and optional data
- Event cleanup handled via returned cleanup functions

### Error Handling
- Comprehensive logging using `electron-log` with file and console transports
- User-friendly error messages with specific guidance
- Retry mechanisms for failed operations
- Graceful degradation when services are unavailable

### Security Practices
- Context isolation enabled with secure preload script
- Node integration disabled in renderer
- External URLs opened via `shell.openExternal()`
- No direct file system access from renderer

### File Paths
- Development: Game executable at `../../../packages/releases/win-unpacked/Attrition.exe`
- Production: Game executable at `%LOCALAPPDATA%/Programs/Attrition/Attrition.exe`
- Temporary downloads: `%TEMP%/attrition-launcher/`
- Version tracking: `version.txt` file next to game executable

### Dependencies Management
- `axios`: HTTP client for GitHub API and file downloads
- `electron-log`: Structured logging for debugging
- `semver`: Semantic version comparison for updates
- `electron-builder`: Cross-platform application packaging
- `rimraf`: Cross-platform file/directory removal

## Project Integration

### Monorepo Context
- This launcher is part of a larger Attrition monorepo with packages: desktop, client, server, shared
- Main game uses MongoDB Atlas for persistence and Socket.io for real-time multiplayer
- Game architecture: Electron + React frontend, Node.js + Express + MongoDB backend
- Current deployment: Render.com (free tier) with 15min sleep timeout

### Development Dependencies
- **Package Manager**: Must use pnpm (>=8.0.0), not npm or yarn
- **Node Version**: Requires Node.js >=18.0.0
- **Build Order**: Always build shared packages first in parent project
- **Database**: Same MongoDB Atlas instance used for development and production

### Release Integration
- Launcher distributes game installers from `BrianSMitchell/attrition-desktop` GitHub releases
- Game version currently at v1.0.9, launcher at v1.0.7 (independent versioning)
- Main project uses `pnpm release:prepare` to create game distributions for launcher
- Distribution flow: Game build → GitHub release → Launcher auto-update → User installation

## Important Notes

### Critical Development Practices
- Always test builds on clean systems to verify installer functionality
- Game executable must be launched with `--launched-by-launcher` flag for proper tracking
- Update checker points to `BrianSMitchell/attrition-desktop` repository for game releases
- Launcher auto-updates are disabled (launcher manages game updates, not itself)
- NSIS installer requires administrator privileges for game installation
- Progress tracking calculates download speed using time elapsed and bytes transferred

### Integration Considerations
- Launcher must handle Render.com's 30-second cold start delay when game connects
- Game warns users if launched directly (not through launcher) to prevent update issues
- Installation path `%LOCALAPPDATA%\Programs\Attrition\` must match parent project expectations
- Launcher version tracking uses `version.txt` file alongside game executable
