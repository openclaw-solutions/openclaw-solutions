#!/usr/bin/env bash
FILE="/opt/agent-mesh/messages.log"
AUTH="/opt/agent-mesh/auth.env"
MAX=4096
IP="${SOCAT_PEERADDR:-}"
NEED_AUTH=false
# Localhost detection: empty, 127.0.0.1, ::1, or any IPv6 address ending with localhost
if [ -z "$IP" ] || [ "$IP" = "127.0.0.1" ] || [ "$IP" = "::1" ]; then
    NEED_AUTH=false
elif echo "$IP" | grep -qi "127.0.0.1\|7f00:0001\|localhost" 2>/dev/null; then
    NEED_AUTH=false
else
    NEED_AUTH=true
fi
read -r line || true
line="${line%%[[:space:]]}"
if $NEED_AUTH; then
    TOK=$(grep MESH_TOKEN "$AUTH" 2>/dev/null | cut -d= -f2)
    if [ "$line" != "AUTH:$TOK" ]; then echo "ERROR: auth"; exit 1; fi
    read -r line || true
    line="${line%%[[:space:]]}"
fi
[ -z "$line" ] && exit 0
[ ${#line} -gt $MAX ] && { echo "ERROR: too big"; exit 1; }
line=$(echo "$line" | tr -cd '[:print:]\t ')
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "$TS [$IP] $line" >> "$FILE"
tail -5 "$FILE" 2>/dev/null || true
