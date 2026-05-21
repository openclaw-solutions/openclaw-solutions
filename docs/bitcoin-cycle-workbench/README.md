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

## License

Educational use. Not financial advice.
