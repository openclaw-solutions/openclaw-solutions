/**
 * Bitcoin Cycle Workbench — Main Application
 * Static-hostable prototype with test data.
 * Not financial advice. Educational purposes only.
 *
 * Uses: TradingView Lightweight Charts (candlestick chart)
 *       Chart.js (mini sparkline metrics)
 */

// ─── Global State ───
const state = {
  data: null,
  candleChart: null,
  miniCharts: {}
};

// ─── DOM Shortcuts ───
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ─── Formatters ───
const fmtPrice = (v) => {
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  return '$' + Number(v).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
};
const fmtCompact = (v) => {
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
};
const fmtPct = (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

// ─── Data Loading ───
// Try /api/workbench first (backend mode), then public no-key APIs in static mode,
// and finally fall back to bundled demo data if public APIs fail/rate-limit.
const IS_BACKEND = window.location.port === '3322' || window.location.hostname === 'localhost' && window.location.port !== '';

function setDataBadge(label) {
  const badges = document.querySelectorAll('.badge');
  badges.forEach(b => {
    if (b.textContent.includes('Demo') || b.textContent.includes('Live') || b.textContent.includes('Delayed')) {
      b.textContent = label;
    }
  });
}

function aggregateOhlcRows(rows, volumesByDay = new Map()) {
  const daily = new Map();
  for (const row of rows || []) {
    const [ts, open, high, low, close] = row;
    const time = new Date(ts).toISOString().slice(0, 10);
    const existing = daily.get(time);
    if (!existing) daily.set(time, { time, open, high, low, close, volume: volumesByDay.get(time) || 0 });
    else {
      existing.high = Math.max(existing.high, high);
      existing.low = Math.min(existing.low, low);
      existing.close = close;
      existing.volume = volumesByDay.get(time) || existing.volume || 0;
    }
  }
  return [...daily.values()];
}

async function enrichWithPublicApis(data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const [priceResp, ohlcResp, marketResp] = await Promise.allSettled([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true', { signal: controller.signal }),
      fetch('https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=30', { signal: controller.signal }),
      fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30', { signal: controller.signal }),
    ]);

    if (priceResp.status === 'fulfilled' && priceResp.value.ok) {
      const priceJson = await priceResp.value.json();
      const btc = priceJson.bitcoin;
      if (btc?.usd) {
        data.btc_price.current = btc.usd;
        data.btc_price.change_24h_pct = btc.usd_24h_change ?? data.btc_price.change_24h_pct;
        data.btc_price.market_cap = btc.usd_market_cap ?? data.btc_price.market_cap;
      }
    }

    let volumesByDay = new Map();
    if (marketResp.status === 'fulfilled' && marketResp.value.ok) {
      const marketJson = await marketResp.value.json();
      for (const [ts, volume] of marketJson.total_volumes || []) {
        const day = new Date(ts).toISOString().slice(0, 10);
        volumesByDay.set(day, (volumesByDay.get(day) || 0) + volume);
      }
    }

    if (ohlcResp.status === 'fulfilled' && ohlcResp.value.ok) {
      const ohlcRows = await ohlcResp.value.json();
      const candles = aggregateOhlcRows(ohlcRows, volumesByDay);
      if (candles.length) {
        data.candles = candles;
        data.btc_price.high_24h = Math.max(...candles.map(c => c.high));
        data.btc_price.low_24h = Math.min(...candles.map(c => c.low));
        data.btc_price.range_label = '30D Range';
      }
    }

    data.meta = data.meta || {};
    data.meta.runtime_source = 'CoinGecko public API in browser; demo fallback if rate-limited';
    document.body.dataset.dataMode = 'live-public';
    setDataBadge('📡 Live Public Data');
    return data;
  } catch (_) {
    document.body.dataset.dataMode = 'demo';
    setDataBadge('📡 Demo Data');
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadData() {
  let data = null;

  // Try local backend first.
  try {
    const apiResp = await fetch('/api/workbench', { signal: AbortSignal.timeout(5000) });
    if (apiResp.ok) {
      data = await apiResp.json();
      if (data && data.btc_price) {
        document.body.dataset.dataMode = 'live';
        setDataBadge('📡 Live Data');
        return data;
      }
    }
  } catch (_) {
    // API unreachable, fall through to static bundle + browser public APIs.
  }

  const resp = await fetch('data/test-data.json');
  if (!resp.ok) throw new Error(`Failed to load data: ${resp.status}`);
  data = await resp.json();
  document.body.dataset.dataMode = 'demo';
  setDataBadge('📡 Demo Data');

  return enrichWithPublicApis(data);
}

// ─── Initialize ───
async function init() {
  try {
    showLoading();
    state.data = await loadData();
    renderStatsBar(state.data);
    renderCandleChart(state.data.candles);
    renderSubCharts(state.data.candles);
    renderMetrics(state.data.metrics);
    renderCyclePosture(state.data.cycle_posture);
    renderInsights(state.data.insights);
    initTabs();
    initChartControls();
    hideLoading();
  } catch (err) {
    showError(err.message);
  }
}

// ─── Loading / Error ───
function showLoading() {
  // Keep the static tab panels in place. Each chart/section already has its
  // own lightweight loading placeholder; replacing #app-content would remove
  // the render targets before data arrives.
  document.body.classList.add('is-loading');
}

function hideLoading() {
  document.body.classList.remove('is-loading');
}

function showError(msg) {
  const container = $('#app-content');
  container.innerHTML = `<div class="error-state">
    <p style="font-size:1.2rem;margin-bottom:8px;">⚠️ Error loading dashboard</p>
    <p>${msg}</p>
    <p style="margin-top:12px;font-size:0.85rem;color:var(--text-muted);">Ensure test-data.json is accessible and you're serving via HTTP (not file://).</p>
  </div>`;
}

// ═══════════════════════════════════════════════
// STATS BAR
// ═══════════════════════════════════════════════
function renderStatsBar(data) {
  const p = data.btc_price;
  const changeClass = p.change_24h_pct >= 0 ? 'positive' : 'negative';
  const changeIcon = p.change_24h_pct >= 0 ? '▲' : '▼';

  const stats = [
    { label: 'BTC / USD', value: fmtPrice(p.current), change: `<span class="stat-change ${changeClass}">${changeIcon} ${fmtPct(p.change_24h_pct)}</span>` },
    { label: p.range_label || '24h Range', value: fmtPrice(p.low_24h) + ' – ' + fmtPrice(p.high_24h), change: '' },
    { label: 'Market Cap', value: fmtPrice(p.market_cap), change: '' },
    { label: 'BTC Dominance', value: p.dominance.toFixed(1) + '%', change: '' },
  ];

  const bar = $('#stats-bar');
  bar.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      ${s.change}
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════
// CANDLESTICK CHART (TradingView Lightweight Charts)
// ═══════════════════════════════════════════════
function renderCandleChart(candles) {
  const container = $('#candle-chart');
  container.innerHTML = '';

  if (typeof LightweightCharts === 'undefined') {
    container.innerHTML = '<div class="loading-state"><span>📊 Chart library loading...</span></div>';
    return;
  }

  const chart = LightweightCharts.createChart(container, {
    layout: {
      background: { color: 'transparent' },
      textColor: '#94a3b8',
    },
    grid: {
      vertLines: { color: '#1a1f2e' },
      horzLines: { color: '#1a1f2e' },
    },
    width: container.clientWidth,
    height: 440,
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: '#2a3142',
      scaleMargins: { top: 0.05, bottom: 0.25 },
    },
    timeScale: {
      borderColor: '#2a3142',
      timeVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
    },
    handleScroll: true,
    handleScale: true,
  });

  // Candlestick series
  const candleSeries = chart.addCandlestickSeries({
    upColor: '#10b981',
    downColor: '#ef4444',
    borderDownColor: '#ef4444',
    borderUpColor: '#10b981',
    wickDownColor: '#ef4444',
    wickUpColor: '#10b981',
  });

  // Format data: { time: '2026-04-01', open, high, low, close }
  candleSeries.setData(candles.map(c => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  })));

  // Volume histogram
  const volumeSeries = chart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: '',
    color: '#2a3142',
    lastValueVisible: false,
    priceLineVisible: false,
  });
  volumeSeries.priceScale().applyOptions({
    scaleMargins: { top: 0.86, bottom: 0 },
  });

  const maxVol = Math.max(...candles.map(c => c.volume));
  volumeSeries.setData(candles.map(c => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
  })));

  state.candleChart = { chart, candleSeries, volumeSeries };

  // Fit content
  chart.timeScale().fitContent();

  // Handle resize
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    if (w > 0) {
      chart.applyOptions({ width: w });
    }
  });
}

