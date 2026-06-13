import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Link, LinkStore } from '@linkbox/shared';

const DEFAULT_FILE = path.join(homedir(), '.linkbox', 'links.json');

/**
 * LinkStore backed by a single JSON file. Writes are atomic: we serialise to a
 * sibling temp file and rename it over the target, so a crash mid-write never
 * leaves a half-written links.json behind.
 */
export class JsonFileStore implements LinkStore {
  constructor(private readonly file: string = DEFAULT_FILE) {}

  async list(): Promise<Link[]> {
    return this.read();
  }

  async add(link: Omit<Link, 'id' | 'savedAt'>): Promise<Link> {
    const links = await this.read();
    const saved: Link = {
      id: randomUUID(),
      savedAt: new Date().toISOString(),
      ...link,
    };
    links.push(saved);
    await this.write(links);
    return saved;
  }

  async remove(id: string): Promise<boolean> {
    const links = await this.read();
    const next = links.filter((link) => link.id !== id);
    if (next.length === links.length) return false;
    await this.write(next);
    return true;
  }

  private async read(): Promise<Link[]> {
    try {
      const raw = await readFile(this.file, 'utf8');
      return JSON.parse(raw) as Link[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  private async write(links: Link[]): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(links, null, 2), 'utf8');
    await rename(tmp, this.file);
  }
}
