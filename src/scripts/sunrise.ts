// AURORA Private — cinematic sunrise hero.
// A full-screen WebGL fragment shader (sky, sun, clouds, sea, sun path, haze, drifting motes)
// scrubbed by GSAP ScrollTrigger while the hero is pinned. CSS sun stays as the fallback
// for reduced motion or no WebGL.
// @ts-nocheck
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uRise; uniform float uHorizon;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }

vec3 sunColor(float r){ return mix(vec3(1.0,.30,.18), vec3(1.0,.72,.50), smoothstep(.15,1.,r)); }

vec3 skyAt(vec2 p, float h, vec2 sun, float r, float aspect){
  float t = clamp((p.y-h)/(1.-h), 0., 1.);
  float e = smoothstep(0.,1.,r);
  vec3 zenith = mix(vec3(.018,.028,.032), vec3(.10,.19,.24), e);
  vec3 mid    = mix(vec3(.035,.05,.055), vec3(.42,.36,.40), e);
  vec3 horiz  = mix(vec3(.06,.075,.08),  vec3(.98,.56,.38), e);
  vec3 col = mix(horiz, mid, smoothstep(0., .28, t));
  col = mix(col, zenith, smoothstep(.22, 1., t));
  float d = length(vec2((p.x-sun.x)*aspect*.55, p.y-sun.y));
  vec3 sc = sunColor(r);
  col += sc * (exp(-d*5.5)*.5 + exp(-d*18.)*.55) * smoothstep(0.,.25,r);
  col += vec3(.9,.42,.36) * exp(-abs(p.y-h)*22.) * exp(-abs(p.x-sun.x)*aspect*1.3) * .55 * r;
  // stratus clouds lit from below
  float band = smoothstep(.04,.12,t) * (1.-smoothstep(.30,.5,t));
  float c = fbm(vec2(p.x*aspect*1.4 + uTime*.004, t*11.)) ;
  c = smoothstep(.52,.78,c) * band;
  vec3 cloud = mix(vec3(.05,.06,.07), mix(vec3(.55,.28,.30), vec3(1.,.74,.56), e), e*(.35+.65*exp(-d*2.2)));
  col = mix(col, cloud, c*.85);
  // stars fade with the light
  vec2 g = floor(gl_FragCoord.xy/2.5);
  float sr = h2(g);
  float st = step(.9985, sr) * pow(1.-e, 2.) * smoothstep(.12,.6,t);
  col += st * (.55+.45*sin(uTime*1.7+h2(g+7.)*40.)) * .8;
  // haze over the horizon
  col = mix(col, horiz*1.05, exp(-t*14.) * .35);
  return col;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x/uRes.y;
  float h = uHorizon, r = uRise;
  float R = .05;
  float er = 1. - pow(1.-r, 2.2);
  vec2 sun = vec2(.5, h + mix(-1.25*R, .21, er));
  vec3 col;
  if(uv.y >= h){
    col = skyAt(uv, h, sun, r, aspect);
    // the sun disc, flattened near the horizon
    float squash = mix(1.18, 1., smoothstep(h, h+.08, sun.y));
    float sd = length(vec2((uv.x-sun.x)*aspect, (uv.y-sun.y)*squash));
    float disc = smoothstep(R, R-.0018, sd);
    float limb = clamp(sd / R, 0., 1.);
    vec3 face = mix(vec3(1.,.93,.80), sunColor(r)*.95, pow(limb, 2.2));
    face = mix(face, vec3(1.,.55,.38), smoothstep(.75, 1., limb) * .5);
    col = mix(col, face * 1.12, disc);
  } else {
    float depth = (h-uv.y)/h;
    float z = 1./(depth + .015);
    vec2 w = vec2((uv.x-.5)*aspect*z*.35, z*.9);
    float wav = fbm(w*vec2(1.8,.55) + vec2(0., -uTime*.06));
    float wav2 = noise(w*vec2(6.,1.6) + vec2(uTime*.05, -uTime*.15));
    // mirrored sky, darker and rippled
    vec2 m = vec2(uv.x + (wav-.5)*.02*depth, h + (h-uv.y)*1.6);
    vec3 refl = skyAt(clamp(m, 0., 1.), h, sun, r, aspect) * .55;
    vec3 deep = mix(vec3(.012,.02,.024), vec3(.05,.09,.11), smoothstep(0.,1.,r));
    col = mix(refl, deep, smoothstep(.0, .55, depth));
    // the path of light towards you
    float sunVis = smoothstep(0., .06, sun.y - h + R);
    float width = .006 + depth*.09;
    float column = exp(-abs((uv.x-sun.x)*aspect)/width);
    float zz = 1./(depth + .06);
    vec2 sp = vec2((uv.x-.5)*aspect*zz*11., zz*4.2 - uTime*.55);
    float sparkle = pow(noise(sp) * noise(sp*1.9 + 3.1), 3.) * 16.;
    float sheen = smoothstep(.45, .9, wav) * .35;
    float near = 1. - smoothstep(.12, .55, depth);
    col += sunColor(r) * column * (sparkle + sheen) * sunVis * r * near;
    col += sunColor(r) * exp(-abs((uv.x-sun.x)*aspect)/.02) * exp(-depth*18.) * .5 * sunVis * r;
    // mist on the water
    col = mix(col, mix(vec3(.06,.075,.08), vec3(.85,.55,.45), r), exp(-depth*26.) * .45);
  }
  // drifting motes of light
  for(int i=0;i<18;i++){
    float fi = float(i);
    vec2 mp = vec2(h2(vec2(fi,1.3)), fract(h2(vec2(fi,7.1)) + uTime*(.004+.006*h2(vec2(fi,3.3)))));
    float md = length((uv - mp)*vec2(aspect,1.));
    col += vec3(1.,.82,.66) * smoothstep(.0035, 0., md) * .3 * r * h2(vec2(fi,9.));
  }
  // vignette and film grain
  vec2 q = uv - .5; col *= 1. - dot(q,q)*.55;
  col += (hash(gl_FragCoord.xy + fract(uTime)*100.) - .5) * .018;
  gl_FragColor = vec4(pow(max(col,0.), vec3(.95)), 1.);
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
      stage.insertBefore(canvas, stage.firstChild);
      sky.classList.add('has-gl');
      let horizon = .5;
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = stage.clientWidth, h = stage.clientHeight;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
        const line = sky.querySelector('.horizon .line');
        if(line){ const sr = stage.getBoundingClientRect(), lr = line.getBoundingClientRect(); horizon = 1 - (lr.top - sr.top) / sr.height; }
      };
      resize(); window.addEventListener('resize', resize);
      const t0 = performance.now();
      draw = () => {
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (performance.now() - t0) / 1000);
        gl.uniform1f(uRise, state.rise);
        gl.uniform1f(uHor, horizon);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      // render only while the hero is on screen
      let on = true, raf = 0;
      const loop = () => { if(on){ draw(); raf = requestAnimationFrame(loop); } };
      new IntersectionObserver((es) => { on = es[0].isIntersecting; cancelAnimationFrame(raf); if(on) loop(); }).observe(sky);
      loop();
    }catch(e){ console.warn('sunrise gl', e && e.message); canvas.remove(); sky.classList.remove('has-gl'); }
  }

  // Scroll choreography
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: sky, start: 'top top', end: 'bottom bottom', scrub: 1.4 },
    onUpdate: setCss,
  });
  tl.to(state, { rise: 1, duration: 1, ease: 'power1.inOut' }, 0)
    .to('.sky .eyebrow', { autoAlpha: 0, y: -16, duration: .06 }, .03)
    .to('.sky-scroll', { autoAlpha: 0, duration: .05 }, 0)
    .fromTo('.sky-word', { letterSpacing: '0.34em' }, { letterSpacing: '0.24em', duration: 1 }, 0);
  const lines = gsap.utils.toArray('.sky-lines p:not(.sky-sub)');
  lines.forEach((el, i) => {
    const at = .08 + i * .17;
    tl.fromTo(el, { autoAlpha: 0, y: 18, filter: 'blur(6px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: .06 }, at)
      .to(el, { autoAlpha: 0, y: -14, filter: 'blur(6px)', duration: .06 }, at + .12);
  });
  tl.fromTo('.sky-sub', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .08 }, .82);
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
