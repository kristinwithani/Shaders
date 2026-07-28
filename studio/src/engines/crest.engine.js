function createEffect(canvas, C) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, desynchronized: true, powerPreference: 'high-performance' });
  const MAXBARS = 24, MAXSTOPS = 8;
  const VS_TRI = `#version 300 es
  void main(){vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(v*2.0-1.0,0.,1.);}`;
  const FS = `#version 300 es
  precision highp float;
  #define MAXBARS 24
  uniform vec2 uRes;
  uniform float uTime, uRise;
  uniform float uBars, uSpread, uMelt, uBreathe, uShimmer;
  uniform float uHeights[MAXBARS];
  uniform float uStopCount, uColorSoft, uBrightness;
  uniform vec3 uCols[8];
  uniform vec3 uBg;
  uniform float uFeather, uHalo;
  uniform float uBlend, uFold, uFoldDepth, uShape;
  uniform vec2 uM;
  uniform float uEngage, uCursorLift, uCursorGlow, uCursorRadius;
  uniform float uImgOn, uImgAspect, uCanvasA, uImgRot, uImgZoom, uImgX, uImgY, uImgFlip, uImgAlpha;
  uniform sampler2D uImg;
  out vec4 o;
  // optional background media, sampled with cover-fit + pan/zoom/rotate (matches the studio cropper)
  vec3 bgSample(vec2 fuv, vec3 fb) {
    if (uImgOn < 0.5) return fb;
    vec2 q = fuv - 0.5;
    q.x *= uCanvasA;
    if (uImgFlip > 0.5) q.x = -q.x;
    float cr = cos(uImgRot), sr = sin(uImgRot);
    q = mat2(cr, sr, -sr, cr) * q;
    q /= max(uImgZoom, 0.05);
    q.x /= uCanvasA;
    vec2 uv = q + 0.5 - vec2(uImgX, uImgY);
    if (uImgAspect > uCanvasA) { uv.x = 0.5 + (uv.x - 0.5) * (uCanvasA / uImgAspect); }
    else { uv.y = 0.5 + (uv.y - 0.5) * (uImgAspect / uCanvasA); }
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return fb;
    return mix(fb, texture(uImg, vec2(uv.x, 1.0 - uv.y)).rgb, uImgAlpha);
  }
  // one rainbow, sampled 0 (root) -> 1 (local crest)
  vec3 palette(float t) {
    float n = max(uStopCount, 1.0);
    float f = clamp(t, 0.0, 1.0) * (n - 1.0);
    int last = int(n) - 1;
    int i0 = int(floor(f)); i0 = clamp(i0, 0, last);
    int i1 = clamp(i0 + 1, 0, last);
    float fr = fract(f);
    float m = mix(fr, smoothstep(0.0, 1.0, fr), uColorSoft);
    return mix(uCols[i0], uCols[i1], m);
  }
  // crest reach at bar position a: the tallest nearby bar, edges softened by
  // the blur so neighbours melt; the domain wraps in ring shape only
  float silhouette(float a) {
    float n = max(uBars, 1.0);
    float colW = 1.0 / n;
    float hw = colW * 0.5 * uSpread;
    float soft = uMelt * colW + 0.5 / uRes.x;
    float H = 0.0;
    for (int i = 0; i < MAXBARS; i++) {
      if (float(i) >= n) break;
      float cx = (float(i) + 0.5) * colW;
      float bh = uHeights[i] * (1.0 + uBreathe * sin(uTime * 1.3 + float(i) * 1.7));
      float d = abs(a - cx);
      if (uShape > 3.5) d = min(d, 1.0 - d);
      float cover = smoothstep(hw + soft, max(hw - soft, 0.0), d);
      H = max(H, bh * cover);
    }
    return H;
  }
  void main() {
    float xs = gl_FragCoord.x / uRes.x;
    float ys = gl_FragCoord.y / uRes.y;
    // fold: the field lives on a plane hinged at the floor and tilted away;
    // invert the perspective projection to find which plane point sits here
    float x = xs, y = ys;
    if (uFold > 0.001) {
      float sa = sin(uFold);
      float den = uFoldDepth * cos(uFold) - ys * sa;
      if (den > 0.002) {
        y = ys * uFoldDepth / den;
        x = (xs - 0.5) * (uFoldDepth + y * sa) / uFoldDepth + 0.5;
      } else { y = 1e3; }              // past the horizon: only the stage remains
    }
    // shape projection: which bar am I under (a), and how far along it (tc)?
    // 0 waves, 1 arch, 2 mirror, 3 gate, 4 spiral
    float a, tc;
    if (uShape < 0.5) {                       // waves: the root line undulates
      a = x;
      tc = max(y - 0.1 * sin(x * 12.566371) - 0.06 * sin(x * 5.0 + 1.7), 0.0);
    }
    else if (uShape < 1.5) {                  // arch: a fan of bars over the top half arc
      float ang = atan(max(y, 1e-4), (x - 0.5) * 2.0);
      a = ang * 0.31830989;                   // 0 at the right springer, 1 at the left
      tc = length(vec2((x - 0.5) * 2.0, y)) * 0.8;
    }
    else if (uShape < 2.5) { a = x; tc = abs(y - 0.5) * 2.0; }        // mirror
    else if (uShape < 3.5) { a = y; tc = min(x, 1.0 - x) * 2.0; }     // gate: curtains close from both sides
    else {                                    // spiral: bars twist as they leave the core
      vec2 pc = vec2(x - 0.5, y - 0.5) * 2.0;
      float r2 = dot(pc, pc);
      float ang = r2 > 1e-8 ? atan(pc.y, pc.x) * 0.15915494 : 0.0;
      a = fract(ang + 0.25 + sqrt(r2) * 0.55);
      tc = sqrt(r2) * 0.72;
    }
    float H = silhouette(a) * uRise;
    // cursor draws the nearest bars toward it and brightens them; the cursor
    // coordinate follows the same shape projection as the bars
    float ca;
    if (uShape < 1.5 && uShape >= 0.5) ca = 1.0 - uM.x;   // arch runs right -> left
    else if (uShape < 2.5) ca = uM.x;                      // waves + mirror follow x
    else if (uShape < 3.5) ca = uM.y;                      // gate follows y
    else {
      // spiral: same twist as the bars, guarded — atan(0,0) is undefined and
      // the eased cursor rests at the exact centre until it first moves
      vec2 mc = (uM - 0.5) * 2.0;
      float md2 = dot(mc, mc);
      ca = md2 > 1e-6 ? fract(atan(mc.y, mc.x) * 0.15915494 + 0.25 + sqrt(md2) * 0.55) : 0.25;
    }
    float ad = a - ca;
    if (uShape > 3.5) ad -= floor(ad + 0.5);
    float cd = ad / max(uCursorRadius, 0.01);
    float cbump = exp(-cd * cd) * uEngage;
    H += uCursorLift * cbump;
    H += uShimmer * 0.02 * sin(a * 22.0 + uTime * 2.3) * H;   // crest ripple
    H = min(H, 0.96);                                         // keep the crest fading inside the frame
    float present = smoothstep(0.0, 0.012, H);                // no bar here -> no root glow
    float t = tc / max(H, 1e-4);
    vec3 rain = palette(t);
    float edge = 1.0 - smoothstep(H - uFeather * H - 1e-4, H + uHalo, tc);
    float appear = smoothstep(0.0, 0.08, uRise);              // ease the glow in as it reveals
    float cover = clamp(edge * appear * present, 0.0, 1.0);   // how much rainbow covers this pixel
    vec3 col = rain * uBrightness * (1.0 + uCursorGlow * cbump);
    vec3 base = bgSample(vec2(xs, ys), uBg);
    vec3 outc;
    if (uBlend < 0.5)      outc = mix(base, col, cover);      // paint: colour sits on the stage (works on white)
    else if (uBlend < 1.5) outc = base + col * cover;         // glow: light added to the stage (dark stages)
    else                   outc = base / max(vec3(1.0) - min(col * cover, vec3(0.999)), vec3(0.001)); // dodge
    o = vec4(outc, 1.0);
  }`;
  function program(vs, fs) {
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const prog = program(VS_TRI, FS);
  const U = n => gl.getUniformLocation(prog, n);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const clampf = (x, a, b) => Math.min(Math.max(x, a), b);
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3);

  const heights = new Float32Array(MAXBARS);
  const cols = new Float32Array(MAXSTOPS * 3);
  const hash = n => { const x = Math.sin(n + C.seed * 127.1) * 43758.5453123; return x - Math.floor(x); };
  function computeHeights() {
    const n = Math.round(clampf(C.bars, 2, MAXBARS));
    const mid = (n - 1) / 2, curve = Math.max(C.curve, 0.05);
    for (let i = 0; i < MAXBARS; i++) {
      if (i >= n) { heights[i] = 0; continue; }
      const d = mid === 0 ? 0 : Math.abs(i - mid) / mid;    // 0 center -> 1 edge
      const eased = 1 - Math.pow(d, curve);                 // 1 center -> 0 edge
      let h = C.peak * (C.valley + (1 - C.valley) * eased);
      h *= 1 + (hash(i * 12.9898 + 1.0) - 0.5) * C.jitter;
      heights[i] = clampf(h, 0, 1.25);
    }
    return n;
  }

  let simT = 0, riseT = 0;
  let engage = 0, engageV = 0;
  let mpx = 0.5, mpy = 0.5, mpxV = 0, mpyV = 0;   // eased cursor position, 0..1 frame coords
  function seedRise() { riseT = C.riseOn ? 0 : 1e9; }
  seedRise();
  function rebuild() { seedRise(); }                          // reseed / deep-links: replay the reveal

  function draw(rise) {
    const n = computeHeights();
    const sc = Math.round(clampf(C.stopCount, 2, MAXSTOPS));
    const cc = [C.c1, C.c2, C.c3, C.c4, C.c5, C.c6, C.c7, C.c8];
    for (let i = 0; i < MAXSTOPS; i++) { const [r, g, b] = hex(cc[i]); cols[i * 3] = r; cols[i * 3 + 1] = g; cols[i * 3 + 2] = b; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(prog);
    gl.uniform2f(U('uRes'), canvas.width, canvas.height);
    gl.uniform1f(U('uTime'), simT);
    gl.uniform1f(U('uRise'), rise);
    gl.uniform1f(U('uBars'), n);
    gl.uniform1f(U('uSpread'), C.spread);
    gl.uniform1f(U('uMelt'), C.melt);
    gl.uniform1f(U('uBreathe'), C.speed > 0 ? C.breathe : 0);   // frozen motion -> no static warp
    gl.uniform1f(U('uShimmer'), C.speed > 0 ? C.shimmer : 0);
    gl.uniform1fv(U('uHeights'), heights);
    gl.uniform1f(U('uStopCount'), sc);
    gl.uniform1f(U('uColorSoft'), C.colorSoft);
    gl.uniform1f(U('uBrightness'), C.brightness);
    gl.uniform3fv(U('uCols'), cols);
    gl.uniform3f(U('uBg'), ...hex(C.bg));
    gl.uniform1f(U('uFeather'), C.feather);
    gl.uniform1f(U('uHalo'), C.halo);
    gl.uniform1f(U('uBlend'), C.blendMode);
    gl.uniform1f(U('uFold'), C.fold * Math.PI / 180);
    gl.uniform1f(U('uFoldDepth'), Math.max(C.foldDepth, 0.1));
    gl.uniform1f(U('uShape'), Math.round(C.shapeMode));
    gl.uniform2f(U('uM'), mpx, mpy);
    gl.uniform1f(U('uEngage'), clampf(engage, 0, 1));
    gl.uniform1f(U('uCursorLift'), C.cursorLift);
    gl.uniform1f(U('uCursorGlow'), C.cursorGlow);
    gl.uniform1f(U('uCursorRadius'), C.cursorRadius);
    gl.uniform1f(U('uImgOn'), C.imageOn && imgTex ? 1 : 0);
    gl.uniform1f(U('uImgAspect'), imgAspect);
    gl.uniform1f(U('uCanvasA'), canvas.width / Math.max(canvas.height, 1));
    gl.uniform1f(U('uImgRot'), C.imageRotate * Math.PI / 180);
    gl.uniform1f(U('uImgZoom'), C.imageZoom);
    gl.uniform1f(U('uImgX'), C.imageX);
    gl.uniform1f(U('uImgY'), C.imageY);
    gl.uniform1f(U('uImgFlip'), C.imageFlip ? 1 : 0);
    gl.uniform1f(U('uImgAlpha'), C.imageOpacity);
    if (videoEl && videoReady) {           // pump the current video frame
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.uniform1i(U('uImg'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // optional background media (uploaded asset): still image or looping video
  let imgTex = null, imgAspect = 1, videoEl = null, videoReady = false, videoObjURL = null;
  const texParams = () => {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const bgAsset = document.getElementById('asset-crestbg');
  const bgSrc = bgAsset ? bgAsset.textContent.trim() : '';
  if (bgSrc && /^data:video\/|\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(bgSrc)) {
    videoEl = document.createElement('video');
    Object.assign(videoEl, { muted: true, loop: true, autoplay: true, playsInline: true, crossOrigin: 'anonymous' });
    canvas._bgVideo = videoEl;             // shared with the cropper: it previews this exact decoder
    videoEl.addEventListener('loadeddata', () => {
      imgAspect = (videoEl.videoWidth / videoEl.videoHeight) || 1;
      imgTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
      texParams();
      videoReady = true;
    });
    const play = () => videoEl && videoEl.play().catch(() => {});  // muted autoplay is allowed
    if (bgSrc.startsWith('data:')) {
      fetch(bgSrc).then(r => r.blob()).then(b => {
        if (!videoEl) return;
        videoObjURL = URL.createObjectURL(b);
        videoEl.src = videoObjURL;
        play();
      }).catch(() => {});
    } else {
      videoEl.src = bgSrc;
      play();
    }
  } else if (bgSrc) {
    const img = new Image();
    img.onload = () => {
      imgAspect = img.width / img.height;
      imgTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      texParams();
    };
    img.src = bgSrc;
  }
  return {
    rebuild,
    dispose() {
      canvas._bgVideo = null;
      if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); videoEl = null; }
      if (videoObjURL) { URL.revokeObjectURL(videoObjURL); videoObjURL = null; }
    },
    frame(dt, mouse) {
      simT += dt * C.speed;
      // reveal once on load; a paused shader settles straight to finished
      if (!C.riseOn) { riseT = 1e9; }
      else if (dt <= 0) { if (riseT < C.riseTime) riseT = C.riseTime; }
      else { riseT += dt; }
      const rise = C.riseOn ? easeOutCubic(clampf(riseT / Math.max(C.riseTime, 0.05), 0, 1)) : 1;
      // cursor springs: engagement fades in/out; the full position eases so
      // every shape can read its own coordinate from the same pointer
      const near = Math.hypot(mouse[0], mouse[1]) < 5;
      const tx = near ? mouse[0] * 0.5 + 0.5 : mpx;
      const ty = near ? mouse[1] * 0.5 + 0.5 : mpy;
      const eT = near ? 1 : 0;
      if (dt > 0) {   // a paused / reduced-motion frame stays perfectly still
        engageV += (eT - engage) * C.stiffness * dt; engageV *= Math.exp(-C.damping * dt); engage += engageV * dt;
        mpxV += (tx - mpx) * C.stiffness * dt; mpxV *= Math.exp(-C.damping * dt); mpx += mpxV * dt;
        mpyV += (ty - mpy) * C.stiffness * dt; mpyV *= Math.exp(-C.damping * dt); mpy += mpyV * dt;
      }
      draw(rise);
    },
  };
}
