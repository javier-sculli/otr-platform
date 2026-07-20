import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.js';
import { OtrMcpAuthProvider } from './oauth/provider.js';
import { registerGoogleCallbackRoute } from './oauth/google-callback.js';
import { registerTools } from './tools/index.js';

const app = express();
app.use(
  cors({
    origin: true,
    // Los clientes MCP (Inspector, Claude Desktop/Slack) corren en otro origen y
    // necesitan leer estos headers para descubrir metadata OAuth y mantener sesión.
    exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id', 'Mcp-Protocol-Version'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const issuerUrl = new URL(config.publicUrl);
const provider = new OtrMcpAuthProvider();

app.use(mcpAuthRouter({
  provider,
  issuerUrl,
  scopesSupported: ['otr:tools'],
}));

registerGoogleCallbackRoute(app, provider);

const authMiddleware = requireBearerAuth({
  verifier: provider,
  requiredScopes: [],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(issuerUrl),
});

function buildMcpServer() {
  const server = new McpServer({ name: 'otr-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });
  registerTools(server);
  return server;
}

const transports: Record<string, StreamableHTTPServerTransport> = {};

app.post('/mcp', authMiddleware, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) delete transports[sid];
      };

      const mcpServer = buildMcpServer();
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('Error manejando request MCP', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

async function handleSessionRequest(req: express.Request, res: express.Response) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const transport = sessionId ? transports[sessionId] : undefined;
  if (!transport) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  await transport.handleRequest(req, res);
}

app.get('/mcp', authMiddleware, handleSessionRequest);
app.delete('/mcp', authMiddleware, handleSessionRequest);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(config.port, () => {
  console.log(`🔌 MCP server running on http://localhost:${config.port}`);
});
