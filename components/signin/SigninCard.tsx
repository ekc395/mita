/** The card in the clearing: a white plate with an inked keyline. */
export function SigninCard({
  title,
  reading,
  children,
}: {
  title: string;
  reading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="signin-card">
      <h1 className="signin-wordmark">{title}</h1>
      <p className="signin-reading" lang="ja">
        {reading}
      </p>
      {children}
    </div>
  );
}