// ═══════════════════════════════════════════════
// SUB-CHARTS (Price + MA line overlay, Volume profile)
// ═══════════════════════════════════════════════
function renderSubCharts(candles) {
  if (typeof Chart === 'undefined') return;

  // ── Price + 50d MA line chart ──
  const priceContainer = document.getElementById('mini-price-chart');
  if (priceContainer) {
    priceContainer.innerHTML = '';
    const canvas = document.createElement('canvas');
    priceContainer.appendChild(canvas);

    const closes = candles.map(c => c.close);
    const labels = candles.map((c, i) => (i % 5 === 0) ? c.time.slice(5) : '');

    // 50d MA
    const ma50 = closes.map((_, i) => {
      if (i < 13) return null;
      const slice = closes.slice(i - 13, i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });

    new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Price',
            data: closes,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
            fill: true,
          },
          {
            label: '14d MA',
            data: ma50,
            borderColor: '#f7931a',
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            tension: 0.2,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12, padding: 8 },
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 9 }, maxTicksLimit: 10 },
            grid: { color: '#1a1f2e' },
          },
          y: {
            ticks: {
              color: '#64748b', font: { size: 9 },
              callback: (v) => '$' + (v / 1000).toFixed(0) + 'k',
            },
            grid: { color: '#1a1f2e' },
          },
        },
        animation: false,
      },
    });
  }

  // ── Volume profile ──
  const volContainer = document.getElementById('mini-volume-chart');
  if (volContainer) {
    volContainer.innerHTML = '';
    const canvas = document.createElement('canvas');
    volContainer.appendChild(canvas);

    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: candles.map((_, i) => (i % 5 === 0) ? candles[i].time.slice(5) : ''),
        datasets: [{
          data: candles.map(c => c.volume),
          backgroundColor: candles.map(c => c.close >= c.open
            ? 'rgba(16,185,129,0.4)'
            : 'rgba(239,68,68,0.4)'
          ),
          borderWidth: 0,
          borderRadius: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => fmtCompact(ctx.raw),
            },
          },
        },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 9 }, maxTicksLimit: 10 }, grid: { color: '#1a1f2e' } },
          y: {
            ticks: {
              color: '#64748b', font: { size: 9 },
              callback: (v) => fmtCompact(v),
            },
            grid: { color: '#1a1f2e' },
          },
        },
        animation: false,
      },
    });
  }
}

