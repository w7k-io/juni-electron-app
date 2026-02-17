# Juni Electron Desktop Application

Application desktop Juni pour l'analyse vidéo handball.

## 🚀 Développement

```bash
# Installer les dépendances
corepack yarn install

# Démarrer en mode développement
corepack yarn start

# Construire l'application
corepack yarn dist
```

## 🏗️ Architecture

- **Electron 37 LTS** pour la stabilité
- **Frontend React** connecté à l'API Juni
- **Binaires natifs** : ONNX Runtime, Sharp, FFmpeg
- **Signature macOS** avec certificats Apple

## 🔄 CI/CD

Le projet utilise GitHub Actions avec les actions centralisées [w7k-io-gh](https://github.com/w7k-io/w7k-io-gh).

### Pipeline

```
push main → Unit Tests → Build DMG → E2E Tests → Commit version → Pre-release
```

### Flow de versioning

1. **GitVersion** calcule la version sémantique
2. **Unit Tests** via Jest
3. **Build** DMG Universal (ARM64 + x64) sur runner self-hosted
4. **E2E Tests** sur macOS
5. **bump-version** commit la version dans `package.json`
6. **Pre-release** GitHub créée (le tag pointe sur le commit versionné)

### Actions utilisées

| Action | Description |
|--------|-------------|
| `w7k-io/w7k-io-gh/gitversion` | Calcul version sémantique |
| `w7k-io/w7k-io-gh/setup-node-npm` | Setup Node.js + NPM_GITHUB_TOKEN |
| `w7k-io/w7k-io-gh/bump-version` | Update package.json + commit |

### Secrets requis

| Secret | Description |
|--------|-------------|
| `NPM_GITHUB_TOKEN` | PAT avec accès packages et push |
| `APPLE_ID` | Apple ID pour notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password Apple |
| `APPLE_TEAM_ID` | Team ID Apple Developer |
| `CSC_LINK` | Certificat de signature (base64) |
| `CSC_KEY_PASSWORD` | Mot de passe du certificat |

### Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `electron-pipeline.yml` | push main, PR | Pipeline complète |
| `electron-build.yml` | workflow_call | Build DMG |
| `release-github.yml` | workflow_call | Création release |
| `promote-release.yml` | manual | Promouvoir en production |

## 📦 Release

Les releases sont automatiques via GitHub Actions :
- Build ARM64 + x64 sur runner self-hosted
- Tests sur GitHub runners (macos-13)
- Distribution via GitHub Releases avec auto-update

### Promouvoir une release

1. Tester la pre-release beta
2. Actions > Promote Release to Production
3. Entrer le tag beta à promouvoir
4. Une release stable est créée

## 📝 License

UNLICENSED - Private project
