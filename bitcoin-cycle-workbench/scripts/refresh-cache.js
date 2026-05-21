#!/usr/bin/env node
/**
 * Bitcoin Cycle Workbench — Cache Refresh Script
 *
 * Standalone CLI to refresh the API cache from public no-key APIs.
 * Can be used standalone or via cron/systemd timer.
 *
 * Usage:
 *   node scripts/refresh-cache.js                # refresh once
 *   node scripts/refresh-cache.js --watch        # refresh every 10 min continuously
 *   node scripts/refresh-cache.js --watch --interval=5   # every 5 min
 *
 * Not financial advice. Educational purposes only.
 */

const { refreshCache } = require('../server/index.js');

async function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch');
  const intervalArg = args.find(a => a.startsWith('--interval='));
  const intervalMin = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : 10;
  const intervalMs = intervalMin * 60 * 1000;

  if (watchMode) {
    console.log(`[bcw-refresh] Watching mode — refreshing every ${intervalMin} minutes.`);

    const tick = async () => {
      try {
        await refreshCache();
        console.log(`[bcw-refresh] ✓ ${new Date().toISOString()}`);
      } catch (err) {
        console.error(`[bcw-refresh] ✗ ${err.message}`);
      }
    };

    await tick();
    setInterval(tick, intervalMs);

    process.on('SIGINT', () => { console.log('\n[bcw-refresh] Stopped.'); process.exit(0); });
    process.on('SIGTERM', () => { console.log('\n[bcw-refresh] Stopped.'); process.exit(0); });
  } else {
    try {
      await refreshCache();
      console.log('[bcw-refresh] ✓ Cache refreshed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('[bcw-refresh] ✗ Failed:', err.message);
      process.exit(1);
    }
  }
}

main();
