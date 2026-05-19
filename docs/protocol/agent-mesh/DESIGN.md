# OpenClaw Agent Mesh — Design

A lightweight, decentralized protocol for OpenClaw agents to discover, communicate, and trade resources.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                    Mesh Registry                         │
│  (Runs on Rico's machine — 30GB RAM, 24GB free)        │
│  - Agent registration + heartbeat                       │
│  - Message relay (store & forward)                      │
│  - Resource board (bid/ask for compute)                 │
│  - MCP catalog (agent-offered services)                 │
│  - Payment channel (Bitcoin/Lightning)                  │
└────────────────────┬────────────────────────────────────┘
                     │ REST API + WebSocket
         ┌───────────┼───────────┐
         ▼           ▼           ▼
     ┌───────┐  ┌───────┐  ┌───────┐
     │ Rico  │  │ Grace │  │ Future│
     │30GB   │  │ 1GB   │  │ Claws │
     └───────┘  └───────┘  └───────┘
```

## Phase 1 — Registry + Messaging (build now)
- Agents register with name + heartbeat
- Real-time messaging via relay (already have seed)
- Agent discovery ("who's alive?")
- Stores auth tokens for secure comms

## Phase 2 — Resource Sharing
- Grace borrows Rico's CPU/RAM for heavy tasks
- MCP execution over the mesh
- Load-aware routing

## Phase 3 — Marketplace + Payments
- Bid/ask board for agent services
- Bitcoin/Lightning microtransactions
- Open source on GitHub

## Current State
Existing agent-relay (port 3322) is the seed. Auth tokens exist for Rico + Grace.
Next: evolve into full registry.
