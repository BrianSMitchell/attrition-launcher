const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const log = require('electron-log');
const { UpdateChecker } = require('./services/updateChecker.js');
const { GamePathManager } = require('./services/gamePathManager.js');
const { autoUpdater } = require('electron-updater');

const DIRNAME = __dirname;
const APP_ID = 'com.attrition.launcher';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('Attrition Launcher starting...', {
  version: app.getVersion(),
  isPackaged: app.isPackaged,
  platform: process.platform
});

let mainWindow = null;
let updateChecker = null;
let gameProcess = null;
let gamePathManager = null;

/**
 * Create the launcher window
 */
function createLauncherWindow() {
  log.info('Creating launcher window');
  
  const preloadPath = path.join(DIRNAME, 'preload.js');
  log.info('Preload script path:', preloadPath);
  log.info('Preload script exists:', fs.existsSync(preloadPath));
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    center: true,
    show: false,
    autoHideMenuBar: true,
    // icon: path.join(DIRNAME, '../assets/icon.png'), // Comment out for now
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      enableRemoteModule: false,
      sandbox: false
    }
  });

  // Add error handling for preload
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    log.error('Preload script error:', { preloadPath, error });
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log.error('Failed to load page:', { errorCode, errorDescription });
  });
  
  // Load the launcher HTML
  const launcherHtml = path.join(DIRNAME, '../ui/launcher.html');
  log.info('Loading launcher HTML:', launcherHtml);
  log.info('Launcher HTML exists:', fs.existsSync(launcherHtml));
  mainWindow.loadFile(launcherHtml);

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    log.info('Launcher window ready to show');
    mainWindow.show();
    
    // Wait a moment for the renderer to be ready
    setTimeout(() => {
      log.info('Starting launcher self-update check');
      startLauncherUpdateFlow();
    }, 800);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    
    // Don't kill game process - it's detached and should run independently
    if (gameProcess) {
      log.info('Launcher closed but game process will continue running independently');
    }
  });

  return mainWindow;
}

/**
 * Start the game update checking process (runs after launcher update is handled)
 */
async function startUpdateCheck() {
  log.info('Starting update check process');
  
  try {
    updateChecker = new UpdateChecker(gamePathManager);
    
    // Send initial status
    log.info('Sending initial status to renderer');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('launcher-status', {
        status: 'checking',
        message: 'Checking for updates...'
      });
    }
    
  const updateInfo = await updateChecker.checkForUpdates();
    
    if (updateInfo.hasUpdate) {
      log.info('Update available', {
        currentVersion: updateInfo.currentVersion,
        latestVersion: updateInfo.latestVersion
      });
      
      // Let the installer handle path selection - just proceed with download
      
      log.info('Sending update-available status to renderer');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launcher-status', {
          status: 'update-available',
          message: `Update available: ${updateInfo.latestVersion}`,
          currentVersion: updateInfo.currentVersion,
          latestVersion: updateInfo.latestVersion,
          releaseNotes: updateInfo.releaseNotes,
          fileName: updateInfo.fileName,
          fileSize: updateInfo.fileSize
        });
      }
      
      // Automatically start download
      await downloadUpdate(updateInfo);
    } else {
      log.info('No update available, game is up to date');
      mainWindow.webContents.send('launcher-status', {
        status: 'up-to-date',
        message: 'Game is up to date',
        currentVersion: updateInfo.currentVersion
      });
      
      // Enable launch button
      mainWindow.webContents.send('launcher-ready', true);
    }
  } catch (error) {
    log.error('Update check failed:', error);
    mainWindow.webContents.send('launcher-status', {
      status: 'error',
      message: `Update check failed: ${error.message}`
    });
  }
}

/**
 * Download and install update
 */
async function downloadUpdate(updateInfo) {
  try {
    mainWindow.webContents.send('launcher-status', {
      status: 'downloading',
      message: 'Downloading update...',
      progress: 0
    });
    
    // Set up progress callback
    const progressCallback = (progress) => {
      mainWindow.webContents.send('launcher-status', {
        status: 'downloading',
        message: `Downloading update... ${Math.round(progress)}%`,
        progress
      });
    };
    
    await updateChecker.downloadUpdate(updateInfo, progressCallback);
    
    mainWindow.webContents.send('launcher-status', {
      status: 'installing',
      message: 'Installing update...'
    });
    
    await updateChecker.installUpdate(updateInfo);
    
    mainWindow.webContents.send('launcher-status', {
      status: 'complete',
      message: 'Update installed successfully!'
    });
    
    // Enable launch button
    mainWindow.webContents.send('launcher-ready', true);
    
  } catch (error) {
    log.error('Update download/install failed:', error);
    mainWindow.webContents.send('launcher-status', {
      status: 'error',
      message: `Update failed: ${error.message}`
    });
  }
}

