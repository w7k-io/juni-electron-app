# Documentation - Système de statut du moteur IA (iagron)

Ce dossier contient toute la documentation pour le système de statut en temps réel du moteur IA iagron.

## 📁 Structure des fichiers

```
docs/
├── README.md                          # Ce fichier (vue d'ensemble)
├── INTEGRATION-GUIDE.md               # 🔥 Guide d'intégration pour l'app web (COMMENCER ICI)
├── PROMPT-FOR-WEB-CLAUDE.md          # Prompt à copier-coller pour Claude sur l'app web
├── iagron-status-api.md              # Documentation API complète avec exemples
└── typescript/
    ├── iagron-types.d.ts              # Définitions TypeScript
    ├── react-hooks.tsx                # Hooks React prêts à l'emploi
    └── vue-composables.ts             # Composables Vue prêts à l'emploi
```

## 🚀 Pour démarrer rapidement

### Si vous travaillez sur l'application web

1. **Lisez** : `INTEGRATION-GUIDE.md` (contient des exemples complets React et Vue)
2. **Copiez** : Les fichiers TypeScript nécessaires dans votre projet web
3. **Implémentez** : Utilisez les hooks/composables fournis sur votre page de chargement

### Si vous voulez donner les instructions à Claude

Utilisez le fichier `PROMPT-FOR-WEB-CLAUDE.md` qui contient un prompt complet prêt à copier-coller.

## 📚 Description des fichiers

### INTEGRATION-GUIDE.md
**Guide d'intégration principal** pour l'application web.

Contient :
- Instructions étape par étape
- Exemples complets pour React et Vue
- Code prêt à copier-coller
- Checklist d'implémentation
- Gestion des erreurs

**👉 Commencez par ce fichier !**

### PROMPT-FOR-WEB-CLAUDE.md
**Prompt optimisé** pour donner à Claude qui travaille sur l'application web.

Contient :
- Contexte complet du projet
- Liste des fichiers de documentation
- Objectifs clairs
- Instructions détaillées
- Solution clé en main

**👉 Copiez-collez ce fichier à Claude sur l'app web !**

### iagron-status-api.md
**Documentation API détaillée** avec tous les détails techniques.

Contient :
- Liste complète des états du moteur
- Structure des objets de statut
- Toutes les APIs disponibles
- Exemples d'utilisation avancés
- Notes de performance et limitations

**👉 Référence technique complète**

### typescript/iagron-types.d.ts
**Définitions TypeScript** pour l'autocomplétion dans l'app web.

Contient :
- Types de tous les états (`IagronEngineStatus`)
- Interfaces complètes (`IagronStatus`, `IagronAnalysisResult`)
- Déclaration de `window.electronAPI`
- Commentaires JSDoc détaillés

**👉 À copier dans `src/types/electron/iagron.d.ts`**

### typescript/react-hooks.tsx
**Hooks React prêts à l'emploi** pour faciliter l'intégration.

Contient :
- `useIagronStatus()` : Surveiller le statut en temps réel
- `useIagronAnalyzer()` : Analyser des vidéos avec feedback
- `useIagronLoadingGate()` : Gérer la page de chargement
- `<LoadingGate />` : Composant clé en main
- `<IagronStatusIndicator />` : Indicateur de statut

**👉 À copier dans `src/hooks/useIagron.tsx` si React**

### typescript/vue-composables.ts
**Composables Vue prêts à l'emploi** pour faciliter l'intégration.

Contient :
- `useIagronStatus()` : Surveiller le statut en temps réel
- `useIagronAnalyzer()` : Analyser des vidéos avec feedback
- `useIagronLoadingGate()` : Gérer la page de chargement
- `createLoadingGate()` : Helper pour composant
- `createIagronStatusIndicator()` : Helper pour indicateur

**👉 À copier dans `src/composables/useIagron.ts` si Vue**

## 🎯 Cas d'usage principaux

### 1. Page de chargement post-login

**Objectif** : Attendre que le moteur IA soit initialisé (+ autres tâches) avant de laisser l'utilisateur accéder à l'app.

**Solution** : Utiliser le composant `LoadingGate` (React) ou `createLoadingGate` (Vue) fourni.

**Documentation** : `INTEGRATION-GUIDE.md` sections "Implémentation rapide"

