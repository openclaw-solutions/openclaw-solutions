#!/usr/bin/env node
/**
 * Bitcoin Cycle Workbench — Backend Server
 *
 * Lightweight Node.js backend (no Express, no npm install required).
 * Serves static frontend, cached API data, and periodic cache refresh.
 *
 * Modes:
 *   node server/index.js              → start HTTP server (port 3322)
 *   node server/index.js --refresh    → refresh cache once, then exit
 *   node server/index.js --serve      → refresh cache, then start server
 *   node server/index.js --help       → show usage
 *
 * Not financial advice. Educational purposes only.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Config ───
const PORT = parseInt(process.env.BCW_PORT || '3322', 10);
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'cache');
const TEST_DATA_PATH = path.join(ROOT, 'data', 'test-data.json');

const CACHE_TTL = {
  market: 5 * 60 * 1000,       // 5 min
  chart: 5 * 60 * 1000,        // 5 min
  onchain: 10 * 60 * 1000,     // 10 min
  workbench: 5 * 60 * 1000,    // 5 min
  mempool: 2 * 60 * 1000,      // 2 min
  hashrate: 10 * 60 * 1000,    // 10 min (mining stats change slowly)
  fee_pressure: 2 * 60 * 1000, // 2 min (derived, recomputed with mempool)
};

// ─── MIME Types ───
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
};

// ─── Cache Helpers ───
function cachePath(name) {
  return path.join(CACHE_DIR, `${name}.json`);
}

function readCache(name) {
  try {
    const raw = fs.readFileSync(cachePath(name), 'utf8');
    const data = JSON.parse(raw);
    if (data._cachedAt && (Date.now() - data._cachedAt < CACHE_TTL[name] || CACHE_TTL[name] === 0)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(name, payload) {
  const entry = { ...payload, _cachedAt: Date.now(), _ttl: CACHE_TTL[name] };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath(name), JSON.stringify(entry, null, 2));
  return entry;
}

function readTestData() {
  try {
    return JSON.parse(fs.readFileSync(TEST_DATA_PATH, 'utf8'));
  } catch (err) {
    console.error('[bcw] Failed to read test-data.json:', err.message);
    return null;
  }
}

// ─── Public API Fetchers ───
// All no-key public APIs with graceful fallback.

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCoinGeckoPrice() {
  try {
    const data = await fetchJson(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_change=true'
    );
    const btc = data.bitcoin;
    return {
      current: btc.usd,
      change_24h_pct: btc.usd_24h_change ?? null,
      market_cap: btc.usd_market_cap ?? null,
      source: 'CoinGecko (public, no-key)',
    };
  } catch (err) {
    console.warn('[bcw] CoinGecko price fetch failed:', err.message);
    return null;
  }
}

async function fetchCoinGeckoChart(days = 30) {
  try {
    const data = await fetchJson(
      `https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=${Math.min(days, 90)}`
    );
    if (!Array.isArray(data) || data.length === 0) throw new Error('Empty response');

    // CoinGecko returns sub-daily OHLC buckets for shorter ranges. TradingView
    // Lightweight Charts expects unique business-day timestamps when `time` is
    // YYYY-MM-DD, so aggregate to one candle per day for the current daily UI.
    const daily = new Map();
    for (const [ts, open, high, low, close] of data) {
      const time = new Date(ts).toISOString().slice(0, 10);
      const existing = daily.get(time);
      if (!existing) {
        daily.set(time, { time, open, high, low, close, volume: 0 });
      } else {
        existing.high = Math.max(existing.high, high);
        existing.low = Math.min(existing.low, low);
        existing.close = close;
      }
    }
    return [...daily.values()];
  } catch (err) {
    console.warn('[bcw] CoinGecko OHLC fetch failed:', err.message);
    return null;
  }
}

async function fetchMempoolFees() {
  try {
    const [fees, blockHeight] = await Promise.all([
      fetchJson('https://mempool.space/api/v1/fees/recommended'),
      fetchJson('https://mempool.space/api/blocks/tip/height'),
    ]);
    return {
      fees: {
        fastestFee: fees.fastestFee,
        halfHourFee: fees.halfHourFee,
        hourFee: fees.hourFee,
        minimumFee: fees.minimumFee,
      },
      block_height: blockHeight,
      source: 'mempool.space (public, no-key)',
    };
  } catch (err) {
    console.warn('[bcw] Mempool fetch failed:', err.message);
    return null;
  }
}

async function fetchMempoolMempool() {
  try {
    const data = await fetchJson('https://mempool.space/api/mempool');
    return {
      count: data.count,
      vsize: data.vsize,
      total_fee: data.total_fee,
      source: 'mempool.space (public, no-key)',
    };
  } catch (err) {
    console.warn('[bcw] Mempool stats fetch failed:', err.message);
    return null;
  }
}

async function fetchMempoolHashrate() {
  try {
    const data = await fetchJson('https://mempool.space/api/v1/mining/hashrate/24h');
    const currentHashPerSecond = data.currentHashrate;
    // Convert from H/s to EH/s (exahash = 10^18), PH/s for display
    const ehPerSecond = currentHashPerSecond / 1e18;
    const phPerSecond = currentHashPerSecond / 1e15;
    const difficulty = data.currentDifficulty;
    return {
      hashrate_hs: currentHashPerSecond,
      hashrate_eh_s: Math.round(ehPerSecond * 100) / 100,
      hashrate_ph_s: Math.round(phPerSecond * 100) / 100,
      difficulty: difficulty,
      source: 'mempool.space (public, no-key)',
    };
  } catch (err) {
    console.warn('[bcw] Hashrate fetch failed:', err.message);
    return null;
  }
}

/**
 * Compute derived fee-pressure metrics from raw mempool data.
 * All inputs are node-verifiable (mempool.space uses public node data).
 */
