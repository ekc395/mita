import { cx } from './cx';

/** `bg-transparent` is load-bearing: without it the UA paints its own control background. */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground',
        className,
      )}
      {...props}
    />
  );
}
