/**
 * BLACK SQUID — ink-in-water hero.
 * A fragment-shader quad: slow fbm ink that drifts from deep indigo to
 * blossom pink as you scroll — the Blue Bvjalie colour change, on the page.
 * Vanilla WebGL (no three.js). Falls back to the static CSS poster on
 * reduced-motion, WebGL failure, or tiny GPUs.
 */
export function initInkHero(canvasId = 'ink') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return; // poster stays

  let gl;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch { return; }
  if (!gl) return;

  const VERT = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;
  const FRAG = `
    precision mediump float;
    uniform vec2  uRes;
    uniform float uTime;
    uniform float uShift;   // 0 = indigo deep, 1 = blossom pink (the tonic hits)

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.04; a *= 0.52; }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes.xy;
      vec2 q = uv * vec2(uRes.x / uRes.y, 1.0);
      float t = uTime * 0.045;                       // wine-slow
      // curl the ink
      float n1 = fbm(q * 2.1 + vec2(t * 0.7, -t * 0.4));
      float n2 = fbm(q * 3.3 - vec2(t * 0.3, t * 0.55) + n1 * 1.7);
      float ink = fbm(q * 1.6 + vec2(n1, n2) * 1.25);

      // palettes — before / after the tonic
      vec3 abyss   = vec3(0.027, 0.035, 0.051);
      vec3 indigoD = vec3(0.106, 0.143, 0.351);
      vec3 indigo  = vec3(0.365, 0.486, 0.941);
      vec3 plum    = vec3(0.180, 0.082, 0.196);
      vec3 pinkD   = vec3(0.478, 0.173, 0.337);
      vec3 pink    = vec3(0.910, 0.639, 0.788);

      vec3 deepC = mix(indigoD, pinkD, uShift);
      vec3 glowC = mix(indigo,  pink,  uShift);
      vec3 baseC = mix(abyss,   plum * 0.6, uShift * 0.55);

      vec3 col = baseC;
      col = mix(col, deepC, smoothstep(0.32, 0.62, ink));
      col = mix(col, glowC, smoothstep(0.58, 0.85, ink) * 0.8);
      // bioluminescent filaments
      float vein = smoothstep(0.495, 0.5, abs(fract(n2 * 4.0) - 0.5)) * 0.0; // off — keep it quiet
      col += glowC * vein;

      // vignette so hero copy stays legible
      float d = distance(uv, vec2(0.5, 0.46));
      col *= 1.0 - smoothstep(0.32, 0.95, d) * 0.75;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  }
  const vs = sh(gl.VERTEX_SHADER, VERT);
  const fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  // fullscreen triangle
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uShift = gl.getUniformLocation(prog, 'uShift');

  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.max(1, w * dpr * 0.66);   // ink is soft — undersample, save GPU
    canvas.height = Math.max(1, h * dpr * 0.66);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  size();
  addEventListener('resize', size);

  let running = true, shift = 0, target = 0;
  new IntersectionObserver(([e]) => { running = e.isIntersecting; }).observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden && running; });

  function onScroll() {
    const h = Math.max(1, innerHeight * 1.4);
    target = Math.min(1, Math.max(0, scrollY / h));
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const t0 = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    if (!running) return;
    shift += (target - shift) * 0.035;            // glacial ease toward pink
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform1f(uShift, shift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (canvas.style.opacity !== '1') canvas.style.opacity = '1';
  })(t0);
}