function computeDerivedMetrics(fees, mempool) {
  if (!fees || !mempool) {
    return { _note: 'Insufficient data to compute fee pressure', _computed: false };
  }

  const minFee = Math.max(fees.minimumFee, 1);
  const feePressureRatio = fees.fastestFee / minFee;
  const feePressureRatioHalf = fees.halfHourFee / minFee;

  // Estimated blocks to clear the current mempool backlog
  // Standard block capacity ~1M vbytes (4M weight units for segwit)
  const estimatedBlocksToClear = Math.ceil(mempool.vsize / 1_000_000);

  // Fee pressure label based on ratio and backlog
  let feePressureLabel;
  if (feePressureRatio < 2 && estimatedBlocksToClear < 5) {
    feePressureLabel = 'Low';
  } else if (feePressureRatio < 5 && estimatedBlocksToClear < 20) {
    feePressureLabel = 'Moderate';
  } else if (feePressureRatio < 15 && estimatedBlocksToClear < 50) {
    feePressureLabel = 'High';
  } else {
    feePressureLabel = 'Very High';
  }

  return {
    fee_pressure_ratio: Math.round(feePressureRatio * 100) / 100,
    fee_pressure_ratio_half: Math.round(feePressureRatioHalf * 100) / 100,
    estimated_blocks_to_clear: estimatedBlocksToClear,
    fee_pressure_label: feePressureLabel,
    _computed: true,
    _data_quality: {
      fee_pressure_ratio: 'Node-verifiable (computed from mempool fees)',
      estimated_blocks_to_clear: 'Node-verifiable (computed from mempool vsize)',
      fee_pressure_label: 'Node-verifiable (derived classification)',
    },
  };
}

// ─── DIA Quotes API ───
async function fetchDiaQuote() {
  try {
    // Note: symbol must be uppercase "BTC", not "bitcoin"
    const data = await fetchJson('https://api.diadata.org/v1/quotation/BTC');
    if (data && data.Price) {
      return {
        current: data.Price,
        change_24h_pct: data.PriceChange24h ?? null,
        market_cap: data.MarketCap ?? null,
        source: 'DIA (public, no-key)',
      };
    }
    return null;
  } catch (err) {
    console.warn('[bcw] DIA fetch failed:', err.message);
    return null;
  }
}

// ─── CryptoCompare OHLC + Volume ───
async function fetchCryptoCompareChart(days = 30) {
  try {
    const limit = Math.min(days, 90);
    const data = await fetchJson(
      `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=${limit}`
    );
    if (data.Response !== 'Success' || !Array.isArray(data.Data?.Data)) {
      throw new Error('CryptoCompare returned non-success response');
    }

    // CryptoCompare returns daily candles with volume. Timestamps are in seconds.
    return data.Data.Data.map(c => ({
      time: new Date(c.time * 1000).toISOString().slice(0, 10),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volumeto || 0,
    })).filter(c => c.open && c.high && c.low && c.close);
  } catch (err) {
    console.warn('[bcw] CryptoCompare OHLC fetch failed:', err.message);
    return null;
  }
}

