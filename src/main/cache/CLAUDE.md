# HLS Cache (main process)

Module Electron qui cache localement les segments HLS, manifests et `init.mp4` afin de réduire le bandwidth Azure de ~90 % sur les revisitations vidéo.

Spec : `docs/superpowers/specs/2026-05-01-juni706-hls-cache-electron-design.md`
Story : [JUNI-706](https://wistiteek.atlassian.net/browse/JUNI-706) (Epic [JUNI-705](https://wistiteek.atlassian.net/browse/JUNI-705))

## Layout filesystem

```
$userData/cache/
  index.json                   # LRU metadata (version 1)
  hls/
    {sha256(canonicalUrl)}.bin # Bytes du segment / manifest / init.mp4
```

`$userData` sur macOS = `~/Library/Application Support/Kagron/cache/`.

## Format `index.json`

```json
{
  "version": 1,
  "entries": [
    {
      "hash": "abc...64hex",
      "originalUrl": "https://...blob.core.windows.net/.../segment_001.m4s",
      "contentType": "video/iso.segment",
      "sizeBytes": 4194304,
      "lastAccessAt": 1714576000000
    }
  ]
}
```

## Contrat IPC (channels `cache:*`)

| Channel | Args | Retour | Notes |
|---|---|---|---|
| `cache:get` | `(canonicalUrl: string)` | `ArrayBuffer \| null` | Hot path. `null` si miss ou désactivé. |
| `cache:put` | `(canonicalUrl, contentType, bytes: ArrayBuffer)` | `void` | Refusé si domaine hors whitelist ou bytes > 50 MiB. |
| `cache:get-stats` | `()` | `CacheStats` | Settings UI. |
| `cache:get-config` | `()` | `CacheConfig` | |
| `cache:set-config` | `(cfg)` | `void` | Triggers une éviction si `capBytes` baissé. |
| `cache:purge` | `()` | `void` | Vide tout. |
| `cache:drain-metrics` | `()` | `CacheMetricsSnapshot` | Reset les compteurs. |

## Règles métier

- Le `canonicalUrl` est **toujours** stripé du SAS / query string **côté renderer avant l'IPC**. Le main process ne voit jamais l'URL avec query.
- La clé filesystem est `sha256(canonicalUrl)` au format hex 64 chars. Validation regex `/^[a-f0-9]{64}$/` avant tout `fs.*` (anti path traversal).
- Le MP4 original n'est jamais caché. Le renderer ne fait `put` que pour les `*.m4s`, `*.m3u8` et `init.mp4` (côté loader hls.js).
- LRU pure (pas de TTL). Hystérésis 90 % : on évince jusqu'à `cap × 0.9` pour éviter les évictions à répétition.
- Protection 30 s : on ne peut pas évincer une entrée dont `lastAccessAt > now - 30000` (segment potentiellement en cours de lecture).
- `put` no-op silencieux sur `ENOSPC`, `EACCES`, ou si désactivé.
- Domaines whitelistés (HTTPS uniquement) : `*.blob.core.windows.net`, `*.kagron.app`, `*.w7k.app`. Tout autre domaine est rejeté avec exception (`domain not allowed`).

## Comportement boot / shutdown / crash

- **Boot** : `HlsCacheManager.init()` lit `index.json`. Si manquant ou corrompu → `rebuildFromFilesystem()` qui scanne `*.bin` et utilise `mtime` comme `lastAccessAt`. Les entrées reconstruites n'ont pas d'`originalUrl` valide donc ne sont pas `hits`, mais leur taille reste comptée → seront réécrites au prochain miss.
- **Shutdown** : `app.on('before-quit')` → `flushIndex()` (`writeFile` tmp + `rename` atomique).
- **Crash main process** : pertes possibles des `lastAccessAt` non flushés. Acceptable, reconstruction au prochain boot.

## Debug

```bash
# Vider le cache à la main
rm -rf "$HOME/Library/Application Support/Kagron/cache/hls"
rm -f  "$HOME/Library/Application Support/Kagron/cache/index.json"

# Inspecter l'index
cat "$HOME/Library/Application Support/Kagron/cache/index.json" | jq
```

## Spécificités macOS

- On utilise `app.getPath('userData')` (= `~/Library/Application Support/Kagron`) au lieu de `~/Library/Caches/`. Les caches sont automatiquement purgés par macOS quand l'espace manque, alors qu'`Application Support` est persistant.
- Time Machine sauvegarde `~/Library/Application Support/`. Si l'utilisateur s'inquiète de la taille, l'option « Vider le cache » dans Settings suffit. Pas d'exclusion auto.

## Bugs connus

(à enrichir au fil de l'eau)

## Tests

| Fichier | Couverture |
|---|---|
| `HlsCacheIndex.test.ts` | LRU, persist, reconstruction depuis filesystem |
| `HlsCacheStore.test.ts` | atomic write, hex 64 validation, ENOENT/EACCES |
| `HlsCacheMetrics.test.ts` | counters, drain |
| `HlsCacheManager.test.ts` | orchestration, whitelist, payload size limit, eviction, https-only |
| `cache-handlers.test.ts` | IPC handlers + validation arguments |
| `cache-handlers.contract.test.ts` | sérialisation JSON renderer ↔ main |
