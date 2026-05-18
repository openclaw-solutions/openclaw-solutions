#!/usr/bin/env node
/**
 * Lightning Wallet MCP Server
 * 
 * Tools for AI agents to create invoices, pay invoices, and check balance
 * via the Lightning Network using NWC (Nostr Wallet Connect).
 * 
 * Pay-per-call via x402: 100 sats per invoice created, 50 sats per payment
 * 
 * Setup:
 *   export NWC_CONNECTION_STRING="nostr+walletconnect://..."
 *   node http-server.js
 * 
 * For testing without real wallet:
 *   npx @getalby/cli faucet  # Get test wallet
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3458');
const NWC_URL = process.env.NWC_URL || '';
const NWC_CONNECTION = process.env.NWC_CONNECTION_STRING || NWC_URL || '';
const NWC_CONNECTION = process.env.NWC_CONNECTION_STRING || '';

const CLI = path.join(__dirname, 'node_modules', '.bin', 'cli');

function nwcCommand(args) {
  if (!NWC_CONNECTION) {
    throw new Error('NWC_CONNECTION_STRING not set. Get one from https://getalby.com or run: npx @getalby/cli faucet');
  }
  const cmd = `${CLI} -c "${NWC_CONNECTION}" ${args}`;
  try {
    const out = execSync(cmd, { encoding: 'utf8', timeout: 15000, env: { ...process.env, CI: 'true' } });
    return JSON.parse(out);
  } catch (e) {
    throw new Error(`NWC error: ${e.stderr || e.message}`);
  }
}

const mcpServer = new Server(
  { name: 'lightning-wallet', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

const toolDefinitions = [
  {
    name: 'create_invoice',
    description: '[PAID - 100 sats] Create a Lightning invoice. Returns a bolt11 invoice string that someone can pay.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in satoshis' },
        description: { type: 'string', description: 'Invoice description/memo (optional)', default: '' }
      },
      required: ['amount']
    }
  },
  {
    name: 'pay_invoice',
    description: '[PAID - 50 sats] Pay a Lightning invoice. Send sats from the connected wallet.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice: { type: 'string', description: 'Bolt11 invoice string to pay' }
      },
      required: ['invoice']
    }
  },
  {
    name: 'get_balance',
    description: '[FREE] Check the connected wallet balance in satoshis.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_balance') {
    try {
      const result = nwcCommand('get-balance');
      return {
        content: [{ type: 'text', text: `Balance: ${result.balance} sats` }]
      };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
    }
  }

  if (name === 'create_invoice') {
    const amount = Number(args?.amount) || 0;
    const description = String(args?.description || '');
    
    if (amount < 1) {
      return { content: [{ type: 'text', text: 'Error: Amount must be at least 1 sat' }], isError: true };
    }

    try {
      const cmd = `make-invoice --amount ${amount}${description ? ` --description "${description}"` : ''}`;
      const result = nwcCommand(cmd);
      return {
        content: [{ type: 'text', text: [
          `Invoice created: ${result.invoice}`,
          `Amount: ${amount} sats`,
          `Description: ${description || '(none)'}`,
          `Payment hash: ${result.payment_hash || 'N/A'}`
        ].join('\n') }]
      };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
    }
  }

  if (name === 'pay_invoice') {
    const invoice = String(args?.invoice || '');
    if (!invoice.startsWith('lnbc') && !invoice.startsWith('lni')) {
      return { content: [{ type: 'text', text: 'Error: Invalid invoice format' }], isError: true };
    }

    try {
      const result = nwcCommand(`pay-invoice --invoice "${invoice}"`);
      return {
        content: [{ type: 'text', text: [
          'Payment sent!',
          `Preimage: ${result.preimage || 'N/A'}`,
          `Fee: ${result.fee || 0} sats`
        ].join('\n') }]
      };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
    }
  }

  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
});

// HTTP + SSE Transport
const sessions = new Map();
let nextSessionId = 1;

const app = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-402-invoice, x-402-payment');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (path === '/health') {
    const hasWallet = !!NWC_CONNECTION;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'lightning-wallet',
      version: '0.1.0',
      tools: ['create_invoice', 'pay_invoice', 'get_balance'],
      wallet_connected: hasWallet
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
        <h1>⚡ Lightning Wallet MCP Server</h1>
        <p>Tools for AI agents to use Lightning Network payments.</p>
        <ul>
          <li><b>create_invoice</b> — 100 sats/call</li>
          <li><b>pay_invoice</b> — 50 sats/call</li>
          <li><b>get_balance</b> — FREE</li>
        </ul>
        <p>SSE: <a href="/sse">/sse</a></p>
        <p>Health: <a href="/health">/health</a></p>
      </body></html>
    `);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

app.listen(PORT, () => {
  console.log(`⚡ Lightning Wallet MCP at http://localhost:${PORT}`);
  console.log(`   Tools: create_invoice, pay_invoice, get_balance`);
  console.log(`   Wallet: ${NWC_CONNECTION ? 'CONNECTED' : 'NOT CONNECTED — set NWC_CONNECTION_STRING'}`);
  console.log(`   Tunnel: npx localtunnel --port ${PORT}`);
});
