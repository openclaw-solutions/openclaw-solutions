# SEO Analyzer — MCP Server

An MCP server for analyzing web page SEO metadata. Designed for AI agents.

## Tools

| Tool | Price | Description |
|------|-------|-------------|
| `analyze_url` | $0.01 | Full SEO analysis of any URL |
| `keyword_suggest` | Free | Generate related keywords |
| `compare_urls` | $0.02 | Side-by-side SEO comparison |

## Payment

This server uses the x402 protocol via FluxA/Base USDC.

**Payment Link:** https://walletapi.fluxapay.xyz/paymentlink/pl_kCSL90NXYrV5xrUERjgUSFS_

## Local Development

```bash
cd projects/mcp-servers/seo-analyzer
node index.js              # stdio transport (for Claude Desktop)
node http-server.js        # HTTP + SSE transport
npx localtunnel --port 3456   # Public tunnel
```

## MPP/mpp.dev Listing

Well-known endpoint: `/.well-known/mpp`
SSE endpoint: `/sse`

## Status

- ✅ 3 working tools (analyze_url, keyword_suggest, compare_urls)
- ✅ HTTP + SSE transport
- ✅ Payment link active (USDC on Base)
- ⏳ x402 protocol integration (client-side)
⏳ mpp.dev listing
⏳ VPS deployment