// ═══════════════════════════════════════════════
// METRIC CARDS
// ═══════════════════════════════════════════════
function renderMetrics(metrics) {
  const grid = $('#metrics-grid');
  grid.innerHTML = '';

  const cards = [
    {
      id: 'puell',
      name: 'Puell Multiple',
      value: metrics.puell_multiple.current.toFixed(2),
      label: metrics.puell_multiple.value_label,
      labelClass: 'info',
      desc: metrics.puell_multiple.description,
      source: metrics.puell_multiple.source,
      history: metrics.puell_multiple.history,
    },
    {
      id: 'mvrv',
      name: 'MVRV Z-Score',
      value: metrics.mvrv_z_score.current.toFixed(2),
      label: metrics.mvrv_z_score.value_label,
      labelClass: 'warning',
      desc: metrics.mvrv_z_score.description,
      source: metrics.mvrv_z_score.source,
      history: metrics.mvrv_z_score.history,
    },
    {
      id: 'realized',
      name: 'Realized Price',
      value: '$' + Number(metrics.realized_price.current).toLocaleString(),
      label: metrics.realized_price.value_label,
      labelClass: 'info',
      desc: metrics.realized_price.description,
      source: metrics.realized_price.source,
      history: metrics.realized_price.history,
    },
    {
      id: 'exchange',
      name: 'Exchange Reserve',
      value: fmtCompact(metrics.exchange_reserve.current) + ' BTC',
      label: metrics.exchange_reserve.value_label,
      labelClass: 'warning',
      desc: metrics.exchange_reserve.description,
      source: metrics.exchange_reserve.source,
      history: metrics.exchange_reserve.history,
    },
    {
      id: 'lth_sth',
      name: 'LTH / STH Ratio',
      value: metrics.lth_sth_ratio.current.toFixed(2),
      label: metrics.lth_sth_ratio.value_label,
      labelClass: 'warning',
      desc: metrics.lth_sth_ratio.description,
      source: metrics.lth_sth_ratio.source,
      history: metrics.lth_sth_ratio.history,
    },
    {
      id: 'pi_cycle',
      name: 'Pi Cycle Top',
      value: metrics.pi_cycle_top.current.ratio.toFixed(2) + 'x',
      label: metrics.pi_cycle_top.current.status,
      labelClass: 'info',
      desc: metrics.pi_cycle_top.description,
      source: metrics.pi_cycle_top.source,
      ma111: metrics.pi_cycle_top.ma111_history,
      ma350: metrics.pi_cycle_top.ma350x2_history,
    },
  ];

  cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'metric-card';
    el.id = 'metric-' + card.id;

    el.innerHTML = `
      <div class="metric-header">
        <div>
          <div class="metric-name">${card.name}</div>
          <div class="metric-source">${card.source}</div>
        </div>
        <span class="metric-label ${card.labelClass}">${card.label}</span>
      </div>
      <div class="metric-value-box">
        <div class="metric-value">${card.value}</div>
      </div>
      <div class="metric-desc">${card.desc}</div>
      <div class="metric-chart-mini" id="mini-chart-${card.id}"></div>
    `;

    grid.appendChild(el);
  });

  // Render mini sparklines after DOM is ready
  requestAnimationFrame(() => {
    cards.forEach(card => {
      if (card.id === 'pi_cycle') {
        renderMiniSparkline('mini-chart-pi_cycle', [
          { data: card.ma111, label: '111d MA' },
          { data: card.ma350, label: '350d×2' },
        ]);
      } else if (card.history) {
        renderMiniSparkline('mini-chart-' + card.id, [
          { data: card.history, label: card.name }
        ]);
      }
    });
  });
}

