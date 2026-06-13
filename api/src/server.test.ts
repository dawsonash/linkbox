import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Link, LinkStore } from '@linkbox/shared';
import { createServer, type TitleFetcher } from './server.ts';

/** In-memory LinkStore so route tests don't touch the filesystem. */
class MemoryStore implements LinkStore {
  private links: Link[] = [];
  private seq = 0;

  async list(): Promise<Link[]> {
    return [...this.links];
  }

  async add(link: Omit<Link, 'id' | 'savedAt'>): Promise<Link> {
    const saved: Link = { id: `id-${++this.seq}`, savedAt: '2026-01-01T00:00:00.000Z', ...link };
    this.links.push(saved);
    return saved;
  }

  async remove(id: string): Promise<boolean> {
    const before = this.links.length;
    this.links = this.links.filter((l) => l.id !== id);
    return this.links.length < before;
  }
}

async function withServer(
  fn: (base: string, store: MemoryStore) => Promise<void>,
  fetchTitle: TitleFetcher = async () => 'fetched title',
) {
  const store = new MemoryStore();
  const server = createServer(store, fetchTitle);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://localhost:${port}`, store);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('GET /links returns the stored links as JSON', async () => {
  await withServer(async (base, store) => {
    await store.add({ url: 'https://a.test', title: 'A', tags: [] });
    const res = await fetch(`${base}/links`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as Link[];
    assert.equal(body.length, 1);
    assert.equal(body[0].url, 'https://a.test');
  });
});

test('GET /links filters by tag and q query params', async () => {
  await withServer(async (base, store) => {
    await store.add({ url: 'https://rust.test', title: 'Rust', tags: ['rust', 'read'] });
    await store.add({ url: 'https://ts.test', title: 'TypeScript', tags: ['ts', 'read'] });

    const byTag = (await (await fetch(`${base}/links?tag=rust`)).json()) as Link[];
    assert.deepEqual(byTag.map((l) => l.title), ['Rust']);

    const byQ = (await (await fetch(`${base}/links?q=script`)).json()) as Link[];
    assert.deepEqual(byQ.map((l) => l.title), ['TypeScript']);

    const combined = (await (await fetch(`${base}/links?tag=read&q=rust`)).json()) as Link[];
    assert.deepEqual(combined.map((l) => l.title), ['Rust']);
  });
});

test('POST /links uses the provided title without fetching', async () => {
  await withServer(
    async (base) => {
      const res = await fetch(`${base}/links`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://a.test', title: 'Given', tags: ['x'] }),
      });
      assert.equal(res.status, 201);
      const link = (await res.json()) as Link;
      assert.equal(link.title, 'Given');
      assert.deepEqual(link.tags, ['x']);
      assert.ok(link.id);
    },
    async () => {
      throw new Error('fetchTitle should not be called when a title is given');
    },
  );
});

test('POST /links fetches the page title when none is given', async () => {
  await withServer(
    async (base) => {
      const res = await fetch(`${base}/links`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://a.test' }),
      });
      assert.equal(res.status, 201);
      const link = (await res.json()) as Link;
      assert.equal(link.title, 'fetched title');
    },
    async () => 'fetched title',
  );
});

test('POST /links falls back to the url when the title cannot be fetched', async () => {
  await withServer(
    async (base) => {
      const res = await fetch(`${base}/links`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://a.test' }),
      });
      const link = (await res.json()) as Link;
      assert.equal(link.title, 'https://a.test');
    },
    async () => undefined,
  );
});

test('POST /links rejects a body without a url', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tags: ['x'] }),
    });
    assert.equal(res.status, 400);
  });
});

test('POST /links rejects an invalid json body', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    assert.equal(res.status, 400);
  });
});

test('DELETE /links/:id removes an existing link', async () => {
  await withServer(async (base, store) => {
    const link = await store.add({ url: 'https://a.test', title: 'A', tags: [] });
    const res = await fetch(`${base}/links/${link.id}`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    assert.deepEqual(await store.list(), []);
  });
});

test('DELETE /links/:id returns 404 for an unknown id', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/links/missing`, { method: 'DELETE' });
    assert.equal(res.status, 404);
  });
});

test('unknown routes return 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
  });
});
