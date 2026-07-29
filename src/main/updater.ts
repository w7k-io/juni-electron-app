import { autoUpdater, dialog, app } from 'electron';

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const FEED_URL = `https://update.electronjs.org/w7k-io/juni-electron-app/${process.platform}-${process.arch}/${app.getVersion()}`;

/**
 * Electron 38+ (Chromium 139+) dropped macOS 11 Big Sur: builds from that
 * version on declare LSMinimumSystemVersion 12.0 and refuse to launch on an
 * older system.
 *
 * Squirrel.Mac does not filter releases by OS version. Without this guard a
 * Big Sur user downloads the update, clicks "Restart", and ends up with an app
 * that never comes back — silently, with no way to understand why and no way
 * back. Freezing them on a working version is the lesser evil.
 */
const MIN_SUPPORTED_MACOS_MAJOR = 12;

/** Major version of the host macOS, or null when it cannot be determined. */
export function getMacOsMajorVersion(systemVersion: string): number | null {
  const major = Number.parseInt(systemVersion.split('.')[0] ?? '', 10);
  return Number.isNaN(major) ? null : major;
}

/**
 * True when this machine can run future releases. An unparseable version
 * returns true on purpose: failing to parse must never strand a user on an
 * old build.
 */
export function canReceiveUpdates(platform: string, systemVersion: string): boolean {
  if (platform !== 'darwin') return true;
  const major = getMacOsMajorVersion(systemVersion);
  if (major === null) return true;
  return major >= MIN_SUPPORTED_MACOS_MAJOR;
}

export function setupAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log('[UPDATER] Skipping auto-update in development mode');
    return;
  }

  if (!canReceiveUpdates(process.platform, process.getSystemVersion())) {
    console.log(
      `[UPDATER] macOS ${process.getSystemVersion()} is below ${MIN_SUPPORTED_MACOS_MAJOR}: ` +
        'auto-update disabled, staying on the current version (JUNI-1194)'
    );
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

    autoUpdater.on('update-downloaded', (_event, _releaseNotes, releaseName) => {
      console.log(`[UPDATER] Update downloaded: ${releaseName}`);

      dialog
        .showMessageBox({
          type: 'info',
          title: 'Mise à jour disponible',
          message: `La version ${releaseName || 'nouvelle'} est prête.`,
          detail: 'Redémarrer maintenant pour appliquer la mise à jour ?',
          buttons: ['Redémarrer', 'Plus tard'],
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) {
            autoUpdater.quitAndInstall();
          }
        });
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
