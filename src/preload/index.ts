import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // External links
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // File APIs
  openFile: (options?: Record<string, unknown>) => ipcRenderer.invoke('open-file', options),
  saveFile: (options?: Record<string, unknown>) => ipcRenderer.invoke('save-file', options),
  selectFolder: (options?: Record<string, unknown>) => ipcRenderer.invoke('select-folder', options),
  getTempDirectory: () => ipcRenderer.invoke('get-temp-directory'),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),
  downloadFile: (url: string, filePath: string, onProgress?: (progress: number) => void) => {
    return new Promise((resolve, reject) => {
      const progressId = Math.random().toString(36).substring(2, 11);

      if (onProgress) {
        const handler = (_event: Electron.IpcRendererEvent, progress: number) => onProgress(progress);
        ipcRenderer.on(`download-progress-${progressId}`, handler);

        ipcRenderer.invoke('download-file', url, filePath, progressId)
          .then((result) => {
            ipcRenderer.removeListener(`download-progress-${progressId}`, handler);
            resolve(result);
          })
          .catch((error) => {
            ipcRenderer.removeListener(`download-progress-${progressId}`, handler);
            reject(error);
          });
      } else {
        ipcRenderer.invoke('download-file', url, filePath).then(resolve).catch(reject);
      }
    });
  },
  writeFile: (filePath: string, data: ArrayBuffer) => ipcRenderer.invoke('write-file', filePath, data),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('read-directory', dirPath),

  // Keychain APIs
  keychainSetPassword: (account: string, password: string) => ipcRenderer.invoke('keychain-set-password', account, password),
  keychainGetPassword: (account: string) => ipcRenderer.invoke('keychain-get-password', account),
  keychainDeletePassword: (account: string) => ipcRenderer.invoke('keychain-delete-password', account),
  keychainFindCredentials: (account: string) => ipcRenderer.invoke('keychain-find-credentials', account),

  // Email
  openEmailClient: (email: string) => ipcRenderer.invoke('open-email-client', email),
});

console.log('Preload script loaded - Juni Electron');
