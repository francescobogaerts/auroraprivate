// AURORA Private — cinematic sunrise hero.
// A full-screen WebGL fragment shader (sky, sun, clouds, sea, sun path, haze, drifting motes)
// scrubbed by GSAP ScrollTrigger while the hero is pinned. CSS sun stays as the fallback
// for reduced motion or no WebGL.
// @ts-nocheck
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
import Lenis from 'lenis';

const FRAG = `
// Physically based sky (single scattering, after glsl-atmosphere by Rye Terrell, public domain),
// procedural ocean (exp-sine waves, after afl_ext's MIT ocean), cloud deck, ACES tonemapping.
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uRise; uniform float uHorizon;
uniform float uYaw; uniform float uSunAz; uniform float uClock; uniform vec4 uRip[8];
// scene: 0 open sea (home), 1 Bonaire, 2 India, 3 Mauritius, 4 Marbella
uniform float uScene; uniform vec3 uWater; uniform vec3 uShallow; uniform float uHaze; uniform float uWave;
#define PI 3.14159265
bool isScene(float k){ return abs(uScene - k) < .5; }
const float RP = 6371e3; const float RA = 6471e3;
const vec3 kRlh = vec3(5.5e-6, 13.0e-6, 22.4e-6); const float kMie = 21e-6;
const float shRlh = 8e3; const float shMie = 1.2e3; const float gMie = .76;

vec2 rsi(vec3 r0, vec3 rd, float sr){
  float a = dot(rd, rd), b = 2.0 * dot(rd, r0), c = dot(r0, r0) - sr*sr, d = b*b - 4.0*a*c;
  if(d < 0.0) return vec2(1e5, -1e5);
  return vec2((-b - sqrt(d))/(2.0*a), (-b + sqrt(d))/(2.0*a));
}
vec3 atmosphere(vec3 r, vec3 pSun, float iSun, int iSteps, int jSteps){
  vec3 r0 = vec3(0., RP + 2., 0.);
  vec2 p = rsi(r0, r, RA); if(p.x > p.y) return vec3(0);
  p.y = min(p.y, rsi(r0, r, RP).x);
  float iStepSize = (p.y - p.x) / float(iSteps);
  float iTime = 0.0; vec3 totalRlh = vec3(0), totalMie = vec3(0); float iOdRlh = 0., iOdMie = 0.;
  float mu = dot(r, pSun), mumu = mu*mu, gg = gMie*gMie;
  float pRlh = 3.0 / (16.0 * PI) * (1.0 + mumu);
  float pMie = 3.0 / (8.0 * PI) * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * gMie, 1.5) * (2.0 + gg));
  for(int i = 0; i < 12; i++){
    if(i >= iSteps) break;
    vec3 iPos = r0 + r * (iTime + iStepSize * 0.5);
    float iHeight = length(iPos) - RP;
    float odStepRlh = exp(-iHeight / shRlh) * iStepSize, odStepMie = exp(-iHeight / shMie) * iStepSize;
    iOdRlh += odStepRlh; iOdMie += odStepMie;
    float jStepSize = rsi(iPos, pSun, RA).y / float(jSteps);
    float jTime = 0.0, jOdRlh = 0.0, jOdMie = 0.0;
    for(int j = 0; j < 6; j++){
      if(j >= jSteps) break;
      vec3 jPos = iPos + pSun * (jTime + jStepSize * 0.5);
      float jHeight = length(jPos) - RP;
      jOdRlh += exp(-jHeight / shRlh) * jStepSize; jOdMie += exp(-jHeight / shMie) * jStepSize;
      jTime += jStepSize;
    }
    vec3 attn = exp(-(kMie * (iOdMie + jOdMie) + kRlh * (iOdRlh + jOdRlh)));
    totalRlh += odStepRlh * attn; totalMie += odStepMie * attn;
    iTime += iStepSize;
  }
  return iSun * (pRlh * kRlh * totalRlh + pMie * kMie * totalMie);
}
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),u.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m = mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<6;i++){ v+=a*noise(p); p=m*p; a*=.5; } return v; }

// light reaching the scene from a low sun: air-mass transmittance
vec3 sunLight(vec3 sd){
  float e = max(sd.y, -0.02);
  float am = 1.0 / (max(e, 0.0) + 0.15 * pow(max(e*57.3 + 3.885, .1), -1.253));
  return exp(-vec3(0.022, 0.050, 0.120) * am * 1.25) * smoothstep(-0.035, 0.01, sd.y);
}

vec3 sky(vec3 rd, vec3 sd, bool cheap){
  vec3 r = normalize(vec3(rd.x, max(rd.y, 0.0005), rd.z));
  vec3 col = cheap ? atmosphere(r, sd, 22.0, 5, 3) : atmosphere(r, sd, 22.0, 10, 4);
  // night / blue hour floor so the pre-dawn is not black
  col += vec3(0.006, 0.010, 0.018) * (1.0 - smoothstep(-0.02, 0.12, sd.y)) * (0.4 + 0.6*(1.0-r.y));
  if(!cheap){
    // stars, fading with the light
    vec2 sp = floor(r.xz / max(r.y, .05) * 380.);
    float st = step(.9993, h2(sp)) * (1.0 - smoothstep(-0.06, 0.03, sd.y)) * smoothstep(.04, .25, r.y);
    col += st * (0.6 + 0.4*sin(uTime*2. + h2(sp+3.)*30.)) * 0.35;
  }
  // the disc itself (slightly larger than life), limb darkened
  float cs = dot(r, sd);
  float ang = acos(clamp(cs, -1., 1.));
  float R = isScene(2.) ? 0.027 : 0.019;
  float disc = smoothstep(R, R*0.92, ang);
  float limb = clamp(ang / R, 0., 1.);
  vec3 sl = sunLight(sd) * (isScene(2.) ? vec3(1., .62, .42) : vec3(1.));
  if(!cheap) col += disc * (sl + vec3(.02,.004,.002)) * mix(vec3(70.), vec3(30.), limb*limb) * step(0.0, rd.y);
  return col;
}

vec4 clouds(vec3 rd, vec3 sd, vec3 skyc){
  if(rd.y <= 0.01) return vec4(0);
  float t = 1400.0 / rd.y;
  vec2 p = rd.xz * t * 0.00042 + vec2(uTime*0.004, 0.0);
  float d = fbm(p + fbm(p*0.6)*0.8);
  float band = smoothstep(.02, .10, rd.y) * (1.0 - smoothstep(.22, .55, rd.y));
  float dens = smoothstep(.50, .78, d) * band;
  if(dens <= 0.001) return vec4(0);
  float lit = clamp(1.0 - (fbm(p + sd.xz*0.15) - d) * 3.0, 0.2, 1.0);
  float mu = dot(rd, sd);
  float fwd = pow(max(mu, 0.), 14.) * 3.0;
  vec3 sl = sunLight(sd) + vec3(1.0, 0.35, 0.25) * 0.25 * smoothstep(-0.12, -0.01, sd.y) * (1.0 - smoothstep(0.0, 0.08, sd.y));
  vec3 c = skyc * 0.35 + sl * (0.9 * lit + fwd) * 1.6;
  float fade = exp(-t * 0.00009);
  return vec4(c, dens * 0.85 * fade);
}

// ocean height: sum of exponential-sine waves with drag (wave shape after afl_ext, MIT)
vec2 wavedx(vec2 pos, vec2 dir, float freq, float phase){
  float x = dot(dir, pos) * freq + phase;
  float w = exp(sin(x) - 1.0);
  return vec2(w, -w * cos(x));
}
float waves(vec2 pos, int it){
  float iter = 0.0, freq = 1.0, tm = 2.0, weight = 1.0, ws = 0.0, sw = 0.0;
  for(int i = 0; i < 18; i++){
    if(i >= it) break;
    vec2 d = vec2(sin(iter), cos(iter));
    vec2 r = wavedx(pos, d, freq, uTime * tm);
    pos += d * r.y * weight * 0.38;
    ws += r.x * weight; sw += weight;
    weight = mix(weight, 0.0, 0.2); freq *= 1.18; tm *= 1.07; iter += 1232.399963;
  }
  return ws / sw;
}
vec3 oceanNormal(vec2 p, float dist){
  int it = dist < 60. ? 18 : (dist < 300. ? 12 : 7);
  float e = 0.02 + dist * 0.0015;
  float H = uWave;
  float c = waves(p, it) * H;
  float dx = waves(p + vec2(e, 0.), it) * H;
  float dz = waves(p + vec2(0., e), it) * H;
  return normalize(vec3(c - dx, e, c - dz));
}

// ---- land on the horizon, one signature per destination ----
float landH(float a){
  if(isScene(1.)){ // Bonaire: Klein Bonaire, a low flat island to the left
    float isl = .011 * smoothstep(-.66, -.58, a) * (1. - smoothstep(-.30, -.22, a));
    return isl > .0005 ? isl + .0012 * noise(vec2(a * 60., 1.)) : -1.;
  }
  if(isScene(2.)) return .050 + .028 * fbm(vec2(a * 4.5, 1.7));          // India: far foothills
  if(isScene(3.)){ // Mauritius: Le Morne, a sheer basalt block with a sloping shoulder, to the right
    float body = smoothstep(.22, .30, a) * (1. - smoothstep(.47, .50, a));
    float top = .092 + .016 * smoothstep(.26, .46, a);
    float pk = body * top;
    pk = max(pk, .040 * smoothstep(.12, .24, a) * (1. - smoothstep(.24, .30, a)));
    pk = max(pk, .028 * (1. - smoothstep(.48, .90, a)) * step(.46, a));
    pk += .006 * fbm(vec2(a * 22., 2.)) * step(.003, pk);
    return pk > .004 ? pk : -1.;
  }
  if(isScene(4.)){ // Marbella: Sierra ridge on the right, the Rock far left
    float r = (.050 * smoothstep(.02, .30, a) + .045 * exp(-pow((a - .46) / .055, 2.))) * (.82 + .30 * fbm(vec2(a * 7., 3.))) * (1. - smoothstep(.85, 1.1, a));
    float rock = .022 * exp(-pow((a + .56) / .040, 2.)) * (1. + .2 * noise(vec2(a * 90., 4.)));
    float hh = max(r, rock);
    return hh > .003 ? hh : -1.;
  }
  return -1.;
}
float landH2(float a){ // India: a nearer, darker ridge
  return isScene(2.) ? .024 + .018 * fbm(vec2(a * 10., 7.)) : -1.;
}
vec3 withLand(vec3 col, vec3 rd, vec3 sd){
  float a = atan(rd.x, rd.z);
  float lh = landH(a);
  if(lh > 0. && rd.y < lh){
    vec3 hz = sky(normalize(vec3(rd.x, .003, rd.z)), sd, true);
    float far = isScene(2.) ? .62 : (isScene(1.) ? .30 : .38);
    vec3 land = hz * (1. - far) * .18 + hz * far * .55 + vec3(.006, .008, .010);
    land += sunLight(sd) * exp(-(lh - rd.y) * 260.) * .25;   // rim light on the ridge
    col = land;
  }
  float l2 = landH2(a);
  if(l2 > 0. && rd.y < l2){
    vec3 hz = sky(normalize(vec3(rd.x, .003, rd.z)), sd, true);
    col = hz * .30 + vec3(.004, .006, .008);
  }
  if(isScene(1.)){ // Bonaire: the white salt pyramids of the south, catching the first pink light
    float pyr = -1., cb = 0.;
    for(int i = 0; i < 6; i++){
      float fi = float(i);
      float c = .34 + fi * .036 + .014 * sin(fi * 7.1) + .01 * h2(vec2(fi, 2.));
      float w = .014 + .009 * h2(vec2(fi, 5.));
      float hh = (w - abs(a - c)) * (.50 + .12 * h2(vec2(fi, 8.)));
      if(hh > pyr){ pyr = hh; cb = c; }
    }
    pyr -= .0006 * noise(vec2(a * 400., 1.));
    if(pyr > 0. && rd.y < pyr){
      vec3 hz = sky(normalize(vec3(rd.x, .003, rd.z)), sd, true);
      float lit = a < cb ? .34 : .12;   // the face turned to the sun
      col = hz * 1.22 + sunLight(sd) * lit + vec3(.022, .018, .020);
      col = mix(col, hz, .12);          // distance haze
    }
  }
  if(isScene(4.) && rd.y < .0045 && a > -.05 && a < .95){ // Marbella: the coast road still lit
    float cell = floor(a * 520.);
    float on = step(.80, h2(vec2(cell, 3.)));
    float cx = (cell + .5) / 520.;
    float d = length(vec2((a - cx) * 520., (rd.y - .0018 - .0012 * h2(vec2(cell, 9.))) * 900.));
    col += vec3(1., .72, .42) * on * exp(-d * d * 1.6) * 2.2 * (1. - smoothstep(.15, .7, uRise)) * (.7 + .3 * sin(uTime * 3. + cell));
  }
  return col;
}
// ---- one regional icon per destination, ~5% of the frame, lit by the same sun ----
// Coordinates: x = azimuth (rad), y = elevation (rd.y). Shapes are drawn in local units and scaled by S.
float cover(float d, float px){ return clamp(d / px + .5, 0., 1.); }
float sbox(vec2 p, vec2 c, vec2 hw){ vec2 q = hw - abs(p - c); return min(q.x, q.y); }
float stri(vec2 p, vec2 a, vec2 b, vec2 c){ // >0 inside, either winding
  vec2 e0 = b - a, e1 = c - b, e2 = a - c;
  float s = sign(e0.y * e2.x - e0.x * e2.y);
  float d0 = s * (e0.x * (p.y - a.y) - e0.y * (p.x - a.x)) / length(e0);
  float d1 = s * (e1.x * (p.y - b.y) - e1.y * (p.x - b.x)) / length(e1);
  float d2 = s * (e2.x * (p.y - c.y) - e2.y * (p.x - c.x)) / length(e2);
  return min(min(d0, d1), d2);
}
// sunlight on a round body at azimuth a; u runs -1..1 across it. Wrapped so the rim glows when backlit.
float roundLit(float u, float a, vec3 sd){
  float th = a + PI - asin(clamp(u, -1., 1.));
  vec3 n = vec3(sin(th), 0., cos(th));
  return max(dot(n, normalize(vec3(sd.x, 0., sd.z))) + .28, 0.) / 1.28;
}

// Mauritius: a pirogue with its lateen sail, drifting, sail glowing when the sun stands behind it
vec4 pirogue(vec2 q, float px, vec3 hz, vec3 sl, float day, float sunRel){
  vec3 c = vec3(0.); float cov = 0.;
  float t = q.x / .017;
  if(abs(t) < 1.){
    float bot = -.0030 + .0026 * t * t, top = .0006 + .0013 * pow(abs(t), 3.);
    float d = min(min(top - q.y, q.y - bot), (1. - abs(t)) * .017);
    float k = cover(d, px);
    vec3 hull = hz * .10 + vec3(.004, .010, .014) + sl * .05 * day * smoothstep(.0, .0006, q.y - bot - .0018);
    c = mix(c, hull, k); cov = max(cov, k);
  }
  float m = cover(min(.00045 - abs(q.x - .0035 - q.y * .03), min(q.y - .0004, .0365 - q.y)), px);
  c = mix(c, hz * .12 + vec3(.01), m); cov = max(cov, m);
  float s = cover(stri(q, vec2(-.016, .0085), vec2(.0125, .0445), vec2(.0110, .0035)), px);
  if(s > 0.){
    float seam = .85 + .15 * smoothstep(.2, .5, abs(fract(q.y * 260.) - .5));
    vec3 cloth = vec3(.98, .90, .78);
    vec3 lit = cloth * (hz * .55 + sl * (.25 + 1.1 * exp(-sunRel * sunRel * 9.))) * seam;
    c = mix(c, mix(hz * .14, lit, .25 + .75 * day), s); cov = max(cov, s);
  }
  float yard = cover(.00035 - abs((q.y - .0085) - (q.x + .016) * (.036 / .0285)), px) * step(-.0165, q.x) * step(q.x, .0128);
  c = mix(c, hz * .1, yard); cov = max(cov, yard);
  return vec4(c, cov);
}

vec3 icon(vec3 col, vec3 rd, vec3 sd, bool refl){
  if(isScene(0.)) return col;
  float a = atan(rd.x, rd.z), y = rd.y;
  float c0 = isScene(1.) ? .22 : (isScene(2.) ? .30 : (isScene(3.) ? .13 + .028 * sin(uTime * .021) : .31));
  c0 *= clamp(uRes.x / uRes.y / 1.6, .3, 1.);   // keep it in frame on a phone
  float span = isScene(2.) ? .15 : (isScene(4.) ? .11 : .085);
  if(abs(a - c0) > span || y > .07 || y < (isScene(3.) ? -.03 : (isScene(2.) ? -.02 : -.001))) return col;
  float S = isScene(2.) ? 1.05 : (isScene(4.) ? 1.35 : 1.);
  float px = (refl ? 3. : 1.2) / (uRes.y * 1.25) / S;
  vec2 q = vec2(a - c0, y) / S;
  vec3 hz = sky(normalize(vec3(rd.x, .003, rd.z)), sd, true);
  vec3 sl = sunLight(sd);
  float day = smoothstep(-.09, .05, sd.y);
  float night = 1. - smoothstep(.06, .5, uRise);
  float sunRel = a - uSunAz;
  vec3 ic = vec3(0.); float cov = 0.;

  if(isScene(1.)){ // Bonaire: Willemstoren, the island's lighthouse on the southern point
    float land = .0034 * exp(-pow((q.x + .006) / .028, 2.)) + .0010 * step(abs(q.x + .01), .07);
    float kL = cover(min(land - q.y, q.y + .0005), px) * step(abs(q.x + .01), .07);
    ic = mix(ic, hz * .22 + vec3(.006, .008, .009) + sl * .05 * day, kL); cov = max(cov, kL);
    float tt = clamp((q.y - .003) / .037, 0., 1.);
    float w = mix(.0043, .0033, tt);
    float kT = cover(min(w - abs(q.x), min(.0400 - q.y, q.y - .0025)), px);
    vec3 plaster = vec3(.90, .84, .74);
    vec3 tower = plaster * (hz * .42 + sl * .85 * day * roundLit(q.x / w, a, sd) + .006);
    ic = mix(ic, tower, kT); cov = max(cov, kT);
    float kG = cover(sbox(q, vec2(0., .0408), vec2(.0041, .0008)), px);
    ic = mix(ic, hz * .10, kG); cov = max(cov, kG);
    float kLn = cover(sbox(q, vec2(0., .0442), vec2(.0026, .0026)), px);
    float phi = uTime * .55;
    float flash = pow(max(cos(phi), 0.), 30.);
    vec3 lamp = vec3(1., .82, .55) * (.4 + 2.6 * night * (.5 + .5 * flash));
    ic = mix(ic, mix(hz * .14, lamp, .35 + .65 * night), kLn); cov = max(cov, kLn);
    float dy = (q.y - .0468) / .0036;
    float kD = cover(min(min(.0029 * sqrt(max(1. - dy * dy, 0.)) - abs(q.x), q.y - .0468), .0504 - q.y), px);
    ic = mix(ic, hz * .09 + sl * .05 * day, kD); cov = max(cov, kD);
    col = mix(col, mix(ic, hz, .10), cov);
    if(!refl && night > .01 && q.y > 0.){ // the sweeping beam and the flash when it faces you
      vec2 L = vec2(0., .0442);
      float dx = abs(q.x), side = sign(q.x);
      float face = pow(max(sin(phi) * side, 0.), 3.);
      float beam = exp(-dx * 14.) * smoothstep(.0012 + dx * .05, 0., abs(q.y - L.y)) * face * step(.0026, dx);
      float halo = exp(-length((q - L) * vec2(1., 1.)) * 900.) * (.3 + 3. * flash);
      col += vec3(1., .85, .6) * (beam * .55 + halo * .8) * night;
    }
    return col;
  }

  if(isScene(2.)){ // India: a Nagara temple above the ghats, oil lamps on the steps
    float ex = min(q.x + .12, .12 - q.x);
    float gTop = .0105 * clamp(ex / .035, 0., 1.);
    float kG = cover(min(gTop - q.y, q.y + .0004), px);
    float step_ = smoothstep(.75, .95, fract(q.y / .0013));
    vec3 stone = vec3(.66, .52, .40);
    vec3 ghat = stone * (hz * .38 + sl * .22 * day) * (1. - .35 * step_);
    ic = mix(ic, ghat, kG); cov = max(cov, kG);
    // temple: plinth, hall, curved spire (shikhara) with two smaller spires, amalaka, kalasha, flag
    float kP = cover(sbox(q, vec2(.0, .0125), vec2(.021, .0021)), px);
    float kM = max(cover(sbox(q, vec2(-.0115, .0185), vec2(.0080, .0040)), px), cover(stri(q, vec2(-.0205, .0222), vec2(-.0025, .0222), vec2(-.0115, .0290)), px));
    float y0 = .0146, y1 = .0510, cs = .0045;
    float tt = clamp((q.y - y0) / (y1 - y0), 0., 1.);
    float w = .0102 * (1. - .78 * pow(tt, 1.7)) + .00035 * smoothstep(.3, .7, abs(fract(tt * 13.) - .5) * 2.);
    float kS = cover(min(w - abs(q.x - cs), min(q.y - y0, y1 - q.y)), px);
    float t2 = clamp((q.y - y0) / .022, 0., 1.);
    float w2 = .0043 * (1. - .8 * pow(t2, 1.6));
    float kU = cover(min(w2 - abs(abs(q.x - cs) - .0082), min(q.y - y0, y0 + .022 - q.y)), px);
    float kA = cover((1. - length((q - vec2(cs, .0522)) / vec2(.0041, .0014))) * .0014, px);
    float kK = max(cover(sbox(q, vec2(cs, .0548), vec2(.0008, .0013)), px), cover(stri(q, vec2(cs - .0006, .0560), vec2(cs + .0006, .0560), vec2(cs, .0578)), px));
    float kPole = cover(sbox(q, vec2(cs + .0001, .0600), vec2(.00022, .0030)), px);
    float wv = .0006 * sin(uTime * 2.4 + q.x * 900.);
    float kF = cover(stri(q, vec2(cs + .0003, .0628), vec2(cs + .0003, .0602), vec2(cs + .0068, .0618 + wv)), px);
    vec3 sand = vec3(.80, .58, .42);
    float lit = roundLit((q.x - cs) / max(w, .001), a, sd);
    vec3 temple = sand * (hz * .34 + sl * 1.25 * day * lit + .006);
    temple += vec3(1., .55, .2) * .06 * night * exp(-(q.y - .0125) * 260.);
    float kT = max(max(kP, kM), max(max(kS, kU), max(kA, kK)));
    ic = mix(ic, temple, kT); cov = max(cov, kT);
    ic = mix(ic, hz * .12, kPole); cov = max(cov, kPole);
    ic = mix(ic, vec3(1., .42, .08) * (hz * .5 + sl * .9 * day + .02), kF); cov = max(cov, kF);
    col = mix(col, mix(ic, hz, .16), cov);
    // diyas: small flames along the steps, and their trembling streaks on the river
    float lampOn = max(night, .35) * (1. - smoothstep(.55, .95, uRise));
    if(!refl && lampOn > .01){
      float row = floor(q.y / .0013);
      if(q.y > 0. && row < 8. && kG > .5){
        float cell = floor(q.x / .0052 + row * .5);
        float cx = (cell + .5 - row * .5) * .0052;
        float on = step(.80, h2(vec2(cell, row)));
        float d = length((q - vec2(cx, (row + .75) * .0013)) * vec2(1., 1.6));
        float fl = .75 + .25 * sin(uTime * 9. + cell * 3.1) * sin(uTime * 5.3 + row);
        col += vec3(1., .58, .22) * on * exp(-d * 2400.) * 1.6 * fl * lampOn;
      }
      if(q.y < 0.){
        float cell = floor(q.x / .0052);
        float cx = (cell + .5) * .0052;
        float on = step(.78, h2(vec2(cell, 0.))) * step(abs(q.x), .11);
        float wob = .0006 * sin(q.y * 3000. + uTime * 4. + cell);
        float st = exp(-abs(q.x - cx + wob) * 1500.) * exp(q.y * 160.);
        col += vec3(1., .55, .2) * on * st * .5 * lampOn * (.6 + .4 * sin(uTime * 7. + cell));
      }
    }
    return col;
  }

  if(isScene(3.)){ // Mauritius: a pirogue under sail
    float bob = .00045 * sin(uTime * 1.3);
    vec2 qb = q - vec2(0., bob);
    vec4 b = pirogue(qb, px, hz, sl, day, sunRel);
    col = mix(col, mix(b.rgb, hz, .08), b.a);
    if(!refl && q.y < 0.){ // its reflection, broken by the swell
      vec2 m = vec2(qb.x + .0009 * sin(q.y * 2600. + uTime * 3.), -qb.y - .0012);
      vec4 r = pirogue(m, px * 3., hz, sl, day, sunRel);
      col = mix(col, r.rgb * .6, r.a * .5 * exp(q.y * 90.));
    }
    return col;
  }

  if(isScene(4.)){ // Marbella: a pueblo blanco on the sierra slope, bell tower and all
    float mound = .006 + .020 * exp(-pow((q.x - .004) / .046, 2.));
    if(q.y > .0036 && q.y < mound){
      float rh = .0034;
      float row = floor((q.y - .0036) / rh);
      float off = h2(vec2(row, 4.)) * .005;
      float cell = floor((q.x + off) / .0049);
      float id = h2(vec2(cell, row));
      float cx = (cell + .5) * .0049 - off;
      float hw = .0049 * .5 * (.70 + .24 * id);
      float top = .0036 + row * rh + .0024 + .0008 * h2(vec2(cell, row + 7.));
      float base = .0036 + row * rh;
      float kH = cover(min(hw - abs(q.x - cx), min(top - q.y, q.y - base)), px) * step(.25, id);
      vec3 wall = vec3(.94, .92, .88) * (hz * .80 + sl * .85 * day * (.7 + .3 * step(cx, q.x - hw * .4)) + .008);
      vec3 roof = vec3(.66, .34, .23) * (hz * .5 + sl * .4 * day);
      vec3 hc = mix(wall, roof, smoothstep(top - .00045, top - .00025, q.y));
      float win = step(.62, h2(vec2(cell, row + 3.))) * cover(sbox(q, vec2(cx + .0006, base + .0011), vec2(.00045, .0005)), px);
      hc = mix(hc, mix(hz * .1, vec3(1., .74, .42) * 1.8, night), win);
      ic = mix(ic, hc, kH); cov = max(cov, kH);
    }
    // the church: nave and a whitewashed bell tower with its open belfry
    float tb = .0236, tx = .010;
    float kN = cover(sbox(q, vec2(tx - .0055, tb + .0015), vec2(.0050, .0022)), px);
    float kTw = cover(sbox(q, vec2(tx, tb + .0090), vec2(.0022, .0095)), px);
    float kCap = cover(stri(q, vec2(tx - .0026, tb + .0185), vec2(tx + .0026, tb + .0185), vec2(tx, tb + .0225)), px);
    float kCr = max(cover(sbox(q, vec2(tx, tb + .0240), vec2(.00018, .0017)), px), cover(sbox(q, vec2(tx, tb + .0245), vec2(.0008, .00018)), px));
    float kBel = cover(sbox(q, vec2(tx, tb + .0155), vec2(.0009, .0017)), px);
    vec3 white = vec3(.95, .93, .89) * (hz * .62 + sl * .65 * day * roundLit((q.x - tx) / .0022, a, sd) + .008);
    float kC = max(kN, kTw);
    ic = mix(ic, white, kC); cov = max(cov, kC);
    ic = mix(ic, vec3(.66, .34, .23) * (hz * .5 + sl * .4 * day), kCap); cov = max(cov, kCap);
    ic = mix(ic, hz * .1, max(kCr, kBel * kTw));  cov = max(cov, kCr);
    col = mix(col, mix(ic, hz, .14), cov);
    return col;
  }
  return col;
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }

void main(){
  vec2 frag = gl_FragCoord.xy;
  float aspect = uRes.x / uRes.y;
  vec2 uv = frag / uRes;
  float h = uHorizon;
  float rise = uRise;
  // sun from 4° below to ~12° above the horizon, straight ahead
  float el = mix(-0.115, 0.085, 1.0 - pow(1.0 - rise, 1.5));
  vec3 sd = normalize(vec3(sin(uSunAz) * cos(el), sin(el), cos(uSunAz) * cos(el)));
  // camera: horizon pinned at uHorizon
  float fov = 1.25;
  vec3 rd = normalize(vec3((uv.x - 0.5) * aspect, (uv.y - h), fov));
  float cy = cos(uYaw), sy = sin(uYaw);
  rd = vec3(rd.x * cy + rd.z * sy, rd.y, -rd.x * sy + rd.z * cy);
  vec3 col;
  float camH = 7.0;
  if(rd.y >= 0.0){
    vec3 s = sky(rd, sd, false);
    vec4 c = clouds(rd, sd, s);
    col = mix(s, c.rgb, c.a);
    col = withLand(col, rd, sd);
    // haze band low on the horizon
    col = mix(col, sky(vec3(rd.x, 0.003, rd.z), sd, true) * 1.05, exp(-rd.y * 60.0 / uHaze) * min(0.55 * uHaze, 0.85));
    // lens glare around the sun
    float g = max(dot(rd, sd), 0.0);
    col += sunLight(sd) * (pow(g, 2200.0) * 40.0 + pow(g, 260.0) * 2.4 + pow(g, 30.0) * 0.25) * smoothstep(-0.03, 0.02, sd.y);
  } else {
    float t = camH / -rd.y;
    vec3 pos = vec3(0., camH, 0.) + rd * t;
    vec3 n = oceanNormal(pos.xz * 1.1, t);
    // ripples you leave on the water
    vec2 wp = pos.xz;
    for(int i = 0; i < 8; i++){
      vec4 R = uRip[i];
      if(R.w <= 0.0) continue;
      float age = uClock - R.z;
      if(age < 0.0 || age > 6.0) continue;
      vec2 dd = wp - R.xy; float rr = length(dd) + 1e-4;
      float front = age * 5.0;
      float env = exp(-age * 0.6) * smoothstep(front + 4.0, front - 1.0, rr) * smoothstep(0.0, 0.8, rr) * R.w / (1.0 + rr * 0.04);
      float ph = rr * 1.25 - age * 7.0;
      n.xz += (dd / rr) * cos(ph) * env * 1.6;
    }
    n = normalize(n);
    n = normalize(mix(n, vec3(0,1,0), smoothstep(200., 2200., t)));
    vec3 refl = reflect(rd, n); refl.y = max(abs(refl.y), 0.015);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 skyR = icon(withLand(sky(refl, sd, true), refl, sd), refl, sd, true);
    vec4 cl = clouds(refl, sd, skyR); skyR = mix(skyR, cl.rgb, cl.a * 0.8);
    vec3 sl = sunLight(sd);
    vec3 water = vec3(0.004, 0.016, 0.022) * (0.25 + 2.5 * max(sd.y + 0.05, 0.0)) + sl * 0.012 * max(n.y,0.);
    // shallow, clear water near the viewer (Bonaire, Mauritius)
    float near = exp(-t * 0.028);
    water = mix(water, uShallow * (0.08 + 1.6 * max(sd.y + 0.04, 0.0)) + uShallow * sl * 0.18, near * step(0.001, uShallow.r + uShallow.g + uShallow.b));
    water *= uWater;
    col = mix(water, skyR * 0.72, fres * (1.0 - near * 0.35 * step(0.001, uShallow.g)));
    // Mauritius: surf on the reef
    if(isScene(3.)){
      float band = smoothstep(52., 60., t) * (1. - smoothstep(66., 78., t));
      float f = smoothstep(.45, .85, noise(vec2(pos.x * .22 + uTime * .15, pos.z * .05)) * (.6 + .4 * sin(uTime * 1.3 + pos.x * .05)));
      col = mix(col, (sl * 0.9 + skyR * 0.5), band * f * 0.75);
    }
    // sun glitter: tight specular + broader sheen
    float sp = max(dot(refl, sd), 0.0);
    col += sl * (pow(sp, 1400.0) * 180.0 + pow(sp, 120.0) * 1.4) * smoothstep(-0.02, 0.02, sd.y);
    // aerial perspective
    vec3 hz = sky(normalize(vec3(rd.x, 0.002, rd.z)), sd, true);
    col = mix(col, hz, 1.0 - exp(-t * 0.0011 * uHaze));
    if(isScene(2.)) col = mix(col, hz * 1.1, exp(-(-rd.y) * 45.) * 0.6); // river mist
  }
  col = icon(col, rd, sd, false);
  // exposure follows the light, ACES, slight grade toward the brand dawn
  float expo = mix(2.2, 0.5, smoothstep(-0.10, 0.08, sd.y));
  col = aces(col * expo);
  col = pow(col, vec3(1.0/2.2));
  col = mix(col, col * vec3(1.03, 0.99, 0.95), 0.6);
  vec2 q = uv - .5; col *= 1. - dot(q, q) * 0.45;
  col += (h2(frag + fract(uTime) * 91.) - .5) * 0.012;
  gl_FragColor = vec4(col, 1.);
}`;
const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`;

function init(){
  const sky = document.querySelector('.sky');
  if(!sky) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = sky.querySelector('.sky-in');
  const state = { rise: still ? .72 : .04 };
  const setCss = () => sky.style.setProperty('--rise', state.rise.toFixed(3));
  setCss();
  if(still) return;

  // WebGL layer
  const canvas = document.createElement('canvas');
  canvas.className = 'sky-gl'; canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  let draw = null;
  if(gl){
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    try{
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog); gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = (n) => gl.getUniformLocation(prog, n);
      const uRes = U('uRes'), uTime = U('uTime'), uRise = U('uRise'), uHor = U('uHorizon');
      const SCENES = {
        home:      { k: 0, water: [1, 1, 1],       shallow: [0, 0, 0],             haze: 1.0, wave: .55 },
        bonaire:   { k: 1, water: [.9, 1.08, 1.12], shallow: [.012, .110, .115],    haze: .75, wave: .42 },
        india:     { k: 2, water: [1.1, 1.0, .85], shallow: [0, 0, 0],             haze: 2.4, wave: .14 },
        mauritius: { k: 3, water: [.9, 1.1, 1.0],  shallow: [.012, .070, .055],    haze: 1.1, wave: .30 },
        marbella:  { k: 4, water: [.85, .95, 1.2], shallow: [0, 0, 0],             haze: .9,  wave: .50 },
      };
      const SC = SCENES[sky.getAttribute('data-scene') || 'home'] || SCENES.home;
      const uScene = U('uScene'), uWater = U('uWater'), uShallow = U('uShallow'), uHaze = U('uHaze'), uWave = U('uWave');
      const uYaw = U('uYaw'), uSunAz = U('uSunAz'), uClock = U('uClock'), uRip = U('uRip');
      // pointer: look around, sun follows a little, ripples on the water
      const look = { x: 0, y: 0, tx: 0, ty: 0 };
      const rips = new Float32Array(32); let ripI = 0, lastRip = 0, lastPt = null;
      const clock = () => (performance.now() - t0) / 1000;
      const addRipple = (cx, cy, strength) => {
        const r = canvas.getBoundingClientRect();
        const ux = (cx - r.left) / r.width, uy = 1 - (cy - r.top) / r.height;
        const aspect = r.width / r.height, yaw = look.x * 0.26;
        let dx = (ux - .5) * aspect, dy = uy - horizon, dz = 1.25;
        const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
        if(dy >= -0.002) return;
        const rx = dx * Math.cos(yaw) + dz * Math.sin(yaw), rz = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
        const t = 7.0 / -dy;
        rips.set([rx * t, rz * t, clock(), strength], (ripI % 8) * 4); ripI++;
      };
      const onMove = (e) => {
        const r = stage.getBoundingClientRect();
        look.tx = ((e.clientX - r.left) / r.width - .5) * 2;
        look.ty = ((e.clientY - r.top) / r.height - .5) * 2;
        const now = performance.now();
        if(lastPt && now - lastRip > 110 && Math.hypot(e.clientX - lastPt[0], e.clientY - lastPt[1]) > 14){ addRipple(e.clientX, e.clientY, 0.8); lastRip = now; }
        lastPt = [e.clientX, e.clientY];
      };
      sky.addEventListener('pointermove', onMove, { passive: true });
      sky.addEventListener('pointerdown', (e) => addRipple(e.clientX, e.clientY, 2.2));
      sky.addEventListener('pointerleave', () => { look.tx = 0; look.ty = 0; lastPt = null; });
      stage.insertBefore(canvas, stage.firstChild);
      sky.classList.add('has-gl');
      let horizon = .5;
      const resize = () => {
        const dpr = Math.min((window.devicePixelRatio || 1) * 0.75, 1.1);
        const w = stage.clientWidth, h = stage.clientHeight;
        const sc = Math.min(dpr, 1500 / Math.max(w, 1)); canvas.width = Math.round(w * sc); canvas.height = Math.round(h * sc);
        gl.viewport(0, 0, canvas.width, canvas.height);
        const line = sky.querySelector('.horizon .line');
        if(line){ const sr = stage.getBoundingClientRect(), lr = line.getBoundingClientRect(); horizon = 1 - (lr.top - sr.top) / sr.height; }
      };
      resize(); window.addEventListener('resize', resize);
      const t0 = performance.now();
      draw = () => {
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (performance.now() - t0) / 1000 * 0.55);
        gl.uniform1f(uRise, state.rise);
        gl.uniform1f(uHor, horizon);
        look.x += (look.tx - look.x) * 0.035; look.y += (look.ty - look.y) * 0.035;
        gl.uniform1f(uYaw, look.x * 0.26);
        gl.uniform1f(uSunAz, look.x * 0.13);
        gl.uniform1f(uClock, clock());
        gl.uniform4fv(uRip, rips);
        gl.uniform1f(uScene, SC.k); gl.uniform3fv(uWater, SC.water); gl.uniform3fv(uShallow, SC.shallow);
        gl.uniform1f(uHaze, SC.haze); gl.uniform1f(uWave, SC.wave);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      // render only while the hero is on screen
      let on = true, raf = 0;
      const loop = () => { if(on){ draw(); raf = requestAnimationFrame(loop); } };
      new IntersectionObserver((es) => { on = es[0].isIntersecting; cancelAnimationFrame(raf); if(on) loop(); }).observe(sky);
      loop();
    }catch(e){ console.warn('sunrise gl', e && e.message); canvas.remove(); sky.classList.remove('has-gl'); }
  }

  // Silky scrolling (mouse wheel / trackpad); touch keeps native scrolling
  const lenis = new Lenis({ lerp: 0.05, wheelMultiplier: 0.7, touchMultiplier: 0.8, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const id = a.getAttribute('href'); if(id.length > 1 && document.querySelector(id)){ e.preventDefault(); lenis.scrollTo(id, { offset: -80 }); } }));

  // Scroll choreography
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: sky, start: 'top top', end: 'bottom bottom', scrub: 2.6 },
    onUpdate: setCss,
  });
  tl.to(state, { rise: 1, duration: 1, ease: 'power1.inOut' }, 0)
    .to('.sky .eyebrow', { autoAlpha: 0, y: -16, duration: .06 }, .03)
    .to('.sky-scroll', { autoAlpha: 0, duration: .05 }, 0)
    .fromTo('.sky-word', { letterSpacing: '0.34em' }, { letterSpacing: '0.24em', duration: 1 }, 0);
  const lines = gsap.utils.toArray('.sky-lines p:not(.sky-sub)');
  lines.forEach((el, i) => {
    const step = Math.min(.17, .66 / Math.max(lines.length, 1));
    const at = .08 + i * step;
    tl.fromTo(el, { autoAlpha: 0, y: 18, filter: 'blur(6px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: .06 }, at)
      .to(el, { autoAlpha: 0, y: -14, filter: 'blur(6px)', duration: .06 }, at + .12);
  });
  tl.fromTo('.sky-sub', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .08 }, .82);
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
