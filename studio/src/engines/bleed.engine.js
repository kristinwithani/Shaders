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
  uniform float uBlend, uFold, uFoldDepth;
  uniform float uMouseX, uEngage, uCursorLift, uCursorGlow, uCursorRadius;
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
  // one vertical rainbow, sampled 0 (floor) -> 1 (crest) across the local bar height
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
  // crest height at column position x: the tallest nearby bar, edges softened
  // by the blur so neighbours melt into one another
  float silhouette(float x) {
    float n = max(uBars, 1.0);
    float colW = 1.0 / n;
    float hw = colW * 0.5 * uSpread;
    float soft = uMelt * colW + 0.5 / uRes.x;
    float H = 0.0;
    for (int i = 0; i < MAXBARS; i++) {
      if (float(i) >= n) break;
      float cx = (float(i) + 0.5) * colW;
      float bh = uHeights[i] * (1.0 + uBreathe * sin(uTime * 1.3 + float(i) * 1.7));
      float cover = smoothstep(hw + soft, max(hw - soft, 0.0), abs(x - cx));
      H = max(H, bh * cover);
    }
    return H;
  }
  void main() {
    float xs = gl_FragCoord.x / uRes.x;
    float ys = gl_FragCoord.y / uRes.y;
    // fold: the gradient lives on a plane hinged at the floor and tilted away;
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
    float H = silhouette(x) * uRise;
    // cursor draws the nearest columns up toward it and brightens them
    float cd = (x - uMouseX) / max(uCursorRadius, 0.01);
    float cbump = exp(-cd * cd) * uEngage;
    H += uCursorLift * cbump;
    H += uShimmer * 0.02 * sin(x * 22.0 + uTime * 2.3) * H;   // crest ripple
    H = min(H, 0.96);                                         // keep the crest fading inside the frame
    float present = smoothstep(0.0, 0.012, H);                // no column here -> no floor glow
    float t = y / max(H, 1e-4);
    vec3 rain = palette(t);
    float edge = 1.0 - smoothstep(H - uFeather * H - 1e-4, H + uHalo, y);
    float appear = smoothstep(0.0, 0.08, uRise);              // ease the glow in as it rises
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
  let engage = 0, engageV = 0, mx = 0.5, mxV = 0;
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
    gl.uniform1f(U('uMouseX'), mx);
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
  const bgAsset = document.getElementById('asset-bleedbg');
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
      // reveal: grow from the floor once on load; a paused shader (e.g. reduced
      // motion) settles straight to the finished state instead of a blank floor
      if (!C.riseOn) { riseT = 1e9; }
      else if (dt <= 0) { if (riseT < C.riseTime) riseT = C.riseTime; }
      else { riseT += dt; }
      const rise = C.riseOn ? easeOutCubic(clampf(riseT / Math.max(C.riseTime, 0.05), 0, 1)) : 1;
      // cursor springs: engagement fades in/out, x-position eases toward the pointer
      const near = Math.hypot(mouse[0], mouse[1]) < 5;
      const tx = near ? mouse[0] * 0.5 + 0.5 : mx;   // hold the last column when the pointer leaves
      const eT = near ? 1 : 0;
      if (dt > 0) {   // a paused / reduced-motion frame stays perfectly still
        engageV += (eT - engage) * C.stiffness * dt; engageV *= Math.exp(-C.damping * dt); engage += engageV * dt;
        mxV += (tx - mx) * C.stiffness * dt; mxV *= Math.exp(-C.damping * dt); mx += mxV * dt;
      }
      draw(rise);
    },
  };
}
