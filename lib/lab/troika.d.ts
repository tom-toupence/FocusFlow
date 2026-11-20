// Déclaration minimale de troika-three-text (la lib ne publie pas de types).
declare module "troika-three-text" {
  import { Mesh, Material } from "three";
  export function configureTextBuilder(cfg: { useWorker?: boolean; sdfGlyphSize?: number }): void;
  export class Text extends Mesh {
    text: string;
    font: string;
    fontSize: number;
    lineHeight: number | "normal";
    letterSpacing: number;
    anchorX: number | "left" | "center" | "right";
    anchorY: number | "top" | "middle" | "bottom";
    textAlign: "left" | "right" | "center" | "justify";
    maxWidth: number;
    color: string | number;
    material: Material;
    sync(cb?: () => void): void;
    dispose(): void;
  }
}
