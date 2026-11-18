---
titre: "DAT-0003 – Signature macOS"
projet: juni-electron-app
auteur: "Florian Dejean"
cree: 2025-12-11
modifie: 2025-12-16
version_confluence: 2
source: https://wistiteek.atlassian.net/wiki/spaces/Juni/pages/186843179/DAT-0003+Signature+macOS
confluence_id: 186843179
migre_le: 2026-11-18
---

# DAT-0003 — Signature macOS

# 📘 DAT-0003 – Signature macOS

------------------------------------------------------------------------

|               |             |
|---------------|-------------|
| 📋 Métadonnée | Valeur      |
| **Version**   | 1.0         |
| **Date**      | 2025-07-27  |
| **Auteur**    | Équipe Juni |
| **Statut**    | ✅ Actif    |

------------------------------------------------------------------------

## 👥 Responsables

|           |                |
|-----------|----------------|
| Rôle      | Personne       |
| DevOps    | Équipe Juni    |
| Tech Lead | Florian Dejean |

------------------------------------------------------------------------

## 🎯 Résumé

> **En une phrase :** Guide complet pour signer et notariser l'application Juni (Electron) sur macOS via Apple Developer Program, permettant une distribution sans avertissements de sécurité Gatekeeper.

------------------------------------------------------------------------

## 📖 1. Introduction

### 1.1 Contexte

Juni est distribuée sous forme d'application desktop Electron. Sur macOS, les applications non signées déclenchent des avertissements Gatekeeper qui bloquent l'installation et nuisent à l'expérience utilisateur.

### 1.2 Objectifs

- Éliminer les avertissements de sécurité macOS

- Permettre une installation sans friction

- Protéger l'application contre les modifications

- Professionnaliser la distribution

### 1.3 Périmètre

**✅ Inclus :**

- Création du compte Apple Developer

- Génération des certificats

- Configuration Electron Builder

- Intégration GitHub Actions

- Notarisation automatique

**❌ Exclus :**

- Distribution via Mac App Store

- Signature Windows (code signing séparé)

------------------------------------------------------------------------

## 🏗️ 2. Architecture

### 2.1 Vue d'ensemble

```java
┌─────────────────────────────────────────────────────────────────────────┐
│                         PIPELINE DE BUILD macOS                          │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Source     │───▶│   Build      │───▶│   Signature  │              │
│  │   Code       │    │   Electron   │    │   codesign   │              │
│  └──────────────┘    └──────────────┘    └──────┬───────┘              │
│                                                  │                       │
│                                                  ▼                       │
│                                          ┌──────────────┐               │
│                                          │ Notarization │               │
│                                          │   Apple      │               │
│                                          └──────┬───────┘               │
│                                                  │                       │
│                                                  ▼                       │
│                                          ┌──────────────┐               │
│                                          │    .dmg      │               │
│                                          │   Signé +    │               │
│                                          │  Notarisé    │               │
│                                          └──────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Composants

|  |  |  |
|----|----|----|
| Composant | Rôle | Technologie |
| **Apple Developer Account** | Identité de développeur | Apple Developer Program (99€/an) |
| **Developer ID Certificate** | Signature de l'application | Certificat X.509 |
| **Electron Builder** | Build + signature | npm package |
| **Notarize.js** | Notarisation automatique | npm package |
| **GitHub Actions** | CI/CD | Runner macOS |

------------------------------------------------------------------------

## 🔧 3. Prérequis

### 3.1 Création du compte Apple Developer

1.  S'inscrire sur [developer.apple.com](https://developer.apple.com)

2.  Payer les **99€ annuels**

3.  Vérifier l'identité (24-48h)

### 3.2 Génération des certificats

#### Créer un Certificate Signing Request (CSR)

Sur Mac, ouvrir "Trousseaux d'accès" :

1.  Menu → Certificat → Demander un certificat à une autorité de certification

2.  Adresse e-mail : votre email Apple Developer

3.  Nom commun : Votre nom/société

4.  Cocher "Enregistrer sur le disque"

#### Créer les certificats sur Apple Developer

1.  Aller sur [developer.apple.com/certificates](https://developer.apple.com/certificates)

2.  Créer **2 certificats** :

|                              |                               |
|------------------------------|-------------------------------|
| Certificat                   | Usage                         |
| **Developer ID Application** | Signature de l'app (.app)     |
| **Developer ID Installer**   | Signature des packages (.pkg) |

------------------------------------------------------------------------

## 🖥️ 4. Configuration

### 4.1 Electron Builder

Modifier `electron-app/package.json` :

```java
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: VOTRE NOM (TEAM_ID)",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "afterSign": "build/notarize.js"
  }
}
```

### 4.2 Entitlements

Créer `electron-app/build/entitlements.mac.plist` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  <key>com.apple.security.files.downloads.read-write</key>
  <true/>
</dict>
</plist>
```

