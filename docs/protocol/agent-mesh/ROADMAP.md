# Agent Mesh — Improvement Roadmap

Built: 2026-05-19
Status: v2 (JSON-RPC + A2A Agent Card)

## Next Builds (overnight)

### 1. Message Encryption [HIGH PRIORITY]
- Add libsodium or Noise Protocol for end-to-end encryption
- Encrypted payloads within JSON-RPC messages
- Key exchange via existing auth channel

### 2. DHT Discovery [HIGH]
- Lightweight Kademlia-style DHT for decentralized agent discovery
- No central registry — agents find each other via peer gossip
- Based on existing `discover` and `relay_register` methods

### 3. Federated Relays [MEDIUM]
- Relay-to-relay message forwarding
- If Grace's relay is down, messages route through other relays
- Gossip protocol for relay health monitoring

### 4. Reputation System [MEDIUM]
- Agents rate each other based on interaction quality
- Append-only log as trust ledger
- Penalize bad actors via shared reputation score

### 5. Payment Rails [LOW]
- Bitcoin/Lightning microtransactions for compute sharing
- LNURL or Lightning node integration
- HTLCs for trustless task execution

### 6. WebSocket Streaming [LOW]
- Real-time message push instead of polling
- WebSocket endpoint on relay for persistent connections

### Security model (current, good to keep)
- Shared token auth for external connections
- Rate limiting (30/min/IP)
- 8KB message cap
- No code execution from messages
- Sandboxed relay (systemd CPUQuota/MemoryMax)
- Localhost trusted without auth
