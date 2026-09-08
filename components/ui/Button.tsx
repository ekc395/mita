import { cx } from './cx';

type Variant = 'solid' | 'outline';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  solid: 'bg-primary text-primary-foreground transition-opacity hover:opacity-90',
  outline: 'border border-border transition-colors hover:bg-accent',
};

/* `lg` is the wizard's sentiment choices, where the button is the whole decision. */
const SIZES: Record<Size, string> = {
  md: 'px-3 py-2',
  lg: 'px-3 py-3',
};

export type ButtonStyle = { variant?: Variant; size?: Size; className?: string };

/** The recipe alone, for button-shaped things that aren't buttons -- a `Link`, mainly. */
export function buttonClass({ variant = 'solid', size = 'md', className }: ButtonStyle = {}) {
  return cx(
    'rounded-lg text-sm font-medium disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ButtonStyle & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}
