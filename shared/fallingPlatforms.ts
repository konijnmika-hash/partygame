// Falling Platforms grid geometry, shared by the server simulation and the client renderer.
export const FP = { COLS: 12, ROWS: 8, TILE: 80, OX: 20, OY: 20, R: 22 } as const;
export const FP_W = FP.COLS * FP.TILE + FP.OX * 2;
export const FP_H = FP.ROWS * FP.TILE + FP.OY * 2;

export function tileAt(x: number, y: number): number {
  const c = Math.floor((x - FP.OX) / FP.TILE);
  const r = Math.floor((y - FP.OY) / FP.TILE);
  if (c < 0 || r < 0 || c >= FP.COLS || r >= FP.ROWS) return -1;
  return r * FP.COLS + c;
}

export function tileCentre(i: number): { x: number; y: number } {
  return { x: FP.OX + (i % FP.COLS) * FP.TILE + FP.TILE / 2, y: FP.OY + Math.floor(i / FP.COLS) * FP.TILE + FP.TILE / 2 };
}
