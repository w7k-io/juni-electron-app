---
titre: "PDR-0025 – Pas d'app Electron Windows : la PWA suffit (et cadrage Electron macOS)"
projet: juni-electron-app
auteur: "Florian Dejean"
cree: 2026-06-25
modifie: 2026-06-25
version_confluence: 1
source: https://wistiteek.atlassian.net/wiki/spaces/Juni/pages/251330561/PDR-0025+Pas+d+app+Electron+Windows+la+PWA+suffit+et+cadrage+Electron+macOS
confluence_id: 251330561
migre_le: 2026-11-18
---

# PDR-0025 — Pas d'app Electron Windows : la PWA suffit (et cadrage Electron macOS)

| 📋 Métadonnée | Valeur                               |
|---------------|--------------------------------------|
| **Statut**    | ✅ Accepted                          |
| **Date**      | 2026-06-25                           |
| **Auteur**    | Florian Dejean (Founder / Tech Lead) |
| **Réviseurs** | Céline (PO), Émilie (UX)             |

------------------------------------------------------------------------

## 👥 Décideurs

| Rôle                 | Personne       |
|----------------------|----------------|
| Product Owner        | Céline         |
| Direction / Business | Florian Dejean |
| Tech Lead            | Florian Dejean |
| Expertise métier     | —              |

------------------------------------------------------------------------

## 🎯 Résumé

> **En une phrase :** Nous ne développerons **pas** d'application Electron pour Windows — la PWA Kagron installée via Edge/Chrome couvre 100 % du besoin sans coût de maintenance ; l'app Electron reste réservée à macOS, et **uniquement** pour contourner les limites de Safari.

------------------------------------------------------------------------

## 📖 Contexte

### Situation actuelle

Kagron est distribué selon deux canaux :

- **Windows / Linux** : PWA `juni-app` (React 19, Spring Boot) dans le navigateur.
- **macOS** : application **Electron** (`juni-electron-app`), wrapper pur — **zéro logique métier, zéro dépendance native** (Sharp/ONNX/FFmpeg déjà retirés). Distribuée en DMG signé + notarisé Apple, auto-update Squirrel.Mac via GitHub Releases.