### 2. Analyser une vidéo avec feedback

**Objectif** : Lancer une analyse et afficher la progression à l'utilisateur.

**Solution** : Utiliser `useIagronAnalyzer()` qui gère automatiquement le statut et la progression.

**Documentation** : `iagron-status-api.md` section "Progression de l'analyse"

### 3. Vérifier si le moteur est prêt

**Objectif** : Activer/désactiver un bouton selon l'état du moteur.

**Solution** : Utiliser `useIagronStatus()` et lire `isReady`.

**Documentation** : `react-hooks.tsx` ou `vue-composables.ts` avec exemples

## 🔄 Workflow typique

```
1. Démarrage Electron
   ↓
2. Initialisation auto du moteur (2-5s)
   État: initializing → ready
   ↓
3. Page de chargement web s'affiche
   ↓
4. Page de chargement écoute les événements
   ↓
5. Toutes les tâches sont complètes
   État moteur IA: ready ✓
   État autres tâches: completed ✓
   ↓
6. Redirection vers le dashboard
```

## 📊 États du moteur

| État | Description | Durée |
|------|-------------|-------|
| `not-initialized` | Moteur non initialisé | N/A |
| `initializing` | Chargement du modèle ONNX | 2-5s |
| `ready` | Prêt à analyser | ∞ |
| `analyzing` | Analyse en cours | Variable |
| `error` | Erreur | ∞ |

## ✅ Checklist pour l'implémentation web

- [ ] Lire `INTEGRATION-GUIDE.md`
- [ ] Copier `iagron-types.d.ts` dans le projet web
- [ ] Copier `react-hooks.tsx` ou `vue-composables.ts`
- [ ] Créer/modifier la page de chargement
- [ ] Utiliser `LoadingGate` avec les tâches existantes
- [ ] Tester l'initialisation (2-5s au démarrage)
- [ ] Tester la gestion d'erreur
- [ ] Styler les composants

## 🐛 Troubleshooting

### Le moteur ne s'initialise pas

1. Vérifiez la console Electron (DevTools)
2. Vérifiez que `@wistiteek/iagron` est installé
3. Vérifiez que le modèle ONNX existe dans `node_modules/@wistiteek/iagron/src/models/`

### Les événements ne sont pas reçus

1. Vérifiez que vous appelez `iagronOnStatusChanged()` avant l'initialisation
2. Vérifiez que vous vous désabonnez dans le cleanup (useEffect return ou onBeforeUnmount)

### La progression reste bloquée

La progression est actuellement simulée (10%, 30%, 50%, 100%) car la librairie iagron ne fournit pas de callbacks natifs. C'est normal.

## 📞 Support

Pour toute question sur l'intégration, consultez :
1. `INTEGRATION-GUIDE.md` en premier
2. `iagron-status-api.md` pour les détails techniques
3. Les fichiers `.tsx` et `.ts` qui contiennent des exemples commentés

---

**Note** : Tous ces fichiers ont été générés automatiquement pour faciliter l'intégration par Claude sur l'application web.

---

## 🚀 Guides de déploiement et CI/CD

### [DEPLOYMENT.md](./DEPLOYMENT.md) ⭐ **ACTIF**
**Guide complet du système de déploiement en deux étapes.**

Système Pre-release + Promotion manuelle :
- **Pre-release automatique** : Build + Tests → Pre-release GitHub (automatique sur push vers main)
- **Promotion manuelle** : Pre-release → Release finale + Azure (manuel, pas de rebuild)

**À lire si** :
- Tu veux comprendre comment déployer en production
- Tu veux créer une nouvelle release
- Tu veux savoir comment tester avant de déployer
- Tu veux comprendre les workflows GitHub Actions

**👉 C'est le guide principal pour tout ce qui concerne les releases et déploiements !**

---

### [GITHUB_ENVIRONMENT_SETUP.md](./GITHUB_ENVIRONMENT_SETUP.md) ⚠️ **OBSOLETE**
~~Guide pour configurer GitHub Environments avec Required Reviewers~~

**Obsolète** : Cette fonctionnalité nécessite GitHub Enterprise pour les repos privés. Ce projet utilise maintenant l'architecture Pre-release + Promotion.

→ Voir [DEPLOYMENT.md](./DEPLOYMENT.md) pour la nouvelle architecture.
