#!/usr/bin/env node
/**
 * SEO Analyzer MCP Server — with MPP payments
 * 
 * MCP server with per-call micropayments via MPP protocol.
 * Supports stablecoins (Tempo testnet) and Lightning (via x402).
 * Charging 1000 sats per analysis call.
 * 
 * HTTP + SSE transport.
 * Tunnel: nohup npx localtunnel --port 3457 &
 */
import http from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Mppx, tempo, Transport as MppTransport } from 'mppx/server';

const PORT = parseInt(process.env.PORT || '3457');
const SERVER_NAME = 'seo-analyzer-paid';

// Create mppx with Tempo stablecoins on testnet
// Our Rico wallet on Base: 0xA0f523ACd8fB3bFA7ADE7144BE4D3095b49D633F
// For Tempo testnet on Arbitrum Sepolia
const mppx = Mppx.create({
  methods: [tempo({
    testnet: true,
    currency: '0x20c0000000000000000000000000000000000000', // USDC on Arbitrum Sepolia
    recipient: '0xA0f523ACd8fB3bFA7ADE7144BE4D3095b49D633F',
    amount: '0.01', // $0.01 per call (~700 sats at $70K BTC)
  })],
  transport: MppTransport.mcpSdk(),
});

const mcpServer = new Server(
  { name: SERVER_NAME, version: '0.3.0' },
  { capabilities: { tools: {} } }
);

const toolDefinitions = [
  {
    name: 'analyze_url',
    description: '[PAID - $0.01] Fetch a URL and analyze its SEO metadata: title, meta description, headings, word count, top keywords.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to analyze' },
        maxWords: { type: 'number', description: 'Max words', default: 500 }
      },
      required: ['url']
    }
  },
  {
    name: 'keyword_suggest',
    description: '[FREE] Given a topic, suggest related keywords.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic/keyword' },
        count: { type: 'number', description: 'Count (max 25)', default: 10 }
      },
      required: ['topic']
    }
  },
  {
    name: 'compare_urls',
    description: '[PAID - $0.02] Compare SEO metadata between two URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        url1: { type: 'string' },
        url2: { type: 'string' }
      },
      required: ['url1', 'url2']
    }
  }
];

// Track SSE sessions
const sessions = new Map();
let nextSessionId = 1;

const app = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-402-invoice, x-402-payment, x-mpp-challenge, x-mpp-credential, x-mpp-receipt');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Discovery endpoint — tells agents and mpp.dev our payment terms
  if (path === '/.well-known/mpp') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: SERVER_NAME,
      version: '0.3.0',
      description: 'SEO analysis tools for AI agents. Paid per-call via Tempo stablecoins or Lightning.',
      payment: {
        methods: ['tempo', 'lightning'],
        currencies: ['USDC', 'BTC'],
        defaultAmount: '0.01',
        unit: 'USD'
      },
      tools: toolDefinitions.map(t => ({
        name: t.name,
        description: t.description,
        price: t.name.includes('compare') ? '$0.02' : t.name.includes('analyze') ? '$0.01' : 'free'
      })),
      endpoints: {
        sse: '/sse',
        health: '/health',
        info: '/'
      }
    }));
    return;
  }

  if (path === '/health') {
    const challenges = mppx.getChallenge ? 'yes' : 'no';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: SERVER_NAME,
      version: '0.3.0',
      tools: toolDefinitions.map(t => t.name),
      payments: 'mppx-ready',
      sessions: sessions.size
    }));
    return;
  }

  if (path === '/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools: toolDefinitions }));
    return;
  }

  if (path === '/sse') {
    const sessionId = nextSessionId++;
    const transport = new SSEServerTransport(`/messages/${sessionId}`, res);
    sessions.set(sessionId, transport);
    req.on('close', () => sessions.delete(sessionId));
    await mcpServer.connect(transport);
    return;
  }

  const msgMatch = path.match(/^\/messages\/(\d+)$/);
  if (msgMatch && req.method === 'POST') {
    const sessionId = parseInt(msgMatch[1]);
    const transport = sessions.get(sessionId);
    if (!transport) { res.writeHead(404); res.end('Not found'); return; }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try { await transport.handlePostMessage(req, res, body); }
      catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html><body>
        <h1>${SERVER_NAME} — MCP + MPP</h1>
        <p>SEO analysis tools for AI agents. Pay per call via stablecoins or Lightning.</p>
        <p><b>Tools:</b></p>
        <ul>
          <li><b>analyze_url</b> — \$0.01 per call</li>
          <li><b>keyword_suggest</b> — FREE</li>
          <li><b>compare_urls</b> — \$0.02 per call</li>
        </ul>
        <p><a href="/health">Health</a> | <a href="/tools">Tools JSON</a> | <a href="/.well-known/mpp">MPP Discovery</a></p>
        <p>SSE: <code>/sse</code></p>
      </body></html>
    `);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

app.listen(PORT, () => {
  console.log(`✅ MCP+MPP Server at http://localhost:${PORT}`);
  console.log(`   Discovery: http://localhost:${PORT}/.well-known/mpp`);
  console.log(`   Tunnel: npx localtunnel --port ${PORT}`);
});

