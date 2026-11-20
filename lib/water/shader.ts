// Shader de la Clepsydre : une eau de nuit vue en incidence rasante, une
// échelle de marée graduée plantée dedans, et au loin une rive éclairée dont la
// lumière prend la couleur de la vidéo (le reflet).
//
// Tout est calculé dans le fragment shader (lancer de rayon analytique sur un
// plan, aucune géométrie) : un seul quad plein écran, aucune texture requise.
//
// Uniformes pilotés par des ÉVÉNEMENTS RÉELS (jamais par le son) :
//   u_level   hauteur de l'eau sur l'échelle (temps écoulé, respiration…)
//   u_swell   houle : > 0 seulement pendant une lecture active
//   u_ripples gouttes (piste suivante) et cailloux (distraction)
//   u_reflet  couleur dominante de la vidéo
export const MAX_RIPPLES = 8;

export const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export const FRAG = `#version 300 es
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_level;     // 0..1 : hauteur de l'eau sur l'échelle
uniform float u_swell;     // 0..1 : amplitude de la houle
uniform vec3  u_reflet;    // couleur de la rive (vidéo)
uniform vec3  u_sodium;    // signal
uniform vec3  u_deep;      // eau profonde
uniform vec3  u_sky;       // ciel au zénith
uniform float u_pole;      // 1 = afficher l'échelle de marée
uniform float u_poleX;     // position horizontale de l'échelle (-1..1 écran)
uniform float u_paper;     // 1 = thème papier (eau claire, rive sombre)
uniform vec4  u_ripples[${MAX_RIPPLES}]; // xy = point (monde xz), z = départ (s), w = force (<0 = caillou)
out vec4 outColor;

const float CAM_H = 1.25;
const float POLE_Z = -6.0;

float hash(float n) { return fract(sin(n) * 43758.5453); }

// Hauteur de l'eau au point p (plan xz) : houle + anneaux amortis.
float heightAt(vec2 p) {
  float h = 0.0;
  float s = u_swell;
  h += s * 0.030 * sin(dot(p, vec2(0.0, 1.0)) * 1.7 + u_time * 0.9);
  h += s * 0.018 * sin(dot(p, vec2(0.6, 0.8)) * 2.9 - u_time * 1.3);
  h += s * 0.010 * sin(dot(p, vec2(-0.7, 0.7)) * 5.3 + u_time * 1.9);
  h += 0.0025 * sin(p.x * 1.9 + u_time * 0.35) * sin(p.y * 1.4 - u_time * 0.25); // eau jamais morte
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = u_ripples[i];
    if (r.z < 0.0) continue;
    float age = u_time - r.z;
    if (age < 0.0 || age > 6.0) continue;
    float d = distance(p, r.xy);
    float stone = r.w < 0.0 ? 1.0 : 0.0;
    float speed = mix(1.4, 2.1, stone);
    float x = d - age * speed;
    float env = exp(-x * x * mix(6.0, 3.5, stone)) * exp(-age * mix(0.9, 1.3, stone));
    h += abs(r.w) * 0.09 * env * sin(x * mix(9.0, 14.0, stone)) / (1.0 + d * 0.6);
  }
  return h;
}

// Rive lointaine : des lumières de ville en grappes irrégulières (quartiers
// denses, trous sombres), surtout chaudes, teintées par le reflet de la vidéo.
float vnoise(float x) { float i = floor(x); float f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
vec3 shore(vec3 dir, float sharp) {
  float az = atan(dir.x, -dir.z);
  float band = exp(-pow((dir.y - 0.012) * mix(38.0, 320.0, sharp), 2.0));
  float district = smoothstep(0.38, 0.78, vnoise(az * 7.0 + 3.0)) * (0.6 + 0.4 * vnoise(az * 23.0));
  float cell = floor(az * 220.0);
  float on = step(0.48, hash(cell)) * district;
  float size = mix(0.18, 0.42, hash(cell + 3.0));
  float dotShape = smoothstep(mix(size + 0.25, size, sharp), 0.0, abs(fract(az * 220.0) - 0.5));
  float lum = mix(0.45, 1.25, hash(cell + 11.0));
  vec3 warm = mix(vec3(1.0, 0.86, 0.66), u_sodium, step(0.62, hash(cell + 7.0)));
  vec3 c = mix(warm, u_reflet * 1.8 + 0.12, 0.35);
  return c * band * on * dotShape * lum * mix(0.55, 1.35, sharp);
}

vec3 skyCol(vec3 dir) {
  // Lueur de ville sur l'horizon (pollution lumineuse), teintée par le reflet.
  float t = clamp(dir.y * 2.4, 0.0, 1.0);
  vec3 glow = u_sky + u_reflet * 0.22 + vec3(0.05, 0.035, 0.02);
  return mix(glow, u_sky, pow(t, 0.45));
}

// Le lampadaire au sodium, hors champ en haut à droite : son reflet trace un
// chemin de lumière sur l'eau. C'est lui qui rend visibles la houle, les
// gouttes et les cailloux (sans lui, une eau de nuit est noire).
const vec3 LAMP = vec3(0.42, 0.075, -1.0);
vec3 lamp(vec3 r) {
  float d = max(dot(normalize(r), normalize(LAMP)), 0.0);
  return u_sodium * (pow(d, 900.0) * 3.2 + pow(d, 90.0) * 0.28);
}

// Échelle de marée : plan vertical face caméra. Renvoie (couleur, alpha).
vec4 pole(vec3 ro, vec3 rd, float waterY, float maxT) {
  if (u_pole < 0.5 || abs(rd.z) < 1e-4) return vec4(0.0);
  float t = (POLE_Z - ro.z) / rd.z;
  if (t <= 0.0 || t > maxT) return vec4(0.0);
  vec3 p = ro + rd * t;
  float px = u_poleX * 4.6;
  float halfW = 0.075;
  if (abs(p.x - px) > halfW || p.y < waterY - 0.0 || p.y > 2.4) return vec4(0.0);
  float y = p.y + 1.0;                       // graduations : 1 unité = 10 marques
  float minor = smoothstep(0.012, 0.0, abs(fract(y * 10.0) - 0.5) - 0.44);
  float major = step(abs(fract(y * 2.0 + 0.5) - 0.5), 0.02);
  float side = step(p.x - px, 0.0);          // marques d'un seul côté, comme une mire
  vec3 face = mix(vec3(0.9, 0.88, 0.83), vec3(0.75, 0.73, 0.68), u_paper);
  vec3 ink = vec3(0.12, 0.13, 0.16);
  vec3 c = face;
  c = mix(c, ink, minor * side * 0.85);
  c = mix(c, u_sodium * 0.9, major);
  float lit = 0.32 + 0.25 * smoothstep(-0.2, 1.2, p.y - waterY);
  return vec4(c * lit, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float horizonY = 0.06;                     // horizon un peu au-dessus du centre
  vec3 ro = vec3(0.0, CAM_H, 0.0);
  vec3 rd = normalize(vec3(uv.x * 1.15, (uv.y - horizonY) * 1.15, -1.0));

  float waterY = -0.6 + u_level * 1.6;       // l'eau monte sur l'échelle
  vec3 col;
  float tWater = 1e9;

  if (rd.y < -1e-4) {
    tWater = (waterY - ro.y) / rd.y;
  }

  if (tWater < 80.0) {
    vec3 p = ro + rd * tWater;
    float e = 0.03 + tWater * 0.004;
    float h  = heightAt(p.xz);
    float hx = heightAt(p.xz + vec2(e, 0.0));
    float hz = heightAt(p.xz + vec2(0.0, e));
    vec3 n = normalize(vec3(h - hx, e, h - hz));
    vec3 r = reflect(rd, n);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 refl = skyCol(r) + shore(r, 0.0) * 1.3 + lamp(r);
    vec4 pr = pole(p + n * 0.0, r, waterY, 40.0);
    refl = mix(refl, pr.rgb * 0.7, pr.a);
    vec3 base = u_deep + vec3(0.008, 0.014, 0.022) * smoothstep(40.0, 2.0, tWater);
    col = mix(base, refl, clamp(fres, 0.0, 1.0));
    float fog = 1.0 - exp(-tWater * 0.045);
    col = mix(col, skyCol(vec3(rd.x, 0.0, rd.z)), fog * 0.85);
  } else {
    col = skyCol(rd) + shore(rd, 1.0);
  }

  vec4 pd = pole(ro, rd, waterY, tWater);
  col = mix(col, pd.rgb, pd.a);

  // Vignette douce, pas d'effet de grain.
  float v = smoothstep(1.35, 0.35, length(uv * vec2(0.85, 1.0)));
  col *= mix(0.72, 1.0, v);

  outColor = vec4(pow(max(col, 0.0), vec3(0.95)), 1.0);
}
`;
