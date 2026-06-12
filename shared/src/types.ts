/** A saved link. The whole domain model lives here, shared by api and cli. */
export interface Link {
  id: string;
  url: string;
  title: string;
  tags: string[];
  savedAt: string; // ISO timestamp
}

export interface LinkStore {
  list(): Promise<Link[]>;
  add(link: Omit<Link, 'id' | 'savedAt'>): Promise<Link>;
  remove(id: string): Promise<boolean>;
}
