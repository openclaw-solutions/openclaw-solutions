#!/usr/bin/env bash
# Agent Mesh v2.1 — jq-based, TLS-ready, hardened
FILE="/opt/agent-mesh/messages.log"
AUTH_FILE="/opt/agent-mesh/auth.env"
MAX=8192
IP="${SOCAT_PEERADDR:-}"
NEED_AUTH=false
if [ -z "$IP" ] || echo "$IP" | grep -qiE '(127\.0\.0\.1|^::1$|^::ffff:127\.|^\[::ffff:127\.|^\[?fe80|localhost)' 2>/dev/null; then
    NEED_AUTH=false
else
    NEED_AUTH=true
fi
read -r line 2>/dev/null || true
[ -z "$line" ] && exit 0
line="${line%%[[:space:]]}"
if [ "$NEED_AUTH" = true ]; then
    TOK=$(grep MESH_TOKEN "$AUTH_FILE" 2>/dev/null | cut -d= -f2)
    if [ "$line" != "AUTH:$TOK" ]; then
        echo '{"jsonrpc":"2.0","error":{"code":-32001,"message":"auth required"},"id":null}'
        exit 1
    fi
    read -r line 2>/dev/null || true
    [ -z "$line" ] && exit 0
    line="${line%%[[:space:]]}"
fi
[ ${#line} -gt $MAX ] && { echo '{"jsonrpc":"2.0","error":{"code":-32002,"message":"too large"},"id":null}'; exit 1; }
IS_JSON=false
echo "$line" | grep -q '^{"jsonrpc"' 2>/dev/null && IS_JSON=true
if [ "$IS_JSON" = true ]; then
    METHOD=$(echo "$line" | jq -r '.method // "unknown"' 2>/dev/null)
    MSG_ID=$(echo "$line" | jq -r '.id // null' 2>/dev/null)
    [ "$MSG_ID" = "null" ] && MSG_ID=null
    PARAMS=$(echo "$line" | jq -c '.params // {}' 2>/dev/null)
    case "$METHOD" in
        ping) echo "{\"jsonrpc\":\"2.0\",\"result\":{\"status\":\"ok\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"},\"id\":$MSG_ID}" ;;
        message)
            TO=$(echo "$PARAMS" | jq -r '.to // "all"' 2>/dev/null)
            TEXT=$(echo "$PARAMS" | jq -r '.text // ""' 2>/dev/null)
            TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
            SEQ=$(($(wc -l < "$FILE" 2>/dev/null || echo 0) + 1))
            echo "$TS [$IP] [msg:$SEQ] to:$TO msg:$TEXT" >> "$FILE"
            echo "{\"jsonrpc\":\"2.0\",\"result\":{\"delivered\":true,\"seq\":$SEQ,\"ts\":\"$TS\"},\"id\":$MSG_ID}" ;;
        advertise)
            TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
            CAPS=$(echo "$PARAMS" | jq -c '.capabilities // []' 2>/dev/null)
            echo "$TS [$IP] [advertise] $CAPS" >> "$FILE"
            echo "{\"jsonrpc\":\"2.0\",\"result\":{\"registered\":true},\"id\":$MSG_ID}" ;;
        discover) echo "{\"jsonrpc\":\"2.0\",\"result\":{\"agents\":[],\"relays\":[]},\"id\":$MSG_ID}" ;;
        card)
            if [ -f "/opt/agent-mesh/agent-card.json" ]; then
                CARD=$(cat /opt/agent-mesh/agent-card.json)
                echo "{\"jsonrpc\":\"2.0\",\"result\":{\"card\":$CARD},\"id\":$MSG_ID}"
            else
                echo "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32004,\"message\":\"no card\"},\"id\":$MSG_ID}"
            fi ;;
        *) echo "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32601,\"message\":\"unknown method: $METHOD\"},\"id\":$MSG_ID}" ;;
    esac
else
    TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    SEQ=$(($(wc -l < "$FILE" 2>/dev/null || echo 0) + 1))
    echo "$TS [$IP] [raw:$SEQ] $line" >> "$FILE"
    tail -5 "$FILE" 2>/dev/null || true
fi
