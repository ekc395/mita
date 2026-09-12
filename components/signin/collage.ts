/** Source w/h per tile, measured from the files in `public/manga/bed/`. Kept
 *  here rather than on each placement: aspect belongs to the image, and a
 *  repeated tile would otherwise carry two copies nothing keeps in agreement. */
export const TILE_ASPECT: Record<number, number> = {
  0: 1.416,
  1: 0.700,
  2: 1.716,
  3: 0.631,
  4: 1.288,
  5: 0.667,
  6: 0.681,
  7: 0.666,
  8: 1.336,
  9: 0.647,
  10: 1.376,
  11: 0.805,
  12: 1.333,
  13: 0.695,
  14: 0.652,
  15: 0.642,
  16: 0.892,
  17: 0.703,
  18: 0.673,
  19: 0.598,
  20: 0.672,
  21: 1.362,
  22: 0.688,
  23: 1.342,
};

/** Whole pages, uncropped, so panel borders and gutters survive. Height derives
 *  from TILE_ASPECT so nothing is squashed. Coverage is verified, not eyeballed
 *  -- each rotated box projected onto a 1440x900 grid, no cell bare. `width` is
 *  px at that reference width, emitted as vw so size and position scale
 *  together at any viewport. Five tiles repeat, placed far apart, to fill
 *  corners. Tile 22 (near-solid black) stays small or it reads as a hole. */
export const SHEET = [
  // Top band
  { tile: 0, left: '-5%', top: '-8%', width: 400, rotate: -3 },
  { tile: 15, left: '14%', top: '-7%', width: 210, rotate: 3 },
  { tile: 2, left: '25%', top: '-9%', width: 350, rotate: -2 },
  { tile: 9, left: '46%', top: '-8%', width: 230, rotate: 3 },
  { tile: 6, left: '62%', top: '-6%', width: 240, rotate: -4 },
  { tile: 23, left: '76%', top: '-7%', width: 370, rotate: 2 },

  // Upper middle band
  { tile: 3, left: '-7%', top: '16%', width: 245, rotate: -3 },
  { tile: 16, left: '8%', top: '12%', width: 230, rotate: 4 },
  { tile: 21, left: '23%', top: '10%', width: 320, rotate: -2 },
  { tile: 7, left: '44%', top: '9%', width: 220, rotate: 3 },
  { tile: 20, left: '59%', top: '13%', width: 235, rotate: -3 },
  { tile: 4, left: '74%', top: '17%', width: 350, rotate: 2 },

  // Lower middle band -- runs behind the card
  { tile: 11, left: '-5%', top: '40%', width: 225, rotate: 4 },
  { tile: 17, left: '10%', top: '34%', width: 240, rotate: -4 },
  { tile: 10, left: '25%', top: '32%', width: 330, rotate: 2 },
  { tile: 13, left: '46%', top: '36%', width: 220, rotate: -3 },
  { tile: 22, left: '61%', top: '34%', width: 190, rotate: 4 },
  { tile: 12, left: '75%', top: '38%', width: 340, rotate: -2 },

  // Bottom band
  { tile: 5, left: '-6%', top: '62%', width: 235, rotate: 3 },
  { tile: 18, left: '8%', top: '58%', width: 230, rotate: -4 },
  { tile: 8, left: '22%', top: '60%', width: 340, rotate: 3 },
  { tile: 1, left: '43%', top: '58%', width: 235, rotate: -3 },
  { tile: 19, left: '58%', top: '60%', width: 220, rotate: 4 },
  { tile: 14, left: '72%', top: '60%', width: 230, rotate: -3 },

  // Corner and edge fills -- repeats, placed away from their twin
  { tile: 3, left: '86%', top: '62%', width: 250, rotate: 3 },
  { tile: 6, left: '88%', top: '24%', width: 240, rotate: -3 },
  { tile: 12, left: '30%', top: '78%', width: 320, rotate: -2 },
  { tile: 21, left: '48%', top: '76%', width: 300, rotate: 3 },
  { tile: 16, left: '11%', top: '74%', width: 280, rotate: -3 },
] as const;
