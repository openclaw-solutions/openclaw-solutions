# Bitcoin Cycle Workbench

A lightweight, static-hostable Bitcoin on-chain metrics and cycle posture dashboard. Built for educational use — not financial advice.

## Preview

Premium dark-themed dashboard featuring:

- **BTC price candlestick chart** (TradingView Lightweight Charts)
- **Price + MA line chart** and **volume profile** sub-charts
- **On-chain metric cards**: Puell Multiple, MVRV Z-Score, Realized Price, Exchange Reserve, LTH/STH Ratio, Pi Cycle Top
- **Educational cycle posture panel**: Accumulation / Neutral / Overheated / Risk-Off
- **Signal dashboard** with individual indicator statuses
- **Latest insights** from Checkmate, What Bitcoin Did, and Ben Cowen

## Files

```
bitcoin-cycle-workbench/
├── index.html            # Main application shell
├── css/
│   └── styles.css        # Premium dark theme
├── js/
│   └── app.js            # Core application logic
├── data/
│   └── test-data.json    # Sample OHLCV + on-chain metrics
└── README.md             # This file
```

## How to View

**You cannot open index.html directly (file://).** Modern browsers block `fetch()` calls to local files. Use a local HTTP server:

### Python 3
```bash
cd projects/bitcoin-cycle-workbench
python3 -m http.server 8080
# → http://localhost:8080
```

### Node.js
```bash
npx serve projects/bitcoin-cycle-workbench
```

### PHP
```bash
php -S localhost:8080 -t projects/bitcoin-cycle-workbench
```

## Data Sources

All data in `test-data.json` is **simulated realistic test data**. This prototype uses:

| Metric | Source Classification |
|---|---|
| BTC price / OHLCV | Exchange-derived (node-verifiable via price feed) |
| Puell Multiple | Node-derived (block reward + 365d MA) |
| Pi Cycle Top | Node-derived (price MAs only) |
| MVRV Z-Score | Vendor-derived (UTXO database required) |
| Realized Price | Vendor-derived (UTXO age database) |
| Exchange Reserve | Vendor-derived (exchange wallet labeling) |
| LTH/STH Ratio | Vendor-derived (UTXO age bands) |

Future versions can compute node-verifiable metrics directly from a local Bitcoin Core RPC.

## Cycle Posture Framework

The cycle posture panel uses educational labels — **not** buy/sell signals:

| Signal | Meaning |
|---|---|
| 🟢 Accumulation | Historically favorable valuations, low sentiment |
| 🔵 Neutral | Balanced conditions, no extreme signals |
| 🟡 Overheated | Elevated risk markers, late-cycle dynamics |
| 🔴 Risk-Off | Extreme valuations / liquidity stress |

Traffic-light model: valuation, liquidity, credit stress, and sentiment are assessed independently.

## Deployment

### Grace VPS (recommended)

1. Clone to Grace VPS: `/opt/openclaw/workspace/projects/bitcoin-cycle-workbench/`
2. Serve via Caddy (existing reverse proxy) under a private subdomain or path:
   ```caddy
   btc.lombardo.life {
       root * /opt/openclaw/workspace/projects/bitcoin-cycle-workbench
       file_server
       # Add basicauth before public exposure
   }
   ```
3. Add `basicauth` before any public exposure.
4. Plan: replace test data with real API calls (see below).

### Real Data Integration Path

1. Add CoinGecko/Kraken API calls for daily OHLCV
2. Compute Puell Multiple and Pi Cycle Top from price data alone (node-verifiable)
3. Add Bitcoin Core RPC calls for block height, mempool stats, fee estimates
4. Integrate FRED API for macro overlays (yields, liquidity, credit stress)
5. Add vendor APIs (Glassnode/CryptoQuant) for UTXO-derived metrics, always labeled by source

## Dependencies (CDN, no npm install)

- **TradingView Lightweight Charts** — candlestick charting library
- **Chart.js** — mini sparklines for metric card trends

Both loaded via CDN in `index.html`.

## Backend Server

A lightweight Node.js backend is available in `server/index.js`. It uses **no npm dependencies** — built-in `http` module only.

### Files

```
bitcoin-cycle-workbench/
├── server/
│   └── index.js            # HTTP server + cache system + API
├── scripts/
│   └── refresh-cache.js    # Standalone cache refresh script
├── data/
│   └── cache/              # Auto-created; stores cached API responses with TTL
│       ├── market.json
│       ├── chart.json
│       ├── onchain.json
│       └── workbench.json
```

### Usage

```bash
# Start the server (serves static frontend + API)
node server/index.js
# → http://localhost:3322

# Refresh cache once, then exit
node server/index.js --refresh

# Refresh cache, then start server
node server/index.js --serve

# Help
node server/index.js --help
```

### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/` | API index with endpoint list |
| `GET /api/health` | Health check + cache status |
| `GET /api/market/btc` | Cached BTC price & market cap |
| `GET /api/chart/btc?days=30` | Cached OHLC chart data (max 90 days) |
| `GET /api/onchain/summary` | Mempool fees, block height, mempool stats |
| `GET /api/workbench` | Combined object — directly consumed by frontend |

### Data Sources (No API Keys Required)

| Source | Data | Reliability |
|---|---|---|
| [CoinGecko](https://www.coingecko.com/en/api) | BTC price, OHLC chart data | Primary, mostly reliable |
| [DIA](https://www.diadata.org/) | BTC price quote | Fallback if CoinGecko fails |
| [mempool.space](https://mempool.space/api) | Fees, block height, mempool stats | Highly reliable |
| `data/test-data.json` | Full on-chain metrics + cycle posture | Fallback when all APIs unreachable |

All fetches have timeouts (8s) and graceful degradation — the server never crashes on API failure.

### Cache System

- Cache files written to `data/cache/*.json` with `_cachedAt` and `_ttl` metadata
- TTLs: market/chart = 5 min, onchain = 10 min, mempool = 2 min
- Server auto-refreshes cache every 10 minutes via `setInterval`
- Manual refresh: `node server/index.js --refresh`
- Cron/systemd timer: `node scripts/refresh-cache.js`

### Security

- **No secrets, no API keys** — uses public endpoints only
- No Bitcoin Core RPC exposed (commented placeholder only)
- Static file serving is path-traversal protected
- CORS headers allow same-origin requests from the frontend
- `Access-Control-Allow-Origin: *` for development flexibility

### Bitcoin Core RPC Integration (Future)

The server includes a commented placeholder for local-only Bitcoin Core RPC integration:

```js
// Enable by setting these env vars and toggling _node_only.enabled
// BTC_RPC_URL=http://127.0.0.1:8332
// BTC_RPC_USER=rpcuser
// BTC_RPC_PASS=rpcpassword
```

RPC is **off by default** and NEVER exposed via API when enabled — only used for cache computation server-side.

### Grace VPS Deployment

#### Option A: Direct serve (simple)

```bash
# On Grace VPS
cd /opt/openclaw/workspace/projects/bitcoin-cycle-workbench
node server/index.js --serve &
```

#### Option B: systemd service

```ini
# /etc/systemd/system/btc-cycle-workbench.service
[Unit]
Description=Bitcoin Cycle Workbench Server
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/openclaw/workspace/projects/bitcoin-cycle-workbench
ExecStart=/usr/bin/node /opt/openclaw/workspace/projects/bitcoin-cycle-workbench/server/index.js
Restart=on-failure
RestartSec=10
Environment=BCW_PORT=3322

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now btc-cycle-workbench.service
```

#### Option C: systemd timer for cache refresh (if reverse-proxying static files separately)

```ini
# /etc/systemd/system/btc-cycle-cache-refresh.service
[Unit]
Description=Bitcoin Cycle Workbench Cache Refresh

[Service]
Type=oneshot
User=openclaw
WorkingDirectory=/opt/openclaw/workspace/projects/bitcoin-cycle-workbench
ExecStart=/usr/bin/node /opt/openclaw/workspace/projects/bitcoin-cycle-workbench/scripts/refresh-cache.js
```

```ini
# /etc/systemd/system/btc-cycle-cache-refresh.timer
[Unit]
Description=Refresh BTC Cycle Workbench cache every 10 minutes

[Timer]
OnCalendar=*:0/10
Persistent=true

[Install]
WantedBy=timers.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now btc-cycle-cache-refresh.timer
```

#### Reverse proxy (Caddy)

```caddy
btc.lombardo.life {
    reverse_proxy localhost:3322
}
```

Or with basic auth until ready:
```caddy
btc.lombardo.life {
    basicauth {
        user $2a$...hashed-password...
    }
    reverse_proxy localhost:3322
}
```

### Frontend API Detection

The frontend (`js/app.js`) automatically detects whether the backend is available:

1. **Backend mode** (port 3322): Fetches `/api/workbench` for live cached data
2. **Static mode** (any other port, or CDN-served): Falls back to `data/test-data.json`

The "📡" badge in the header updates to show "Live Data" when the API is active.

## License

Educational use. Not financial advice.
