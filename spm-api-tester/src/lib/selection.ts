/** Keep a controlled resource id only while it still exists; otherwise fall
 * back to the first current registry id. Session reset and cascade deletes
 * must not strand selectors on stale local state. */
export function existingOrFirst(selected: string, ids: string[]): string {
  return ids.includes(selected) ? selected : (ids[0] ?? "");
}
