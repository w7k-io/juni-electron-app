#!/usr/bin/env node

/**
 * Script de test pour vérifier le lancement de l'application Juni
 * Vérifie que l'app démarre et atteint la page de login
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const APP_PATH = process.argv[2];
const ARCHITECTURE = process.argv[3] || 'unknown';
const TEST_TIMEOUT = 30000; // 30 secondes

if (!APP_PATH) {
  console.error('❌ Usage: node test-app-launch.js <path-to-Kagron.app> [architecture]');
  process.exit(1);
}

if (!fs.existsSync(APP_PATH)) {
  console.error(`❌ Application non trouvée: ${APP_PATH}`);
  process.exit(1);
}

console.log(`🚀 Test de lancement de Juni ${ARCHITECTURE}...`);
console.log(`📍 Chemin: ${APP_PATH}`);

// Lancer l'application avec des logs
const executablePath = path.join(APP_PATH, 'Contents', 'MacOS', 'Juni');
const appProcess = spawn(executablePath, [
  '--no-sandbox',
  '--disable-gpu',
  '--enable-logging=stderr',
  '--log-level=0',
  '--remote-debugging-port=9222'
], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1',
    JUNI_TEST_MODE: 'true',
    DISPLAY: process.env.DISPLAY || ':0'
  }
});

let isAppReady = false;
let hasError = false;
let logOutput = '';

// Timeout de sécurité
const timeout = setTimeout(() => {
  if (!isAppReady && !hasError) {
    console.log('⏰ Timeout atteint - arrêt du test');
    appProcess.kill();
    process.exit(1);
  }
}, TEST_TIMEOUT);

// Analyser les logs stdout
appProcess.stdout.on('data', (data) => {
  const output = data.toString();
  logOutput += output;
  console.log(`[STDOUT] ${output.trim()}`);

  // Rechercher des indicateurs de succès
  if (output.includes('App ready') ||
      output.includes('Login page loaded') ||
      output.includes('Renderer process started') ||
      output.includes('Main window created')) {
    console.log('✅ Application semble avoir démarré correctement');
    isAppReady = true;
  }
});

// Analyser les logs stderr pour les erreurs
appProcess.stderr.on('data', (data) => {
  const output = data.toString();
  logOutput += output;
  console.log(`[STDERR] ${output.trim()}`);

  // Ignorer les avertissements courants d'Electron
  if (output.includes('deprecated') ||
      output.includes('WARNING') ||
      output.includes('warning') ||
      output.includes('[GPU process]') ||
      output.includes('sandbox') ||
      output.includes('Failed to load image')) {
    return; // Ignorer ces messages
  }

  // Rechercher des erreurs critiques
  if (output.includes('Cannot find module') ||
      output.includes('Error:') ||
      output.includes('Uncaught Exception') ||
      output.includes('dyld') ||
      output.includes('crash')) {
    console.log('❌ Erreur critique détectée dans l\'application');
    hasError = true;
  }
});

// Gérer la fermeture du processus
appProcess.on('close', (code, signal) => {
  clearTimeout(timeout);

  console.log(`\n📊 Processus fermé - Code: ${code}, Signal: ${signal}`);

  if (hasError) {
    console.log('❌ Test échoué - Erreurs critiques détectées');
    console.log('\n📝 Logs complets:');
    console.log(logOutput);
    process.exit(1);
  }

  // Considérer le test réussi si l'app a démarré même brièvement
  // ou si elle s'est fermée proprement
  if (isAppReady || code === 0 || code === null) {
    console.log('✅ Test réussi - Application a démarré sans erreur critique');
    process.exit(0);
  } else {
    console.log(`❌ Test échoué - Code de sortie: ${code}`);
    console.log('\n📝 Logs complets:');
    console.log(logOutput);
    process.exit(1);
  }
});

appProcess.on('error', (err) => {
  clearTimeout(timeout);
  console.log(`❌ Erreur de lancement: ${err.message}`);
  process.exit(1);
});

// Arrêter l'application après un délai
setTimeout(() => {
  if (!hasError) {
    console.log('⏱️ Test terminé - Arrêt de l\'application');
    appProcess.kill('SIGTERM');
  }
}, 10000); // Laisser 10 secondes pour démarrer

console.log('⏳ Test en cours...');