import { SHEET, TILE_ASPECT } from './collage';

import './signin.css';

/** Viewport `SHEET` widths were tuned against; they are emitted as vw, not px,
 *  so the pile scales instead of only covering this one size. */
const REF_WIDTH = 1440;

/** Decorative only: every layer is aria-hidden, so a screen reader sees just the card. */
export function SigninHero({ children }: { children: React.ReactNode }) {
  return (
    <main className="signin">
      <div className="signin-bed" aria-hidden="true">
        {SHEET.map(({ tile, left, top, width, rotate }, i) => (
          <div
            key={i}
            className="signin-sheet-page"
            style={{
              left,
              top,
              width: `${(width / REF_WIDTH) * 100}vw`,
              height: `${(width / TILE_ASPECT[tile] / REF_WIDTH) * 100}vw`,
              transform: `scale(var(--sheet-scale, 1)) rotate(${rotate}deg)`,
              backgroundImage: `url(/manga/bed/${tile}.jpg)`,
            }}
          />
        ))}
      </div>

      <div className="signin-vignette" aria-hidden="true" />

      {children}
    </main>
  );
}
