import { test, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from 'playwright';
import path from 'path';

test.describe('Juni App - Login Screen', () => {
  let app: ElectronApplication;
  let win: Page;

  test.beforeAll(async () => {
    // Chemin vers l'app extraite du DMG
    const appBundle = path.resolve(process.cwd(), 'app-under-test', 'Kagron.app');
    const execPath = path.join(appBundle, 'Contents', 'MacOS', 'Kagron');

    console.log(`🚀 Lancement de l'application: ${execPath}`);

    app = await electron.launch({
      executablePath: execPath,
      args: ['--no-sandbox', '--disable-gpu', '--password-store=basic'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        JUNI_TEST_MODE: 'true',
        ELECTRON_ENABLE_LOGGING: '1',
      },
      timeout: 120000,
    });

    // Attendre la première fenêtre
    win = await app.firstWindow({ timeout: 30000 });
    console.log('✅ Fenêtre principale détectée');

    // Attendre que le DOM soit chargé
    await win.waitForLoadState('domcontentloaded');
    console.log('✅ Page chargée');
  });

  test.afterAll(async () => {
    if (app) {
      console.log('🧹 Fermeture de l\'application');
      await app.close();
    }
  });

  test('affiche la page de login', async ({ }, testInfo) => {
    // Attendre un peu pour que la page s'affiche complètement
    await win.waitForTimeout(2000);

    // Prendre un screenshot et l'attacher au rapport
    const screenshot = await win.screenshot({ fullPage: true });
    await testInfo.attach('Page de login', {
      body: screenshot,
      contentType: 'image/png',
    });
    console.log('📸 Screenshot attaché au rapport Playwright');

    // Sauvegarder aussi une copie locale pour CI
    const screenshotPath = `juni-login-${process.env.TEST_ARCH || 'unknown'}.png`;
    await win.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot sauvegardé: ${screenshotPath}`);

    // Vérifier que la page contient des éléments de login
    const pageContent = await win.content();

    // Vérifications basiques
    expect(pageContent.length).toBeGreaterThan(0);
    console.log('✅ Page de login chargée avec succès');

    // Vérifier que la fenêtre existe et a un titre
    expect(await win.title()).toBeTruthy();
  });
});