Le wrapper Electron expose à la webapp via `window.electronAPI` : credentials chiffrés OS (`safeStorage`), cache HLS local ([JUNI-706](https://wistiteek.atlassian.net/browse/JUNI-706)), file I/O (`downloadFile`, `saveFile`, `selectFolder`, `readFile`, `writeFile`, `readDirectory`), `openExternal`.

### Pourquoi maintenant ?

Question posée : **« combien coûterait une app Electron Windows (signature, installer, zip) et est-ce utile ? »**. L'évaluation a élargi le débat à la pertinence même d'une app native (Windows ET macOS) face à la PWA.

### Benchmark / état de l'art

Le streaming vidéo grand public (YouTube, Twitch, Netflix) ne compte **jamais** sur le cache du client pour maîtriser l'egress : la réponse standard est un **CDN/edge** devant le stockage. Côté desktop, la tendance 2023-2026 est la « renaissance des PWA » : Chromium est PWA-complet, et Safari a rattrapé une grande partie de son retard (cf. ci-dessous).

------------------------------------------------------------------------

## ❓ Problème à résoudre

> 🔴 **Problème :** Faut-il investir dans une (ou des) application(s) native(s) Electron, et sur quelles plateformes, ou la PWA suffit-elle ? Quel est le bon niveau d'empaquetage par plateforme, au meilleur rapport bénéfice / coût de maintenance ?

------------------------------------------------------------------------

## 🎯 Objectifs

| Type | Objectif |
|----|----|
| 💼 Business | Minimiser les coûts récurrents (signature, CI) et la dette de maintenance |
| 📦 Produit | Offrir une expérience desktop correcte (fenêtre dédiée, plein écran) sur Windows et macOS |
| 👤 Utilisateur | Lecture vidéo HLS fluide, login persistant, zéro friction d'installation |
| ⚙️ Technique | Ne pas multiplier les cibles de build/release sans gain mesurable |

------------------------------------------------------------------------

## 🔍 Options envisagées

### Option 1 – App Electron Windows (en plus de macOS)

📝 *Porter le wrapper Electron sur Windows : makers Squirrel (.exe) + ZIP, signature, workflow CI `windows-build.yml`.*

| ✅ Avantages | ❌ Inconvénients |
|----|----|
| Cohérence avec macOS | 2ᵉ cible à maintenir **à vie** (CI, signing, release, auto-update) |
| Contrôle fin du cache disque | Coût récurrent signature ≈ 120 \$/an (Azure Trusted Signing) ou ≈ 550 \$/an (cert OV/EV) |
| Fenêtre dédiée | **Aucune capacité nouvelle** vs PWA Edge/Chrome |

**⚙️ Effort estimé :** 🟡 Moyen (≈ 2 j dev one-shot + maintenance continue)

### Option 2 – PWA installable (Edge/Chrome) sur Windows — **retenue**

📝 *Aucune app native Windows. La PWA `juni-app` est installable en 1 clic depuis Edge/Chrome.*

| ✅ Avantages | ❌ Inconvénients |
|----|----|
| Service worker, Cache API, notifications, File System Access, passkeys : **tout natif Chromium** | Dépend d'un navigateur Chromium (cas par défaut sur Windows) |
| Fenêtre standalone plein écran (`display: standalone`) | Contrôle du cache un cran moins fin que disque natif (marginal) |
| Coût : **0 €**, aucune CI/signature supplémentaire |  |

**⚙️ Effort estimé :** 🟢 Faible (manifest correct, déjà nécessaire)

### Option 3 – Tout en PWA, y compris macOS (supprimer l'Electron)

📝 *Abandonner aussi l'Electron macOS et pousser les coachs Mac vers la PWA.*

| ✅ Avantages | ❌ Inconvénients |
|----|----|
| Une seule cible (la webapp) | Les coachs Mac sont sur **Safari** → dépend du support PWA Safari |
| Zéro maintenance native | Perte du DMG signé/notarisé (gage de légitimité) |
|  | Friction de migration : utilisateurs ayant déjà l'app + credentials Keychain |

**⚙️ Effort estimé :** 🟢 Faible techniquement, mais 🔴 impact utilisateur à planifier

------------------------------------------------------------------------

## ✅ Décision

> 🏆 **Option retenue : Option 2 — PWA installable sur Windows. Pas d'app Electron Windows.** L'app Electron reste **macOS-only** ; l'Option 3 (suppression Electron macOS) est **étudiée mais pas tranchée** (cf. trade-offs).

### Le raisonnement par soustraction

L'évaluation a procédé en démontant les arguments un par un :

**1. « Une app native serait mieux »** L'Electron macOS n'existe pas par préférence : il existe **à cause de Safari**. Sur Windows, Edge/Chrome sont des PWA de première classe → ce problème n'existe pas.

**2. « L'installation PWA apporte-t-elle quelque chose vs un onglet ? »** Techniquement non : service worker, cache, notifications, File System Access, passkeys marchent **déjà dans l'onglet**. L'installation n'ajoute que de l'**ergonomie** (fenêtre standalone plein écran) — ce qui a une vraie valeur pour une app vidéo en session longue, et coûte **0 €**.

**3. « Le cache vidéo réduit notre coût de bande passante »** Vrai, mais ce cache est un comportement de *client qui cache*, **pas un truc d'Electron** : la PWA cache déjà via Cache API + Service Worker. Sur l'egress, Electron vs PWA = match nul. De plus, un cache **client** ne réduit l'egress que sur **re-visionnage par le même utilisateur** — le bon levier structurel est un **CDN devant le Blob**, qui sert tous les clients sans rien installer. **Un CDN est déjà en place.** L'argument bande passante ne justifie donc aucune app native.

**4. « Du coup Electron ne sert à rien, même sur Mac »** Saut logique invalide : le CDN règle l'egress, mais l'Electron macOS n'a **jamais** servi à l'egress — il sert à contourner Safari. Le vrai critère devient : **quel navigateur utilisent les coachs Mac ?** → réponse : **Safari**.

**5. État réel de Safari en 2026 (correction d'une idée reçue)** Depuis macOS Sonoma (Safari 17, fin 2023), « Ajouter au Dock » donne à Safari : fenêtre dédiée, notifications Web Push, **stockage isolé (Cache API/IndexedDB → cache vidéo HLS fonctionnel)**. L'écart Safari ↔ Electron s'est largement refermé. Le **seul trou résiduel** : la **File System Access API** (`showSaveFilePicker`, `showDirectoryPicker`, lecture/écriture d'un dossier choisi), que WebKit n'implémente toujours pas — le téléchargement classique (blob + `<a download>`), lui, fonctionne dans Safari.

### Ce que nous ne ferons PAS (trade-offs)

- **Pas d'app Electron Windows.** Aucun gain fonctionnel vs PWA, coût de maintenance à vie injustifié (YAGNI).
- **Pas d'argument egress pour justifier une app native** : le CDN en place est le bon levier, la PWA cache déjà côté client.
- **Pas de suppression de l'Electron macOS pour l'instant** : reste justifié tant que les coachs Mac sont sur Safari ET que juni-app a un besoin réel de File System Access (à confirmer — cf. plan de mise en œuvre).

------------------------------------------------------------------------

## 📊 Conséquences

### ✅ Impacts positifs

- Économie d'une cible de build/release/signature complète (≈ 120–550 \$/an + ≈ 2 j dev + maintenance continue évités).
- Stratégie de distribution clarifiée et documentée pour les nouveaux arrivants.
- Recentrage du « vrai » levier bande passante sur le CDN, pas sur le client.

### ⚠️ Impacts négatifs / Risques

| Risque | Mitigation |
|----|----|
| Expérience PWA Windows non optimale (manifest incomplet) | Audit du `manifest.json` juni-app (`display: standalone`, icônes, scope) |
| Coachs Windows sur un navigateur non-Chromium | Cas marginal ; documenter « installer via Edge/Chrome » |
| Décision Mac laissée ouverte | Vérifier l'usage réel de `window.electronAPI` (file I/O avancé vs download simple) avant de trancher l'Option 3 |

------------------------------------------------------------------------

## 📈 Critères de succès

| Métrique | Cible | Horizon | Comment mesurer |
|----|----|----|----|
| Coût récurrent app native Windows | 0 € | Permanent | Aucune CI/signature Windows créée |
| Expérience PWA installée Windows | Lecture HLS + login persistant OK | Court terme | Test manuel sur PC Windows (Edge) |
| Egress vidéo maîtrisé | Servi via CDN | Acquis | CDN déjà en place devant le Blob |

------------------------------------------------------------------------

## 🚀 Plan de mise en œuvre

### Périmètre

| Action | Inclus |
|----|----|
| Ne pas créer de cible Electron Windows | ✅ |
| Garder l'Electron macOS en l'état | ✅ |
| Audit `manifest.json` juni-app (qualité PWA installée) | ✅ (recommandé) |
| Décider du sort de l'Electron macOS (Option 3) | ❌ (différé — dépend de l'analyse File System Access) |

### Étapes principales

1.  Acter « pas d'Electron Windows » (ce PDR).
2.  Mettre à jour le `CLAUDE.md` de `juni-electron-app` si besoin (la stratégie « Windows/Linux = PWA » est confirmée).
3.  (Optionnel) Auditer le `manifest.json` de juni-app pour garantir une PWA installable propre sur Windows et macOS Sonoma+.
4.  (Différé) Analyser comment juni-app consomme `window.electronAPI` (file I/O avancé ?) pour trancher l'avenir de l'Electron macOS.

------------------------------------------------------------------------

## 🔗 Liens & références

| Type | Lien |
|----|----|
| 📐 PDR lié | PDR-0012 – Analyse de matchs sur iPad (PWA dédiée) |
| 📐 PDR lié | PDR-0017 – HLS Streaming pour les vidéos de match |
| 📦 Repo | `juni-electron-app` (wrapper macOS) ; `juni-app` (PWA) |
| 📚 Réf. technique | Safari « Add to Dock » (Safari 17 / macOS Sonoma) ; Azure Trusted Signing (≈ 9,99 \$/mois) |

------------------------------------------------------------------------

## 📅 Historique des modifications

| Date       | Auteur         | Modification |
|------------|----------------|--------------|
| 2026-06-25 | Florian Dejean | Création     |
