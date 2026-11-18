---
titre: "ADR-0017 – Stratégie multi-plateforme (Electron + Capacitor)"
projet: juni-electron-app
auteur: "Florian Dejean"
cree: 2026-01-01
modifie: 2026-01-01
version_confluence: 1
source: https://wistiteek.atlassian.net/wiki/spaces/Juni/pages/195919874/ADR-0017+Strat+gie+multi-plateforme+Electron+Capacitor
confluence_id: 195919874
migre_le: 2026-11-18
---

# ADR-0017 — Stratégie multi-plateforme (Electron + Capacitor)

# 📐 ADR-0017 – Stratégie multi-plateforme (Electron + Capacitor)

|               |                               |
|---------------|-------------------------------|
| 📋 Métadonnée | Valeur                        |
| **Statut**    | ✅ Accepted                   |
| **Date**      | 2025-01-01                    |
| **Auteur**    | Olivier, Architecte Technique |
| **Réviseurs** | Florian Dejean, Maxime        |

------------------------------------------------------------------------

## 👥 Décideurs

|            |                |
|------------|----------------|
| Rôle       | Personne       |
| Tech Lead  | Florian Dejean |
| Architecte | Olivier        |
| Senior Dev | Maxime         |

------------------------------------------------------------------------

## 🎯 Résumé

**En une phrase** : Juni conserve Electron pour desktop (macOS/Windows) et ajoute un wrapper Capacitor dédié pour mobile (iPad/iOS), avec une couche d'abstraction `PlatformAPI` dans la webapp pour unifier les appels aux APIs natives.

------------------------------------------------------------------------

## 📖 Contexte

### Situation actuelle

Juni est actuellement distribuée sous forme d'application desktop **Electron** pour macOS. L'application charge une webapp React hébergée sur `juni.w7k.app` et expose des APIs natives via IPC :

|                          |                                                |
|--------------------------|------------------------------------------------|
| API Electron             | Usage Juni                                     |
| `safeStorage`            | Stockage sécurisé credentials (Keychain macOS) |
| `Notification`           | Notifications système                          |
| `dialog`                 | Sélection fichiers/dossiers                    |
| `shell.openExternal`     | Ouverture liens externes                       |
| `shell.showItemInFolder` | Montrer fichier dans Finder                    |
| `fs` (via IPC)           | Lecture/écriture/téléchargement fichiers       |

### Pourquoi maintenant ?

- Demande croissante des coachs pour un accès **iPad** (usage terrain)

- Besoin d'une version **Windows** pour élargir le marché

- L'analyse IA étant maintenant **côté serveur** (juni-iagron-service), l'app cliente est devenue un "thin client"

------------------------------------------------------------------------

## ❓ Problème

🔴 **Problème** : Nous voulons supporter iPad et Windows, mais **Electron ne supporte pas iOS** et nous devons comprendre l'effort réel de portage.

### Contraintes techniques identifiées

|  |  |
|----|----|
| Contrainte | Impact |
| Electron ≠ iOS | Electron utilise Chromium + Node.js, interdits sur iOS App Store |
| Capacitor ≠ Desktop | Capacitor est conçu pour mobile, pas pour macOS/Windows |
| APIs natives différentes | Chaque plateforme a ses propres APIs (Keychain iOS ≠ safeStorage Electron) |

------------------------------------------------------------------------

## 🔍 Options envisagées

### Option 1 – Electron pour tout (web app iOS)

📝 Utiliser Electron pour desktop et proposer une simple PWA pour iPad.

⚙️ Effort estimé : 🟢 Faible (2-3 semaines)

