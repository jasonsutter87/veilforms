/**
 * VeilForms API Server
 * Simple HTTP server wrapper for Netlify Functions in Docker deployment
 */

import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Function registry
const functions = new Map();

// Load all function files
async function loadFunctions() {
  const files = await fs.readdir(__dirname);

  for (const file of files) {
    if (file.endsWith('.js') && file !== 'server.js') {
      try {
        const modulePath = join(__dirname, file);
        const module = await import(modulePath);

        if (module.default && module.config?.path) {
          functions.set(module.config.path, module.default);
          console.log(`Loaded function: ${module.config.path}`);
        }
      } catch (error) {
        console.error(`Failed to load ${file}:`, error.message);
      }
    }
  }
}

// Parse request body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Create server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // CORS headers
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',');
  const origin = req.headers.origin;

  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Find matching function
  const handler = functions.get(path);

  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
    return;
  }

  try {
    // Parse body for POST/PUT/PATCH
    let body = {};
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      body = await parseBody(req);
    }

    // Create request context
    const context = {
      req,
      cookies: parseCookies(req.headers.cookie || ''),
      params: Object.fromEntries(url.searchParams),
      json: () => Promise.resolve(body)
    };

    // Call handler
    const result = await handler({
      method: req.method,
      headers: req.headers,
      url: req.url,
      body: JSON.stringify(body),
      json: () => Promise.resolve(body)
    }, context);

    // Send response
    res.writeHead(result.statusCode || 200, result.headers || {});
    res.end(result.body);
  } catch (error) {
    console.error('Handler error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    }));
  }
});

// Parse cookies
function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name) cookies[name] = value;
  });
  return cookies;
}

// Start server
async function start() {
  await loadFunctions();

  server.listen(PORT, HOST, () => {
    console.log(`VeilForms API Server running on http://${HOST}:${PORT}`);
    console.log(`Loaded ${functions.size} functions`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start
start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
