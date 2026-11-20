// Déclaration minimale d'opentype.js 2.x (la lib ne fournit pas de types).
declare module "opentype.js" {
  export interface PathCommand { type: "M" | "L" | "Q" | "C" | "Z"; x: number; y: number; x1: number; y1: number; x2: number; y2: number }
  export interface Path { commands: PathCommand[] }
  export interface Font { getPath(text: string, x: number, y: number, fontSize: number): Path; unitsPerEm: number }
  export function parse(buffer: ArrayBuffer): Font;
}
