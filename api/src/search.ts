import type { Link } from '@linkbox/shared';

export interface LinkQuery {
  /** Tags that must all be present on a link (AND), compared case-insensitively. */
  tags: string[];
  /** Case-insensitive substring matched against the title and url. */
  q?: string;
}

/**
 * Narrows links to those matching the query. An empty query (no tags, no text)
 * returns every link unchanged, so callers can route all GET /links through it.
 */
export function filterLinks(links: Link[], query: LinkQuery): Link[] {
  const wanted = query.tags.map((tag) => tag.toLowerCase());
  const needle = query.q?.trim().toLowerCase();

  return links.filter((link) => {
    if (wanted.length > 0) {
      const have = link.tags.map((tag) => tag.toLowerCase());
      if (!wanted.every((tag) => have.includes(tag))) return false;
    }
    if (needle) {
      const haystack = `${link.title} ${link.url}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
