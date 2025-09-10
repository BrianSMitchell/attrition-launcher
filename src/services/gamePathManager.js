const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const log = require('electron-log');

/**
 * GamePathManager - Handles storing and retrieving game installation paths
 * This allows the launcher to work regardless of where user chooses to install the game
 */
class GamePathManager {
  constructor() {
    this.configFile = path.join(app.getPath('userData'), 'launcher-config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const configData = fs.readFileSync(this.configFile, 'utf8');
        const config = JSON.parse(configData);
        log.info('Loaded launcher config:', config);
        return config;
      }
    } catch (error) {
      log.error('Failed to load config:', error);
    }
    
    // Return default config
    return {
      gameInstallPath: null,
      gameVersion: '0.0.0',
      lastUpdateCheck: null
    };
  }

  /**
   * Save configuration to file
   */
  saveConfig() {
    try {
      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configFile, configData, 'utf8');
      log.info('Saved launcher config:', this.config);
    } catch (error) {
      log.error('Failed to save config:', error);
    }
  }

  /**
   * Get the current game installation path
   */
  getGameInstallPath() {
    return this.config.gameInstallPath;
  }

  /**
   * Set the game installation path
   */
  setGameInstallPath(gamePath) {
    this.config.gameInstallPath = gamePath;
    this.saveConfig();
    log.info('Updated game install path:', gamePath);
  }

  /**
   * Get the full path to the game executable
   */
  getGameExecutablePath() {
    const gamePath = this.getGameInstallPath();
    if (!gamePath) {
      return null;
    }
    return path.join(gamePath, 'Attrition.exe');
  }

  /**
   * Check if the game is installed and accessible
   */
  isGameInstalled() {
    const gameExePath = this.getGameExecutablePath();
    if (!gameExePath) {
      log.info('No game path configured');
      return false;
    }
    
    const exists = fs.existsSync(gameExePath);
    log.info('Game installed check:', { path: gameExePath, exists });
    return exists;
  }

  /**
   * Get the current game version
   */
  getGameVersion() {
    const gamePath = this.getGameInstallPath();
    if (!gamePath) {
      return '0.0.0';
    }

    try {
      const versionFile = path.join(gamePath, 'version.txt');
      if (fs.existsSync(versionFile)) {
        const version = fs.readFileSync(versionFile, 'utf8').trim();
        log.info('Read game version:', version);
        return version;
      }
    } catch (error) {
      log.error('Failed to read game version:', error);
    }

    return '0.0.0'; // No version file found
  }

  /**
   * Set the game version (after successful installation)
   */
  setGameVersion(version) {
    const gamePath = this.getGameInstallPath();
    if (!gamePath) {
      log.error('Cannot set game version - no game path configured');
      return;
    }

    try {
      // Write version file next to the game
      const versionFile = path.join(gamePath, 'version.txt');
      fs.writeFileSync(versionFile, version, 'utf8');
      
      // Also store in config for backup
      this.config.gameVersion = version;
      this.saveConfig();
      
      log.info('Updated game version:', { version, versionFile });
    } catch (error) {
      log.error('Failed to set game version:', error);
    }
  }

  /**
   * Get a suggested default game installation path
   */
  getDefaultGamePath() {
    // Suggest installing next to the launcher by default
    const launcherDir = path.dirname(app.getPath('exe'));
    return path.join(launcherDir, 'Game');
  }

  /**
   * Auto-detect game installation location after installer runs
   */
  detectGameInstallation() {
    log.info('Attempting to auto-detect game installation location');
    
    // Common installation locations to check
    const commonPaths = [
      path.join('C:', 'Program Files', 'Attrition'),
      path.join('C:', 'Program Files (x86)', 'Attrition'),
      path.join(require('os').homedir(), 'AppData', 'Local', 'Programs', 'Attrition'),
      path.join(require('os').homedir(), 'Games', 'Attrition'),
      path.join(require('os').homedir(), 'Desktop', 'Attrition'),
      path.join(this.getDefaultGamePath())
    ];
    
    for (const gamePath of commonPaths) {
      const exePath = path.join(gamePath, 'Attrition.exe');
      log.info('Checking for game at:', exePath);
      
      if (fs.existsSync(exePath)) {
        log.info('Game found at:', gamePath);
        this.setGameInstallPath(gamePath);
        return gamePath;
      }
    }
    
    log.warn('Could not auto-detect game installation location');
    return null;
  }
  
  /**
   * Clear game configuration (for testing or reset)
   */
  clearGameConfig() {
    this.config.gameInstallPath = null;
    this.config.gameVersion = '0.0.0';
    this.saveConfig();
    log.info('Cleared game configuration');
  }
}

module.exports = { GamePathManager };
