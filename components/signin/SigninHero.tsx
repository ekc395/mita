import { BED_ROWS, CUTOUTS } from './collage';

import './signin.css';

/** The layered sign-in backdrop. Purely decorative: every layer is aria-hidden,
 *  so the caller's card is all a screen reader sees. */
export function SigninHero({ children }: { children: React.ReactNode }) {
  let tile = 0;

  return (
    <main className="signin">
      <div className="signin-bed" aria-hidden="true">
        {BED_ROWS.map((weights, row) => (
          <div key={row} className="signin-bed-row">
            {weights.map((weight) => {
              const index = tile++;
              return (
                <div
                  key={index}
                  className="signin-bed-tile"
                  style={{ flex: weight, backgroundImage: `url(/manga/bed/${index}.jpg)` }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="signin-vignette" aria-hidden="true" />

      {CUTOUTS.map(({ src, width, height, rotate, ...edges }) => (
        <div
          key={src}
          aria-hidden="true"
          className="signin-cut"
          style={{
            ...edges,
            transform: 'scale(var(--cut-scale, 1)) rotate(var(--cut-rotate, 0deg))',
            width,
            height,
            ['--cut-rotate' as string]: `${rotate}deg`,
            backgroundImage: `url(${src})`,
          }}
        />
      ))}

      {children}
    </main>
  );
}
