# Juni Electron Desktop Application

Application desktop Juni pour l'analyse video handball.

## Developpement

```bash
# Installer les dependances
npm ci

# Demarrer en mode developpement (DevTools + localhost)
export JUNI_DEVTOOLS=true
export JUNI_FRONTEND_URL=http://localhost:3000
export JUNI_BACKEND_URL=http://localhost:8080
npm run start:local

# Demarrer en mode production (https://juni.w7k.app)
npm start

# Construire le ZIP Universal (arm64 + x64)
npm run make
```

## Architecture

- **Electron 37 LTS** pour la stabilite
- **Frontend React** connecte a l'API Juni (pur wrapper, zero logique metier)
- **Signature macOS** avec certificats Apple
- **Auto-update** via Squirrel.Mac + update.electronjs.org

## CI/CD

Le projet utilise GitHub Actions avec des runners GitHub-hosted (`macos-latest`).

### Pipeline

```
push main -> Unit Tests -> Build ZIP Universal -> E2E Tests -> Release stable -> Version bump
```

### Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `electron-pipeline.yml` | push main, PR | Pipeline complete |
| `electron-build.yml` | workflow_call | Build ZIP Universal macOS |
| `test-components.yml` | workflow_call | Tests unitaires Jest |
| `test-e2e-macos.yml` | workflow_call | Tests E2E Playwright (main uniquement) |
| `release-github.yml` | workflow_call | Creation release GitHub stable |

### Flow de versioning

1. **GitVersion** calcule la version semantique
2. **Unit Tests** via Jest
3. **Build** ZIP Universal (ARM64 + x64) sur `macos-latest`
4. **E2E Tests** sur macOS (skip sur PR)
5. **Release** GitHub stable avec ZIP en asset
6. **bump-version** commit la version dans `package.json`

### Secrets requis

| Secret | Description |
|--------|-------------|
| `APPLE_ID` | Apple ID pour notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password Apple |
| `APPLE_TEAM_ID` | Team ID Apple Developer |
| `CSC_LINK` | Certificat de signature (base64) |
| `CSC_KEY_PASSWORD` | Mot de passe du certificat |

## Tests

```bash
# Tests unitaires Jest
npx jest

# Tests E2E Playwright (necessite build prealable)
npm run test:e2e

# Coverage
npx jest --coverage
```

## Auto-update

- **Mecanisme** : Squirrel.Mac (built-in Electron autoUpdater)
- **Feed** : `https://update.electronjs.org/w7k-io/juni-electron-app/darwin-{arch}/{version}`
- **Frequence** : Check toutes les 4h + 10s apres demarrage
- **Distribution** : GitHub Releases stables (ZIP en asset)
- **Prerequis** : Repo public (update.electronjs.org ne supporte pas les repos prives)

## License

UNLICENSED - Private project
