/** Underlined email field. The label is visually hidden, never absent -- placeholders vanish on typing. */
export function SigninField({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <>
      <label htmlFor={id} className="signin-label">
        {label}
      </label>
      <input id={id} className="signin-field" {...props} />
    </>
  );
}
