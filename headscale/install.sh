#!/usr/bin/env bash
# install.sh — idempotent Headscale install + nginx + TLS for RCS
#
# Usage:  sudo bash install.sh
#
# Re-runs are safe: every step checks for existing state before mutating.
# Run from this directory (the repo-mirrored headscale/ folder), or pass
# HEADSCALE_ASSET_DIR to point elsewhere.

set -euo pipefail

# ----------------------------------------------------------------------------
# Config (override via env if needed)
# ----------------------------------------------------------------------------
HOSTNAME_FQDN="${HOSTNAME_FQDN:-mesh.tinyglobalvillage.com}"
LE_EMAIL="${LE_EMAIL:-connect@giocoelho.com}"
HEADSCALE_ASSET_DIR="${HEADSCALE_ASSET_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
HEADSCALE_USER="headscale"
HEADSCALE_GROUP="headscale"
HEADSCALE_HOME="/var/lib/headscale"
HEADSCALE_ETC="/etc/headscale"
HEADSCALE_BIN="/usr/local/bin/headscale"
NGINX_AVAIL="/etc/nginx/sites-available/${HOSTNAME_FQDN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${HOSTNAME_FQDN}"
SYSTEMD_UNIT="/etc/systemd/system/headscale.service"
# WHY: initial users come from a sibling file (or INITIAL_USERS env). The file
# form survives both pre- and post-canonicality JSON shapes for mesh-vpn-config.
INITIAL_USERS_FILE="${INITIAL_USERS_FILE:-${HEADSCALE_ASSET_DIR}/initial-users.txt}"
LAST_VERSION_FILE="${HEADSCALE_HOME}/.last-version"
INSTALL_CHECKSUM_FILE="${HEADSCALE_HOME}/.install-checksum"

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
log()  { printf '\033[1;36m[headscale-install]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[headscale-install]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[headscale-install]\033[0m %s\n' "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Must run as root (try: sudo bash install.sh)"
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1 (install with: apt-get install -y $2)"
}

# ----------------------------------------------------------------------------
# Step 0 — preflight
# ----------------------------------------------------------------------------
require_root

log "Asset dir: ${HEADSCALE_ASSET_DIR}"
[[ -f "${HEADSCALE_ASSET_DIR}/config.yaml"     ]] || die "Missing ${HEADSCALE_ASSET_DIR}/config.yaml"
[[ -f "${HEADSCALE_ASSET_DIR}/headscale.service" ]] || die "Missing ${HEADSCALE_ASSET_DIR}/headscale.service"
[[ -f "${HEADSCALE_ASSET_DIR}/nginx-mesh.conf"  ]] || die "Missing ${HEADSCALE_ASSET_DIR}/nginx-mesh.conf"

require_cmd curl curl
require_cmd jq jq
require_cmd nginx nginx
require_cmd systemctl systemd
require_cmd certbot "certbot python3-certbot-nginx"

# ----------------------------------------------------------------------------
# Step 1 — system user + directories
# ----------------------------------------------------------------------------
if id -u "${HEADSCALE_USER}" >/dev/null 2>&1; then
  log "User ${HEADSCALE_USER} already exists — skipping useradd"
else
  log "Creating system user ${HEADSCALE_USER}"
  useradd --system --home-dir "${HEADSCALE_HOME}" --shell /usr/sbin/nologin \
          --user-group "${HEADSCALE_USER}"
fi

log "Ensuring directories: ${HEADSCALE_HOME}, ${HEADSCALE_ETC}"
install -d -o "${HEADSCALE_USER}" -g "${HEADSCALE_GROUP}" -m 0750 "${HEADSCALE_HOME}"
install -d -o root              -g "${HEADSCALE_GROUP}" -m 0750 "${HEADSCALE_ETC}"

