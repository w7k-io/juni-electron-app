# Tests E2E avec Playwright

## 🎯 Objectif

Tester automatiquement l'application Juni packagée dans un `.dmg` avec Playwright pour vérifier :
- Le lancement de l'application
- L'affichage de la page de login
- La capture de screenshots

## 🚀 Utilisation en local

### 1. Préparer l'application à tester

```bash
# Construire le DMG (ou utiliser un DMG existant)
npm run build:arm64  # ou build:x64 selon ton architecture

# Monter et extraire l'app
DMG_FILE="dist/Kagron-*.dmg"
hdiutil attach "$DMG_FILE" -nobrowse -mountpoint /Volumes/Kagron
rm -rf app-under-test
mkdir -p app-under-test
cp -R "/Volumes/Kagron/Kagron.app" "app-under-test/"
xattr -dr com.apple.quarantine "app-under-test/Kagron.app"
hdiutil detach /Volumes/Kagron
```

### 2. Lancer les tests

```bash
# Installer Playwright (première fois seulement)
npx playwright install --with-deps

# Lancer les tests
npm run test:e2e

# Mode UI (interactif)
npm run test:e2e:ui

# Mode debug (pas à pas)
npm run test:e2e:debug
```

### 3. Résultats

- **Screenshots** : `juni-login-{arch}.png`
- **Rapport HTML** : `playwright-report/index.html`
- **Traces** : `test-results/` (en cas d'échec)

## 🔧 Configuration

La configuration Playwright se trouve dans `playwright.config.ts`.

## 📝 Écrire de nouveaux tests

Les tests sont dans `test/e2e/*.spec.ts`. Exemple :

```typescript
test('vérifie un élément', async () => {
  const button = win.locator('button[type="submit"]');
  await expect(button).toBeVisible();
});
```

## 🤖 CI/CD

Les tests sont automatiquement exécutés dans GitHub Actions après chaque build :
- Workflow : `.github/workflows/test-macos-arch.yml`
- Runs séparés pour x64 et arm64
- Screenshots et rapports uploadés comme artifacts