// ─── Mini Sparkline (Chart.js) ───
function renderMiniSparkline(containerId, datasets) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (typeof Chart === 'undefined') {
    container.innerHTML = '<span style="font-size:0.7rem;color:var(--text-muted)">Chart library loading...</span>';
    return;
  }

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  const colors = ['#3b82f6', '#f7931a', '#8b5cf6'];

  const chartData = {
    labels: datasets[0].data.map((_, i) => ''),
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: colors[i % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
    })),
  };

  new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
      elements: {
        point: { radius: 0 },
      },
      animation: false,
    },
  });
}

// ═══════════════════════════════════════════════
// CYCLE POSTURE
// ═══════════════════════════════════════════════
function renderCyclePosture(posture) {
  const signalClass = 'signal-' + posture.current.toLowerCase().replace(/[-\s]/g, '_');

  const indicator = $('#posture-indicator');
  indicator.className = 'posture-indicator ' + signalClass;
  indicator.textContent = posture.current;

  $('#posture-phase').textContent = posture.phase;
  $('#posture-desc').textContent = posture.description;

  // Components
  const comps = $('#posture-components');
  comps.innerHTML = Object.entries(posture.components).map(([key, val]) => `
    <div class="posture-component">
      <div class="posture-component-label">${key.replace(/_/g, ' ')}</div>
      <div class="posture-component-value">${val}</div>
    </div>
  `).join('');

  // Educational signal panel
  const signals = [
    { name: 'Puell Multiple', dot: 'dot-blue', status: 'Neutral (1.42)', statusClass: '' },
    { name: 'MVRV Z-Score', dot: 'dot-yellow', status: 'Elevated (2.14)', statusClass: 'warn' },
    { name: 'Realized Price Comparison', dot: 'dot-green', status: 'Premium 196%', statusClass: 'good' },
    { name: 'Exchange Reserve', dot: 'dot-green', status: 'Steady decline', statusClass: 'good' },
    { name: 'LTH / STH Ratio', dot: 'dot-yellow', status: 'Distribution phase', statusClass: 'warn' },
    { name: 'Pi Cycle Top', dot: 'dot-green', status: 'Not triggered', statusClass: 'good' },
    { name: 'Real Yields (10Y TIPS)', dot: 'dot-yellow', status: 'Headwind at 2.10%', statusClass: 'warn' },
  ];

  const sigGrid = $('#signal-grid');
  sigGrid.innerHTML = signals.map(s => `
    <div class="signal-item">
      <div class="signal-dot ${s.dot}"></div>
      <div class="signal-name">${s.name}</div>
      <div class="signal-status ${s.statusClass}">${s.status}</div>
    </div>
  `).join('');

  $('#signal-footer-note').textContent = posture.educational_note;
}

// ═══════════════════════════════════════════════
// INSIGHTS
// ═══════════════════════════════════════════════
function renderInsights(insights) {
  const grid = $('#insights-grid');
  grid.innerHTML = insights.map(i => `
    <div class="insight-card">
      <div class="insight-source">${i.source}</div>
      <div class="insight-title">${i.title}</div>
      <div class="insight-summary">${i.summary}</div>
      <div class="insight-date">${i.date}</div>
      ${i.link ? `<a class="insight-link" href="${i.link}" target="_blank" rel="noopener">Read more →</a>` : ''}
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════
function initTabs() {
  const tabs = $$('.tab-btn');
  const panels = $$('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      // Activate this
      tab.classList.add('active');
      const target = $(`#${tab.dataset.tab}`);
      if (target) target.classList.add('active');

      // Refresh chart on resize if chart tab
      if (tab.dataset.tab === 'tab-charts' && state.candleChart) {
        setTimeout(() => {
          state.candleChart.chart.applyOptions({
            width: $('#candle-chart').clientWidth,
          });
          state.candleChart.chart.timeScale().fitContent();
        }, 50);
      }
    });
  });
}

// ═══════════════════════════════════════════════
// CHART CONTROLS
// ═══════════════════════════════════════════════
function initChartControls() {
  const btns = $$('.chart-control-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ═══════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);
