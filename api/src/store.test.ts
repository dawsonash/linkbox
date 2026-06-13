import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonFileStore } from './store.ts';

async function withStore(fn: (store: JsonFileStore, file: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'linkbox-'));
  const file = path.join(dir, 'links.json');
  try {
    await fn(new JsonFileStore(file), file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('list returns empty array when the file does not exist', async () => {
  await withStore(async (store) => {
    assert.deepEqual(await store.list(), []);
  });
});

test('add assigns an id and savedAt, and persists', async () => {
  await withStore(async (store, file) => {
    const link = await store.add({ url: 'https://x.test', title: 'X', tags: ['a'] });
    assert.ok(link.id);
    assert.ok(link.savedAt);
    assert.equal(link.url, 'https://x.test');

    const onDisk = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(onDisk.length, 1);
    assert.equal(onDisk[0].id, link.id);
  });
});

test('list returns added links across instances', async () => {
  await withStore(async (store, file) => {
    await store.add({ url: 'https://one.test', title: 'one', tags: [] });
    await store.add({ url: 'https://two.test', title: 'two', tags: [] });

    const reopened = new JsonFileStore(file);
    const links = await reopened.list();
    assert.deepEqual(
      links.map((l) => l.url),
      ['https://one.test', 'https://two.test'],
    );
  });
});

test('remove deletes a matching link and reports success', async () => {
  await withStore(async (store) => {
    const link = await store.add({ url: 'https://x.test', title: 'X', tags: [] });
    assert.equal(await store.remove(link.id), true);
    assert.deepEqual(await store.list(), []);
  });
});

test('remove returns false for an unknown id', async () => {
  await withStore(async (store) => {
    await store.add({ url: 'https://x.test', title: 'X', tags: [] });
    assert.equal(await store.remove('nope'), false);
    assert.equal((await store.list()).length, 1);
  });
});
