#!/usr/bin/env bash
# Bitcoin Cycle Workbench — Health Check
#
# Lightweight shell script for monitoring the backend server.
# Returns 0 if healthy, non-zero if something is wrong.
#
# Usage:
#   ./deploy/healthcheck.sh                           # check local server on default port
#   ./deploy/healthcheck.sh 3322                      # check specific port
#   ./deploy/healthcheck.sh 3322 /opt/workspace/bcw   # check different root
#
# Integration:
#   systemd:   HealthCheck=/path/to/healthcheck.sh
#   cron:      * * * * * /path/to/healthcheck.sh

set -euo pipefail

PORT="${1:-3322}"
BCW_ROOT="${2:-/opt/openclaw/workspace/projects/bitcoin-cycle-workbench}"
URL="http://127.0.0.1:${PORT}/api/health"

# Colors for human-readable output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "[bcw-health] Checking ${URL} ..."

# 1. HTTP health endpoint
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${URL}" 2>/dev/null || true)
if [ "${STATUS}" != "200" ]; then
    echo -e "${RED}✗ FAIL${NC} — HTTP status ${STATUS} (expected 200)"
    exit 1
fi

# 2. Validate response body
BODY=$(curl -s --max-time 5 "${URL}" 2>/dev/null || true)
if echo "${BODY}" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('status') == 'ok', 'status not ok'; assert 'cache' in d, 'no cache field'" 2>/dev/null; then
    :
else
    echo -e "${RED}✗ FAIL${NC} — Health response body invalid"
    echo "  Response: ${BODY:0:200}"
    exit 1
fi

# 3. Check cache freshness — warn if all caches are stale but don't exit
STALE_COUNT=$(echo "${BODY}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
cache = d.get('cache', {})
stale = [k for k,v in cache.items() if v == 'stale/missing']
print(len(stale))
" 2>/dev/null || echo "0")

if [ "${STALE_COUNT}" -gt 0 ] && [ "${STALE_COUNT}" -gt 3 ]; then
    echo -e "${YELLOW}⚠ WARN${NC} — ${STALE_COUNT} cache entries stale"
    # Don't exit non-zero — server may have just started
fi

# 4. Check process is alive
PID=$(pgrep -f "node server/index.js" 2>/dev/null || true)
if [ -z "${PID}" ]; then
    echo -e "${YELLOW}⚠ WARN${NC} — No node process found (may be running under different user)"
else
    echo -e "${GREEN}✓ Process PID ${PID}${NC}"
fi

# 5. Spot-check workbench endpoint for valid JSON
WB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${PORT}/api/workbench" 2>/dev/null || true)
if [ "${WB_STATUS}" != "200" ]; then
    echo -e "${RED}✗ FAIL${NC} — /api/workbench returned ${WB_STATUS}"
    exit 1
fi

echo -e "${GREEN}✓ HEALTHY${NC} — All checks passed (port ${PORT})"
exit 0
