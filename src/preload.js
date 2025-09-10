const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loading...');

try {
  // Expose launcher APIs to the renderer process
  contextBridge.exposeInMainWorld('launcherAPI', {
    // Update operations
    checkForUpdates: () => ipcRenderer.invoke('launcher:checkForUpdates'),
    
    // Game launch
    launchGame: () => ipcRenderer.invoke('launcher:launchGame'),
    getGamePath: () => ipcRenderer.invoke('launcher:getGamePath'),
    
    // Utility
    openUrl: (url) => ipcRenderer.invoke('launcher:openUrl', url),
    
    // Event listeners
    onLauncherStatus: (callback) => {
      const handler = (event, status) => callback(status);
      ipcRenderer.on('launcher-status', handler);
      // Return cleanup function
      return () => ipcRenderer.removeListener('launcher-status', handler);
    },
    
    onLauncherReady: (callback) => {
      const handler = (event, isReady) => callback(isReady);
      ipcRenderer.on('launcher-ready', handler);
      // Return cleanup function
      return () => ipcRenderer.removeListener('launcher-ready', handler);
    },
    
    // Game path management
    chooseGamePath: () => ipcRenderer.invoke('launcher:chooseGamePath'),
    getGameStatus: () => ipcRenderer.invoke('launcher:getGameStatus')
  });

  console.log('Preload script loaded successfully');

} catch (error) {
  console.error('Preload script error:', error);
}
