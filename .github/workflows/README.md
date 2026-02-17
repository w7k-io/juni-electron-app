# Juni Electron Workflows

## Workflow principal : `electron-pipeline.yml`

```bash
# Pipeline complete (build + tests + pre-release)
gh workflow run electron-pipeline.yml

# Version specifique
gh workflow run electron-pipeline.yml --field version=1.2.3
```

## Workflows disponibles (7)

### Principal
- **`electron-pipeline.yml`** - Pipeline complete : Build -> Tests E2E -> Pre-release

### Reusables (workflow_call)
- `electron-build.yml` - Build Universal macOS + tests Jest
- `test-components.yml` - Tests unitaires
- `test-e2e-macos.yml` - Tests Playwright E2E
- `release-github.yml` - Creation release GitHub
- `deploy-azure.yml` - Upload Azure Blob Storage

### Manuel
- `promote-release.yml` - Promotion beta -> stable

---
*Les workflows reusables sont appeles par `electron-pipeline.yml`*