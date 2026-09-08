/** Joins class names, dropping falsy ones. No clsx: nothing here needs conflict resolution. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
