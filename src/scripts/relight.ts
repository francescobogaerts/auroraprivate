// AURORA Private — relight.
// Photos below the hero are re-lit as you scroll: a low, warm light at first that climbs and
// cools, the way the sunrise above did. The photo's own tones stand in for depth, so the light
// rakes across plaster, water and rock; the pointer adds a slight parallax.
// One shared WebGL context renders every visible photo; each gets a 2D canvas on top of its <img>.
// No WebGL, reduced motion, or a photo that cannot be read (CORS) → the plain photo stays.
// @ts-nocheck

const FRAG = `
precision mediump float;
uniform sampler2D uTex; uniform vec2 uRes; uniform vec4 uMap;   // uv = vUv * uMap.xy + uMap.zw
uniform float uP; uniform vec2 uPtr; uniform float uT;
varying vec2 vUv;
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
float H(vec2 uv){ return lum(texture2D(uTex, uv).rgb); }
void main(){
  vec2 uv = vUv * uMap.xy + uMap.zw;
  float h0 = H(uv);
  uv += (h0 - .5) * uPtr * .010;                          // depth parallax from tone
  vec2 e = 2.0 / uRes;
  float hx = H(uv + vec2(e.x, 0.)) - H(uv - vec2(e.x, 0.));
  float hy = H(uv + vec2(0., e.y)) - H(uv - vec2(0., e.y));
  float bx = H(uv + vec2(e.x*6., 0.)) - H(uv - vec2(e.x*6., 0.));
  float by = H(uv + vec2(0., e.y*6.)) - H(uv - vec2(0., e.y*6.));
  vec3 n = normalize(vec3(-(hx * .15 + bx) * 1.1, -(hy * .15 + by) * 1.1, 1.));
  vec3 base = texture2D(uTex, uv).rgb;
  // the light: low and warm from the lower left, climbing to high, neutral, upper right
  float p = clamp(uP, 0., 1.);
  vec2 lp = mix(vec2(-.15, .05), vec2(1.05, 1.05), p) + uPtr * vec2(.10, .06);
  vec3 L = normalize(vec3(lp - vUv, .55 + .5 * p));
  float diff = max(dot(n, L), 0.);
  vec3 tint = mix(vec3(1.0, .80, .64), vec3(1.0, .985, .96), smoothstep(.2, .9, p));
  float pool = exp(-dot(vUv - lp, vUv - lp) * mix(2.2, 1.2, p));
  float level = mix(.70, .98, smoothstep(.0, .7, p)) + pool * .20;
  float relief = clamp((diff - L.z) * .9, -.12, .12);          // light raking across the surface
  vec3 col = base * mix(vec3(1.), tint, .8) * level * (1. + relief);
  float spec = pow(max(dot(reflect(-L, n), vec3(0,0,1)), 0.), 28.) * smoothstep(.45, .9, h0);
  col += tint * spec * .06;
  col = mix(col, col * vec3(1.02, .99, .96), .5);
  col += (fract(sin(dot(gl_FragCoord.xy + uT, vec2(12.9898, 78.233))) * 43758.5) - .5) * .01;
  gl_FragColor = vec4(col, 1.);
}`;
const VERT = `attribute vec2 a; varying vec2 vUv; void main(){ vUv = a * .5 + .5; vUv.y = 1. - vUv.y; gl_Position = vec4(a, 0., 1.); }`;