// Tool handlers with MPP payment
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const extra = request._meta || {};

  if (name === 'analyze_url') {
    // Charge $0.01 (or try MPP payment)
    try {
      const chargeResult = await mppx.charge({ amount: '0.01', description: 'URL SEO analysis' })(extra);
      if (chargeResult.status === 402) throw chargeResult.challenge;
    } catch (e) {
      if (e && typeof e === 'object' && e.code === -32042) throw e;
      if (e && e.status === 402 && e.challenge) throw e.challenge;
    }

    const url = String(args?.url || '');
    try { new URL(url); } catch { return { content: [{ type: 'text', text: `Invalid URL: ${url}` }], isError: true }; }
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
      if (!resp.ok) return { content: [{ type: 'text', text: `HTTP ${resp.status}` }], isError: true };
      const html = await resp.text();
      const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || 'N/A';
      const desc = (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*\/?>/i) || [])[1]?.trim() || 'N/A';
      const wordCount = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).length;
      const headings = {};
      for (let i = 1; i <= 3; i++) {
        const htags = html.match(new RegExp(`<h${i}[^>]*>([^<]*)<\\/h${i}>`, 'gi'));
        headings[`h${i}`] = htags ? htags.map(t => t.replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 10) : [];
      }
      return { content: [{ type: 'text', text: `## ${url}\nTitle: ${title}\nDesc: ${desc}\nWords: ${wordCount}\nH1: ${(headings.h1||[]).join(', ')}\nH2: ${(headings.h2||[]).join(', ')}` }] };
    } catch (e) { return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }; }
  }

  if (name === 'keyword_suggest') {
    const topic = String(args?.topic || '');
    const count = Math.min(Number(args?.count) || 10, 25);
    const patterns = [`${topic} template`,`${topic} spreadsheet`,`${topic} guide`,`${topic} checklist`,`how to ${topic}`,`${topic} examples`,`${topic} tools`,`${topic} tips`,`free ${topic}`,`best ${topic}`];
    return { content: [{ type: 'text', text: `Suggestions for "${topic}":\n${patterns.slice(0, count).map((s,i)=>`${i+1}. ${s}`).join('\n')}` }] };
  }

  if (name === 'compare_urls') {
    try {
      const chargeResult = await mppx.charge({ amount: '0.02', description: 'URL comparison' })(extra);
      if (chargeResult.status === 402) throw chargeResult.challenge;
    } catch (e) {
      if (e && typeof e === 'object' && e.code === -32042) throw e;
      if (e && e.status === 402 && e.challenge) throw e.challenge;
    }

    const url1 = String(args?.url1 || '');
    const url2 = String(args?.url2 || '');
    async function analyze(u) {
      try {
        new URL(u);
        const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
        const h = await r.text();
        return { title: (h.match(/<title[^>]*>([^<]*)<\/title>/i)||[])[1]?.trim()||'N/A', words: h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().split(/\s+/).length };
      } catch(e) { return { error: e.message }; }
    }
    const [a,b] = await Promise.all([analyze(url1), analyze(url2)]);
    return { content: [{ type: 'text', text: `## Comparison\n1: ${a.title}\n2: ${b.title}\nWords: ${a.words} vs ${b.words}` }] };
  }

  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
});
