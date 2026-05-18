#!/usr/bin/env node
/**
 * SEO Analyzer MCP Server — HTTP + SSE Transport
 * 
 * Runs the MCP server over HTTP with SSE transport so it can be tunneled
 * and listed on mpp.dev / 402Index.io.
 * 
 * Usage:
 *   node http-server.js [port]
 *   PORT=3456 node http-server.js
 * 
 * Tunnel with localtunnel:
 *   npx localtunnel --port 3456
 */
import http from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const PORT = parseInt(process.env.PORT || process.argv[2] || '3456');
const SERVER_NAME = 'seo-analyzer';

// Create the MCP server (same tools as index.js)
const mcpServer = new Server(
  { name: SERVER_NAME, version: '0.2.0' },
  { capabilities: { tools: {} } }
);

const toolDefinitions = [
  {
    name: 'analyze_url',
    description: 'Fetch a URL and analyze its SEO metadata: title, meta description, headings (H1-H6), word count, top keywords.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to analyze' },
        maxWords: { type: 'number', description: 'Max words to extract (default 500)', default: 500 }
      },
      required: ['url']
    }
  },
  {
    name: 'keyword_suggest',
    description: 'Given a topic or seed keyword, suggest related search keywords and phrases.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The topic or seed keyword' },
        count: { type: 'number', description: 'Number of suggestions (default 10, max 25)', default: 10 }
      },
      required: ['topic']
    }
  },
  {
    name: 'compare_urls',
    description: 'Compare SEO metadata between two URLs side by side.',
    inputSchema: {
      type: 'object',
      properties: {
        url1: { type: 'string', description: 'First URL' },
        url2: { type: 'string', description: 'Second URL' }
      },
      required: ['url1', 'url2']
    }
  }
];

// Track transport sessions
const sessions = new Map();
let nextSessionId = 1;

