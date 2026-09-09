import { cx } from './cx';

/** The recipe alone, for field-shaped non-inputs. `bg-transparent` stops the UA painting
 *  its own background; width is the caller's, since cx cannot resolve conflicts. */
export function inputClass(className?: string): string {
  return cx(
    'rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground',
    className,
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass(cx('w-full', className))} {...props} />;
}
