import type { Link } from '@linkbox/shared';

const USAGE = `usage: lb <command>

  add <url> [--tag x --tag y]   save a link (title is fetched by the api)
  list                          list saved links as a table
  rm <id>                       remove a link by id
  help                          show this message`;

export interface Deps {
  fetch: typeof fetch;
  log: (msg: string) => void;
  error: (msg: string) => void;
  apiBase: string;
}

/** Runs one CLI invocation. Returns the process exit code. */
export async function run(argv: string[], deps: Deps): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case undefined:
    case 'help':
      deps.log(USAGE);
      return 0;
    case 'add':
      return add(rest, deps);
    case 'list':
      return list(deps);
    case 'rm':
      return remove(rest, deps);
    default:
      deps.error(`unknown command: ${command}`);
      deps.log(USAGE);
      return 1;
  }
}

async function add(args: string[], deps: Deps): Promise<number> {
  let url: string | undefined;
  const tags: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tag') {
      const value = args[++i];
      if (value) tags.push(value);
    } else if (arg.startsWith('--tag=')) {
      tags.push(arg.slice('--tag='.length));
    } else if (!url) {
      url = arg;
    }
  }

  if (!url) {
    deps.error('usage: lb add <url> [--tag x --tag y]');
    return 1;
  }

  const res = await deps.fetch(`${deps.apiBase}/links`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, tags }),
  });
  if (!res.ok) {
    deps.error(`add failed: ${res.status} ${res.statusText}`.trim());
    return 1;
  }

  const link = (await res.json()) as Link;
  deps.log(`added ${link.id}  ${link.title}`);
  return 0;
}

async function list(deps: Deps): Promise<number> {
  const res = await deps.fetch(`${deps.apiBase}/links`);
  if (!res.ok) {
    deps.error(`list failed: ${res.status} ${res.statusText}`.trim());
    return 1;
  }

  const links = (await res.json()) as Link[];
  if (links.length === 0) {
    deps.log('no links yet — add one with `lb add <url>`');
    return 0;
  }

  deps.log(formatTable(links));
  return 0;
}

async function remove(args: string[], deps: Deps): Promise<number> {
  const [id] = args;
  if (!id) {
    deps.error('usage: lb rm <id>');
    return 1;
  }

  const res = await deps.fetch(`${deps.apiBase}/links/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (res.status === 404) {
    deps.error(`no link with id ${id}`);
    return 1;
  }
  if (!res.ok) {
    deps.error(`rm failed: ${res.status} ${res.statusText}`.trim());
    return 1;
  }

  deps.log(`removed ${id}`);
  return 0;
}

/** Renders links as a left-aligned, space-padded table. */
export function formatTable(links: Link[]): string {
  const headers = ['ID', 'TITLE', 'TAGS', 'URL'];
  const rows = links.map((link) => [link.id, link.title, link.tags.join(','), link.url]);
  const widths = headers.map((header, col) =>
    Math.max(header.length, ...rows.map((row) => row[col].length)),
  );
  const render = (cells: string[]) =>
    cells.map((cell, col) => cell.padEnd(widths[col])).join('  ').trimEnd();
  return [render(headers), ...rows.map(render)].join('\n');
}

const isMain = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const code = await run(process.argv.slice(2), {
    fetch,
    log: (msg) => console.log(msg),
    error: (msg) => console.error(msg),
    apiBase: process.env.LINKBOX_API ?? 'http://localhost:4321',
  });
  process.exitCode = code;
}
