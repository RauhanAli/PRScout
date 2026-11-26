# Putting gitprscout.com on the production stack

The production stack listens only on **127.0.0.1:8310** (the `edge` nginx).
The public route is a Cloudflare tunnel, and `~/.cloudflared/` is
hand-managed, so this file is the copy-paste plan; nothing under
`deploy/prod/` touches that directory.

Two ways, pick one:

- **A. A new tunnel `prscout-prod`** (recommended: production stays up when the
  staging tunnel is restarted, and moving to Hetzner later is "run the same
  tunnel there").
- **B. Add ingress to the existing `staging` tunnel** (`~/staging/cloudflared/config.yml`,
  the `staging-cloudflared` container). Fewer moving parts, shared fate with staging.

Both end with the same DNS records and the same checks.

## A. New tunnel `prscout-prod`

### 1. Create it (once, on this box, as your user)

```sh
cloudflared tunnel login                 # opens a browser once; pick the gitprscout.com zone
cloudflared tunnel create prscout-prod      # prints the tunnel UUID and writes
                                         # ~/.cloudflared/<UUID>.json (the credentials)
cloudflared tunnel list                  # confirm: prscout-prod  <UUID>
```

### 2. Config file: `~/.cloudflared/prscout-prod.yml`

Replace `<UUID>` with the value from step 1 (twice).

```yaml
tunnel: <UUID>
credentials-file: /home/rauhan/.cloudflared/<UUID>.json

# gitprscout.com -> the production edge on 127.0.0.1:8310 (deploy/prod).
# www is also routed here; the edge answers it with a 301 to the apex.
ingress:
  - hostname: gitprscout.com
    service: http://127.0.0.1:8310
  - hostname: www.gitprscout.com
    service: http://127.0.0.1:8310
  - service: http_status:404
```

### 3. DNS: two CNAME records in the gitprscout.com zone

Either let cloudflared write them:

```sh
cloudflared tunnel route dns prscout-prod gitprscout.com
cloudflared tunnel route dns prscout-prod www.gitprscout.com
```

or add them by hand in the Cloudflare dashboard (DNS > Records), both proxied
(orange cloud):

| Type  | Name                 | Target                    | Proxy   |
| ----- | -------------------- | ------------------------- | ------- |
| CNAME | `@` (gitprscout.com) | `<UUID>.cfargotunnel.com` | Proxied |
| CNAME | `www`                | `<UUID>.cfargotunnel.com` | Proxied |

If `@` already has A/AAAA records (parking page), delete them first; a CNAME
at the apex is fine on Cloudflare (CNAME flattening).

### 4. Run it

**Option 1: a systemd --user unit** (like the backup timer; survives reboots
because the user lingers):

`~/.config/systemd/user/cloudflared-prscout-prod.service`

```ini
[Unit]
Description=Cloudflare tunnel prscout-prod -> gitprscout.com (127.0.0.1:8310)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate --config %h/.cloudflared/prscout-prod.yml run
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

```sh
which cloudflared                     # adjust ExecStart if it isn't /usr/bin/cloudflared
systemctl --user daemon-reload
systemctl --user enable --now cloudflared-prscout-prod
systemctl --user status cloudflared-prscout-prod --no-pager
journalctl --user -u cloudflared-prscout-prod -f
```

**Option 2: a docker container** like `staging-cloudflared` (host network so
it reaches 127.0.0.1:8310):

```sh
mkdir -p ~/.cloudflared/prscout-prod
cp ~/.cloudflared/prscout-prod.yml ~/.cloudflared/prscout-prod/config.yml
cp ~/.cloudflared/<UUID>.json ~/.cloudflared/prscout-prod/creds.json
# in config.yml, change credentials-file to /etc/cloudflared/creds.json
docker run -d --name prscout-prod-cloudflared --restart unless-stopped --network host \
  -v "$HOME/.cloudflared/prscout-prod:/etc/cloudflared:ro" \
  cloudflare/cloudflared:latest tunnel --no-autoupdate --config /etc/cloudflared/config.yml run
docker logs -f prscout-prod-cloudflared
```

## B. Reuse the `staging` tunnel instead

1. Add the two hostnames to `~/staging/cloudflared/config.yml` **above** the
   `*.rauhan-ali.xyz` wildcard:

   ```yaml
   - hostname: gitprscout.com
     service: http://127.0.0.1:8310
   - hostname: www.gitprscout.com
     service: http://127.0.0.1:8310
   ```

2. DNS: the same two CNAMEs as in A.3, targeting the _staging_ tunnel's
   `<UUID>.cfargotunnel.com` (`cloudflared tunnel list` shows it), or
   `cloudflared tunnel route dns staging gitprscout.com` and the same for `www`.
   The tunnel is on a different Cloudflare account/zone only if gitprscout.com
   is; route dns needs the zone in the account the tunnel was created in.

3. Reload: `docker restart staging-cloudflared` (a few seconds of downtime
   for everything on that tunnel; the user does this, not a worker).

## www to apex, and TLS

- The edge already answers `Host: www.gitprscout.com` with
  `301 https://gitprscout.com/<path>`, so no Cloudflare rule is required.
- Optional: do it at the Cloudflare edge instead (saves a hop): Rules >
  Redirect Rules > "www to apex": when `http.host eq "www.gitprscout.com"`,
  dynamic redirect to `concat("https://gitprscout.com", http.request.uri.path)`,
  301, preserve query string.
- SSL/TLS mode: **Full** (the tunnel terminates TLS, the origin is plain
  http on loopback; Full works for tunnels). Turn on **Always Use HTTPS**
  (Edge Certificates) and, if you like, HSTS after a day of it working.

## Check it

```sh
curl -sI https://gitprscout.com/ | head -5                      # 200, cf-ray header
curl -sI https://www.gitprscout.com/ | grep -i '^location'      # https://gitprscout.com/
curl -s https://gitprscout.com/robots.txt                       # Allow: / and the sitemap
curl -s https://gitprscout.com/__build | jq .live.main.short    # the deployed commit
cd e2e && BASE_URL=https://gitprscout.com npx playwright test --workers=1
```

The web app trusts `CF-Connecting-IP` (`TRUST_PROXY_HEADERS=1`) for rate
limits. That is safe only while the edge port stays on 127.0.0.1 and the
tunnel is the sole way in; never publish 8310 on another address.