/**
 * Launch the main game
 */
async function launchGame() {
  log.info('Launching main game');
  
  try {
    let gameExecutable = getGameExecutablePath();
    
    log.info('Checking game executable:', {
      path: gameExecutable,
      exists: fs.existsSync(gameExecutable)
    });
    
    if (!fs.existsSync(gameExecutable)) {
      log.warn(`Game executable not found at: ${gameExecutable}`);
      
      // Try to auto-detect the game installation
      log.info('Attempting to detect game installation location');
      const detectedPath = gamePathManager.detectGameInstallation();
      
      if (detectedPath) {
        log.info('Game detected at new location, retrying launch');
        // Retry with the newly detected path
        const newGameExecutable = gamePathManager.getGameExecutablePath();
        if (fs.existsSync(newGameExecutable)) {
          // Update the gameExecutable variable for the rest of the function
          gameExecutable = newGameExecutable;
          log.info('Successfully found game at:', gameExecutable);
        } else {
          const errorMsg = `Game executable still not found after detection at: ${newGameExecutable}`;
          log.error(errorMsg);
          mainWindow.webContents.send('launcher-status', {
            status: 'error',
            message: errorMsg
          });
          return;
        }
      } else {
        const errorMsg = `Game executable not found at: ${gameExecutable}. Please reinstall the game.`;
        log.error(errorMsg);
        mainWindow.webContents.send('launcher-status', {
          status: 'error',
          message: errorMsg
        });
        return;
      }
    }
    
    // Check if the file is actually executable
    try {
      const stats = fs.statSync(gameExecutable);
      log.info('Game executable stats:', {
        size: stats.size,
        modified: stats.mtime,
        isFile: stats.isFile()
      });
    } catch (statError) {
      log.error('Failed to get game executable stats:', statError);
    }
    
    log.info('Starting game process with enhanced options:', {
      executable: gameExecutable,
      args: ['--launched-by-launcher']
    });
    
    // Use more explicit spawn options
    gameProcess = spawn(gameExecutable, ['--launched-by-launcher'], {
      detached: true, // Detach so game runs independently
      stdio: ['ignore', 'ignore', 'ignore'], // Don't capture output to avoid blocking
      env: {
        ...process.env,
        ATTRITION_LAUNCHED_BY_LAUNCHER: 'true'
      },
      windowsVerbatimArguments: false,
      shell: false
    });
    
    // Unref the process so launcher can close independently
    gameProcess.unref();
    
    gameProcess.on('spawn', () => {
      log.info('Game process spawned successfully');
      mainWindow.webContents.send('launcher-status', {
        status: 'game-launched',
        message: 'Game started successfully!'
      });
      
      // Auto-close the launcher once the game has spawned successfully.
      // The game process is spawned with detached:true and unref(),
      // and our before-quit handler does NOT kill the game, so it will continue running.
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          log.info('Game spawned; closing launcher window');
          mainWindow.close();
        } catch (e) {
          log.warn('Failed to close launcher window, attempting app.quit()', e);
        }
      }
      // Ensure process exits even if window close didn’t trigger quit
      setTimeout(() => {
        try {
          log.info('Exiting launcher process after game launch');
          app.quit();
        } catch {}
      }, 500);
    });
    
    gameProcess.on('error', (error) => {
      log.error('Game process error:', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        path: error.path
      });
      
      let userMessage = `Failed to start game: ${error.message}`;
      
      // Provide more specific error messages
      if (error.code === 'ENOENT') {
        userMessage = 'Game executable not found. Please try reinstalling.';
      } else if (error.code === 'EACCES') {
        userMessage = 'Permission denied. Try running the launcher as administrator.';
      } else if (error.code === 'EPERM') {
        userMessage = 'Permission error. Check antivirus settings and try again.';
      }
      
      mainWindow.webContents.send('launcher-status', {
        status: 'error',
        message: userMessage
      });
    });
    
    gameProcess.on('exit', (code, signal) => {
      log.info('Game process exited:', { code, signal });
      
      if (code !== 0 && code !== null) {
        mainWindow.webContents.send('launcher-status', {
          status: 'error',
          message: `Game exited with error code: ${code}`
        });
      }
    });
    
  } catch (error) {
    log.error('Launch game failed with exception:', error);
    mainWindow.webContents.send('launcher-status', {
      status: 'error',
      message: `Failed to launch game: ${error.message}`
    });
  }
}