# ----------------------------------------------------------------------------
# Step 2 — download + install Headscale binary
# ----------------------------------------------------------------------------
# WHY: cache the last successfully resolved release tag so GitHub API outages /
# rate-limits don't break re-installs. No TTL — only refreshed on a clean 200.
LATEST_TAG=""
GH_API_URL="https://api.github.com/repos/juanfont/headscale/releases/latest"
GH_TMP="$(mktemp)"
GH_HTTP_CODE="$(curl -sSL -o "${GH_TMP}" -w '%{http_code}' "${GH_API_URL}" || echo 000)"
if [[ "${GH_HTTP_CODE}" == "200" ]]; then
  LATEST_TAG="$(jq -r '.tag_name' < "${GH_TMP}" 2>/dev/null || true)"
fi
rm -f "${GH_TMP}"

if [[ -n "${LATEST_TAG}" && "${LATEST_TAG}" != "null" ]]; then
  # Refresh cache only on a clean resolve.
  install -d -o "${HEADSCALE_USER}" -g "${HEADSCALE_GROUP}" -m 0750 "${HEADSCALE_HOME}"
  printf '%s\n' "${LATEST_TAG}" > "${LAST_VERSION_FILE}"
else
  if [[ -s "${LAST_VERSION_FILE}" ]]; then
    LATEST_TAG="$(head -n1 "${LAST_VERSION_FILE}")"
    warn "GitHub API returned ${GH_HTTP_CODE}; using cached release tag ${LATEST_TAG} from ${LAST_VERSION_FILE}"
  else
    die "Could not resolve latest Headscale release tag (HTTP ${GH_HTTP_CODE}) and no cached value at ${LAST_VERSION_FILE}"
  fi
fi
LATEST_VER="${LATEST_TAG#v}"
log "Latest Headscale release: ${LATEST_TAG}"

CURRENT_VER=""
if [[ -x "${HEADSCALE_BIN}" ]]; then
  CURRENT_VER="$(${HEADSCALE_BIN} version 2>/dev/null | head -n1 | awk '{print $1}' || true)"
fi

if [[ "${CURRENT_VER}" == "${LATEST_VER}" || "${CURRENT_VER}" == "${LATEST_TAG}" ]]; then
  log "Headscale ${CURRENT_VER} already installed — skipping download"
else
  ARCH="$(dpkg --print-architecture 2>/dev/null || echo amd64)"
  DEB_URL="https://github.com/juanfont/headscale/releases/download/${LATEST_TAG}/headscale_${LATEST_VER}_linux_${ARCH}.deb"
  TMP_DEB="$(mktemp --suffix=.deb)"
  trap 'rm -f "${TMP_DEB}"' EXIT

  log "Downloading ${DEB_URL}"
  if curl -fsSL -o "${TMP_DEB}" "${DEB_URL}"; then
    log "Installing .deb via dpkg"
    dpkg -i "${TMP_DEB}" || { apt-get install -f -y && dpkg -i "${TMP_DEB}"; }
    # If the .deb shipped its own unit / config, we'll overwrite them below.
  else
    warn ".deb not found — falling back to tarball binary"
    BIN_URL="https://github.com/juanfont/headscale/releases/download/${LATEST_TAG}/headscale_${LATEST_VER}_linux_${ARCH}"
    curl -fsSL -o "${HEADSCALE_BIN}.new" "${BIN_URL}"
    chmod +x "${HEADSCALE_BIN}.new"
    mv "${HEADSCALE_BIN}.new" "${HEADSCALE_BIN}"
  fi
fi

# ----------------------------------------------------------------------------
# Step 3 — install config.yaml (backup existing)
# ----------------------------------------------------------------------------
TARGET_CONFIG="${HEADSCALE_ETC}/config.yaml"
if [[ -f "${TARGET_CONFIG}" ]] && ! cmp -s "${HEADSCALE_ASSET_DIR}/config.yaml" "${TARGET_CONFIG}"; then
  BACKUP="${TARGET_CONFIG}.bak.$(date +%Y%m%d-%H%M%S)"
  log "Backing up existing config to ${BACKUP}"
  cp -a "${TARGET_CONFIG}" "${BACKUP}"
fi
log "Writing ${TARGET_CONFIG}"
install -o root -g "${HEADSCALE_GROUP}" -m 0640 "${HEADSCALE_ASSET_DIR}/config.yaml" "${TARGET_CONFIG}"