function init(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const figs = [...document.querySelectorAll('.gallery .photo, .day-pic .photo, .interlude .photo, .strip .slide .photo')];
  if(!figs.length) return;
  const gc = document.createElement('canvas');
  const gl = gc.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  if(!gl) return;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)){ console.warn('relight', gl.getShaderInfoLog(o)); return null; } return o; };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if(!vs || !fs) return;
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(pr, n);
  const uRes = U('uRes'), uMap = U('uMap'), uP = U('uP'), uPtr = U('uPtr'), uT = U('uT');

  const items = figs.map((fig) => ({ fig, img: fig.querySelector('img'), tex: null, cv: null, ctx: null, on: false, ptr: [0, 0], tp: [0, 0], ready: false, failed: false }));

  const load = (it) => {
    if(it.loading || it.failed) return; it.loading = true;
    const src = it.img.currentSrc || it.img.src;
    const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
    if(/unsplash/.test(src)) im.referrerPolicy = 'no-referrer';
    im.onload = () => {
      try {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        it.tex = t; it.iw = im.naturalWidth; it.ih = im.naturalHeight;
        const cv = document.createElement('canvas'); cv.className = 'relight'; cv.setAttribute('aria-hidden', 'true');
        it.fig.appendChild(cv); it.cv = cv; it.ctx = cv.getContext('2d');
        it.ready = true; dirty = true;
      } catch(e){ it.failed = true; }
    };
    im.onerror = () => { it.failed = true; };
    im.src = src;
  };

  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const it = items.find((i) => i.fig === e.target); if(!it) return;
    it.on = e.isIntersecting; if(it.on){ load(it); dirty = true; }
  }), { rootMargin: '200px 0px' });
  items.forEach((it) => it.img && io.observe(it.fig));

  let dirty = true, px = 0, py = 0;
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  addEventListener('resize', () => { dirty = true; });
  addEventListener('pointermove', (e) => { px = e.clientX / innerWidth * 2 - 1; py = e.clientY / innerHeight * 2 - 1; dirty = true; }, { passive: true });

  const pos = (img) => {
    const op = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    return [isNaN(op[0]) ? .5 : op[0], isNaN(op[1]) ? .5 : op[1]];
  };
  const draw = (it, t) => {
    const r = it.fig.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return;
    const s = Math.min(devicePixelRatio || 1, 1.5);
    const W = Math.min(Math.round(r.width * s), 1400), Hh = Math.round(W * r.height / r.width);
    if(it.cv.width !== W || it.cv.height !== Hh){ it.cv.width = W; it.cv.height = Hh; }
    if(gc.width !== W || gc.height !== Hh){ gc.width = W; gc.height = Hh; }
    gl.viewport(0, 0, W, Hh);
    // object-fit: cover mapping
    const fa = r.width / r.height, ia = it.iw / it.ih;
    let sx = 1, sy = 1; if(ia > fa) sx = fa / ia; else sy = ia / fa;
    const [ox, oy] = pos(it.img);
    gl.uniform4f(uMap, sx, sy, (1 - sx) * ox, (1 - sy) * oy);
    gl.uniform2f(uRes, it.iw, it.ih);
    // progress: the photo entering at the bottom (0) to leaving at the top (1)
    const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
    gl.uniform1f(uP, p);
    it.ptr[0] += (px - it.ptr[0]) * .08; it.ptr[1] += (py - it.ptr[1]) * .08;
    gl.uniform2f(uPtr, it.ptr[0], -it.ptr[1]);
    gl.uniform1f(uT, (t % 1000));
    gl.bindTexture(gl.TEXTURE_2D, it.tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    it.ctx.drawImage(gc, 0, 0);
    if(!it.shown){ it.shown = true; it.fig.classList.add('is-relit'); }
    return Math.abs(px - it.ptr[0]) + Math.abs(py - it.ptr[1]) > .002;
  };
  const frame = (t) => {
    let more = false;
    if(dirty){
      dirty = false;
      for(const it of items) if(it.on && it.ready) more = draw(it, t) || more;
      if(more) dirty = true;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
// Text-only sections: a soft pool of light that drifts with the scroll, so no part of the page goes flat.
function ambient(){
  const secs = [...document.querySelectorAll('section.tone-night, section.tone-dusk, section.tone-dawn, section.tone-day')];
  if(!secs.length) return;
  secs.forEach((s) => s.classList.add('amb'));
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let req = 0;
  const upd = () => { req = 0; const vh = innerHeight;
    for(const s of secs){ const r = s.getBoundingClientRect(); if(r.bottom < 0 || r.top > vh) continue;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))); s.style.setProperty('--amb', p.toFixed(3)); } };
  addEventListener('scroll', () => { if(!req) req = requestAnimationFrame(upd); }, { passive: true });
  upd();
}
const boot = () => { init(); ambient(); };
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
