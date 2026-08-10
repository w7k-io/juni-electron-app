# juni-electron-app

Application desktop **macOS uniquement** pour Kagron (wrapper Electron). Windows/Linux utilisent la PWA de juni-app. Aucune logique metier - tout est dans juni-app (webapp).

## Stack

| Composant | Version |
|-----------|---------|
| **Electron** | 43.2.0 (plancher macOS **13** — voir `MIN_SUPPORTED_MACOS_MAJOR` dans `src/main/updater.ts`) |
| **Electron Forge** | 7.11.2 |
| **TypeScript** | 5.9.3 (strict) |
| **Node.js (app)** | **24.18** — celui embarqué par Electron 43, c'est lui qui exécute le main process et le preload |
| **Node.js (build)** | **24** (`.nvmrc` + `engines`) — compilation TS, Forge, packaging |
| **Playwright** | 1.62.0 (E2E) |
| **Jest** | 30.4.2 (unit) |

> ⚠️ **`@types/node` suit le Node d'Electron, pas le `.nvmrc`.** Les deux valent 24 aujourd'hui, mais ils sont indépendants : au prochain palier Electron, lire la version dans `DEPS` du tag (`gh api "repos/electron/electron/contents/DEPS?ref=v<version>"`), pas dans le `.nvmrc`. Cf [`node-version-policy.md`](https://github.com/w7k-io/juni-claude-rules/blob/main/rules/node-version-policy.md).

## Commandes

```bash
# Dev local (DevTools + localhost)
npm run start:local

# Production (https://juni.w7k.app)
npm start

# Build
npm run make                 # ZIP Universal (arm64 + x64)

# Tests
npx jest                     # Jest unit
npm run test:e2e             # Playwright (post-build)
npx jest --coverage          # Coverage
```

### Variables d'environnement dev

```bash
export JUNI_DEVTOOLS=true
export JUNI_FRONTEND_URL=http://localhost:3000
export JUNI_BACKEND_URL=http://localhost:8080
npm run start:local
```

## Architecture

```
src/main/
├── index.ts              # Entry point (app lifecycle, IPC setup)
├── window.ts             # Window creation, CSP, preload
├── updater.ts            # Auto-update via Squirrel.Mac
└── ipc/
    ├── keychain-handlers.ts  # safeStorage credentials
    ├── file-handlers.ts      # File dialogs, download, read/write
    └── misc-handlers.ts      # openExternal

src/preload/
└── index.ts              # Context bridge -> window.electronAPI

forge.config.js           # Electron Forge config (makers, publishers, signing)
tsconfig.json             # TypeScript config (commonjs, strict)
```

### APIs exposees (window.electronAPI)

**Keychain (safeStorage Electron)**
```typescript
keychainSetPassword(account, password)
keychainGetPassword(account)
keychainDeletePassword(account)
keychainFindCredentials(account)
```

**Fichiers**
```typescript
openFile(options)           // Dialog open
saveFile(options)           // Dialog save
selectFolder(options)       // Folder picker
downloadFile(url, path, onProgress)
writeFile(path, data)
readFile(path)
readDirectory(path)
deleteFile(path)
showItemInFolder(path)
getTempDirectory()
```

**Cache HLS (JUNI-706)**
```typescript
cache.get(canonicalUrl)            // ArrayBuffer | null
cache.put(canonicalUrl, contentType, bytes)
cache.getStats()                   // { totalBytes, entries, capBytes, enabled }
cache.getConfig()                  // { capBytes, enabled }
cache.setConfig(cfg)
cache.purgeAll()
cache.drainMetrics()               // CacheMetricsSnapshot
```

Stockage : `~/Library/Application Support/Kagron/cache/`. Détails : `src/main/cache/CLAUDE.md`.

**Utilitaires**
```typescript
openExternal(url)           // Ouvre navigateur
```

**Notifications** : Gerees cote webapp via web Notification API (pas d'IPC Electron).

## Securite

- `nodeIntegration: false`
- `contextIsolation: true`
- CSP configuree pour localhost, kagron.app, Azure Blob
- `setWindowOpenHandler` : tout `window.open` est refuse (ou converti en telechargement
  pour les URLs media), SAUF le **panneau d'edition detache** (JUNI-1231) —
  meme origine app + path exact `/review/detached-panel`, verifie par la fonction pure
  `src/main/window-open-policy.ts` (`isDetachedPanelUrl`). `ALLOWED_APP_ORIGINS` de ce
  module est la source unique des origines app (partagee avec `will-navigate`).
  Sentinelles : `window-open-policy.test.ts` + describe `JUNI-1231` de `index.test.ts`
  (un seul `action: 'allow'` dans le handler).

## Build macOS

### Electron Forge + Squirrel.Mac

- **MakerZIP** : ZIP universal (arm64 + x64)
- **Code signing** via `@electron/osx-sign` (hardened runtime)
- **Notarization** via `@electron/notarize`
- **Auto-update** via Squirrel.Mac (update.electronjs.org)

### Secrets requis (CI)

```
APPLE_ID
APPLE_APP_SPECIFIC_PASSWORD
APPLE_TEAM_ID
CSC_LINK (base64 cert.p12)
CSC_KEY_PASSWORD
```

## Auto-update

- **Mecanisme** : Squirrel.Mac (built-in Electron autoUpdater)
- **Feed** : `https://update.electronjs.org/w7k-io/juni-electron-app/darwin-universal/<version>`
- **Frequence** : Check toutes les 4h + 10s apres demarrage
- **Distribution** : GitHub Releases (ZIP)
- **Prerequis** : Repo public (update.electronjs.org ne supporte pas les repos prives)

## CI/CD

5 workflows GitHub Actions :
- `electron-pipeline.yml` : Pipeline principale (build -> test -> release)
- `electron-build.yml` : Build Universal macOS (Forge make) + tests Jest
- `test-components.yml` : Tests unitaires
- `test-e2e-macos.yml` : Tests Playwright E2E (main uniquement, skip sur PR)
- `release-github.yml` : Publication GitHub Release (stable, avec ZIP en asset)

## Tests

### Makefile helpers

```bash
make build        # Build ZIP via Forge
make prepare-test # Extrait ZIP, prepare app
make run-test     # Playwright E2E
make test         # Pipeline complete
make clean        # Nettoie artifacts
```

### E2E Playwright

```
test/e2e/login.spec.ts
```

## Points cles

- **Zero logique metier** : Pur wrapper, tout est dans juni-app
- **Zero dependance native** : Sharp, ONNX, FFmpeg supprimes du package
- **Credentials** : safeStorage Electron (chiffrement OS)
- **Auto-update** : Squirrel.Mac via GitHub Releases (repo public requis)
- **Universal build** : arm64 + x64 simultanes
- **TypeScript strict** : Main process et preload
- **Notifications** : Web Notification API (pas d'IPC Electron)
