import { RankedRow, type RankedEntry } from '@/components/RankedRow';
import { cx } from '@/components/ui/cx';

/** The ranked block, identical on your own list and on a profile. */
export function RankedList({ rows, className }: { rows: RankedEntry[]; className?: string }) {
  if (rows.length === 0) return null;

  return (
    <ol className={cx('space-y-1', className)}>
      {rows.map((row, index) => (
        <RankedRow key={row.anilist_id} row={row} position={index + 1} />
      ))}
    </ol>
  );
}
