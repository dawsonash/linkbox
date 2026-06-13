import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Link } from '@linkbox/shared';
import { run, formatTable, type Deps } from './main.ts';

interface Call {
  url: string;
  init?: RequestInit;
}

/** A Deps stub: queued fetch responses, captured output, recorded calls. */
function harness(responses: Response[]) {
  const calls: Call[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const queue = [...responses];
  const deps: Deps = {
    apiBase: 'http://api.test',
    fetch: (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const next = queue.shift();
      if (!next) throw new Error(`unexpected fetch: ${url}`);
      return next;
    }) as unknown as typeof fetch,
    log: (msg) => out.push(msg),
    error: (msg) => err.push(msg),
  };
  return { deps, calls, out, err };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const link = (over: Partial<Link> = {}): Link => ({
  id: 'id-1',
  url: 'https://a.test',
  title: 'A',
  tags: [],
  savedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

test('help prints usage and exits 0', async () => {
  const h = harness([]);
  assert.equal(await run(['help'], h.deps), 0);
  assert.match(h.out.join('\n'), /usage: lb/);
});

test('no command prints usage', async () => {
  const h = harness([]);
  assert.equal(await run([], h.deps), 0);
  assert.match(h.out.join('\n'), /usage: lb/);
});

test('add posts url and tags, prints the new id', async () => {
  const h = harness([json(link({ id: 'abc', title: 'Saved' }), 201)]);
  const code = await run(['add', 'https://a.test', '--tag', 'work', '--tag', 'read'], h.deps);
  assert.equal(code, 0);
  assert.equal(h.calls[0].url, 'http://api.test/links');
  assert.equal(h.calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(h.calls[0].init?.body)), {
    url: 'https://a.test',
    tags: ['work', 'read'],
  });
  assert.match(h.out.join('\n'), /added abc {2}Saved/);
});

test('add supports --tag=value form', async () => {
  const h = harness([json(link(), 201)]);
  await run(['add', 'https://a.test', '--tag=x'], h.deps);
  assert.deepEqual(JSON.parse(String(h.calls[0].init?.body)).tags, ['x']);
});

test('add without a url errors and exits 1 without calling the api', async () => {
  const h = harness([]);
  const code = await run(['add', '--tag', 'x'], h.deps);
  assert.equal(code, 1);
  assert.equal(h.calls.length, 0);
  assert.match(h.err.join('\n'), /usage: lb add/);
});

test('add surfaces an api error', async () => {
  const h = harness([json({ error: 'url is required' }, 400)]);
  const code = await run(['add', 'https://a.test'], h.deps);
  assert.equal(code, 1);
  assert.match(h.err.join('\n'), /add failed: 400/);
});

test('list renders a table of links', async () => {
  const h = harness([
    json([
      link({ id: 'id-1', title: 'First', tags: ['a', 'b'], url: 'https://one.test' }),
      link({ id: 'id-2', title: 'Second', tags: [], url: 'https://two.test' }),
    ]),
  ]);
  const code = await run(['list'], h.deps);
  assert.equal(code, 0);
  const table = h.out.join('\n');
  assert.match(table, /ID\s+TITLE\s+TAGS\s+URL/);
  assert.match(table, /id-1\s+First\s+a,b\s+https:\/\/one\.test/);
  assert.match(table, /id-2\s+Second\s+https:\/\/two\.test/);
});

test('list prints a friendly message when empty', async () => {
  const h = harness([json([])]);
  await run(['list'], h.deps);
  assert.match(h.out.join('\n'), /no links yet/);
});

test('rm deletes by id and confirms', async () => {
  const h = harness([new Response(null, { status: 204 })]);
  const code = await run(['rm', 'id-1'], h.deps);
  assert.equal(code, 0);
  assert.equal(h.calls[0].url, 'http://api.test/links/id-1');
  assert.equal(h.calls[0].init?.method, 'DELETE');
  assert.match(h.out.join('\n'), /removed id-1/);
});

test('rm reports a 404 as a missing id', async () => {
  const h = harness([new Response(null, { status: 404 })]);
  const code = await run(['rm', 'nope'], h.deps);
  assert.equal(code, 1);
  assert.match(h.err.join('\n'), /no link with id nope/);
});

test('rm without an id errors', async () => {
  const h = harness([]);
  const code = await run(['rm'], h.deps);
  assert.equal(code, 1);
  assert.equal(h.calls.length, 0);
});

test('unknown command errors and prints usage', async () => {
  const h = harness([]);
  const code = await run(['frobnicate'], h.deps);
  assert.equal(code, 1);
  assert.match(h.err.join('\n'), /unknown command: frobnicate/);
});

test('formatTable column widths fit the widest cell', () => {
  const table = formatTable([link({ id: 'short', title: 'a much longer title' })]);
  const [header] = table.split('\n');
  assert.ok(header.indexOf('TITLE') >= 'short'.length);
});

test('search sends q and repeated tag params and renders matches', async () => {
  const h = harness([json([link({ id: 'm1', title: 'Match' })])]);
  const code = await run(['search', 'match', '--tag', 'work', '--tag', 'read'], h.deps);
  assert.equal(code, 0);
  const url = new URL(h.calls[0].url);
  assert.equal(url.pathname, '/links');
  assert.equal(url.searchParams.get('q'), 'match');
  assert.deepEqual(url.searchParams.getAll('tag'), ['work', 'read']);
  assert.match(h.out.join('\n'), /m1\s+Match/);
});

test('search works with --tag only (no query)', async () => {
  const h = harness([json([link({ id: 'm1' })])]);
  const code = await run(['search', '--tag', 'work'], h.deps);
  assert.equal(code, 0);
  const url = new URL(h.calls[0].url);
  assert.equal(url.searchParams.get('q'), null);
  assert.deepEqual(url.searchParams.getAll('tag'), ['work']);
});

test('search prints "no matches" on an empty result', async () => {
  const h = harness([json([])]);
  const code = await run(['search', 'nothing'], h.deps);
  assert.equal(code, 0);
  assert.match(h.out.join('\n'), /no matches/);
});

test('search without a query or tag errors without calling the api', async () => {
  const h = harness([]);
  const code = await run(['search'], h.deps);
  assert.equal(code, 1);
  assert.equal(h.calls.length, 0);
  assert.match(h.err.join('\n'), /usage: lb search/);
});