# ----------------------------------------------------------------------------
# Step 4 — systemd unit
# ----------------------------------------------------------------------------
if [[ -f "${SYSTEMD_UNIT}" ]] && ! cmp -s "${HEADSCALE_ASSET_DIR}/headscale.service" "${SYSTEMD_UNIT}"; then
  BACKUP="${SYSTEMD_UNIT}.bak.$(date +%Y%m%d-%H%M%S)"
  log "Backing up existing systemd unit to ${BACKUP}"
  cp -a "${SYSTEMD_UNIT}" "${BACKUP}"
fi
log "Installing systemd unit"
install -o root -g root -m 0644 "${HEADSCALE_ASSET_DIR}/headscale.service" "${SYSTEMD_UNIT}"
systemctl daemon-reload

# ----------------------------------------------------------------------------
# Step 5 — nginx vhost
# ----------------------------------------------------------------------------
if [[ -f "${NGINX_AVAIL}" ]] && ! cmp -s "${HEADSCALE_ASSET_DIR}/nginx-mesh.conf" "${NGINX_AVAIL}"; then
  BACKUP="${NGINX_AVAIL}.bak.$(date +%Y%m%d-%H%M%S)"
  log "Backing up existing nginx vhost to ${BACKUP}"
  cp -a "${NGINX_AVAIL}" "${BACKUP}"
fi
log "Writing ${NGINX_AVAIL}"
install -o root -g root -m 0644 "${HEADSCALE_ASSET_DIR}/nginx-mesh.conf" "${NGINX_AVAIL}"

if [[ ! -L "${NGINX_ENABLED}" ]]; then
  log "Enabling nginx site"
  ln -sf "${NGINX_AVAIL}" "${NGINX_ENABLED}"
fi

# ACME webroot for renewals
install -d -o root -g root -m 0755 /var/www/html

log "Validating nginx config"
nginx -t
log "Reloading nginx"
systemctl reload nginx

# ----------------------------------------------------------------------------
# Step 6 — TLS via certbot (idempotent)
# ----------------------------------------------------------------------------
CERT_PATH="/etc/letsencrypt/live/${HOSTNAME_FQDN}/fullchain.pem"
NEEDS_CERT=1
if [[ -f "${CERT_PATH}" ]]; then
  # Refuse to reissue if cert is valid for > 7 days
  if openssl x509 -checkend $((7*86400)) -noout -in "${CERT_PATH}" >/dev/null 2>&1; then
    log "Existing cert at ${CERT_PATH} is valid >7d — skipping certbot"
    NEEDS_CERT=0
  fi
fi

if [[ "${NEEDS_CERT}" -eq 1 ]]; then
  log "Requesting cert from Let's Encrypt for ${HOSTNAME_FQDN}"
  certbot --nginx \
          -d "${HOSTNAME_FQDN}" \
          --non-interactive \
          --agree-tos \
          --redirect \
          -m "${LE_EMAIL}"
fi

# ----------------------------------------------------------------------------
# Step 7 — enable + (conditionally) restart headscale
# ----------------------------------------------------------------------------
# WHY: avoid pointless restarts on no-op re-runs. Compute a checksum over the
# three files whose change should cause a restart (binary + config + unit) and
# only restart when it differs from the last successful install. First runs
# (no sentinel) always restart.
compute_install_checksum() {
  sha256sum "${HEADSCALE_BIN}" "${TARGET_CONFIG}" "${SYSTEMD_UNIT}" 2>/dev/null \
    | sha256sum | awk '{print $1}'
}

log "Enabling headscale.service"
systemctl enable headscale >/dev/null

NEW_CHECKSUM="$(compute_install_checksum)"
OLD_CHECKSUM=""
if [[ -s "${INSTALL_CHECKSUM_FILE}" ]]; then
  OLD_CHECKSUM="$(head -n1 "${INSTALL_CHECKSUM_FILE}")"
fi

if [[ -z "${OLD_CHECKSUM}" ]]; then
  log "No prior install sentinel — restarting headscale (first install)"
  systemctl restart headscale
  printf '%s\n' "${NEW_CHECKSUM}" > "${INSTALL_CHECKSUM_FILE}"
