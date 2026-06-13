import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Link } from '@linkbox/shared';
import { filterLinks } from './search.ts';

const link = (over: Partial<Link>): Link => ({
  id: 'id',
  url: 'https://example.com',
  title: 'Example',
  tags: [],
  savedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const links: Link[] = [
  link({ id: '1', title: 'Rust Book', url: 'https://doc.rust-lang.org', tags: ['rust', 'read'] }),
  link({ id: '2', title: 'TypeScript Guide', url: 'https://ts.dev', tags: ['ts', 'read'] }),
  link({ id: '3', title: 'Cooking pasta', url: 'https://food.test/pasta', tags: ['food'] }),
];

const ids = (result: Link[]) => result.map((l) => l.id);

test('empty query returns all links', () => {
  assert.deepEqual(ids(filterLinks(links, { tags: [] })), ['1', '2', '3']);
});

test('q matches a case-insensitive substring of the title', () => {
  assert.deepEqual(ids(filterLinks(links, { tags: [], q: 'rust' })), ['1']);
  assert.deepEqual(ids(filterLinks(links, { tags: [], q: 'BOOK' })), ['1']);
});

test('q also matches the url', () => {
  assert.deepEqual(ids(filterLinks(links, { tags: [], q: 'food.test' })), ['3']);
});

test('a single tag filters by membership, case-insensitively', () => {
  assert.deepEqual(ids(filterLinks(links, { tags: ['read'] })), ['1', '2']);
  assert.deepEqual(ids(filterLinks(links, { tags: ['RUST'] })), ['1']);
});

test('multiple tags require all to be present (AND)', () => {
  assert.deepEqual(ids(filterLinks(links, { tags: ['rust', 'read'] })), ['1']);
  assert.deepEqual(ids(filterLinks(links, { tags: ['rust', 'ts'] })), []);
});

test('tag and q combine', () => {
  assert.deepEqual(ids(filterLinks(links, { tags: ['read'], q: 'guide' })), ['2']);
  assert.deepEqual(ids(filterLinks(links, { tags: ['food'], q: 'rust' })), []);
});

test('blank q is ignored rather than matching nothing', () => {
  assert.deepEqual(ids(filterLinks(links, { tags: [], q: '   ' })), ['1', '2', '3']);
});
