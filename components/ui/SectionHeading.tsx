import { cx } from './cx';

/** Small-caps heading over a section of rows. Callers own the top margin. */
export function SectionHeading({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      className={cx(
        'text-sm font-semibold uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      {children}
    </h2>
  );
}
