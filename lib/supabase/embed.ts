/**
 * supabase-js inference on aliased FK-hinted embeds is unreliable: a to-one embed
 * arrives as an object or a one-element array. Casting the shape away made an
 * array render as a missing join -- "Someone" on every feed row -- silently.
 */
export function toOne<T>(embed: T | T[] | null | undefined, label: string): T | null {
  if (embed == null) return null;
  if (!Array.isArray(embed)) return embed;
  if (embed.length === 0) return null;

  // Several rows means the relationship is not to-one and the caller's type is
  // wrong -- better to fail than to silently drop rows.
  if (embed.length > 1) {
    throw new Error(`${label}: expected a to-one embed, got ${embed.length} rows`);
  }

  return embed[0];
}
