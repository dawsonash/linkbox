import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LinkStore } from '@linkbox/shared';
import { JsonFileStore } from './store.ts';

const PORT = Number(process.env.PORT ?? 4321);
const MAX_BODY_BYTES = 1_000_000;

/** Resolves a page's <title>, or undefined if it can't be fetched/parsed. */
export type TitleFetcher = (url: string) => Promise<string | undefined>;

export async function fetchPageTitle(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const html = await res.text();
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match?.[1]?.trim().replace(/\s+/g, ' ') || undefined;
  } catch {
    return undefined;
  }
}

export function createServer(
  store: LinkStore,
  fetchTitle: TitleFetcher = fetchPageTitle,
): http.Server {
  return http.createServer((req, res) => {
    handle(req, res, store, fetchTitle).catch((err) => {
      send(res, 500, { error: err instanceof Error ? err.message : String(err) });
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  store: LinkStore,
  fetchTitle: TitleFetcher,
): Promise<void> {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';

  if (method === 'GET' && pathname === '/health') {
    return send(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/links') {
    return send(res, 200, await store.list());
  }

  if (method === 'POST' && pathname === '/links') {
    let body: unknown;
    try {
      body = await readJson(req);
    } catch {
      return send(res, 400, { error: 'invalid json body' });
    }
    const input = body as { url?: unknown; title?: unknown; tags?: unknown };
    if (typeof input?.url !== 'string' || input.url.trim().length === 0) {
      return send(res, 400, { error: 'url is required' });
    }
    const url = input.url.trim();
    const givenTitle = typeof input.title === 'string' ? input.title.trim() : '';
    const title = givenTitle || (await fetchTitle(url)) || url;
    const tags = Array.isArray(input.tags)
      ? input.tags.filter((t): t is string => typeof t === 'string')
      : [];
    const link = await store.add({ url, title, tags });
    return send(res, 201, link);
  }

  const del = pathname.match(/^\/links\/([^/]+)$/);
  if (method === 'DELETE' && del) {
    const removed = await store.remove(decodeURIComponent(del[1]));
    return removed ? send(res, 204) : send(res, 404, { error: 'not found' });
  }

  return send(res, 404, { error: 'not found' });
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (data.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const isMain = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const server = createServer(new JsonFileStore());
  server.listen(PORT, () => {
    console.log(`linkbox api listening on http://localhost:${PORT}`);
  });
}
