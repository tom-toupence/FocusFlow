// Shaders de la rue de Séoul en 2.5D (projection caméra sur une vraie photo).
// Préparation des textures : scripts/seoul/ (profondeur, plans, masques).

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/**
 * Passe 1 : la scène.
 * - 4 plans (fond -> premier plan), alpha = « ce plan ou plus proche » ; le
 *   décalage de parallaxe dépend de la profondeur DU PIXEL (texture depth,
 *   un canal par plan), donc une surface continue coupée entre deux plans
 *   bouge d'un seul tenant ; seules les vraies discontinuités révèlent les
 *   zones reconstituées derrière.
 * - effets sur masques (masks : R néons, G fenêtres, B sol, A ciel ;
 *   ids : R numéro d'enseigne, G numéro de fenêtre).
 * Sorties : la couleur, et la part lumineuse (source du bloom).
 */
export const SCENE = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outBright;

uniform sampler2D uL0, uL1, uL2, uL3, uDepth, uMasks, uIds;
uniform vec2 uRes;          // taille du canvas (px)
uniform float uImgAspect;   // largeur / hauteur de la photo
uniform float uTime;
uniform vec2 uCam;          // décalage caméra (unités photo)
uniform float uZoom;        // >= 1, marge pour que les bords ne se voient jamais
uniform float uFocus;       // profondeur qui ne bouge pas
uniform float uNight;       // 0 = début de session, 1 = fin de nuit
uniform float uBreak;       // 0 = travail, 1 = pause
uniform float uRain;        // densité de pluie (0..1)
uniform vec3 uEvent;        // x = type (1 fin de pomodoro, 2 objectif), y = début (s), z = 0
uniform float uMotion;      // 0 = mouvement réduit (aucune animation interne)

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

vec2 shift(float d) { return uCam * (d - uFocus); }

// Point du plan k qui arrive au pixel p (inversion du décalage, 3 itérations).
vec2 locate(vec2 p, int k) {
  vec2 q = p;
  for (int i = 0; i < 3; i++) {
    vec4 d = texture(uDepth, q);
    float dk = k == 0 ? d.r : k == 1 ? d.g : k == 2 ? d.b : d.a;
    q = p - shift(dk);
  }
  return q;
}

// Grésillement d'une enseigne : la plupart sont stables avec de rares
// battements ; quelques tubes fatigués grésillent pour de bon.
float neon(float id, float t) {
  if (id < 0.5) return 1.0;
  float h = hash(id * 3.17);
  float f = 1.0;
  if (h < 0.10) {                                     // tube fatigué
    float n = noise(vec2(t * 9.0, id));
    f = mix(0.25, 1.0, step(0.32, n)) * (0.85 + 0.15 * noise(vec2(t * 40.0, id * 7.0)));
  } else {                                            // battement rare
    float period = 18.0 + h * 40.0;
    float ph = mod(t + h * 97.0, period);
    f = ph < 0.35 ? mix(0.35, 1.0, step(0.5, fract(ph * 23.0))) : 1.0;
  }
  // Pendant la pause, une partie des enseignes s'éteint (la ville se calme).
  float off = step(h, 0.45) * uBreak;
  // Au fil de la nuit, quelques enseignes ferment pour de bon.
  off = max(off, step(0.8, h) * step(1.0 - (h - 0.8) * 4.0, uNight));
  return f * (1.0 - off * 0.85);
}

// Fenêtres : elles s'éteignent peu à peu à mesure que la nuit avance.
float windowOn(float id) {
  if (id < 0.5) return 1.0;
  float h = hash(id * 7.31 + 1.0);
  return smoothstep(h - 0.03, h + 0.03, 1.0 - uNight * 0.75);
}

vec3 rainLayer(vec2 sp, float scale, float speed, float width, float len, float density, float seed, float t) {
  vec2 r = sp * vec2(1.0, 1.0) * scale;
  r.x += r.y * 0.07;                       // légère inclinaison
  float cols = 70.0;
  float cx = floor(r.x * cols);
  float colSeed = hash(cx + seed);
  if (colSeed > density) return vec3(0.0);
  float y = fract(r.y * 0.9 + t * speed * (0.8 + colSeed * 0.4) + colSeed * 13.0);
  float x = fract(r.x * cols) - 0.5;
  float streak = smoothstep(len, 0.0, y) * smoothstep(0.0, 0.02, y);
  float across = exp(-x * x / (width * width));
  return vec3(streak * across);
}