/**
 * Get the path to the game executable
 */
function getGameExecutablePath() {
  if (app.isPackaged) {
    // Use GamePathManager to get the configured game path
    const gamePath = gamePathManager.getGameExecutablePath();
    log.info('Getting game executable path:', {
      isPackaged: true,
      configuredPath: gamePathManager.getGameInstallPath(),
      executablePath: gamePath
    });
    return gamePath;
  } else {
    // In development, use the built game from packages/releases
    const devPath = path.join(DIRNAME, '../../../packages/releases/win-unpacked/Attrition.exe');
    log.info('Development game path:', devPath);
    return devPath;
  }
}

// IPC Handlers
ipcMain.handle('launcher:checkForUpdates', async () => {
  await startUpdateCheck();
});

ipcMain.handle('launcher:launchGame', async () => {
  await launchGame();
});

ipcMain.handle('launcher:getGamePath', () => {
  return getGameExecutablePath();
});

ipcMain.handle('launcher:openUrl', async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('launcher:chooseGamePath', async () => {
  // This handler is kept for compatibility but the installer handles path selection
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Game Installation Directory',
    defaultPath: gamePathManager.getDefaultGamePath(),
    buttonLabel: 'Select Folder',
    properties: ['openDirectory', 'createDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    const fullGamePath = path.join(selectedPath, 'Attrition');
    gamePathManager.setGameInstallPath(fullGamePath);
    log.info('User manually selected game path:', fullGamePath);
    return fullGamePath;
  }
  
  return null;
});

ipcMain.handle('launcher:getGameStatus', () => {
  return {
    isInstalled: gamePathManager.isGameInstalled(),
    installPath: gamePathManager.getGameInstallPath(),
    version: gamePathManager.getGameVersion()
  };
});

function startLauncherUpdateFlow() {
  try {
    // Configure logger for autoUpdater
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;

    // Events
    autoUpdater.on('checking-for-update', () => {
      log.info('[LauncherUpdate] Checking for launcher updates...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launcher-status', {
          status: 'checking',
          message: 'Checking launcher updates...'
        });
      }
    });

    autoUpdater.on('update-available', (info) => {
      log.info('[LauncherUpdate] Update available:', info);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launcher-status', {
          status: 'downloading',
          message: `Updating launcher to v${info.version}...`,
          progress: 0
        });
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('[LauncherUpdate] No launcher update available:', info);
      // Proceed to game update flow
      startUpdateCheck();
    });

    autoUpdater.on('download-progress', (progress) => {
      const pct = Math.round(progress.percent || 0);
      log.info(`[LauncherUpdate] Download progress: ${pct}% (${Math.round(progress.transferred/1024/1024)}/${Math.round(progress.total/1024/1024)} MB)`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launcher-status', {
          status: 'downloading',
          message: `Updating launcher... ${pct}%`,
          progress: pct
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('[LauncherUpdate] Update downloaded; quitting and installing.');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launcher-status', {
          status: 'installing',
          message: 'Installing launcher update...'
        });
      }
      // Quit and run the new installer; it will uninstall previous version as configured in NSIS
      setTimeout(() => autoUpdater.quitAndInstall(true, true), 500);
    });

    autoUpdater.on('error', (err) => {
      log.error('[LauncherUpdate] Auto-update error:', err);
      // Fall back to game update so user can still play
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launcher-status', {
          status: 'error',
          message: `Launcher update error: ${err.message}. Proceeding to game update...`
        });
      }
      startUpdateCheck();
    });

    // Start check
    autoUpdater.checkForUpdates();
  } catch (e) {
    log.error('[LauncherUpdate] Exception during setup:', e);
    startUpdateCheck();
  }
}

// App event handlers
app.whenReady().then(() => {
  app.setAppUserModelId(APP_ID);
  
  // Initialize GamePathManager
  gamePathManager = new GamePathManager();
  log.info('GamePathManager initialized');
  
  createLauncherWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createLauncherWindow();
  }
});

app.on('before-quit', () => {
  log.info('Launcher shutting down');
  
  // Don't kill game process since it's detached and should run independently
  if (gameProcess) {
    log.info('Game process is detached and will continue running');
  }
});