|                                    |                                   |
|------------------------------------|-----------------------------------|
| ✅ Avantages                       | ❌ Inconvénients                  |
| Pas de nouveau wrapper à maintenir | Pas d'accès au Keychain iOS       |
| Code unique                        | Pas de notifications push natives |
| Rapide à mettre en place           | Pas de présence App Store         |
|                                    | UX dégradée (pas d'icône native)  |
|                                    | Limitations filesystem sévères    |

⚠️ Risques :

- Expérience utilisateur iPad médiocre

- "Se souvenir de moi" impossible de manière sécurisée

### Option 2 – Capacitor pour tout (abandonner Electron)

📝 Migrer entièrement vers Capacitor qui supporte iOS, Android ET le web.

⚙️ Effort estimé : 🔴 Élevé (2-3 mois)

|  |  |
|----|----|
| ✅ Avantages | ❌ Inconvénients |
| Un seul wrapper multi-plateforme | Capacitor n'est pas conçu pour desktop |
| Plugins unifiés | Perte des fonctionnalités desktop natives |
|  | Réécriture complète du wrapper |
|  | Risque de régression sur macOS |

⚠️ Risques :

- Perte de qualité sur desktop

- Effort de migration considérable

- Capacitor desktop (Electron sous le capot) est expérimental

### Option 3 – Electron desktop + Capacitor mobile (retenue) ✅

📝 Conserver Electron pour desktop (macOS/Windows) et créer un wrapper Capacitor dédié pour mobile (iPad/iOS), avec une abstraction `PlatformAPI` dans la webapp.

⚙️ Effort estimé : 🟡 Moyen (5-6 semaines total)

|  |  |
|----|----|
| ✅ Avantages | ❌ Inconvénients |
| Chaque plateforme utilise l'outil optimal | Deux wrappers à maintenir |
| Pas de régression desktop | Abstraction à créer dans la webapp |
| Accès natif iOS (Keychain, Push, App Store) | Build iOS à configurer |
| Windows quasi gratuit (même Electron) |  |

⚠️ Risques :

- Maintenance de deux wrappers (mitigé par l'abstraction)

- Divergence possible des features (mitigé par tests)

------------------------------------------------------------------------

## ✅ Décision

### 🏆 Option retenue : Option 3 – Electron desktop + Capacitor mobile

### Justification

1.  **Electron est mature et fonctionne** pour desktop – pas de raison de changer

2.  **Capacitor est le standard** pour les apps hybrides iOS/Android

3.  **L'abstraction PlatformAPI** permet de mutualiser 95% du code webapp

4.  **Windows est quasi gratuit** avec Electron (même codebase que macOS)

5.  **L'App Store iOS** apporte crédibilité et découvrabilité

### Ce que nous allons faire

1.  **Créer l'abstraction** `PlatformAPI` dans juni-app (webapp React)

2.  **Adapter juni-electron-app** pour utiliser cette abstraction

3.  **Créer juni-capacitor-app** (nouveau repo) pour iPad/iOS

4.  **Configurer le build Windows** dans juni-electron-app

5.  **Publier sur l'App Store iOS** (compte Apple Developer existant)

### Ce que nous ne ferons PAS

- ❌ Migrer Electron vers Capacitor pour desktop

- ❌ Supporter Android dans un premier temps (V2)

- ❌ Créer une PWA comme solution principale pour iPad

------------------------------------------------------------------------

## 📊 Conséquences

### ✅ Impacts positifs

- Support iPad natif avec expérience premium

- Support Windows sans effort supplémentaire significatif

- Architecture propre et maintenable

- Pas de régression sur macOS

### ⚠️ Impacts négatifs / Risques acceptés

|                           |                                              |
|---------------------------|----------------------------------------------|
| Risque                    | Mitigation                                   |
| Deux wrappers à maintenir | Abstraction PlatformAPI + tests E2E partagés |
| Divergence de features    | Feature flags + matrice de compatibilité     |
| Complexité build iOS      | Documentation DAT + CI/CD GitHub Actions     |

### 🔧 Dette technique introduite

- Abstraction PlatformAPI à maintenir synchronisée

- Deux pipelines de build (Electron + Capacitor)

------------------------------------------------------------------------

## 📐 Implémentation

### Architecture cible

```java
┌─────────────────────────────────────────────────────────────────┐
│                    juni-app (React/MUI)                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   PlatformAPI (abstraction)               │  │
│  │  notify() | openExternal() | saveCredentials() | ...      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Electron Impl   │ │  Capacitor Impl  │ │    Web Impl      │
│                  │ │                  │ │                  │
│ window.electronAPI│ │ Capacitor plugins│ │ Web APIs native │
│                  │ │                  │ │                  │
│ macOS / Windows  │ │   iPad / iOS     │ │    Browser       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### Interface PlatformAPI

```java
// services/platform/PlatformAPI.ts

export interface PlatformAPI {
  // Identification
  readonly platform: 'electron' | 'capacitor' | 'web';
  
  // Notifications
  notify(title: string, body: string, options?: NotifyOptions): Promise<void>;
  
  // Navigation externe
  openExternal(url: string): Promise<void>;
  
  // Credentials sécurisés
  saveCredentials(account: string, password: string): Promise<boolean>;
  getCredentials(account: string): Promise<string | null>;
  deleteCredentials(account: string): Promise<boolean>;
  hasCredentials(account: string): Promise<boolean>;
  
  // Fichiers
  pickFile(options?: FilePickerOptions): Promise<string | null>;
  pickFolder(options?: FolderPickerOptions): Promise<string | null>;
  downloadFile(url: string, filename: string, onProgress?: (p: number) => void): Promise<string>;
  
  // Utilitaires
  showItemInFolder?(filePath: string): Promise<void>; // Optionnel (desktop only)
  getTempDirectory(): Promise<string>;
}
```

### Mapping des implémentations

|  |  |  |  |
|----|----|----|----|
| Méthode | Electron | Capacitor | Web |
| `notify` | `window.electronAPI.notify()` | `@capacitor/local-notifications` | `new Notification()` |
| `openExternal` | `window.electronAPI.openExternal()` | `@capacitor/browser` | `window.open()` |
| `saveCredentials` | `window.electronAPI.keychainSetPassword()` | `@capacitor-community/secure-storage` | ❌ Non supporté |
| `getCredentials` | `window.electronAPI.keychainGetPassword()` | `@capacitor-community/secure-storage` | ❌ Non supporté |
| `pickFile` | `window.electronAPI.openFile()` | `@capacitor/filesystem` | `<input type="file">` |
| `downloadFile` | `window.electronAPI.downloadFile()` | `@capacitor/filesystem` | Blob + download |
| `showItemInFolder` | `window.electronAPI.showItemInFolder()` | ❌ Non supporté | ❌ Non supporté |

------------------------------------------------------------------------

## ✔️ Critères de validation

- PlatformAPI créée et documentée dans juni-app
- juni-electron-app utilise PlatformAPI (pas de régression)
- juni-capacitor-app créé et fonctionnel sur iPad
- Build Windows fonctionnel
- Tests E2E passants sur toutes les plateformes
- Documentation mise à jour
- Review par Maxime

------------------------------------------------------------------------

## 🔗 Liens & références

|                |                                                            |
|----------------|------------------------------------------------------------|
| Type           | Lien                                                       |
| 📄 DAT associé | DAT-XXXX – Architecture multi-plateforme (à créer)         |
| 🎫 Epic Jira   | JUNI-XXX – Support iPad (à créer)                          |
| 📚 Capacitor   | [https://capacitorjs.com/](https://capacitorjs.com/)       |
| 📚 Electron    | [https://www.electronjs.org/](https://www.electronjs.org/) |

------------------------------------------------------------------------

## 📅 Historique des modifications

|            |         |              |
|------------|---------|--------------|
| Date       | Auteur  | Modification |
| 2025-01-01 | Olivier | Création     |
