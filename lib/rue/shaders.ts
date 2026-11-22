// Rue de nuit en vraie projection caméra (camera projection, comme en motion
// design) : chaque plan de la photo est un maillage déplacé par sa profondeur,
// vu par une caméra en perspective qui avance, tourne et bascule. Les objets
// proches grossissent et glissent plus que le fond : c'est ce qui donne le
// relief, impossible avec un simple décalage d'image.
// Préparation des textures : scripts/rue/ (profondeur, plans, masques).

/** Passe 1, sommets : la grille d'un plan, poussée à sa profondeur. */
export const MESH_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aUv;
uniform sampler2D uDepth;
uniform int uLayer;
uniform mat4 uProj, uView;
uniform vec2 uTan;          // tan(fov/2) horizontal et vertical de la photo
uniform vec2 uZ;            // profondeur métrique du plus proche et du plus loin
out vec2 vUv;
out float vD;
void main() {
  vec4 dd = textureLod(uDepth, aUv, 0.0);
  float d = uLayer == 0 ? dd.r : uLayer == 1 ? dd.g : uLayer == 2 ? dd.b : dd.a;
  // Depth Anything donne une disparité relative : on interpole en 1/z.
  float z = 1.0 / mix(1.0 / uZ.y, 1.0 / uZ.x, d);
  vec3 p = vec3((aUv.x - 0.5) * 2.0 * uTan.x * z, -(aUv.y - 0.5) * 2.0 * uTan.y * z, -z);
  vUv = aUv;
  vD = d;
  gl_Position = uProj * uView * vec4(p, 1.0);
}`;

/** Passe 1, fragments : la photo du plan et la vie de la rue sur ses masques. */
export const MESH_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in float vD;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outBright;
layout(location = 2) out vec4 outDepth;

uniform sampler2D uColor, uMasks, uIds;
uniform float uTime, uNight, uBreak, uRain, uMotion;
uniform float uTexW;        // largeur de la photo en pixels
uniform vec3 uEvent;        // x = type (1 fin de pomodoro, 2 objectif), y = début (s)

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}

// Enseignes : stables, rares battements ; quelques tubes fatigués.
float neon(float id, float t) {
  if (id < 0.5) return 1.0;
  float h = hash(id * 3.17);
  float f = 1.0;
  if (h < 0.06) {
    float n = noise(vec2(t * 9.0, id));
    f = mix(0.5, 1.0, step(0.28, n)) * (0.9 + 0.1 * noise(vec2(t * 40.0, id * 7.0)));
  } else {
    float period = 18.0 + h * 40.0;
    float ph = mod(t + h * 97.0, period);
    f = ph < 0.35 ? mix(0.35, 1.0, step(0.5, fract(ph * 23.0))) : 1.0;
  }
  float off = step(h, 0.45) * uBreak;                                   // la pause calme la rue
  off = max(off, step(0.8, h) * step(1.0 - (h - 0.8) * 4.0, uNight));  // fermetures au fil de la nuit
  return f * (1.0 - off * 0.85);
}

float windowOn(float id) {
  if (id < 0.5) return 1.0;
  float h = hash(id * 7.31 + 1.0);
  return smoothstep(h - 0.03, h + 0.03, 1.0 - uNight * 0.75);
}

void main() {
  // Raccord étiré : un triangle qui relie un objet au décor plus loin dans
  // le même plan change de profondeur bien plus vite par pixel de photo
  // qu'aucune surface réelle (un sol en perspective reste sous 0,002). On le
  // jette : le plan arrière, reconstitué à cet endroit, apparaît à la place.
  float perTexel = fwidth(vD) / max(length(fwidth(vUv)) * uTexW, 1e-4);
  if (perTexel > 0.012) discard;

  float t = uTime * uMotion;
  vec2 uv = vUv;

  // Flaques : des gouttes y dessinent des anneaux qui réfractent la photo.
  float floorM = texture(uMasks, uv).b;
  if (floorM > 0.01 && uMotion > 0.5) {
    float cell = mix(0.02, 0.07, vD);
    vec2 g = uv / vec2(cell, cell * 0.45);
    vec2 gi = floor(g), gf = fract(g) - 0.5;
    float h = hash2(gi);
    float ph = fract(t * (0.5 + h * 0.6) + h * 9.0);
    vec2 c = vec2(hash2(gi + 3.1), hash2(gi + 7.7)) - 0.5;
    float dist = length(gf - c * 0.6);
    float ring = sin((dist - ph * 0.45) * 60.0) * exp(-ph * 4.0) * smoothstep(0.45, 0.0, dist) * step(0.35, h);
    uv += normalize(gf - c * 0.6 + 1e-4) * ring * 0.0025 * floorM * (0.6 + uRain);
  }

  vec4 c = texture(uColor, uv);
  if (c.a < 0.02) discard;
  vec3 col = c.rgb;
  vec4 m = texture(uMasks, uv);
  vec4 ids = texture(uIds, uv) * 255.0;
  float emissive = m.r, win = m.g;

  // Fin de pomodoro : coupure de courant qui balaie la rue du fond vers nous,
  // puis rallumage en grésillant, chaque enseigne à son rythme.
  float et = uTime - uEvent.y, cut = 0.0;
  float f = neon(floor(ids.r + 0.5), t);
  if (uEvent.x > 0.5 && uEvent.x < 1.5 && et >= 0.0 && et < 4.0) {
    float front = et * 0.45 - 0.1;
    float h = hash(floor(ids.r + 0.5) * 1.7);
    float behind = front - vD;
    float dark = smoothstep(-0.06, 0.02, behind) * (1.0 - smoothstep(0.12 + h * 0.15, 0.3 + h * 0.2, behind));
    float relight = step(0.12 + h * 0.15, behind) * (1.0 - step(0.3 + h * 0.2, behind)) * step(0.5, fract(et * 17.0 + h * 5.0));
    cut = max(dark - relight, 0.0);
  }
  f *= 1.0 - 0.95 * cut;
  col *= 1.0 - emissive * (1.0 - f) * 0.9;

  float w = windowOn(floor(ids.g + 0.5));
  col *= 1.0 - win * (1.0 - w) * 0.85;

  // Objectif atteint : les fenêtres se rallument, une onde monte le long des façades.
  float glow = 0.0;
  if (uEvent.x > 1.5 && et >= 0.0 && et < 5.0) {
    glow = exp(-pow(vUv.y - (1.0 - et * 0.35), 2.0) * 90.0) * (emissive + win) * 0.9 * (1.0 - et / 5.0);
    col *= 1.0 + win * (1.0 - w) * 0.85 * smoothstep(0.0, 0.6, et);
  }

  // Sol : les reflets scintillent sous la pluie et baissent pendant la coupure.
  col *= 1.0 - floorM * cut * 0.55;
  col *= 1.0 + floorM * (noise(vec2(vUv.x * 80.0, vUv.y * 12.0 - t * 2.5)) - 0.5) * 0.25 * uMotion;
  col += glow * vec3(1.0, 0.95, 0.85);

  outColor = vec4(col, c.a);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  outBright = vec4(col * smoothstep(0.55, 0.95, lum) * (0.4 + emissive * f), c.a);
  outDepth = vec4(vD, 0.0, 0.0, c.a);
}`;

