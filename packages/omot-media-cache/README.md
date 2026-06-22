# omot-media-cache

Private local media cache for OMOT images. It is intended to run near a large
local disk and be exposed to the frontend through a private Cloudflare Tunnel.

## Run

```sh
MEDIA_CACHE_KEY=<your-media-key> \
MEDIA_CACHE_DIR=/mnt/16t/omot-media \
yarn workspace omot-media-cache start
```

By default the service listens on `127.0.0.1:8789` and accepts images from
`web.archive.org`, `pbs.twimg.com`, `video.twimg.com`, and `abs.twimg.com`.

Useful environment variables:

- `MEDIA_CACHE_KEY` or `OMOT_API_KEY`: required private key.
- `MEDIA_CACHE_DIR`: cache root, defaults to `.cache/omot-media`.
- `MEDIA_CACHE_HOST`: bind host, defaults to `127.0.0.1`.
- `MEDIA_CACHE_PORT`: bind port, defaults to `8789`.
- `MEDIA_MAX_BYTES`: max image size, defaults to `52428800`.
- `MEDIA_FETCH_TIMEOUT_MS`: upstream timeout, defaults to `45000`.
- `MEDIA_ALLOWED_HOSTS`: comma-separated host allowlist.

## Cloudflare Tunnel

Quick tunnel:

```sh
cloudflared tunnel --url http://127.0.0.1:8789
```

Named tunnel example:

```yaml
tunnel: omot-media
credentials-file: /home/me/.cloudflared/omot-media.json

ingress:
  - hostname: media.example.com
    service: http://127.0.0.1:8789
  - service: http_status:404
```

## Frontend

Open the frontend with runtime media cache config:

```text
https://your-frontend.example/?apikey=<your-edge-api-key>&media=https%3A%2F%2Fmedia.example.com&mediakey=<your-media-key>
```

The same values can also be saved in Settings under Edge:

- Media Cache URL: `https://media.example.com`
- Media Cache Key: `<your-media-key>`

## Prefetch From Edge

Pull media URLs from the deployed Worker and store them locally:

```sh
MEDIA_CACHE_KEY=<your-media-key> \
MEDIA_CACHE_DIR=/mnt/16t/omot-media \
yarn workspace omot-media-cache pull-edge \
  --edge-url https://omot-edge.ayanamists.workers.dev \
  --api-key <your-edge-api-key> \
  --pages 2 \
  --limit 100 \
  --concurrency 4
```

The prefetch commands print per-run failures, such as archived image 404s, but
keep the process exit code at zero by default so long full-cache runs can
continue. Add `--strict` if failures should make the command exit non-zero.

For only tweet body media, exclude avatars:

```sh
MEDIA_CACHE_KEY=<your-media-key> \
MEDIA_CACHE_DIR=/mnt/16t/omot-media \
yarn workspace omot-media-cache pull-edge \
  --api-key <your-edge-api-key> \
  --avatars 0 \
  --pages 2 \
  --limit 100 \
  --concurrency 4
```
