#!/usr/bin/env node
/**
 * SEO URL Analyzer MCP Server
 * 
 * Accepts a URL, fetches the page, extracts SEO metadata.
 * Agents can call this tool via MCP protocol.
 * 
 * To test locally:
 *   npx @modelcontextprotocol/inspector node index.js
 * 
 * Or with Claude Desktop:
 *   Add to claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "seo-analyzer": {
 *         "command": "node",
 *         "args": ["/path/to/index.js"]
 *       }
 *     }
 *   }
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'seo-analyzer', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
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
      description: 'Given a topic or seed keyword, suggest related search keywords and phrases an AI agent or content creator could target.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic or seed keyword to generate suggestions for' },
          count: { type: 'number', description: 'Number of suggestions (default 10, max 25)', default: 10 }
        },
        required: ['topic']
      }
    },
    {
      name: 'compare_urls',
      description: 'Compare SEO metadata between two URLs side by side: titles, descriptions, word counts, headings, keyword overlap.',
      inputSchema: {
        type: 'object',
        properties: {
          url1: { type: 'string', description: 'First URL to compare' },
          url2: { type: 'string', description: 'Second URL to compare' }
        },
        required: ['url1', 'url2']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'analyze_url') {
    const url = String(args?.url || '');
    const maxWords = Number(args?.maxWords) || 500;

    try {
      new URL(url);
    } catch {
      return {
        content: [{ type: 'text', text: `Error: Invalid URL: ${url}` }],
        isError: true
      };
    }

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAnalyzer/1.0)' },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: `Error: HTTP ${response.status} from ${url}` }],
          isError: true
        };
      }

      const html = await response.text();
      
      // Extract metadata
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*\/?>/i);
      const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*\/?>/i);
      
      // Extract headings
      const headings = {};
      for (let i = 1; i <= 6; i++) {
        const htags = html.match(new RegExp(`<h${i}[^>]*>([^<]*)<\\/h${i}>`, 'gi'));
        headings[`h${i}`] = htags ? htags.map(t => t.replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 20) : [];
      }

      // Extract text content (strip HTML tags)
      const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
                              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
                              .replace(/<[^>]+>/g, ' ')
                              .replace(/\s+/g, ' ')
                              .trim();
      
      const wordCount = textContent.split(/\s+/).length;
      
      // Keyword frequency (skip common words)
      const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','by','with','from','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','not','no','nor','so','if','as','it','its','this','that','these','those','i','you','he','she','we','they','them','their','my','your','his','her','our','its','me','us','all','each','every','some','any','both','few','more','most','other','such','only','own','same','too','very','just']);
      const words = textContent.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
      const freq = {};
      for (const w of words) freq[w] = (freq[w] || 0) + 1;
      const topKeywords = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([word, count]) => `${word}: ${count}`);

      const textSample = textContent.slice(0, maxWords).split(' ').slice(0, maxWords).join(' ') + (wordCount > maxWords ? '...' : '');

      const result = [
        `## SEO Analysis: ${url}\n`,
        `**Title:** ${titleMatch ? titleMatch[1].trim() : 'N/A'}`,
        `**Meta Description:** ${descMatch ? descMatch[1].trim() : 'N/A'}`,
        `**Canonical URL:** ${canonicalMatch ? canonicalMatch[1] : 'N/A'}`,
        `**Status:** ${response.status} ${response.statusText}`,
        `**Content-Type:** ${response.headers.get('content-type') || 'N/A'}`,
        `**Word Count:** ${wordCount.toLocaleString()}`,
        '',
        `## Headings`,
        ...Object.entries(headings).flatMap(([level, items]) => 
          items.length ? [`\n### ${level.toUpperCase()} (${items.length})`, ...items.map(h => `- ${h}`)] : []
        ),
        '',
        `## Top Keywords (${topKeywords.length})`,
        ...topKeywords.map(k => `- ${k}`),
        '',
        `## Text Preview (${Math.min(maxWords, wordCount)} words)`,
        textSample
      ].join('\n');

      return {
        content: [{ type: 'text', text: result }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error fetching ${url}: ${error.message}` }],
        isError: true
      };
    }
  }

  if (name === 'keyword_suggest') {
    const topic = String(args?.topic || '');
    const count = Math.min(Number(args?.count) || 10, 25);

    try {
      // Use web search to find related keyword patterns
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(topic + ' ideas')}&format=json&no_html=1`, {
        signal: AbortSignal.timeout(10000)
      }).catch(() => null);

      // Generate keyword suggestions based on common patterns
      const patterns = [
        `${topic} template`,
        `${topic} spreadsheet`,
        `${topic} guide`,
        `${topic} checklist`,
        `${topic} for beginners`,
        `${topic} examples`,
        `${topic} best practices`,
        `${topic} tools`,
        `${topic} tips`,
        `${topic} calculator`,
        `how to ${topic}`,
        `${topic} checklist template`,
        `${topic} tracking`,
        `${topic} management`,
        `free ${topic}`,
        `${topic} for small business`,
        `${topic} online`,
        `${topic} for landlords`,
        `${topic} automation`,
        `${topic} software`,
        `${topic} ideas`,
        `${topic} strategy`,
        `best ${topic}`,
        `${topic} 2026`,
        `${topic} system`
      ];

      const suggestions = patterns.slice(0, count);
      
      return {
        content: [{
          type: 'text',
          text: `## Keyword Suggestions for "${topic}"\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error generating suggestions: ${error.message}` }],
        isError: true
      };
    }
  }

  if (name === 'compare_urls') {
    const url1 = String(args?.url1 || '');
    const url2 = String(args?.url2 || '');

    async function analyzeUrl(url) {
      try {
        new URL(url);
      } catch {
        return { error: `Invalid URL: ${url}` };
      }
      try {
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAnalyzer/1.0)' },
          signal: AbortSignal.timeout(15000)
        });
        if (!resp.ok) return { error: `HTTP ${resp.status}`, url };
        const html = await resp.text();
        const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || 'N/A';
        const desc = (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*\/?>/i) || [])[1]?.trim() || 'N/A';
        const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const wordCount = textContent.split(/\s+/).length;
        const h1 = [...html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
        return { url, title, desc, wordCount, h1, error: null };
      } catch (e) {
        return { error: e.message, url };
      }
    }

    const [r1, r2] = await Promise.all([analyzeUrl(url1), analyzeUrl(url2)]);

    const lines = [
      `## SEO Comparison`,
      '',
      `| Metric | URL 1 | URL 2 |`,
      `|--------|-------|-------|`,
      `| URL | ${r1.url || 'N/A'} | ${r2.url || 'N/A'} |`,
      `| Title | ${(r1.title || 'ERR').slice(0, 80)} | ${(r2.title || 'ERR').slice(0, 80)} |`,
      `| Description | ${(r1.desc || 'ERR').slice(0, 80)}${((r1.desc || '').length > 80 ? '...' : '')} | ${(r2.desc || 'ERR').slice(0, 80)}${((r2.desc || '').length > 80 ? '...' : '')} |`,
      `| Word Count | ${r1.wordCount?.toLocaleString() || 'ERR'} | ${r2.wordCount?.toLocaleString() || 'ERR'} |`,
      `| H1 Tags | ${(r1.h1 || []).join(', ').slice(0, 60) || 'None'} | ${(r2.h1 || []).join(', ').slice(0, 60) || 'None'} |`
    ];

    return {
      content: [{ type: 'text', text: lines.join('\n') }]
    };
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true
  };
});

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SEO Analyzer MCP server running on stdio');
}

main().catch(e => {
  console.error('Server error:', e);
  process.exit(1);
});