// ─── CoinGecko Volume Data (from market_chart) ───
async function fetchCoinGeckoVolume(days = 30) {
  try {
    const data = await fetchJson(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${Math.min(days, 90)}`
    );
    if (!Array.isArray(data?.total_volumes)) {
      throw new Error('No volume data in response');
    }

    // Aggregate sub-daily volumes into daily totals
    const daily = {};
    for (const [ts, vol] of data.total_volumes) {
      const day = new Date(ts).toISOString().slice(0, 10);
      daily[day] = (daily[day] || 0) + vol;
    }
    return daily;
  } catch (err) {
    console.warn('[bcw] CoinGecko volume fetch failed:', err.message);
    return null;
  }
}

// ─── Refresh Cache ───
async function refreshCache() {
  console.log('[bcw] Refreshing cache...');
  const results = { market: null, chart: null, onchain: null, workbench: null };
  const testData = readTestData();

  // Try CoinGecko first, fall back to DIA, then test-data
  let priceData = await fetchCoinGeckoPrice();
  if (!priceData) {
    priceData = await fetchDiaQuote();
  }
  if (priceData) {
    results.market = writeCache('market', {
      bitcoin: {
        usd: priceData.current,
        usd_24h_change: priceData.change_24h_pct,
        usd_market_cap: priceData.market_cap,
      },
      _source: priceData.source,
    });
    console.log(`[bcw] ✓ Market data cached (BTC $${priceData.current})`);
  } else if (testData) {
    // Fall back to test data
    const btc = testData.btc_price;
    results.market = writeCache('market', {
      bitcoin: {
        usd: btc.current,
        usd_24h_change: btc.change_24h_pct,
        usd_market_cap: btc.market_cap,
      },
      _source: 'Fallback: test-data.json',
    });
    console.log('[bcw] ⚠ Market data from test-data.json (live APIs unreachable)');
  }

  // OHLC chart data — CoinGecko primary, CryptoCompare fallback
  let candles = await fetchCoinGeckoChart(30);
  let chartSource = null;

  if (candles) {
    chartSource = 'CoinGecko (public, no-key)';

    // Try to augment with volume data from CoinGecko market_chart
    const volumes = await fetchCoinGeckoVolume();
    if (volumes) {
      for (const c of candles) {
        if (volumes[c.time]) {
          c.volume = Math.round(volumes[c.time]);
        }
      }
    }

    results.chart = writeCache('chart', { candles, _source: chartSource });
    console.log(`[bcw] ✓ Chart data cached (${candles.length} candles, CoinGecko)`);
  } else {
    // Fallback: CryptoCompare (daily OHLC + volume in one call)
    candles = await fetchCryptoCompareChart(30);
    if (candles) {
      chartSource = 'CryptoCompare (public, no-key)';
      results.chart = writeCache('chart', { candles, _source: chartSource });
      console.log(`[bcw] ✓ Chart data cached (${candles.length} candles, CryptoCompare)`);
    } else if (testData) {
      results.chart = writeCache('chart', {
        candles: testData.candles,
        _source: 'Fallback: test-data.json',
      });
      console.log('[bcw] ⚠ Chart data from test-data.json');
    }
  }

  // On-chain summary + mempool + hashrate + derived metrics
  const [fees, mempool, hashrate] = await Promise.all([
    fetchMempoolFees(),
    fetchMempoolMempool(),
    fetchMempoolHashrate(),
  ]);

  const onchain = {};
  if (fees) {
    onchain.fees = fees.fees;
    onchain.block_height = fees.block_height;
    onchain._fee_source = fees.source;
  } else if (testData) {
    onchain._fee_note = 'mempool.space unreachable';
  }
  if (mempool) {
    onchain.mempool = { count: mempool.count, vsize: mempool.vsize, total_fee: mempool.total_fee };
    onchain._mempool_source = mempool.source;
  }
  if (hashrate) {
    onchain.hashrate = {
      current_eh_s: hashrate.hashrate_eh_s,
      current_ph_s: hashrate.hashrate_ph_s,
      difficulty: hashrate.difficulty,
    };
    onchain._hashrate_source = hashrate.source;
  }

  // Compute derived fee-pressure metrics
  const feePressure = computeDerivedMetrics(fees?.fees ?? null, mempool ?? null);
  if (feePressure._computed) {
    onchain.fee_pressure = {
      ratio: feePressure.fee_pressure_ratio,
      ratio_half_hour: feePressure.fee_pressure_ratio_half,
      estimated_blocks_to_clear: feePressure.estimated_blocks_to_clear,
      label: feePressure.fee_pressure_label,
    };
    onchain._fee_pressure_quality = feePressure._data_quality;
  }

  onchain._cachedAt = Date.now();

  // Data quality labels for all on-chain fields
  onchain._data_quality = {
    block_height: 'Node-verifiable (any Bitcoin full node)',
    fees: 'Node-verifiable (mempool estimatesmartfee)',
    mempool_count: 'Node-verifiable (local mempool info)',
    mempool_vsize: 'Node-verifiable (local mempool info)',
    mempool_total_fee: 'Node-verifiable (local mempool info)',
    hashrate: 'Vendor-derived (mempool.space mining pool estimates)',
    difficulty: 'Node-verifiable (block header data)',
    fee_pressure: 'Node-verifiable (derived from public mempool data)',
    estimated_blocks_to_clear: 'Node-verifiable (computed from mempool vsize)',
  };

  // Add placeholders for node-only metrics (Bitcoin Core RPC)
  onchain._node_only = {
    note: 'Bitcoin Core RPC integration available with local node access',
    enabled: false,
    // BTC_RPC_URL=http://127.0.0.1:8332
    // BTC_RPC_USER=rpcuser
    // BTC_RPC_PASS=rpcpassword
    _requires_full_node: [
      'Puell Multiple (block reward + 365d MA)',
      'Pi Cycle Top (price MAs)',
      'mempool sequence stats',
      'fee estimates (estimatesmartfee)',
      'block template (getblocktemplate)',
    ],
  };

  results.onchain = writeCache('onchain', onchain);
  console.log('[bcw] ✓ On-chain summary cached');

  // Workbench — combined object compatible with frontend
  const workbench = buildWorkbench(results, testData);
  results.workbench = writeCache('workbench', workbench);
  console.log('[bcw] ✓ Workbench combined data cached');

  console.log('[bcw] Cache refresh complete.');
  return results;
}

// ─── Build combined workbench object ───
function buildWorkbench(cacheResults, testData) {
  const marketCache = cacheResults.market || readCache('market');
  const chartCache = cacheResults.chart || readCache('chart');
  const onchainCache = cacheResults.onchain || readCache('onchain');

  const market = marketCache?.bitcoin;
  const candles = chartCache?.candles;
  const onchain = onchainCache || {};

  // Start with test-data structure, overlay live data
  const td = testData || {};
  const btcPrice = td.btc_price || {};

  return {
    meta: {
      description: 'Bitcoin Cycle Workbench — Combined live+cache data',
      generated: new Date().toISOString(),
      source: marketCache?._source || td.meta?.data_source_note || 'cache/test-data',
      not_financial_advice: true,
      educational_only: true,
    },
    btc_price: {
      current: market?.usd ?? btcPrice.current,
      change_24h_pct: market?.usd_24h_change ?? btcPrice.change_24h_pct,
      market_cap: market?.usd_market_cap ?? btcPrice.market_cap,
      dominance: btcPrice.dominance ?? null,
      high_24h: btcPrice.high_24h ?? null,
      low_24h: btcPrice.low_24h ?? null,
      source: marketCache?._source || 'test-data.json',
    },
    candles: candles ?? td.candles ?? [],
    onchain_summary: {
      fees: onchain.fees ?? null,
      block_height: onchain.block_height ?? null,
      mempool: onchain.mempool ?? null,
      hashrate: onchain.hashrate ?? null,
      fee_pressure: onchain.fee_pressure ?? null,
      _fee_source: onchain._fee_source ?? null,
      _mempool_source: onchain._mempool_source ?? null,
      _hashrate_source: onchain._hashrate_source ?? null,
      _data_quality: onchain._data_quality ?? null,
      _fee_pressure_quality: onchain._fee_pressure_quality ?? null,
      _node_only: onchain._node_only ?? null,
    },
    metrics: td.metrics || {},
    cycle_posture: td.cycle_posture || {
      current: 'Neutral',
      description: 'Live API data unavailable. Using fallback.',
      phase: 'Unknown',
    },
    insights: td.insights || [],
  };
}

// ─── API Handlers ───
function apiResponse(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(data, null, 2));
}

async function handleApi(pathname, query, res) {
  // CORS preflight
  if (pathname === '/api/') {
    return apiResponse(res, 200, {
      name: 'Bitcoin Cycle Workbench API',
      version: '1.1.0',
      endpoints: [
        '/api/health',
        '/api/market/btc',
        '/api/chart/btc?days=30',
        '/api/onchain/summary',
        '/api/workbench',
      ],
      educational_only: true,
      not_financial_advice: true,
    });
  }

  // Health
  if (pathname === '/api/health') {
    const cacheStatus = {};
    for (const name of Object.keys(CACHE_TTL)) {
      const cached = readCache(name);
      cacheStatus[name] = cached ? 'fresh' : 'stale/missing';
    }
    return apiResponse(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      cache: cacheStatus,
      version: '1.1.0',
      educational_only: true,
      not_financial_advice: true,
    });
  }

  // Market / BTC
  if (pathname === '/api/market/btc') {
    let data = readCache('market');
    if (!data) {
      const priceData = await fetchCoinGeckoPrice();
      if (priceData) {
        data = writeCache('market', {
          bitcoin: {
            usd: priceData.current,
            usd_24h_change: priceData.change_24h_pct,
            usd_market_cap: priceData.market_cap,
          },
          _source: priceData.source,
        });
      } else {
        const td = readTestData();
        data = td ? {
          bitcoin: { usd: td.btc_price.current, usd_24h_change: td.btc_price.change_24h_pct, usd_market_cap: td.btc_price.market_cap },
          _source: 'Fallback: test-data.json',
        } : { error: 'No data available' };
      }
    }
    return apiResponse(res, 200, data);
  }

  // Chart / BTC
  if (pathname === '/api/chart/btc') {
    let data = readCache('chart');
    if (!data) {
      const days = parseInt(query?.days || '30', 10);
      let candles = await fetchCoinGeckoChart(days);
      let source = null;

      if (candles) {
        source = 'CoinGecko (public, no-key)';
        const volumes = await fetchCoinGeckoVolume(days);
        if (volumes) {
          for (const c of candles) {
            if (volumes[c.time]) c.volume = Math.round(volumes[c.time]);
          }
        }
      } else {
        candles = await fetchCryptoCompareChart(days);
        if (candles) source = 'CryptoCompare (public, no-key)';
      }

      if (candles) {
        data = writeCache('chart', { candles, _source: source || 'on-demand' });
      } else {
        const td = readTestData();
        data = td ? { candles: td.candles, _source: 'Fallback: test-data.json' } : { candles: [], _source: 'none' };
      }
    }
    return apiResponse(res, 200, data);
  }

  // On-chain summary (enriched with hashrate, fee pressure, data quality labels)
  if (pathname === '/api/onchain/summary') {
    let data = readCache('onchain');
    if (!data) {
      const [fees, mempool, hashrate] = await Promise.all([
        fetchMempoolFees(),
        fetchMempoolMempool(),
        fetchMempoolHashrate(),
      ]);
      const derived = computeDerivedMetrics(fees?.fees ?? null, mempool ?? null);
      data = {
        fees: fees?.fees ?? null,
        block_height: fees?.block_height ?? null,
        mempool: mempool ? { count: mempool.count, vsize: mempool.vsize, total_fee: mempool.total_fee } : null,
        hashrate: hashrate ? {
          current_eh_s: hashrate.hashrate_eh_s,
          current_ph_s: hashrate.hashrate_ph_s,
          difficulty: hashrate.difficulty,
        } : null,
        fee_pressure: derived._computed ? {
          ratio: derived.fee_pressure_ratio,
          ratio_half_hour: derived.fee_pressure_ratio_half,
          estimated_blocks_to_clear: derived.estimated_blocks_to_clear,
          label: derived.fee_pressure_label,
        } : null,
        _fee_source: fees?.source ?? null,
        _mempool_source: mempool?.source ?? null,
        _hashrate_source: hashrate?.source ?? null,
        _data_quality: {
          block_height: 'Node-verifiable (any Bitcoin full node)',
          fees: 'Node-verifiable (mempool estimatesmartfee)',
          mempool_count: 'Node-verifiable (local mempool info)',
          mempool_vsize: 'Node-verifiable (local mempool info)',
          mempool_total_fee: 'Node-verifiable (local mempool info)',
          hashrate: 'Vendor-derived (mempool.space mining pool estimates)',
          difficulty: 'Node-verifiable (block header data)',
          fee_pressure: 'Node-verifiable (derived from public mempool data)',
          estimated_blocks_to_clear: 'Node-verifiable (computed from mempool vsize)',
        },
        _node_only: {
          note: 'Bitcoin Core RPC integration available with local node access',
          enabled: false,
          _requires_full_node: [
            'Puell Multiple (block reward + 365d MA)',
            'Pi Cycle Top (price MAs)',
            'mempool sequence stats',
            'fee estimates (estimatesmartfee)',
            'block template (getblocktemplate)',
          ],
        },
      };
      data = writeCache('onchain', data);
    }
    return apiResponse(res, 200, data);
  }

  // On-chain mempool deep-dive
  if (pathname === '/api/onchain/mempool') {
    let data = readCache('onchain');
    if (!data) {
      data = readCache('onchain'); // pull again if already refreshed
    }
    if (!data || !data.mempool) {
      const mempool = await fetchMempoolMempool();
      if (mempool) {
        data = data || {};
        data.mempool = { count: mempool.count, vsize: mempool.vsize, total_fee: mempool.total_fee };
      }
    }
    // Build a focused response with deep mempool info + fee pressure
    const feePressure = data?.fee_pressure ?? null;
    return apiResponse(res, 200, {
      mempool: data?.mempool ?? null,
      block_height: data?.block_height ?? null,
      fee_pressure: feePressure,
      _mempool_source: data?._mempool_source ?? null,
      _data_quality: {
        mempool_count: 'Node-verifiable (local mempool info)',
        mempool_vsize: 'Node-verifiable (local mempool info)',
        mempool_total_fee: 'Node-verifiable (local mempool info)',
        estimated_blocks_to_clear: 'Node-verifiable (computed from mempool vsize)',
        fee_pressure: 'Node-verifiable (derived from public mempool data)',
      },
    });
  }

  // On-chain hashrate
  if (pathname === '/api/onchain/hashrate') {
    let data = readCache('onchain');
    if (!data || !data.hashrate) {
      const hashrate = await fetchMempoolHashrate();
      if (hashrate) {
        data = data || {};
        data.hashrate = {
          current_eh_s: hashrate.hashrate_eh_s,
          current_ph_s: hashrate.hashrate_ph_s,
          difficulty: hashrate.difficulty,
        };
        data._hashrate_source = hashrate.source;
      }
    }
    return apiResponse(res, 200, {
      hashrate: data?.hashrate ?? null,
      _hashrate_source: data?._hashrate_source ?? null,
      _data_quality: {
        hashrate: 'Vendor-derived (mempool.space mining pool estimates)',
        difficulty: 'Node-verifiable (block header data)',
      },
    });
  }

  // On-chain fee pressure (derived metric)
  if (pathname === '/api/onchain/fee-pressure') {
    let data = readCache('onchain');
    if (!data || !data.fee_pressure) {
      const [fees, mempool] = await Promise.all([
        fetchMempoolFees(),
        fetchMempoolMempool(),
      ]);
      const derived = computeDerivedMetrics(fees?.fees ?? null, mempool ?? null);
      data = data || {};
      if (derived._computed) {
        data.fee_pressure = {
          ratio: derived.fee_pressure_ratio,
          ratio_half_hour: derived.fee_pressure_ratio_half,
          estimated_blocks_to_clear: derived.estimated_blocks_to_clear,
          label: derived.fee_pressure_label,
        };
      }
    }
    return apiResponse(res, 200, {
      fee_pressure: data?.fee_pressure ?? null,
      _data_quality: {
        fee_pressure_ratio: 'Node-verifiable (computed from mempool fees)',
        estimated_blocks_to_clear: 'Node-verifiable (computed from mempool vsize)',
        fee_pressure_label: 'Node-verifiable (derived classification)',
      },
    });
  }

  // Workbench (combined)
  if (pathname === '/api/workbench') {
    let data = readCache('workbench');
    if (!data) {
      const td = readTestData();
      const results = await refreshCache();
      data = readCache('workbench') || buildWorkbench({}, td);
    }
    return apiResponse(res, 200, data);
  }

  // 404 for unknown API routes
  return apiResponse(res, 404, { error: 'Not found', path: pathname });
}

// ─── Static File Server ───
function serveStatic(urlPath, res) {
  // Normalize: strip trailing slashes, map / to index.html
  let safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  if (safePath === '/' || safePath === '') safePath = '/index.html';

  const filePath = path.join(ROOT, safePath);

  // Security: ensure we're still under ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback: serve index.html for non-file routes
        fs.readFile(path.join(ROOT, 'index.html'), (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            return res.end('Not found');
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexData);
        });
      } else {
        res.writeHead(500);
        res.end('Internal server error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

// ─── HTTP Server ───
function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    const query = Object.fromEntries(url.searchParams);

    // API routes
    if (pathname.startsWith('/api/')) {
      return handleApi(pathname, query, res);
    }

    // Static files
    serveStatic(pathname, res);
  });

  server.listen(PORT, () => {
    console.log(`\n  🛠 Bitcoin Cycle Workbench Server`);
    console.log(`  ──────────────────────────────────`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  Health:  http://localhost:${PORT}/api/health`);
    console.log(`  Workbench: http://localhost:${PORT}/api/workbench`);
    console.log(`  Static:  http://localhost:${PORT} (frontend)\n`);
    console.log('  Educational use only. Not financial advice.\n');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[bcw] Shutting down...');
    server.close(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    console.log('\n[bcw] Shutting down...');
    server.close(() => process.exit(0));
  });
}

