/** Placement of the four die-cut figures, one per corner. */
export const CUTOUTS = [
  { src: '/manga/group.png', left: '2%', top: '7%', width: 212, height: 321, rotate: -6 },
  { src: '/manga/team7.png', right: '2.5%', top: '5%', width: 330, height: 183, rotate: 4 },
  { src: '/manga/hxh.png', right: '6%', bottom: '4%', width: 202, height: 321, rotate: 5 },
  { src: '/manga/carry.png', left: '8%', bottom: '3%', width: 216, height: 305, rotate: -4 },
] as const;

/** Column weights per bed row. Uneven on purpose -- a repeated rhythm reads as a grid. */
export const BED_ROWS = [
  [1.3, 1.0, 1.6, 1.1],
  [1.0, 1.7, 1.2, 1.4],
  [1.5, 1.1, 1.0, 1.8],
  [1.2, 1.4, 1.7, 1.0],
] as const;
