const axios = require('axios');
const fs = require('node:fs');
const path = require('node:path');
const { createWriteStream } = require('node:fs');
const { spawn } = require('node:child_process');
const { app } = require('electron');
const log = require('electron-log');
const semver = require('semver');

/**
 * UpdateChecker service for handling game updates
 * Downloads updates from GitHub releases and manages installation
 */
class UpdateChecker {
  constructor(gamePathManager) {
    this.githubRepo = 'BrianSMitchell/attrition-desktop';
    this.apiBaseUrl = 'https://api.github.com';
    this.gamePathManager = gamePathManager;
    this.currentVersion = this.getCurrentVersion();
    this.tempDir = this.getTempDirectory();
    
    log.info('UpdateChecker initialized', {
      repo: this.githubRepo,
      currentVersion: this.currentVersion,
      tempDir: this.tempDir
    });
  }

  /**
   * Get the current installed game version
   */
  getCurrentVersion() {
    try {
      if (app.isPackaged) {
        // Use GamePathManager to check game version
        return this.gamePathManager.getGameVersion();
      } else {
        // In development, read from the desktop package.json
        const desktopPackageJson = path.resolve(process.cwd(), 'packages', 'desktop', 'package.json');
        if (fs.existsSync(desktopPackageJson)) {
          const pkg = JSON.parse(fs.readFileSync(desktopPackageJson, 'utf8'));
          return pkg.version;
        }
        
        return '0.0.0'; // Force download in development
      }
    } catch (error) {
      log.error('Failed to get current version:', error);
      return '0.0.0'; // Force download on error
    }
  }

  /**
   * Get temporary directory for downloads
   */
  getTempDirectory() {
    const tempDir = path.join(app.getPath('temp'), 'attrition-launcher');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    return tempDir;
  }

  /**
   * Check for available updates from GitHub
   */
  async checkForUpdates() {
    log.info('Checking for updates...');
    
    try {
      // Get all releases to filter for game releases (not launcher releases)
      const response = await axios.get(`${this.apiBaseUrl}/repos/${this.githubRepo}/releases`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Attrition-Launcher/1.0'
        },
        timeout: 30000
      });

      // Filter out launcher releases (with -launcher suffix) to get only game releases
      const gameReleases = response.data.filter(release => 
        !release.tag_name.includes('-launcher')
      );
      
      if (gameReleases.length === 0) {
        throw new Error('No game releases found in the repository');
      }
      
      // Get the latest game release
      const latestRelease = gameReleases[0]; // Releases are sorted by date, newest first
      const latestVersion = latestRelease.tag_name.replace(/^v/, ''); // Remove 'v' prefix
      
      log.info('Latest release info:', {
        latestVersion,
        currentVersion: this.currentVersion,
        publishedAt: latestRelease.published_at,
        assetsCount: latestRelease.assets.length
      });

      // Compare versions
      const hasUpdate = semver.gt(latestVersion, this.currentVersion);
      
      // Find the installer asset
      const installerAsset = latestRelease.assets.find(asset => 
        asset.name.includes('Setup') && asset.name.endsWith('.exe')
      );

      if (!installerAsset && hasUpdate) {
        throw new Error('No installer found in the latest release');
      }

      const updateInfo = {
        hasUpdate,
        currentVersion: this.currentVersion,
        latestVersion,
        releaseNotes: latestRelease.body || 'No release notes available',
        downloadUrl: installerAsset?.browser_download_url,
        fileName: installerAsset?.name,
        fileSize: installerAsset?.size,
        publishedAt: latestRelease.published_at
      };

