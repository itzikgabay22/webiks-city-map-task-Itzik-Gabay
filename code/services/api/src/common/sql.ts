/** LIKE pattern matching values that start with the query, with wildcards escaped. */
export function likePrefix(query: string): string {
  return query.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
}