// HTTP server
const app = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-402-invoice, x-402-payment');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health/status endpoint
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: SERVER_NAME,
      version: '0.2.0',
      tools: toolDefinitions.map(t => t.name),
      sessions: sessions.size
    }));
    return;
  }

  // Tools listing endpoint (for easy discovery)
  if (path === '/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools: toolDefinitions }));
    return;
  }

  // SSE endpoint — MCP client connects here
  if (path === '/sse') {
    const sessionId = nextSessionId++;
    const transport = new SSEServerTransport(`/messages/${sessionId}`, res);
    sessions.set(sessionId, transport);
    
    req.on('close', () => {
      sessions.delete(sessionId);
    });

    await mcpServer.connect(transport);
    return;
  }

  // Message endpoint — client sends JSON-RPC messages here
  const msgMatch = path.match(/^\/messages\/(\d+)$/);
  if (msgMatch && req.method === 'POST') {
    const sessionId = parseInt(msgMatch[1]);
    const transport = sessions.get(sessionId);
    if (!transport) {
      res.writeHead(404);
      res.end('Session not found');
      return;
    }

    // Collect body
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        await transport.handlePostMessage(req, res, body);
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Root — simple info page
  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html><body>
        <h1>${SERVER_NAME} MCP Server</h1>
        <p>Running on port ${PORT}</p>
        <p>Tools: ${toolDefinitions.map(t => t.name).join(', ')}</p>
        <p>SSE: <a href="/sse">/sse</a></p>
        <p>Health: <a href="/health">/health</a></p>
        <p>Tools JSON: <a href="/tools">/tools</a></p>
        <hr>
        <p>MCP protocol: connect to <code>/sse</code> with SSE transport</p>
      </body></html>
    `);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Actually start listening
app.listen(PORT, () => {
  console.log(`✅ MCP Server running at http://localhost:${PORT}`);
  console.log(`   SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`   Tools: ${toolDefinitions.map(t => t.name).join(', ')}`);
  console.log(`   Tunnel: npx localtunnel --port ${PORT}`);
});

// Register handlers (copy logic from index.js)
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze_url') {
    const url = String(args?.url || '');
    const maxWords = Number(args?.maxWords) || 500;
    try { new URL(url); } catch { return { content: [{ type: 'text', text: `Error: Invalid URL: ${url}` }], isError: true }; }
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
      if (!resp.ok) return { content: [{ type: 'text', text: `Error: HTTP ${resp.status}` }], isError: true };
      const html = await resp.text();
      const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || 'N/A';
      const desc = (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*\/?>/i) || [])[1]?.trim() || 'N/A';
      const canonical = (html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*\/?>/i) || [])[1] || 'N/A';
      const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const wordCount = textContent.split(/\s+/).length;
      const headings = {};
      for (let i = 1; i <= 6; i++) {
        const htags = html.match(new RegExp(`<h${i}[^>]*>([^<]*)<\\/h${i}>`, 'gi'));
        headings[`h${i}`] = htags ? htags.map(t => t.replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 20) : [];
      }
      const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','by','with','from','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','not','no','nor','so','if','as','it','its','this','that','these','those','i','you','he','she','we','they','them','their','my','your','his','her','our','its','me','us','all','each','every','some','any','both','few','more','most','other','such','only','own','same','too','very','just']);
      const words = textContent.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
      const freq = {};
      for (const w of words) freq[w] = (freq[w] || 0) + 1;
      const topKeywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([w, c]) => `${w}: ${c}`);

      return {
        content: [{ type: 'text', text: [
          `## SEO Analysis: ${url}`,
          `**Title:** ${title}`,
          `**Description:** ${desc}`,
          `**Canonical:** ${canonical}`,
          `**Status:** ${resp.status}`,
          `**Words:** ${wordCount.toLocaleString()}`,
          `**Headings:** ${['h1','h2','h3'].filter(h => headings[h]?.length).map(h => `${h.toUpperCase()}:${headings[h].length}`).join(', ')}`,
          `**Top Keywords:** ${topKeywords.slice(0, 10).join(', ')}`
        ].join('\n') }]
      };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
    }
  }

  if (name === 'keyword_suggest') {
    const topic = String(args?.topic || '');
    const count = Math.min(Number(args?.count) || 10, 25);
    const patterns = [
      `${topic} template`, `${topic} spreadsheet`, `${topic} guide`, `${topic} checklist`,
      `${topic} for beginners`, `${topic} examples`, `${topic} best practices`, `${topic} tools`,
      `${topic} tips`, `${topic} calculator`, `how to ${topic}`, `${topic} checklist template`,
      `${topic} tracking`, `${topic} management`, `free ${topic}`, `${topic} for small business`,
      `${topic} online`, `${topic} for landlords`, `${topic} automation`, `${topic} software`,
      `${topic} ideas`, `${topic} strategy`, `best ${topic}`, `${topic} 2026`, `${topic} system`
    ];
    return { content: [{ type: 'text', text: `## Keyword Suggestions for "${topic}"\n\n${patterns.slice(0, count).map((s, i) => `${i + 1}. ${s}`).join('\n')}` }] };
  }

  if (name === 'compare_urls') {
    const url1 = String(args?.url1 || '');
    const url2 = String(args?.url2 || '');
    async function analyze(u) {
      try {
        new URL(u);
        const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
        const h = await r.text();
        return {
          title: (h.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || 'N/A',
          words: h.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).length,
          h1: [...h.matchAll(/<h1[^>]*>([^<]*)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).join(', ').slice(0, 80) || 'None'
        };
      } catch (e) { return { error: e.message }; }
    }
    const [a, b] = await Promise.all([analyze(url1), analyze(url2)]);
    return { content: [{ type: 'text', text: [
      `## SEO Comparison`,
      `| Metric | URL 1 | URL 2 |`,
      `|--------|-------|-------|`,
      `| Title | ${(a.title || 'ERR').slice(0, 80)} | ${(b.title || 'ERR').slice(0, 80)} |`,
      `| Words | ${a.words?.toLocaleString() || 'ERR'} | ${b.words?.toLocaleString() || 'ERR'} |`,
      `| H1 | ${a.h1 || 'None'} | ${b.h1 || 'None'} |`
    ].join('\n') }] };
  }

  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
});
