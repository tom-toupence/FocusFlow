// Le WebGL rendu par le processeur (SwiftShader, llvmpipe : pas de pilote
// graphique, accélération coupée, machine virtuelle) coûte des centaines de
// millisecondes par image sur le fil principal. Les scènes décoratives (splash,
// ville) passent alors à leur version fixe : c'est plus juste qu'une animation
// qui gèle l'interface.
//
// Pour une démo ou un test sur une telle machine : localStorage
// `focusflow-force-webgl` = "1" force le rendu animé.

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    if (localStorage.getItem("focusflow-force-webgl") === "1") return false;
  } catch { /* stockage indisponible */ }
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return SOFTWARE.test(name);
}

let cached: boolean | null = null;
/** WebGL2 avec accélération matérielle (résultat mis en cache). */
export function hasHardwareWebGL2(): boolean {
  if (cached !== null) return cached;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    cached = !!gl && !isSoftwareRenderer(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}
