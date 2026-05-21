#!/usr/bin/env bash
# Bitcoin Cycle Workbench — Grace VPS Deployment Setup
#
# Automated setup for deploying the backend server on Grace VPS.
# Creates the system user, copies systemd files, and enables services.
#
# Usage:
#   sudo bash deploy/setup.sh              # full setup
#   sudo bash deploy/setup.sh --dry-run    # print what would be done
#
# Requires:
#   - Project already cloned to /opt/openclaw/workspace/projects/bitcoin-cycle-workbench
#   - node.js installed
#   - sudo access

set -euo pipefail

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=true
    echo "[bcw-deploy] DRY RUN — commands will be printed, not executed"
fi

PROJECT_ROOT="/opt/openclaw/workspace/projects/bitcoin-cycle-workbench"
SERVICE_USER="btc-cycle"
SERVICE_DIR="/etc/systemd/system"

run() {
    if [ "$DRY_RUN" = true ]; then
        echo "  >> $*"
    else
        echo "  >> $*"
        eval "$@"
    fi
}

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║ Bitcoin Cycle Workbench — VPS Setup       ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Create system user ──
echo "[1/5] Creating system user '${SERVICE_USER}'..."
if id "${SERVICE_USER}" &>/dev/null; then
    echo "  ✓ User '${SERVICE_USER}' already exists"
else
    run useradd -r -s /usr/sbin/nologin -m -d "/var/lib/${SERVICE_USER}" "${SERVICE_USER}"
    echo "  ✓ Created system user '${SERVICE_USER}'"
fi

# ── Step 2: Fix permissions ──
echo "[2/5] Setting project permissions..."
run chown -R "${SERVICE_USER}:${SERVICE_USER}" "${PROJECT_ROOT}"
run chmod 755 "${PROJECT_ROOT}"
run mkdir -p "${PROJECT_ROOT}/data/cache"
run chown "${SERVICE_USER}:${SERVICE_USER}" "${PROJECT_ROOT}/data/cache"
echo "  ✓ Permissions set"

# ── Step 3: Copy systemd units ──
echo "[3/5] Copying systemd unit files..."
for unit in btc-cycle-workbench.service; do
    run cp "${PROJECT_ROOT}/deploy/${unit}" "${SERVICE_DIR}/${unit}"
    run chmod 644 "${SERVICE_DIR}/${unit}"
    echo "  ✓ Installed ${unit}"
done
run systemctl daemon-reload
echo "  ✓ systemd reloaded"

# ── Step 4: Enable and start service ──
echo "[4/5] Enabling and starting service..."
run systemctl enable btc-cycle-workbench.service
run systemctl start btc-cycle-workbench.service
echo "  ✓ Service started"

# ── Step 5: Verify ──
echo "[5/5] Verifying service..."
sleep 2
if run systemctl is-active --quiet btc-cycle-workbench.service; then
    echo ""
    echo "  ✅ btc-cycle-workbench.service is ACTIVE"
    echo ""
    echo "  Check health:      curl -s http://127.0.0.1:3322/api/health"
    echo "  View logs:         sudo journalctl -u btc-cycle-workbench -f"
    echo "  Caddy config:      cp deploy/Caddyfile.route to /etc/caddy/conf.d/"
    echo ""
else
    echo "  ❌ Service failed to start!"
    echo "     Check: sudo journalctl -u btc-cycle-workbench --no-pager -n 50"
    exit 1
fi

# ── Optional: timer/cache refresh ──
echo ""
echo "  ── OPTIONAL ──"
echo "  If the server handles cache itself (default), you don't need the timer."
echo "  To install the timer (e.g. if using Caddy static-only mode):"
echo "    sudo cp ${PROJECT_ROOT}/deploy/cache-refresh.service ${SERVICE_DIR}/"
echo "    sudo cp ${PROJECT_ROOT}/deploy/cache-refresh.timer ${SERVICE_DIR}/"
echo "    sudo systemctl daemon-reload && sudo systemctl enable --now cache-refresh.timer"
echo ""
echo "  Setup complete. 🧠"
