/** Outlined submit. Fills with ink on hover -- the card's only inversion until an error. */
export function SigninButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={className ? `signin-submit ${className}` : 'signin-submit'} {...props}>
      {children}
    </button>
  );
}
