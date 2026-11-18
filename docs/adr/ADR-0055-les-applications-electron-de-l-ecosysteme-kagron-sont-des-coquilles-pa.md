---
titre: "ADR-0055 – Les applications Electron de l'écosystème Kagron sont des coquilles, pas des conteneurs d'application"
projet: juni-electron-app
auteur: "Florian Dejean"
cree: 2026-08-27
modifie: 2026-08-27
version_confluence: 1
source: https://wistiteek.atlassian.net/wiki/spaces/Juni/pages/269385730/ADR-0055+Les+applications+Electron+de+l+cosyst+me+Kagron+sont+des+coquilles+pas+des+conteneurs+d+application
confluence_id: 269385730
migre_le: 2026-11-18
---

# ADR-0055 — Les applications Electron de l'écosystème Kagron sont des coquilles, pas des conteneurs d'application

| 📋 Métadonnée | Valeur               |
|---------------|----------------------|
| **Statut**    | ⏳ Proposed          |
| **Date**      | 2026-08-27           |
| **Auteur**    | Olivier (Architecte) |
| **Réviseurs** | Florian Dejean       |

------------------------------------------------------------------------

## 👥 Décideurs

| Rôle | Personne |
|----|----|
| Tech Lead | Florian Dejean |
| Architecte | Olivier |
| Développeurs concernés | Maxime (frontend), Nico (DevOps) |
| Product Owner | Céline — impact produit limité (disparition du mode hors ligne) |

------------------------------------------------------------------------

## 🎯 Résumé

> **En une phrase :** une application Electron de l'écosystème Kagron charge une URL distante et ne contient aucun code métier ni aucun secret — le modèle « embarqué », qui oblige à injecter des secrets de production dans le binaire et à renotariser à chaque changement métier, est abandonné.

------------------------------------------------------------------------

## 📖 Contexte

L'écosystème Kagron compte aujourd'hui **deux applications Electron**, construites selon **deux modèles opposés**, sans qu'aucune décision documentée ne justifie l'écart :

| Application | Modèle | Code de chargement |
|----|----|----|
| `juni-electron-app` | **coquille** | `mainWindow.loadURL(startUrl)` — charge `kagron.app` |
| `kagron-backoffice` | **embarqué** | `win.loadFile('../dist/index.html')` — embarque son propre build web |

L'écart a été découvert le **2026-08-26**, en auditant la consommation GitHub Actions de l'organisation `w7k-io`. Ce n'était pas l'objet de l'audit : c'est le job `Electron macOS` de `kagron-backoffice/pipeline.yml` qui a attiré l'attention, par son coût, et l'inspection de ce job a révélé le vrai problème.

Le modèle « embarqué » impose une contrainte que le modèle coquille n'a pas : **l'application packagée doit connaître, à la construction, tout ce dont elle a besoin à l'exécution**. Comme le back-office pilote une dizaine d'API tierces, cela signifie leurs jetons.

------------------------------------------------------------------------

## ❓ Problème

> 🔴 **Problème :** nous avons besoin d'un back-office utilisable en application de bureau, mais le modèle « embarqué » impose d'écrire les secrets de production dans le binaire distribué — ce qui contredit frontalement une décision d'architecture déjà prise et déjà implémentée.

Concrètement, le job `Electron macOS` écrit avant packaging un fichier `dist/config.js` :

```javascript
window.__KAGRON_CONFIG__ = {
  adminPasswordBase64, kagronApiToken, keygenAccountId, keygenApiToken,
  azureTenantId, azureClientId, azureClientSecret, azureSubscriptionId,
  terraformApiToken, mollieApiKey, githubToken,
  grafanaUrl, grafanaApiKey, codacyApiToken, jiraUserEmail, jiraApiToken, roboflowApiKey
}
```

Ce fichier est **embarqué dans l'application signée et notarisée**, puis **uploadé en artefact CI (rétention 7 jours) et attaché à une release GitHub**. La clé de paiement Mollie, le secret Azure et le PAT GitHub voyagent donc en clair dans un livrable distribuable.

