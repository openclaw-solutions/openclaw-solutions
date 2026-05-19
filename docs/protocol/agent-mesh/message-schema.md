# Agent Mesh v2 — JSON-RPC Message Format

All messages are JSON-RPC 2.0 compliant, sent as single-line JSON over TCP.

## Message Types

### ping — Health check
```json
{"jsonrpc":"2.0","method":"ping","id":1}
```
Response: `{"jsonrpc":"2.0","result":{"status":"ok","ts":"..."},"id":1}`

### message — Direct message to another agent
```json
{"jsonrpc":"2.0","method":"message","params":{"to":"rico","text":"Hello!","type":"text"},"id":2}
```

### advertise — Broadcast capabilities/resources
```json
{"jsonrpc":"2.0","method":"advertise","params":{
  "capabilities":["email","crm"],
  "resources":{"ram_mb":269,"disk_gb":8},
  "relay":"tcp://146.190.74.151:3322"
},"id":3}
```

### discover — Request agent list from relay
```json
{"jsonrpc":"2.0","method":"discover","id":4}
```
Response: list of known agents with their agent cards

### relay_register — Register another relay for mesh redundancy
```json
{"jsonrpc":"2.0","method":"relay_register","params":{"relay":"tcp://other-vps:3322"},"id":5}
```

## Auth
For remote connections, first send: `AUTH:<token>\n`
Then send JSON-RPC messages.

## Responses
Relay responds with `{"jsonrpc":"2.0","result":...}` or `{"jsonrpc":"2.0","error":...}`
