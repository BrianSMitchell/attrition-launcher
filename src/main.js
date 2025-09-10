const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const log = require('electron-log');
const { UpdateChecker } = require('./services/updateChecker.js');

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
      log.info('Starting update check after delay');
      startUpdateCheck();
    }, 1000);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    
    // Kill game process if launcher is closed
    if (gameProcess && !gameProcess.killed) {
      log.info('Killing game process due to launcher close');
      gameProcess.kill();
    }
  });

  return mainWindow;
}

/**
 * Start the update checking process
 */
async function startUpdateCheck() {
  log.info('Starting update check process');
  
  try {
    updateChecker = new UpdateChecker();
    
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
    const gameExecutable = getGameExecutablePath();
    
    log.info('Checking game executable:', {
      path: gameExecutable,
      exists: fs.existsSync(gameExecutable)
    });
    
    if (!fs.existsSync(gameExecutable)) {
      const errorMsg = `Game executable not found at: ${gameExecutable}`;
      log.error(errorMsg);
      mainWindow.webContents.send('launcher-status', {
        status: 'error',
        message: errorMsg
      });
      return;
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
      detached: false, // Keep attached for better error handling
      stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout/stderr for debugging
      env: {
        ...process.env,
        ATTRITION_LAUNCHED_BY_LAUNCHER: 'true'
      },
      windowsVerbatimArguments: false,
      shell: false
    });
    
    // Capture output for debugging
    if (gameProcess.stdout) {
      gameProcess.stdout.on('data', (data) => {
        log.info('Game stdout:', data.toString());
      });
    }
    
    if (gameProcess.stderr) {
      gameProcess.stderr.on('data', (data) => {
        log.error('Game stderr:', data.toString());
      });
    }
    
    gameProcess.on('spawn', () => {
      log.info('Game process spawned successfully');
      mainWindow.webContents.send('launcher-status', {
        status: 'game-launched',
        message: 'Game started successfully!'
      });
      
      // Minimize launcher immediately when game spawns
      if (mainWindow) {
        log.info('Game spawned, minimizing launcher');
        mainWindow.minimize();
        
        // Close launcher after game has had time to stabilize
        setTimeout(() => {
          if (mainWindow && gameProcess && !gameProcess.killed) {
            log.info('Game appears stable, closing launcher');
            mainWindow.close();
          }
        }, 5000); // 5 seconds to ensure game is stable
      }
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
    // In production, game is typically installed in AppData/Local/Programs/Attrition
    const os = require('os');
    const gameInstallPath = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Attrition', 'Attrition.exe');
    log.info('Production game path:', gameInstallPath);
    return gameInstallPath;
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

// App event handlers
app.whenReady().then(() => {
  app.setAppUserModelId(APP_ID);
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
  
  // Clean up game process
  if (gameProcess && !gameProcess.killed) {
    log.info('Cleaning up game process');
    gameProcess.kill();
  }
});