// ─── Periodic Refresh (every 10 min) ───
let refreshInterval = null;
function startPeriodicRefresh() {
  refreshInterval = setInterval(async () => {
    try {
      await refreshCache();
    } catch (err) {
      console.error('[bcw] Periodic refresh error:', err.message);
    }
  }, 10 * 60 * 1000);
}

// ─── Main ───
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
  Bitcoin Cycle Workbench — Backend Server

  USAGE:
    node server/index.js              Start HTTP server
    node server/index.js --refresh    Refresh cache once, then exit
    node server/index.js --serve      Refresh cache, then start server
    node server/index.js --help       Show this help

  ENV:
    BCW_PORT=3322   Server port (default 3322)

  ENDPOINTS:
    GET /api/                     API index
    GET /api/health               Health check + cache status
    GET /api/market/btc           Cached BTC price/market data
    GET /api/chart/btc?days=30    Cached OHLC chart data
    GET /api/onchain/summary      Enriched on-chain: fees, mempool, hashrate, fee pressure
    GET /api/onchain/mempool      Deep mempool detail + fee pressure
    GET /api/onchain/hashrate     Mining hashrate + difficulty
    GET /api/onchain/fee-pressure  Derived fee pressure metrics
    GET /api/workbench            Combined object for frontend

  DATA SOURCES (no API key required):
    - CoinGecko: price, OHLC + volume chart data
    - CryptoCompare: OHLC + volume (fallback for chart)
    - mempool.space: fees, block height, mempool stats, hashrate, difficulty
    - DIA: price quote (fallback for price)
    - Fallback: data/test-data.json

  NOT FINANCIAL ADVICE. Educational purposes only.
`);
    process.exit(0);
  }

  if (args.includes('--refresh')) {
    console.log('[bcw] Manual cache refresh...');
    try {
      await refreshCache();
      console.log('[bcw] Done.');
      process.exit(0);
    } catch (err) {
      console.error('[bcw] Refresh failed:', err.message);
      process.exit(1);
    }
  }

  if (args.includes('--serve')) {
    console.log('[bcw] Refreshing cache before starting server...');
    try {
      await refreshCache();
    } catch (err) {
      console.warn('[bcw] Initial cache refresh failed (server will use fallbacks):', err.message);
    }
  }

  // Start the server (also starts if no args)
  startServer();
  startPeriodicRefresh();
}

// Only start if run directly (not required as module)
if (require.main === module) {
  main();
}

module.exports = { refreshCache, readCache, writeCache, buildWorkbench, startServer };
