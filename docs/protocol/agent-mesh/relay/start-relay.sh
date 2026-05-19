#!/usr/bin/env bash
set -euo pipefail
PORT=${AGENT_MESH_PORT:-3322}
exec socat TCP-LISTEN:$PORT,reuseaddr,fork,keepalive,so-keepalive EXEC:/opt/agent-mesh/message-handler.sh
