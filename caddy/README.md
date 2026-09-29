# Caddy with Cloudflare DNS

The official `caddy` image rebuilt with
[caddy-dns/cloudflare](https://github.com/caddy-dns/cloudflare), so Caddy can
obtain certificates through the ACME DNS-01 challenge. That challenge proves
control of the domain by writing a TXT record, so it works for sites whose
names resolve to private addresses that Let's Encrypt cannot reach over HTTP.

Paths, volumes and the command match the official image.

## Token

Create a Cloudflare API token with `Zone / DNS / Edit`, scoped to the zones
Caddy serves. Pass it as an environment variable; never commit it.

## Caddyfile

```caddyfile
{
    acme_dns cloudflare {env.CF_API_TOKEN}
}

site.example.com {
    respond "ok"
}
```

## Run

```sh
docker build --pull -t local/caddy-cloudflare ./caddy
docker run --rm -p 443:443 \
  -e CF_API_TOKEN \
  -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -v caddy-data:/data \
  local/caddy-cloudflare
```

Keep `/data` on a volume: it holds the issued certificates and the ACME
account, and losing it means re-issuing on every start, which runs into Let's
Encrypt rate limits.

Rebuild with `--pull` to pick up new Caddy releases and plugin fixes.
`CADDY_VERSION` (default `2`) pins the upstream tag.

## Ports

Only `443/tcp` and `443/udp` (HTTP/3) are declared. The official image also
declares `80` and `2019`; a Dockerfile cannot drop an inherited `EXPOSE`, so
the runtime stage is rebuilt on Alpine the way the official image is, with
the builder's `caddy` binary and the official image's default Caddyfile and
welcome page. DNS-01 needs
no inbound port. `80` is still usable for an HTTP-to-HTTPS redirect; publish
it in the compose file if wanted. `EXPOSE` is only metadata: nothing is
published unless the compose file or `docker run -p` publishes it.
