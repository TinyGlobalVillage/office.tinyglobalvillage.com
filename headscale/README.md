# Headscale control plane for the TGV mesh VPN

Phase 1 deploy assets for `mesh.tinyglobalvillage.com` — the self-hosted
[Headscale](https://github.com/juanfont/headscale) control server that backs
the WireGuard mesh between RCS, fallback nodes, and admin laptops.

The runtime UI for managing peers + audit lives in the Mesh VPN HCM at
`src/app/components/hardening/mesh-vpn/` (TGV Office → Utils → System Hardening
→ Mesh VPN). Runtime-tunable config will eventually land at
`data/mesh-vpn/mesh-vpn-config.json` per the global hardening rule.

## Files

| File                  | Destination                                                                   |
|-----------------------|-------------------------------------------------------------------------------|
| `config.yaml`         | `/etc/headscale/config.yaml`                                                  |
| `headscale.service`   | `/etc/systemd/system/headscale.service`                                       |
| `nginx-mesh.conf`     | `/etc/nginx/sites-available/mesh.tinyglobalvillage.com` (+ enabled symlink)   |
| `install.sh`          | run-in-place — not copied to a destination                                    |

`install.sh` reads the three files above from this directory and installs
them in the right places (with backups of any pre-existing copies).

## Prerequisites

- Ubuntu / Debian RCS host with root access
- `curl`, `jq`, `nginx`, `certbot` + `python3-certbot-nginx`, `systemd`
  (install via `apt-get install -y curl jq nginx certbot python3-certbot-nginx`)
- DNS A/AAAA record `mesh.tinyglobalvillage.com` → RCS public IP (must resolve
  before running, or certbot will fail)
- UFW open on 80/tcp + 443/tcp to the world (HTTP/HTTPS); 41641/udp open to
  the world for Tailscale clients to reach DERP-less peers if you ever turn
  that on (not required for Phase 1, which uses Tailscale's public DERP)
- Outbound connectivity to `controlplane.tailscale.com` (for the DERP map)
  and `api.github.com` + `github.com/juanfont/headscale/releases` (for the
  install)

## Environment variables (optional install-time overrides)

| Variable                | Default                            | Purpose                                            |
|-------------------------|------------------------------------|----------------------------------------------------|
| `HOSTNAME_FQDN`         | `mesh.tinyglobalvillage.com`       | Public hostname (used for nginx + certbot)         |
| `LE_EMAIL`              | `connect@giocoelho.com`            | Let's Encrypt registration email                   |
| `HEADSCALE_ASSET_DIR`   | dir containing `install.sh`        | Where to read `config.yaml` / unit / nginx from    |

## Install order (one-time per host)

```bash
# From the repo on RCS:
cd /srv/refusion-core/clients/office.tinyglobalvillage.com/headscale
sudo bash install.sh

# Then generate a preauth key for the first peer:
sudo headscale preauthkeys create --user gio --expiration 24h --reusable

# On the peer node (e.g. fallback box, laptop):
sudo tailscale up --login-server=https://mesh.tinyglobalvillage.com --authkey=<key>

# Verify:
sudo headscale nodes list
```

The install is idempotent — re-run safely after changes. Each step checks
for existing state, only writes when content differs, and backs up the
previous copy with a timestamped `.bak.YYYYMMDD-HHMMSS` suffix.

## Expected outcome

- `headscale` systemd unit enabled + running as user `headscale`
- `https://mesh.tinyglobalvillage.com/health` returns `200 OK`
- Two users seeded: `gio` and `marmar`
- nginx serves the control plane with TLS via Let's Encrypt + WebSocket upgrade
- All state under `/var/lib/headscale/` (SQLite db, control-plane keys)
- Config at `/etc/headscale/config.yaml` (group-readable by `headscale`)
- CLI usable as `sudo headscale ...` (talks to the local unix socket)

## Rollback

```bash
# Stop + disable the service
sudo systemctl disable --now headscale

# Remove nginx site
sudo rm -f /etc/nginx/sites-enabled/mesh.tinyglobalvillage.com
sudo nginx -t && sudo systemctl reload nginx

# Optional: revoke the TLS cert
sudo certbot delete --cert-name mesh.tinyglobalvillage.com

# Remove binary + config + state (DESTRUCTIVE — wipes all peer registrations)
sudo rm -f /usr/local/bin/headscale
sudo rm -rf /etc/headscale /var/lib/headscale
sudo rm -f /etc/systemd/system/headscale.service
sudo systemctl daemon-reload

# Remove system user
sudo userdel headscale 2>/dev/null || true
```

To roll back to a previous config without wiping state, restore the most
recent `.bak.*` file in `/etc/headscale/` or `/etc/systemd/system/` and
`sudo systemctl daemon-reload && sudo systemctl restart headscale`.

## Notes

- Phase 1 uses Tailscale's public DERP fleet (no need to run our own DERP
  server). If we ever want to self-host DERP for latency or sovereignty,
  flip `derp.server.enabled: true` in `config.yaml` and open `udp/3478` +
  `tcp/443` accordingly.
- MagicDNS is OFF in Phase 1. Peers reach each other by `100.64.x.y` IPs.
  Turn on `dns.magic_dns: true` once the mesh is stable and we have a
  short-name convention.
- ACL policy path is empty → default-allow within the tailnet. The actual
  SSH/admin gating is done at the host level via UFW + sshd config; the
  Mesh VPN HCM's "per-peer killswitch" panel is the runtime chokepoint.
- The runtime install/render scripts may eventually move out of the repo to
  `/srv/refusion-core/utils/scripts/headscale/` per the FreeSWITCH pattern;
  this directory will then keep only the templates + README.
