import { autoUpdater } from 'electron';
import { app } from 'electron';

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const FEED_URL = `https://update.electronjs.org/w7k-io/juni-electron-app/${process.platform}-${process.arch}/${app.getVersion()}`;

export function setupAutoUpdater(): void {
  // Squirrel events on macOS are handled by electron-squirrel-startup (if needed)
  // For now, use Electron's built-in autoUpdater

  if (!app.isPackaged) {
    console.log('[UPDATER] Skipping auto-update in development mode');
    return;
  }

  try {
    autoUpdater.setFeedURL({ url: FEED_URL });
    console.log(`[UPDATER] Feed URL: ${FEED_URL}`);

    autoUpdater.on('checking-for-update', () => {
      console.log('[UPDATER] Checking for updates...');
    });

    autoUpdater.on('update-available', () => {
      console.log('[UPDATER] Update available, downloading...');
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[UPDATER] No updates available');
    });

    autoUpdater.on('update-downloaded', (_event, releaseNotes, releaseName) => {
      console.log(`[UPDATER] Update downloaded: ${releaseName}`);
      // The update will be applied on next restart
      // Optionally notify the user via the renderer process
    });

    autoUpdater.on('error', (error) => {
      console.error('[UPDATER] Error:', error.message);
    });

    // Check for updates after a short delay on startup
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 10_000);

    // Periodic update checks
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, UPDATE_CHECK_INTERVAL_MS);

  } catch (error) {
    console.error('[UPDATER] Failed to initialize:', error);
  }
}
