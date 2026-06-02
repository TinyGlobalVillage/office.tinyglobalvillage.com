# Headscale — RCS-Stack entry

> Status: draft · 2026-06-01

**One-liner:** Self-hosted mesh VPN control plane for private SSH-from-anywhere.

**Stack / runtime:** Go binary + SQLite + nginx + Let's Encrypt
**Service:** systemd unit `headscale.service`, user `headscale`, port `8080` (loopback only — public reachability via nginx on `443`)
**Source-of-truth files:**
- `/etc/headscale/config.yaml` — server config (listen addr, DERP map, DNS, OIDC, base domain)
- `/var/lib/headscale/db.sqlite` — node registry, user/key state, route table

---

## Architecture

A mesh VPN gives every enrolled device a stable private IP on a shared overlay network so they can reach each other directly regardless of NAT, ISP, or physical location. Headscale is the open-source control plane that does enrollment, key exchange, and route brokering — the equivalent of the proprietary Tailscale coordination server, but running on our VPS under our control. The actual data plane is WireGuard inside each client; Headscale never sees traffic.

**DERP relays.** When two peers cannot reach each other directly (symmetric NAT, hostile firewall), traffic falls back to a DERP relay — an encrypted TCP tunnel hosted by a third party. We currently use **Tailscale's public free DERP fleet** (no account needed, no auth, fair-use). Self-hosting a DERP node is a future optional hardening (single Go binary, ~50 MB RAM); only worth it if we hit the free-tier ceiling or want to remove the external dependency.

**Subnet.** Headscale assigns each node an IP out of `100.64.0.0/10` (the CGNAT space — RFC 6598 — guaranteed not to collide with any home/office LAN). RCS itself sits on this network as a regular node and is reachable at its mesh IP from any enrolled device.

**Peer-to-peer once meshed.** After enrollment Headscale only mediates **discovery**: it tells clients about each other's pubkeys and endpoints. Once peers know each other they speak WireGuard directly; Headscale can go offline and existing tunnels keep working until key rotation.

---

## Enrollment flow

Adding a new device takes ~30 seconds:

1. On RCS: `sudo headscale preauthkeys create -u gio -e 1h --reusable=false`
2. Copy the printed key.
3. On the new device, install the Tailscale client (the official client speaks Headscale's protocol).
4. Run `tailscale up --login-server=https://headscale.tinyglobalvillage.com --authkey=<key>`
5. Verify: `tailscale status` shows the mesh IP; `ssh rcs` works from anywhere on earth.

Keys are single-use by default and expire in 1h — leaked keys cannot be reused after enrollment or after the TTL.

---

## Operations cheat-sheet

```bash
# Node inventory
headscale nodes list
headscale nodes list -o json | jq '.[] | {name, ipAddresses, lastSeen}'

# Issue a fresh preauthkey
headscale preauthkeys create -u gio -e 1h
headscale preauthkeys list -u gio

# Remove a compromised / decommissioned device
headscale nodes delete <id>
headscale nodes expire <id>   # keeps record, forces re-auth

# Users (one user can own many nodes)
headscale users create <name>
headscale users list

# Service control
systemctl status headscale
systemctl restart headscale
systemctl reload headscale     # picks up config.yaml without dropping tunnels

# Logs
journalctl -u headscale -f
journalctl -u headscale --since "10 min ago" | grep -i error
```

---

## Break-glass recovery

Three tiers, escalate only if the previous one fails.

### Tier 1 — Headscale is down but RCS is up
Symptoms: `tailscale status` says "no route to control plane"; SSH-over-mesh fails; RCS itself is fine over the public internet.
Fix from the VPS provider's web console (Vultr / Hetzner / etc):
```bash
systemctl restart headscale
journalctl -u headscale -n 50
```
If that brings it back, you're done. New tunnels can be established again.

### Tier 2 — Config corrupted (Headscale won't start)
Symptoms: `systemctl status headscale` shows fail; logs reference a YAML parse error or schema mismatch.
Restore the last known-good config from the sibling backup:
```bash
cp /etc/headscale/config.yaml.bak /etc/headscale/config.yaml
systemctl restart headscale
```
Convention: any operator who edits `config.yaml` must `cp config.yaml config.yaml.bak` first. Office Utils' HCM does this automatically on every save.

### Tier 3 — Totally hosed (mesh unreachable AND SSH-over-mesh broken)
Last resort. You need shell on RCS without the mesh.
1. From the VPS provider's web console (browser-based root shell — does not require SSH):
   ```bash
   # Allow public SSH on the moved port, scoped to your current public IP
   ufw allow from <your-current-public-ip> to any port 27720 proto tcp comment 'breakglass'
   ```
2. SSH in from your laptop: `ssh -p 27720 root@rcs.tinyglobalvillage.com`
3. Fix the underlying problem (binary upgrade gone bad, disk full, expired cert, DERP misconfig).
4. **Revert the firewall hole immediately:**
   ```bash
   ufw status numbered
   ufw delete <number>   # the breakglass rule
   ```
5. Audit-log the event in Office Utils → System Hardening → Activity Timeline.

The whole point of the mesh is that public-port-22 is closed. Tier 3 reopens an alternate port temporarily and ONLY from your current IP — close it the moment you're done.

---

## Related rcs-stack entries

- [`ssh.md`](./ssh.md) — SSH hardening posture (key-only, mesh-only by default, port 27720 closed)
- [`ufw.md`](./ufw.md) — firewall rules; Headscale public 443 lives here; Tier 3 break-glass rule format
- [`fail2ban.md`](./fail2ban.md) — brute-force shield on the SSH port if it's ever opened
- [`nginx.md`](./nginx.md) — TLS termination for `headscale.tinyglobalvillage.com` → `127.0.0.1:8080`

---

## Office Utils HCM

Operator surface: **`MeshVpnControlModal`** under System Hardening on `office.tinyglobalvillage.com/dashboard/utils`. Per the global hardening rule, every defensive layer must be visible and tunable from Office — no CLI-only management.

The modal exposes:
- Activity Timeline (enrollments, deletions, key rotations, config edits, restarts)
- Node inventory with last-seen + mesh IP + quick-expire action
- Preauthkey issuer (TTL picker, one-shot vs reusable, scoped to user)
- DERP relay selector (Tailscale public ↔ self-hosted, when we add the latter)
- Backup/restore of `config.yaml` with automatic `.bak` write
- Embedded `Fail2banGlobalView` + `UfwGlobalView` (per the HCM shape rule — global tools are global)

---

**Last updated:** 2026-06-01 · author: gio · status: draft (pending verification after first failover drill)