### 4.3 Script de notarisation

Créer `electron-app/build/notarize.js` :

```javascript
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    appBundleId: 'com.wistiteek.juni',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

------------------------------------------------------------------------

## 🚀 5. Déploiement

### 5.1 Secrets GitHub Actions

|  |  |  |
|----|----|----|
| Secret | Description | Exemple |
| `APPLE_ID` | Email Apple Developer | `dev@company.com` |
| `APPLE_ID_PASSWORD` | Mot de passe spécifique à l'app | (généré sur [appleid.apple.com](http://appleid.apple.com)) |
| `APPLE_TEAM_ID` | ID de l'équipe (10 caractères) | `ABC1234567` |
| `CSC_LINK` | Certificat en base64 | `base64 -i cert.p12` |
| `CSC_KEY_PASSWORD` | Mot de passe du certificat | `********` |

### 5.2 Obtenir le certificat en base64

```bash
# Exporter le certificat depuis Trousseaux d'accès
security find-identity -v -p codesigning

# Exporter en .p12
security export -k ~/Library/Keychains/login.keychain \
  -t identities -f pkcs12 -o cert.p12

# Convertir en base64
base64 -i cert.p12 -o cert.txt
```

### 5.3 Workflow GitHub Actions (extrait)

```java
jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build and sign
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
        run: npm run dist
```

------------------------------------------------------------------------

## 🧪 6. Test et validation

### 6.1 Test local

```bash
# Build avec signature
npm run dist

# Vérifier la signature
codesign -dv --verbose=4 dist/mac/Juni.app

# Vérifier la notarisation
spctl -a -vvv -t install dist/Juni-*.dmg
```

### 6.2 Résultats attendus

|                 |                                           |
|-----------------|-------------------------------------------|
| Commande        | Sortie attendue                           |
| `codesign -dv`  | `Authority=Developer ID Application: ...` |
| `spctl -a -vvv` | `source=Notarized Developer ID`           |

------------------------------------------------------------------------

## ⚠️ 7. Solutions temporaires

### Option A : Bypass Gatekeeper (utilisateur final)

Clic droit → **Ouvrir** au lieu de double-clic

### Option B : Self-signed Certificate (développement)

```bash
security create-keychain -p "" build.keychain
security import cert.p12 -k build.keychain -P "" -A
```

------------------------------------------------------------------------

## 💰 8. Coûts

[TABLE]

------------------------------------------------------------------------

## ⏱️ 9. Timeline d'implémentation

|                                |                           |
|--------------------------------|---------------------------|
| Étape                          | Durée                     |
| Inscription Apple Developer    | 24-48h de validation      |
| Génération des certificats     | Immédiat après validation |
| Configuration Electron Builder | 1-2h                      |
| Premier build signé            | 1-2h                      |
| Notarisation                   | 5-15 minutes par build    |

------------------------------------------------------------------------

## 📈 10. Avantages

|                           |                                     |
|---------------------------|-------------------------------------|
| Avantage                  | Description                         |
| **Confiance utilisateur** | Plus d'avertissements de sécurité   |
| **Distribution**          | Installation sans friction          |
| **Professionnalisme**     | Application reconnue par Apple      |
| **Sécurité**              | Protection contre les modifications |

------------------------------------------------------------------------

## 🔗 Liens & références

|  |  |
|----|----|
| Type | Lien |
| 📚 Apple Developer | [developer.apple.com](https://developer.apple.com) |
| 📚 Electron Builder | [electron.build/code-signing](https://www.electron.build/code-signing) |
| 📚 Notarization | [developer.apple.com/documentation/security/notarizing_macos_software](https://developer.apple.com/documentation/security/notarizing_macos_software) |

------------------------------------------------------------------------

## 📅 Historique des modifications

|            |             |                                |
|------------|-------------|--------------------------------|
| Date       | Auteur      | Modification                   |
| 2025-07-27 | Équipe Juni | Création initiale              |
| 2025-12-16 | Olivier     | Reformatage selon template DAT |

------------------------------------------------------------------------

*💡 Un bon DAT répond à "Comment ça marche ?" pour quelqu'un qui rejoint l'équipe.*