export const QUAD_VERT = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/**
 * Passe 2, écran : brume, pluie (masquée par ce qui est plus proche qu'elle),
 * étalonnage selon la nuit et la pause, bloom, vignette, grain.
 */
export const POST = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene, uBright, uDepthTex;
uniform vec2 uRes;
uniform float uTime, uNight, uBreak, uRain, uMotion;
uniform vec2 uRainDrift;    // la pluie suit un peu la caméra (parallaxe)

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

// Un rideau de pluie : des traits qui TOMBENT (y écran vers le bas), tête en bas.
float rain(vec2 sp, float scale, float speed, float width, float len, float density, float seed, float t) {
  vec2 r = sp * scale;
  r.x += r.y * 0.07;
  float cols = 70.0;
  float cx = floor(r.x * cols);
  float cs = hash(cx + seed);
  if (cs > density) return 0.0;
  float y = fract(r.y * 0.9 - t * speed * (0.8 + cs * 0.4) + cs * 13.0);
  float x = fract(r.x * cols) - 0.5;
  float streak = smoothstep(1.0 - len, 1.0, y) * (1.0 - smoothstep(0.985, 1.0, y));
  return streak * exp(-x * x / (width * width));
}

void main() {
  float t = uTime * uMotion;
  vec3 col = texture(uScene, vUv).rgb;
  float d = texture(uDepthTex, vUv).r;

  // Brume entre les plans, éclairée par la ville (l'image très floue).
  vec3 haze = textureLod(uScene, vUv, 6.0).rgb * 1.3 + vec3(0.02, 0.03, 0.05);
  float fogN = fbm(vUv * vec2(3.0, 5.0) + vec2(t * 0.012, -t * 0.006));
  float fog = (1.0 - d) * (0.16 + 0.2 * fogN) * (1.0 + uBreak * 0.6);
  col = mix(col, haze, clamp(fog, 0.0, 0.6));

  // Pluie : trois rideaux à des profondeurs différentes, cachés par ce qui
  // est plus proche qu'eux ; le plus proche est large et flou, et glisse le
  // plus avec la caméra.
  if (uMotion > 0.5 && uRain > 0.01) {
    float aspect = uRes.x / uRes.y;
    vec2 sp = vec2(vUv.x * aspect, 1.0 - vUv.y);
    vec3 lit = textureLod(uScene, vUv, 4.0).rgb * 1.6 + 0.06;
    float r = rain(sp + uRainDrift * 0.3, 1.6, 1.6, 0.10, 0.10, 0.55 * uRain, 1.0, t) * 0.35 * step(d, 0.30)
            + rain(sp + uRainDrift * 0.6, 0.9, 1.1, 0.14, 0.16, 0.45 * uRain, 2.0, t) * 0.30 * step(d, 0.62)
            + rain(sp + uRainDrift * 1.0, 0.45, 0.75, 0.32, 0.26, 0.30 * uRain, 3.0, t) * 0.12;
    col += r * lit;
  }

  vec3 b = textureLod(uBright, vUv, 2.0).rgb * 0.35 + textureLod(uBright, vUv, 3.5).rgb * 0.35 + textureLod(uBright, vUv, 5.0).rgb * 0.30;
  col += b * 0.9;

  // Étalonnage : la nuit avance (plus froid, plus sombre), la pause désature.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.0 - 0.18 * uBreak - 0.10 * uNight);
  col *= mix(vec3(1.0), vec3(0.88, 0.94, 1.06), uNight * 0.6 + uBreak * 0.3);
  col *= 1.0 - 0.12 * uNight;

  vec2 vv = vUv - 0.5;
  col *= 1.0 - dot(vv, vv) * 0.55;
  col += (hash2(vUv * uRes + fract(t) * 91.0) - 0.5) * 0.018 * uMotion;
  col = col / (1.0 + col * 0.25);
  outColor = vec4(col, 1.0);
}`;