elif [[ "${OLD_CHECKSUM}" != "${NEW_CHECKSUM}" ]]; then
  log "Install artifacts changed (checksum drift) — restarting headscale"
  systemctl restart headscale
  printf '%s\n' "${NEW_CHECKSUM}" > "${INSTALL_CHECKSUM_FILE}"
else
  log "No change in binary/config/unit — skipping restart"
  # Ensure service is at least running (e.g. after a manual stop).
  systemctl is-active --quiet headscale || { log "headscale not active — starting"; systemctl start headscale; }
fi

# ----------------------------------------------------------------------------
# Step 8 — health check
# ----------------------------------------------------------------------------
log "Waiting 5s for headscale to come up…"
sleep 5

HEALTH_URL="https://${HOSTNAME_FQDN}/health"
HTTP_CODE="$(curl -s -o /tmp/headscale-health.$$ -w '%{http_code}' "${HEALTH_URL}" || echo 000)"
if [[ "${HTTP_CODE}" != "200" ]]; then
  warn "Health check failed: GET ${HEALTH_URL} returned ${HTTP_CODE}"
  warn "Body:"
  cat /tmp/headscale-health.$$ >&2 || true
  rm -f /tmp/headscale-health.$$
  warn "Recent journal:"
  journalctl -u headscale --no-pager -n 50 >&2 || true
  die "Headscale did not come up healthy"
fi
rm -f /tmp/headscale-health.$$
log "Health check OK (200)"

# ----------------------------------------------------------------------------
# Step 9 — bootstrap users
# ----------------------------------------------------------------------------
existing_users() {
  "${HEADSCALE_BIN}" users list --output json 2>/dev/null | jq -r '.[].name' 2>/dev/null || true
}

# WHY: resolve initial users from (1) INITIAL_USERS env (space-separated
# string) if set, else (2) the sibling initial-users.txt file (one user per
# line, blank lines / `#` comments ignored). This is robust to either shape
# of mesh-vpn-config.json (pre- or post-canonicality fix) — the file form
# avoids depending on the JSON's evolving schema.
_initial_users_raw="${INITIAL_USERS:-}"
INITIAL_USERS_ARR=()
if [[ -n "${_initial_users_raw}" ]]; then
  # shellcheck disable=SC2206
  INITIAL_USERS_ARR=(${_initial_users_raw})
elif [[ -f "${INITIAL_USERS_FILE}" ]]; then
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%%#*}"                 # strip comments
    line="${line//[[:space:]]/}"       # strip whitespace
    [[ -z "${line}" ]] && continue
    INITIAL_USERS_ARR+=("${line}")
  done < "${INITIAL_USERS_FILE}"
fi

if [[ "${#INITIAL_USERS_ARR[@]}" -eq 0 ]]; then
  die "No initial users configured: set INITIAL_USERS env (space-separated) or create ${INITIAL_USERS_FILE} (one user per line)"
fi

CURRENT_USERS="$(existing_users)"
for u in "${INITIAL_USERS_ARR[@]}"; do
  if printf '%s\n' "${CURRENT_USERS}" | grep -qx "${u}"; then
    log "User '${u}' already exists — skipping"
  else
    log "Creating user '${u}'"
    "${HEADSCALE_BIN}" users create "${u}"
  fi
done

# ----------------------------------------------------------------------------
# Done
# ----------------------------------------------------------------------------
cat <<EOF

============================================================
 Headscale is up at https://${HOSTNAME_FQDN}
============================================================
 Binary       : ${HEADSCALE_BIN} ($(${HEADSCALE_BIN} version 2>/dev/null | head -n1))
 Config       : ${TARGET_CONFIG}
 State dir    : ${HEADSCALE_HOME}
 Systemd unit : ${SYSTEMD_UNIT}
 nginx vhost  : ${NGINX_AVAIL}
 Users        : $(existing_users | tr '\n' ' ')

 Next steps:
   # Generate a preauth key for the first node (24h, reusable):
   sudo headscale preauthkeys create --user gio --expiration 24h --reusable

   # Then on the peer node:
   tailscale up --login-server=https://${HOSTNAME_FQDN} --authkey=<key>

   # List nodes:
   sudo headscale nodes list
============================================================
EOF