**Le proxy `/api/admin/proxy/{tool}/**` de juni-app ([JUNI-854](https://wistiteek.atlassian.net/browse/JUNI-854)) existe précisément pour empêcher cela** : il porte les jetons côté serveur pour que le client n'en détienne aucun. La PWA du back-office respecte cette règle. Le wrapper Electron la contourne — et l'a fait silencieusement, parce que le modèle « embarqué » ne laissait pas d'autre issue.

Second effet, moins grave mais permanent : **chaque changement métier déclenche une re-signature et une re-notarisation Apple**. Le contenu du back-office est du web ; il n'y a aucune raison qu'une modification d'un écran passe par la chaîne de notarisation d'Apple.

------------------------------------------------------------------------

## 🧪 Hypothèses et contraintes

### Hypothèses

- Le back-office ne pilote que des **API distantes** : sans réseau, il n'a de toute façon rien à afficher ni à faire.

- Cloudflare Zero Trust, qui protège `admin.kagron.io`, peut être franchi depuis une `BrowserWindow` Electron. **Cette hypothèse n'est pas vérifiée** — c'est l'objet de la story bloquante S0 ([JUNI-1320](https://wistiteek.atlassian.net/browse/JUNI-1320)).

### Contraintes

| Type | Contrainte |
|----|----|
| 🔒 Sécurité | Aucun jeton de production dans un livrable client. Tous les appels outillés passent par le proxy juni-app. |
| 📱 Produit | **Le back-office DOIT rester une PWA** — usage iPhone et iPad (décision Florian du 2026-05-09). |
| 🛠️ Stack existante | `juni-electron-app` fournit déjà coquille (`window.ts`) et mise à jour automatique (`updater.ts`), éprouvés en production. |
| 🔐 Réseau | `admin.kagron.io` est derrière Cloudflare Zero Trust ; `kagron.app` ne l'est pas. |
| 💰 Budget | Le job macOS coûte 710 minutes de quota par mois (multiplicateur ×10) pour 1,6 minute de travail réel. |

------------------------------------------------------------------------

## 🔍 Options envisagées

### Option 1 – Garder le modèle embarqué et chiffrer `config.js`

📝 *Conserver l'architecture actuelle, en obscurcissant ou chiffrant le fichier de configuration embarqué.*

| ✅ Avantages | ❌ Inconvénients |
|----|----|
| Aucun changement d'architecture | **Ne résout rien** : la clé de déchiffrement voyage dans le même binaire |
| Mode hors ligne préservé | Le contournement du proxy [JUNI-854](https://wistiteek.atlassian.net/browse/JUNI-854) subsiste |
|  | Re-notarisation à chaque changement métier maintenue |
|  | Sécurité par l'obscurité — l'anti-pattern que l'audit vient de mettre au jour |

**⚙️ Effort estimé :** 🟢 Faible

**⚠️ Risques :** donne l'illusion d'une correction. Un secret chiffré dans un binaire dont la clé est aussi dans le binaire reste un secret en clair.

### Option 2 – Modèle coquille, wrapper dans un dépôt public séparé

📝 *Le wrapper Electron ne fait plus que `loadURL('https://admin.kagron.io')`. Aucun code métier, aucun secret. Il vit dans son propre dépôt public `w7k-io/kagron-backoffice-desktop`. `kagron-backoffice` reste privé et perd tout son outillage Electron.*

| ✅ Avantages | ❌ Inconvénients |
|----|----|
| **Plus aucun secret dans le binaire** — le proxy [JUNI-854](https://wistiteek.atlassian.net/browse/JUNI-854) redevient le seul chemin | Perte du mode hors ligne |
| Cohérence avec `juni-electron-app` : un seul modèle à comprendre | Dépendance à Cloudflare Access dans une `BrowserWindow` — non vérifié |
| Le contenu métier se met à jour tout seul, avec la PWA | Un dépôt de plus à maintenir |
| Plus de re-notarisation sur changement métier | Le wrapper public expose l'existence de `admin.kagron.io` (déjà public par DNS) |
| Coquille et mise à jour automatique déjà écrites et éprouvées |  |

**⚙️ Effort estimé :** 🟡 Moyen

**⚠️ Risques :** si Cloudflare Access ne peut pas être franchi proprement depuis une `BrowserWindow`, l'option tombe. D'où le prototype préalable et bloquant (S0).

### Option 3 – Supprimer purement le desktop du back-office

📝 *Ne garder que la PWA, installable sur macOS depuis le navigateur.*

| ✅ Avantages | ❌ Inconvénients |
|----|----|
| Effort quasi nul, gain de sécurité immédiat | Perte d'un confort d'usage bureau réel |
| Aucun dépôt supplémentaire | Ne dit rien du modèle Electron pour les autres applications — le problème de fond reste non tranché |

**⚙️ Effort estimé :** 🟢 Faible

------------------------------------------------------------------------

## ✅ Décision

> 🏆 **Option retenue : Option 2 – Modèle coquille, wrapper dans un dépôt public séparé**

### Justification

L'option 1 est écartée parce qu'elle ne corrige rien : elle déplace un secret en clair derrière une clé qui voyage avec lui. L'option 3 réglerait le cas du back-office sans énoncer la règle, et le prochain wrapper Electron repartirait sur le modèle embarqué.

L'option 2 est la seule qui **remet le proxy [JUNI-854](https://wistiteek.atlassian.net/browse/JUNI-854) au centre** et qui **aligne les deux applications Electron sur le même modèle**. Elle s'appuie sur du code déjà écrit et éprouvé en production (`window.ts`, `updater.ts` de `juni-electron-app`), ce qui limite le risque d'implémentation à la seule inconnue réelle : Cloudflare Access.

### Ce que nous allons faire

1.  **Valider d'abord l'inconnue** (S0, bloquante) : une `BrowserWindow` peut-elle franchir Cloudflare Zero Trust et conserver sa session ? Réponse écrite oui/non avant tout autre travail.

2.  Statuer sur la **rotation des 20 secrets exposés** (S1), indépendamment du reste.

3.  Créer `w7k-io/kagron-backoffice-desktop`, dépôt **public**, coquille sans code métier ni secret (S2).

4.  Y porter la CI : build, signature, notarisation, release (S3).

5.  Retirer de `kagron-backoffice` le job Electron, l'injection de configuration, le dossier `electron/`, `forge.config.cjs` et les dépendances Electron (S4).

6.  Reprendre la mise à jour automatique de `juni-electron-app` (S5).

**Règle générale posée par cet ADR :** toute future application Electron de l'écosystème Kagron est une coquille. Elle charge une URL distante, ne contient pas de code métier et ne reçoit aucun secret à la construction.

### Ce que nous ne ferons PAS

- ❌ **Aucun pivot « Electron-only ».** Le back-office reste une PWA : il est utilisé sur iPhone et iPad, où Electron n'existe pas. Le desktop est un confort, jamais le canal unique. Décision Florian du 2026-05-09, rappelée ici parce qu'elle a déjà été remise en cause par le passé.

- ❌ Nous ne rendons pas `kagron-backoffice` public. Seul le dépôt wrapper l'est.

- ❌ Nous ne réintroduisons pas de configuration sensible côté client, sous quelque forme que ce soit — y compris chiffrée.

------------------------------------------------------------------------

## 📊 Conséquences

### ✅ Impacts positifs

- **Plus aucun secret de production dans un livrable distribuable.** C'est l'objectif, et le seul critère qui compte.

- Un modèle unique pour les deux applications Electron : ce qui est appris sur l'une vaut pour l'autre.

- Le contenu métier du desktop suit la PWA sans reconstruction, sans re-signature, sans re-notarisation.

- **Bénéfice secondaire, pas l'objectif :** le dépôt wrapper étant public, son build macOS devient gratuit — 710 minutes de quota par mois économisées. `juni-electron-app` étant déjà public, les deux DMG de l'écosystème le deviennent.

### ⚠️ Impacts négatifs / Risques acceptés

- **Perte du mode hors ligne.** Jugée acceptable : le back-office ne pilote que des API distantes, il n'a rien à faire sans réseau. → **Mitigation :** un écran d'erreur explicite quand `admin.kagron.io` est injoignable, jamais un écran blanc (traité dans la section UX du ticket QA). ⚠️ **Cette conséquence doit être confirmée explicitement par Florian avant de livrer** — c'est la raison pour laquelle cet ADR reste en statut *Proposed*.

- **Dépendance à Cloudflare Access dans la fenêtre Electron.** → **Mitigation :** prototype bloquant préalable (S0). Si la réponse est non, l'ADR est à réviser, pas à contourner.

- **Secrets déjà exposés.** Si un DMG a quitté le poste de Florian, les 20 jetons sont à considérer comme compromis. → **Mitigation :** S1 tranche et fait tourner ce qui doit l'être.

- Un dépôt supplémentaire à maintenir. → **Mitigation :** il ne contient qu'une coquille, dont le code change rarement.

### 🔧 Dette technique introduite

- Aucune dette nouvelle. Cet ADR **résorbe** une dette existante : le contournement du proxy [JUNI-854](https://wistiteek.atlassian.net/browse/JUNI-854) par le wrapper Electron.

------------------------------------------------------------------------

## 📐 Implémentation

### Architecture

```
AVANT — modèle embarqué (kagron-backoffice)

  [ CI: injecte 20 secrets → dist/config.js ]
                 |
                 v
  [ .app signée + notarisée ]  ──>  appels DIRECTS aux API tierces
     contient le build web              (Mollie, Azure, GitHub, ...)
     contient les secrets                        ✗ contourne le proxy

APRÈS — modèle coquille

  [ .app signée + notarisée ]
     ne contient QUE loadURL()
     aucun secret
                 |
                 v
       admin.kagron.io  (PWA, protégée par Cloudflare Access)
                 |
                 v
       juni-app  /api/admin/proxy/{tool}/**   ──>  API tierces
          détient les jetons, côté serveur         ✓ JUNI-854 respecté
```

### Code exemple

```
// Modèle coquille — repris de juni-electron-app/src/main/window.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
});

// Une URL distante. Aucun build local, aucune configuration injectée.
mainWindow.loadURL('https://admin.kagron.io');
```

### Configuration requise

| Variable | Description | Où |
|----|----|----|
| `APPLE_ID` | Compte Apple pour la notarisation | Secret du dépôt wrapper |
| `APPLE_APP_SPECIFIC_PASSWORD` | Mot de passe applicatif Apple | Secret du dépôt wrapper |
| `APPLE_TEAM_ID` | Identifiant d'équipe Apple | Secret du dépôt wrapper |
| *(aucune autre)* | **Aucun jeton d'API tierce.** C'est le point de l'ADR. | — |

------------------------------------------------------------------------

## ✔️ Critères de validation

- S0 répondue par écrit : Cloudflare Access franchissable depuis une `BrowserWindow`, session persistante
- Confirmation explicite de Florian sur l'abandon du mode hors ligne
- Le `.app` / `.dmg` construit ne contient **aucune** occurrence de `__KAGRON_CONFIG__`, `mollie`, `azure`, `keygen`, `terraform`, `roboflow`, `grafana`, `codacy`, `jira`, `githubToken`, `adminPassword`
- Contrôle de non-régression automatisé en CI (échec du build si un motif de secret est trouvé dans les ressources packagées)
- La PWA servie par Docker reçoit toujours sa configuration par variables d'environnement après le retrait du job Electron
- Le back-office reste installable et utilisable en PWA sur iPhone et iPad
- Conventions `.claude/rules/github-actions.md` respectées dans le nouveau dépôt
- Review par Florian

------------------------------------------------------------------------

## 🔗 Liens & références

| Type | Lien |
|----|----|
| 🎫 Epic Jira | [JUNI-1319](https://wistiteek.atlassian.net/browse/JUNI-1319) — kagron-backoffice desktop : coquille Electron |
| 🎫 Story bloquante | [JUNI-1320](https://wistiteek.atlassian.net/browse/JUNI-1320) — prototype Cloudflare Access |
| 🎫 Ticket QA | [JUNI-1326](https://wistiteek.atlassian.net/browse/JUNI-1326) |
| 📄 Décision antérieure | [JUNI-854](https://wistiteek.atlassian.net/browse/JUNI-854) — proxy `/api/admin/proxy/{tool}/**` |
| 📖 ADR lié | [ADR-0017](ADR-0017-strategie-multi-plateforme-electron-capacitor.md) — Stratégie multi-plateforme (Electron + Capacitor) |
| 📐 Règle projet | `.claude/rules/github-actions.md` — conventions GitHub Actions |
| 📐 Règle projet | `.claude/rules/kagron-visual-identity.md` — identité visuelle commune |

------------------------------------------------------------------------

## 📅 Historique des modifications

| Date | Auteur | Modification |
|----|----|----|
| 2026-08-27 | Olivier (Architecte) | Création — issue de l'audit CI/CD de l'organisation w7k-io du 2026-08-26 |
