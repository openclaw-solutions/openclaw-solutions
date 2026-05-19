#!/usr/bin/env bash
FILE="/opt/agent-mesh/messages.log"
AUTH="/opt/agent-mesh/auth.env"
RELAY_DB="/opt/agent-mesh/relay-registry.json"
AGENT_CARD="/opt/agent-mesh/agent-card.json"
MAX=8192
IP="${SOCAT_PEERADDR:-}"

NEED_AUTH=false
if [ -z "$IP" ] || [ "$IP" = "127.0.0.1" ] || [ "$IP" = "::1" ]; then
    NEED_AUTH=false
elif echo "$IP" 2>/dev/null | grep -qi "127.0.0.1\|7f00:0001\|localhost"; then
    NEED_AUTH=false
else
    NEED_AUTH=true
fi

read -r line 2>/dev/null || true
[ -z "$line" ] && exit 0
line="${line%%[[:space:]]}"

if [ "$NEED_AUTH" = true ]; then
    TOK=$(grep MESH_TOKEN "$AUTH" 2>/dev/null | cut -d= -f2)
    if [ "$line" != "AUTH:$TOK" ]; then
        echo '{"jsonrpc":"2.0","error":{"code":-32001,"message":"auth required"},"id":null}'
        exit 1
    fi
    read -r line 2>/dev/null || true
    [ -z "$line" ] && exit 0
    line="${line%%[[:space:]]}"
fi

[ ${#line} -gt $MAX ] && { echo '{"jsonrpc":"2.0","error":{"code":-32002,"message":"too large"},"id":null}'; exit 1; }

# Check JSON-RPC
IS_JSON=false
echo "$line" | grep -q '^{"jsonrpc"' 2>/dev/null && IS_JSON=true

if [ "$IS_JSON" = true ]; then
    METHOD=$(echo "$line" | grep -o '"method":"[^"]*"' 2>/dev/null | head -1 | cut -d'"' -f4)
    MSG_ID=$(echo "$line" | grep -o '"id":[0-9]*' 2>/dev/null | head -1 | cut -d: -f2)
    PARAMS=$(echo "$line" | grep -o '"params":{[^}]*}' 2>/dev/null | head -1)
    [ -z "$MSG_ID" ] && MSG_ID=null
    [ -z "$METHOD" ] && METHOD="unknown"

    case "$METHOD" in
        ping)
            echo "{\"jsonrpc\":\"2.0\",\"result\":{\"status\":\"ok\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"},\"id\":$MSG_ID}"
            ;;
        message)
            TO=$(echo "$PARAMS" | grep -o '"to":"[^"]*"' 2>/dev/null | cut -d'"' -f4)
            TEXT=$(echo "$PARAMS" | grep -o '"text":"[^"]*"' 2>/dev/null | cut -d'"' -f4)
            [ -z "$TEXT" ] && TEXT="(empty)"
            TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
            echo "$TS [$IP] [json-rpc] to:$TO msg:$TEXT" >> "$FILE"
            echo "{\"jsonrpc\":\"2.0\",\"result\":{\"delivered\":true,\"ts\":\"$TS\"},\"id\":$MSG_ID}"
            ;;
        advertise)
            TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
            echo "$TS [$IP] [advertise] $PARAMS" >> "$FILE"
            echo "{\"jsonrpc\":\"2.0\",\"result\":{\"registered\":true},\"id\":$MSG_ID}"
            ;;
        discover)
            if [ -f "$RELAY_DB" ]; then
                cat "$RELAY_DB"
            else
                echo "{\"jsonrpc\":\"2.0\",\"result\":{\"agents\":[],\"relays\":[]},\"id\":$MSG_ID}"
            fi
            ;;
        card)
            if [ -f "$AGENT_CARD" ]; then
                CARD=$(cat "$AGENT_CARD")
                echo "{\"jsonrpc\":\"2.0\",\"result\":{\"card\":$CARD},\"id\":$MSG_ID}"
            else
                echo "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32004,\"message\":\"no card\"},\"id\":$MSG_ID}"
            fi
            ;;
        *)
            echo "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32601,\"message\":\"unknown method: $METHOD\"},\"id\":$MSG_ID}"
            ;;
    esac
else
    # Raw text (backward compatible)
    TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "$TS [$IP] $line" >> "$FILE"
    tail -5 "$FILE" 2>/dev/null || true
fi
