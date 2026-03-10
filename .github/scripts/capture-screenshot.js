#!/usr/bin/env node

/**
 * Script pour capturer un screenshot de l'application Juni
 * Utilise le remote debugging pour prendre une capture d'écran
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const APP_PATH = process.argv[2];
const ARCHITECTURE = process.argv[3] || 'unknown';
const OUTPUT_PATH = process.argv[4] || `./juni-screenshot-${ARCHITECTURE}.png`;

if (!APP_PATH) {
  console.error('❌ Usage: node capture-screenshot.js <path-to-Kagron.app> [architecture] [output-path]');
  process.exit(1);
}

console.log(`📸 Capture d'écran de Juni ${ARCHITECTURE}...`);
console.log(`📍 Application: ${APP_PATH}`);
console.log(`💾 Screenshot: ${OUTPUT_PATH}`);

const executablePath = path.join(APP_PATH, 'Contents', 'MacOS', 'Kagron');

// Lancer l'application avec remote debugging
const appProcess = spawn(executablePath, [
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--remote-debugging-port=9222',
  '--enable-logging=stderr'
], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1',
    JUNI_TEST_MODE: 'true'
  }
});

let screenshotTaken = false;
let hasError = false;

// Fonction pour prendre un screenshot via Chrome DevTools Protocol
async function takeScreenshot() {
  return new Promise((resolve, reject) => {
    // Attendre que l'app soit prête
    setTimeout(async () => {
      try {
        console.log('🔍 Connexion au remote debugging...');

        // Obtenir la liste des onglets
        const tabsReq = http.request({
          hostname: 'localhost',
          port: 9222,
          path: '/json',
          method: 'GET'
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', async () => {
            try {
              const tabs = JSON.parse(data);
              const mainTab = tabs.find(tab => tab.type === 'page') || tabs[0];

              if (!mainTab) {
                reject(new Error('Aucun onglet trouvé'));
                return;
              }

              console.log(`📄 Onglet trouvé: ${mainTab.title}`);

              // Se connecter via WebSocket au DevTools
              const WebSocket = require('ws');
              const ws = new WebSocket(mainTab.webSocketDebuggerUrl);

              ws.on('open', () => {
                console.log('🔌 Connecté au DevTools');

                // Activer le runtime et la page
                ws.send(JSON.stringify({id: 1, method: 'Runtime.enable'}));
                ws.send(JSON.stringify({id: 2, method: 'Page.enable'}));

                // Attendre un peu puis prendre le screenshot
                setTimeout(() => {
                  ws.send(JSON.stringify({
                    id: 3,
                    method: 'Page.captureScreenshot',
                    params: {
                      format: 'png',
                      quality: 100
                    }
                  }));
                }, 2000);
              });

              ws.on('message', (data) => {
                const message = JSON.parse(data.toString());

                if (message.id === 3 && message.result && message.result.data) {
                  console.log('📸 Screenshot capturé !');

                  // Sauvegarder l'image
                  const imageBuffer = Buffer.from(message.result.data, 'base64');
                  fs.writeFileSync(OUTPUT_PATH, imageBuffer);

                  console.log(`✅ Screenshot sauvegardé: ${OUTPUT_PATH}`);
                  screenshotTaken = true;
                  ws.close();
                  resolve();
                }
              });

              ws.on('error', (err) => {
                console.error('❌ Erreur WebSocket:', err.message);
                reject(err);
              });

            } catch (parseError) {
              reject(new Error(`Erreur parsing JSON: ${parseError.message}`));
            }
          });
        });

        tabsReq.on('error', (err) => {
          reject(new Error(`Erreur connexion DevTools: ${err.message}`));
        });

        tabsReq.end();

      } catch (error) {
        reject(error);
      }
    }, 5000); // Attendre 5 secondes que l'app démarre
  });
}

// Installer ws si nécessaire
function installWs() {
  return new Promise((resolve, reject) => {
    const npmProcess = spawn('npm', ['install', 'ws'], { stdio: 'pipe' });

    npmProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Installation ws échouée: code ${code}`));
      }
    });
  });
}

// Analyser les logs pour détecter le démarrage
appProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[APP-STDOUT] ${output.trim()}`);
});

appProcess.stderr.on('data', (data) => {
  const output = data.toString();
  console.log(`[APP-STDERR] ${output.trim()}`);

  // Détecter les erreurs critiques
  if (output.includes('Fatal') || output.includes('Cannot find module') || output.includes('dyld')) {
    hasError = true;
    console.error('❌ Erreur critique détectée');
  }
});

// Gérer la fermeture
appProcess.on('close', (code) => {
  console.log(`📊 Application fermée - Code: ${code}`);

  if (screenshotTaken && !hasError) {
    console.log('✅ Test screenshot réussi');
    process.exit(0);
  } else if (hasError) {
    console.log('❌ Test échoué - erreurs détectées');
    process.exit(1);
  } else {
    console.log('❌ Test échoué - screenshot non pris');
    process.exit(1);
  }
});

// Lancer le processus de capture
console.log('⏳ Lancement de l\'application...');

installWs()
  .then(() => {
    console.log('📦 WebSocket installé');
    return takeScreenshot();
  })
  .then(() => {
    console.log('📸 Capture terminée');
    // Arrêter l'application après le screenshot
    setTimeout(() => {
      if (!appProcess.killed) {
        appProcess.kill('SIGTERM');
      }
    }, 1000);
  })
  .catch((error) => {
    console.error('❌ Erreur capture:', error.message);
    if (!appProcess.killed) {
      appProcess.kill('SIGTERM');
    }
    process.exit(1);
  });

// Timeout de sécurité
setTimeout(() => {
  if (!screenshotTaken) {
    console.log('⏰ Timeout - arrêt forcé');
    if (!appProcess.killed) {
      appProcess.kill('SIGKILL');
    }
    process.exit(1);
  }
}, 30000); // 30 secondes max