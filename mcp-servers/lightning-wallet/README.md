# ⚡ Lightning Wallet MCP Server

**MCP server that gives AI agents Lightning Network payment capabilities.** Create invoices, pay invoices, check balance — all via MCP tools.

## Tools

| Tool | Price | Description |
|------|-------|-------------|
| `create_invoice` | 100 sats | Create a Lightning invoice (bolt11) |
| `pay_invoice` | 50 sats | Pay a Lightning invoice |
| `get_balance` | Free | Check wallet balance |

## Setup

```bash
# Install
npm install

# Configure wallet (NWC connection string)
export NWC_CONNECTION_STRING="nostr+walletconnect://..."

# Run
node http-server.mjs
```

## Getting a Wallet

1. Create an account at [getalby.com](https://getalby.com)
2. Go to Wallet → Wallet Connections → Add Connection
3. Copy the NWC connection string
4. Set it as `NWC_CONNECTION_STRING`

## HTTP + SSE Transport

```
GET  /health      — Server status
GET  /tools       — Tool definitions
GET  /sse         — SSE endpoint for MCP clients
POST /messages/:id — Message endpoint
```

## Build

```bash
npm install
NWC_CONNECTION_STRING="nostr+walletconnect://..." PORT=3458 node http-server.mjs
```

## Listing

This server is designed to be listed on:
- Composio marketplace
- MPP/mpp.dev
- GitHub (mcp-server topic)
