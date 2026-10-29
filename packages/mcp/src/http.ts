// The shared mode of the server: one process, many clients over HTTP. Each MCP session has its own
// server and transport, so the family of each reader stays its own. The listener binds to the
// loopback address, and a request with a Host or Origin that is not loopback is refused, because a
// web page can reach a local port through a rebound name.

import { randomUUID } from 'node:crypto';
import {
  createServer as listen,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export const HTTP_HOST = '127.0.0.1';
export const HTTP_PATH = '/mcp';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

const hostnameOf = (authority: string): string => {
  try {
    return new URL(`http://${authority}`).hostname;
  } catch {
    return '';
  }
};

/** True when the Host is loopback and any Origin is loopback too. */
export const isLoopbackRequest = (request: IncomingMessage): boolean => {
  const host = request.headers.host;
  if (host === undefined || !LOOPBACK.has(hostnameOf(host))) return false;
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  try {
    return LOOPBACK.has(new URL(origin).hostname);
  } catch {
    return false;
  }
};

const MAX_BODY = 4 * 1024 * 1024;

const bodyOf = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const part = chunk as Buffer;
    size += part.length;
    if (size > MAX_BODY) throw new Error('the body is too large');
    chunks.push(part);
  }
  return chunks.length === 0 ? undefined : JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

interface Live {
  readonly transport: StreamableHTTPServerTransport;
  readonly server: McpServer;
}

/** Serve `makeServer` over HTTP on the loopback address. Port 0 picks a free port. */
export const serveHttp = (makeServer: () => McpServer, port: number): Promise<Server> => {
  const sessions = new Map<string, Live>();

  const refuse = (response: ServerResponse, status: number, text: string): undefined => {
    response.writeHead(status, { 'content-type': 'text/plain' }).end(text);
    return undefined;
  };

  const http = listen((request, response) => {
    void (async () => {
      if (!isLoopbackRequest(request)) {
        refuse(response, 403, 'the host is not loopback');
        return;
      }
      if (new URL(request.url ?? '/', 'http://x').pathname !== HTTP_PATH) {
        refuse(response, 404, 'the path is /mcp');
        return;
      }

      const given = request.headers['mcp-session-id'];
      const id = Array.isArray(given) ? given[0] : given;
      const live = id === undefined ? undefined : sessions.get(id);
      if (id !== undefined && live === undefined) {
        refuse(response, 404, 'no such session');
        return;
      }
      if (live !== undefined) return live.transport.handleRequest(request, response);

      // A request with no session starts one, and only an initialize request is a start.
      if (request.method !== 'POST') {
        refuse(response, 400, 'no session');
        return;
      }
      const body = await bodyOf(request);
      const server = makeServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        onsessioninitialized: (made) => {
          sessions.set(made, { transport, server });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId !== undefined) sessions.delete(transport.sessionId);
        void server.close();
      };
      // The class is a Transport; its optional members differ only under exactOptionalPropertyTypes.
      await server.connect(transport as Transport);
      await transport.handleRequest(request, response, body);
    })().catch((fault: unknown) => {
      console.error(`an HTTP request failed: ${fault instanceof Error ? fault.message : 'fault'}`);
      if (!response.headersSent) refuse(response, 400, 'the request failed');
    });
  });

  http.on('close', () => {
    for (const { transport } of sessions.values()) void transport.close();
  });

  return new Promise((done, fail) => {
    http.once('error', fail);
    http.listen(port, HTTP_HOST, () => {
      done(http);
    });
  });
};
