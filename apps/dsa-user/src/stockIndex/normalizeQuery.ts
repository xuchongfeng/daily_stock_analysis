export function normalizeQuery(query: string): string {
  return query.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');
}