void main() {
  // Couverture : la photo remplit le canvas sans déformation.
  float aspect = uRes.x / uRes.y;
  vec2 p = vUv;
  p.y = 1.0 - p.y;                                   // photo : origine en haut
  vec2 sc = aspect > uImgAspect ? vec2(1.0, uImgAspect / aspect) : vec2(aspect / uImgAspect, 1.0);
  p = (p - 0.5) * sc / uZoom + 0.5;

  float t = uTime * uMotion;

  // Sol mouillé : des gouttes ponctuent les flaques (anneaux qui s'élargissent),
  // la photo est réfractée localement.
  float floorM = texture(uMasks, p).b;
  if (floorM > 0.01 && uMotion > 0.5) {
    float dz = texture(uDepth, p).a;
    float cell = mix(0.02, 0.07, dz);
    vec2 g = p / vec2(cell, cell * 0.45);            // anneaux écrasés par la perspective
    vec2 gi = floor(g), gf = fract(g) - 0.5;
    float h = hash2(gi);
    float ph = fract(t * (0.5 + h * 0.6) + h * 9.0);
    vec2 c = vec2(hash2(gi + 3.1), hash2(gi + 7.7)) - 0.5;
    float dist = length(gf - c * 0.6);
    float ring = sin((dist - ph * 0.45) * 60.0) * exp(-ph * 4.0) * smoothstep(0.45, 0.0, dist) * step(0.35, h);
    vec2 n = normalize(gf - c * 0.6 + 1e-4) * ring;
    p += n * 0.0025 * floorM * (0.6 + uRain);
  }

  // Les plans, du fond vers l'avant.
  vec3 col = vec3(0.0);
  vec2 qTop = p;
  float dTop = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 q = locate(p, k);
    vec4 c = k == 0 ? texture(uL0, q) : k == 1 ? texture(uL1, q) : k == 2 ? texture(uL2, q) : texture(uL3, q);
    col = mix(col, c.rgb, c.a);
    if (c.a > 0.5) {
      qTop = q;
      vec4 d = texture(uDepth, q);
      dTop = k == 0 ? d.r : k == 1 ? d.g : k == 2 ? d.b : d.a;
    }
  }

  vec4 m = texture(uMasks, qTop);
  vec4 ids = texture(uIds, qTop) * 255.0;
  float emissive = m.r, win = m.g, sky = m.a;

  // Fin de pomodoro : une vague de coupures traverse la rue du fond vers nous.
  float ev = 0.0, et = uTime - uEvent.y;
  if (uEvent.x > 0.5 && et >= 0.0 && et < 4.0) {
    float front = et * 0.6;
    ev = exp(-pow((1.0 - dTop) - (1.0 - front), 2.0) * 60.0);
  }

  float f = neon(floor(ids.r + 0.5), t);
  if (uEvent.x > 0.5 && uEvent.x < 1.5) f *= 1.0 - 0.8 * ev * step(0.5, fract(et * 14.0));
  col *= 1.0 - emissive * (1.0 - f) * 0.9;

  float w = windowOn(floor(ids.g + 0.5));
  col *= 1.0 - win * (1.0 - w) * 0.85;

  // Objectif atteint : les fenêtres se rallument d'un coup et une onde de
  // lumière monte le long des façades.
  float glow = 0.0;
  if (uEvent.x > 1.5 && et >= 0.0 && et < 5.0) {
    float wave = exp(-pow(p.y - (1.0 - et * 0.35), 2.0) * 90.0);
    glow = wave * (emissive + win) * 0.9 * (1.0 - et / 5.0);
    col *= 1.0 + win * (1.0 - w) * 0.85 * smoothstep(0.0, 0.6, et);
  }

  // Sol : scintillement des reflets sous la pluie.
  float fm = texture(uMasks, qTop).b;
  col *= 1.0 + fm * (noise(vec2(qTop.x * 80.0, qTop.y * 12.0 - t * 2.5)) - 0.5) * 0.25 * uMotion;

  // Brume qui dérive entre les plans, éclairée par la ville (lumière diffuse
  // = la photo très floue).
  vec3 haze = textureLod(uL0, qTop, 6.0).rgb * 1.3 + vec3(0.02, 0.03, 0.05);
  float fogN = fbm(qTop * vec2(3.0, 5.0) + vec2(t * 0.012, -t * 0.006));
  float fog = (1.0 - dTop) * (0.18 + 0.22 * fogN) * (1.0 + uBreak * 0.6);
  col = mix(col, haze, clamp(fog, 0.0, 0.6));

  // Pluie : trois rideaux à des profondeurs différentes, masqués par ce qui
  // est plus proche qu'eux ; le plus proche est large et flou.
  if (uMotion > 0.5 && uRain > 0.01) {
    vec2 sp = vUv * vec2(aspect, 1.0);
    sp.y = 1.0 - sp.y;
    vec3 lit = textureLod(uL0, qTop, 4.0).rgb * 1.6 + 0.06;
    float d1 = step(dTop, 0.30), d2 = step(dTop, 0.62);
    vec3 r = rainLayer(sp, 1.6, 1.6, 0.10, 0.10, 0.55 * uRain, 1.0, t) * 0.35 * d1
           + rainLayer(sp, 0.9, 1.1, 0.14, 0.16, 0.45 * uRain, 2.0, t) * 0.30 * d2
           + rainLayer(sp, 0.45, 0.75, 0.32, 0.26, 0.30 * uRain, 3.0, t) * 0.12;
    col += r * lit;
  }

  // Étalonnage : la nuit avance (plus froid, un peu plus sombre), la pause
  // désature et bleuit légèrement.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.0 - 0.18 * uBreak - 0.10 * uNight);
  col *= mix(vec3(1.0), vec3(0.88, 0.94, 1.06), uNight * 0.6 + uBreak * 0.3);
  col *= 1.0 - 0.12 * uNight;
  col += glow * vec3(1.0, 0.95, 0.85);

  // Vignette et grain très légers (une photo, pas un écran).
  vec2 vv = vUv - 0.5;
  col *= 1.0 - dot(vv, vv) * 0.55;
  col += (hash2(vUv * uRes + fract(t) * 91.0) - 0.5) * 0.018 * uMotion;

  outColor = vec4(col, 1.0);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  outBright = vec4(col * smoothstep(0.55, 0.95, lum) * (0.4 + emissive * f), 1.0);
}`;

/** Passe 2 : bloom discret à partir des niveaux de mipmap de la part lumineuse. */
export const POST = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene, uBright;
uniform float uBloom;
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  vec3 b = textureLod(uBright, vUv, 2.0).rgb * 0.35
         + textureLod(uBright, vUv, 3.5).rgb * 0.35
         + textureLod(uBright, vUv, 5.0).rgb * 0.30;
  c += b * uBloom;
  // Tonemapping doux pour garder les néons sans brûler les blancs.
  c = c / (1.0 + c * 0.25);
  outColor = vec4(pow(c, vec3(0.98)), 1.0);
}`;