      log.info('Update check result:', updateInfo);
      return updateInfo;
      
    } catch (error) {
      log.error('Failed to check for updates:', error);
      throw new Error(`Failed to check for updates: ${error.message}`);
    }
  }

  /**
   * Download update file with progress tracking
   */
  async downloadUpdate(updateInfo, progressCallback) {
    log.info('Starting update download:', {
      fileName: updateInfo.fileName,
      fileSize: updateInfo.fileSize,
      url: updateInfo.downloadUrl
    });

    const downloadPath = path.join(this.tempDir, updateInfo.fileName);
    
    // Remove existing file if it exists
    if (fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }

    try {
      const response = await axios({
        method: 'GET',
        url: updateInfo.downloadUrl,
        responseType: 'stream',
        timeout: 300000, // 5 minute timeout
        headers: {
          'User-Agent': 'Attrition-Launcher/1.0'
        }
      });

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      const writer = createWriteStream(downloadPath);
      
      response.data.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = (downloadedSize / totalSize) * 100;
        
        if (progressCallback) {
          progressCallback(progress);
        }
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          log.info('Download completed:', {
            path: downloadPath,
            size: downloadedSize
          });
          resolve(downloadPath);
        });
        
        writer.on('error', (error) => {
          log.error('Download failed:', error);
          reject(error);
        });
      });
      
    } catch (error) {
      log.error('Failed to download update:', error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Install the downloaded update
   */
  async installUpdate(updateInfo) {
    const downloadPath = path.join(this.tempDir, updateInfo.fileName);
    
    log.info('Installing game update:', downloadPath);

    if (!fs.existsSync(downloadPath)) {
      throw new Error('Downloaded installer not found');
    }

    try {
      // Run the installer silently so the UI stays contained within the launcher
      // NSIS supports silent mode via /S. We also pass /currentuser to keep per-user installs.
      const installerArgs = ['/S', '/currentuser'];
      
      log.info('Running game installer silently:', {
        path: downloadPath,
        args: installerArgs
      });

      return new Promise((resolve, reject) => {
        const installer = spawn(downloadPath, installerArgs, {
          stdio: 'ignore', // No separate installer output window
          windowsHide: true, // Ensure no new window is shown
          detached: false // Keep attached so we wait for completion
        });

        installer.on('close', (code) => {
          if (code === 0) {
            log.info('Game installation completed successfully');
            
            // Clean up downloaded file
            try {
              fs.unlinkSync(downloadPath);
            } catch (cleanupError) {
              log.warn('Failed to clean up downloaded file:', cleanupError);
            }
            
            // Auto-detect where the game was installed
            const detectedPath = this.gamePathManager.detectGameInstallation();
            if (detectedPath) {
              // Update version tracking using GamePathManager
              this.gamePathManager.setGameVersion(updateInfo.latestVersion);
              log.info('Game installation detected and configured successfully');
            } else {
              log.warn('Could not detect game installation location after installer completed');
            }
            
            resolve();
          } else {
            log.error('Game installation failed with code:', code);
            reject(new Error(`Game installation failed with exit code: ${code}`));
          }
        });

        installer.on('error', (error) => {
          log.error('Game installation process error:', error);
          reject(error);
        });

        // Wait for the installer to finish (removed unref())
      });
      
    } catch (error) {
      log.error('Failed to install game update:', error);
      throw new Error(`Game installation failed: ${error.message}`);
    }
  }

  /**
   * Update the version file after successful installation
   */
  updateVersionFile(newVersion) {
    try {
      // Write version file next to the game executable (Program Files)
      const gameDir = path.join('C:', 'Program Files', 'Attrition');
      const versionFile = path.join(gameDir, 'version.txt');
      
      // Ensure the game directory exists
      if (!fs.existsSync(gameDir)) {
        log.warn('Game directory does not exist when trying to write version file:', gameDir);
        return;
      }
      
      fs.writeFileSync(versionFile, newVersion);
      log.info('Game version file updated:', { newVersion, path: versionFile });
      
      // Update current version for next check
      this.currentVersion = newVersion;
      
    } catch (error) {
      log.error('Failed to update game version file:', error);
    }
  }

  /**
   * Get release notes formatted as HTML
   */
  formatReleaseNotes(notes) {
    if (!notes) return '<p>No release notes available</p>';
    
    // Convert markdown-style formatting to HTML
    return notes
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/<p><li>/g, '<ul><li>')
      .replace(/<\/li><\/p>/g, '</li></ul>');
  }
}

module.exports = { UpdateChecker };
