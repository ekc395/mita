/** Monochrome has no red to spend, so an error inverts instead. */
export function SigninError({ children }: { children: React.ReactNode }) {
  return (
    <p className="signin-error" role="alert">
      {children}
    </p>
  );
}
