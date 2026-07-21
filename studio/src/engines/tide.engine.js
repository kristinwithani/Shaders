function createEffect(canvas, C) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, desynchronized: true, powerPreference: 'high-performance' });
  const VS = `#version 300 es
  void main(){vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(v*2.0-1.0,0.,1.);}`;
  const FS = `#version 300 es
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime, uSoftK, uOpacity, uAngle, uEdgeBlur;
  uniform float uLevel, uBSoft, uLineA;
  uniform vec3 uLineCol;
  uniform vec4 uBlobs[12];      // x, y, radius, -
  uniform vec3 uBlobCols[12];
  uniform int uNB;
  uniform vec3 uBg1, uBg2;
  uniform float uImgOn, uImgAspect, uCanvasA, uImgRot, uImgZoom, uImgX, uImgY, uImgFlip, uImgAlpha;
  uniform sampler2D uImg;
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
  out vec4 o;
  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y));
    // background: a clean two-colour gradient at an adjustable angle
    float t = clamp(dot(p, vec2(cos(uAngle), sin(uAngle))) * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uBg1, uBg2, t);
    col = bgSample(gl_FragCoord.xy / uRes, col);
    // the tide mask: blobs live below the waterline, fading across uBSoft
    // frame edge blur: 0 at the centre rising to 1 on the border, reaching
    // uEdgeBlur inward. Blurring analytic fields = widening their falloffs,
    // so blobs and the waterline melt as they approach the frame.
    float eb = 1.0 - smoothstep(0.0, max(uEdgeBlur, 1e-4), 1.0 - max(abs(p.x), abs(p.y)));
    float bSoft = uBSoft + eb * 0.35;
    float softK = uSoftK / (1.0 + eb * 6.0);
    float mask = smoothstep(uLevel + bSoft, uLevel - bSoft, p.y);
    for (int i = 0; i < 12; i++) {
      if (i >= uNB) break;
      vec2 d = p - uBlobs[i].xy;
      float r = max(uBlobs[i].z, 1e-3);
      float a = exp(-dot(d, d) / (r * r) * softK);
      col = mix(col, uBlobCols[i], a * uOpacity * mask);
    }
    // optional hairline right at the waterline (defocused near the frame edge)
    float ln = (1.0 - smoothstep(0.004, 0.016 + eb * 0.05, abs(p.y - uLevel))) * (1.0 - eb * 0.8);
    col = mix(col, uLineCol, ln * uLineA);
    o = vec4(col, 1.0);
  }`;
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = n => gl.getUniformLocation(prog, n);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

  function rgb2hsv(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 0) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6; if (h < 0) h += 1;
    }
    return [h, mx === 0 ? 0 : d / mx, mx];
  }
  function hsv2rgb(h, s, v) {
    const f = n => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5), f(3), f(1)];
  }

  // pooled blob simulation: bounce box capped by the waterline
  let blobs = [];
  function rebuildBlobs() {
    const hash = n => { const x = Math.sin(n + C.seed * 1013.7) * 43758.5453123; return x - Math.floor(x); };
    blobs = [];
    for (let i = 0; i < Math.min(C.count, 12); i++) {
      const h = k => hash(i * 23.17 + k * 71.3);
      const a = h(3) * 6.28318;
      blobs.push({
        x: (h(1) - 0.5) * 1.5, y: -0.9 + h(2) * 0.8,   // start inside the pool
        dx: Math.cos(a), dy: Math.sin(a),
        rf: (h(4) - 0.5) * 2,
        phase: h(5) * 6.28318,
        ox: 0, oy: 0, vx: 0, vy: 0,                     // cursor stir displacement + velocity
      });
    }
  }
  rebuildBlobs();

  // optional background media (uploaded asset): still image or looping video
  let imgTex = null, imgAspect = 1, videoEl = null, videoReady = false, videoObjURL = null;
  const texParams = () => {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const bgAsset = document.getElementById('asset-tidebg');
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
      // <video> won't reliably load a large data: URL — feed it a blob URL instead
      fetch(bgSrc).then(r => r.blob()).then(b => {
        if (!videoEl) return;
        videoObjURL = URL.createObjectURL(b);
        videoEl.src = videoObjURL;
        play();
      }).catch(() => {});
    } else {
      videoEl.src = bgSrc;                 // http(s) URL passthrough
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

  const posData = new Float32Array(12 * 4);
  const colData = new Float32Array(12 * 3);

  // ==================== web overlay (mirrors the web shader) ====================

  const VS_LINE = `#version 300 es
  layout(location=0) in vec2 corner;    // x: 0..1 along, y: -1..1 across
  layout(location=1) in vec4 iSeg;      // ax, ay, bx, by (unit space)
  layout(location=2) in vec2 iMeta;     // width px, alpha
  uniform vec2 uRes;
  out float vAcross; out float vHalfPx; out float vAlpha;
  void main() {
    vec2 a = iSeg.xy, b = iSeg.zw;
    vec2 dir = normalize(b - a + 1e-6);
    vec2 perp = vec2(-dir.y, dir.x);
    float scale = 0.5 * min(uRes.x, uRes.y);
    float halfU = (iMeta.x * 0.5 + 1.0) / scale;
    vec2 p = mix(a, b, corner.x) + perp * halfU * corner.y;
    gl_Position = vec4(p * scale / (0.5 * uRes), 0.0, 1.0);
    vAcross = corner.y * (iMeta.x * 0.5 + 1.0);
    vHalfPx = iMeta.x * 0.5;
    vAlpha = iMeta.y;
  }`;
  const FS_LINE = `#version 300 es
  precision highp float;
  in float vAcross; in float vHalfPx; in float vAlpha;
  uniform vec3 uColor;
  out vec4 o;
  void main() {
    float edge = smoothstep(vHalfPx + 0.7, max(vHalfPx - 0.7, 0.0), abs(vAcross));
    o = vec4(uColor, edge * vAlpha);
  }`;
  const VS_DOT = `#version 300 es
  layout(location=0) in vec2 corner;    // -1..1
  layout(location=1) in vec4 iDot;      // x, y, size px, alpha
  uniform vec2 uRes;
  out vec2 vLocal; out float vSize; out float vAlpha;
  void main() {
    float scale = 0.5 * min(uRes.x, uRes.y);
    float rU = (iDot.z * 0.5 + 1.5) / scale;
    vec2 p = iDot.xy + corner * rU;
    gl_Position = vec4(p * scale / (0.5 * uRes), 0.0, 1.0);
    vLocal = corner * (iDot.z * 0.5 + 1.5);
    vSize = iDot.z * 0.5;
    vAlpha = iDot.w;
  }`;
  const FS_DOT = `#version 300 es
  precision highp float;
  in vec2 vLocal; in float vSize; in float vAlpha;
  uniform vec3 uColor; uniform float uShape;
  out vec4 o;
  void main() {
    vec2 q = vLocal;
    float d;
    if (uShape < 0.5)      d = length(q) - vSize;                    // circle
    else if (uShape < 1.5) d = max(abs(q.x), abs(q.y)) - vSize;      // square
    else if (uShape < 2.5) d = (abs(q.x) + abs(q.y)) * 0.82 - vSize; // diamond
    else                   d = abs(length(q) - vSize * 0.75) - vSize * 0.28; // ring
    o = vec4(uColor, smoothstep(0.8, -0.8, d) * vAlpha);
  }`;
  function wProgram(vs, fs) {
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const wProgLine = wProgram(VS_LINE, FS_LINE);
  const wProgDot = wProgram(VS_DOT, FS_DOT);
  const WU = (p, n) => gl.getUniformLocation(p, n);
  const wHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

  const MAX_N = 400, MAX_E = MAX_N * 4;
  const segData = new Float32Array(MAX_E * 4);
  const segMeta = new Float32Array(MAX_E * 2);
  const dotData = new Float32Array(MAX_N * 4);
  function wMakeVao(corners, instances) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const cBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const it of instances) {
      gl.bindBuffer(gl.ARRAY_BUFFER, it.buf);
      gl.bufferData(gl.ARRAY_BUFFER, it.bytes, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(it.loc);
      gl.vertexAttribPointer(it.loc, it.size, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(it.loc, 1);
    }
    gl.bindVertexArray(null);
    return vao;
  }
  const segBuf = gl.createBuffer(), segMetaBuf = gl.createBuffer(), dotBuf = gl.createBuffer();
  const wVaoLine = wMakeVao(new Float32Array([0,-1, 1,-1, 0,1, 1,1]),
    [{ buf: segBuf, bytes: segData.byteLength, loc: 1, size: 4 },
     { buf: segMetaBuf, bytes: segMeta.byteLength, loc: 2, size: 2 }]);
  const wVaoDot = wMakeVao(new Float32Array([-1,-1, 1,-1, -1,1, 1,1]),
    [{ buf: dotBuf, bytes: dotData.byteLength, loc: 1, size: 4 }]);

  // ---- web structure: nodes on an irregular blob shell + k-nearest links ----
  let nodes = [], edges = [], maxR = 1;
  function rebuildWeb() {
    const hash = n => { const x = Math.sin(n + C.seed * 1013.7) * 43758.5453123; return x - Math.floor(x); };
    const N = Math.min(Math.round(C.webCount), MAX_N);
    const GA = 2.39996322973;
    const ph1 = hash(1) * 6.28, ph2 = hash(2) * 6.28, ph3 = hash(3) * 6.28;
    nodes = [];
    for (let i = 0; i < N; i++) {
      let z = 1 - 2 * (i + 0.5) / N;
      z = Math.min(Math.max(z + (hash(i * 7.1) - 0.5) * 0.2, -0.99), 0.99);
      const th = i * GA + hash(i * 3.3) * 0.9;
      const s = Math.sqrt(1 - z * z);
      const dx = s * Math.cos(th), dy = s * Math.sin(th), dz = z;
      // irregular blob: radius modulated by seeded low-frequency waves
      const mod = 1 + C.webIrregularity * (0.45 * Math.sin(3.1 * dx + ph1)
        + 0.35 * Math.sin(4.2 * dy + ph2) + 0.25 * Math.sin(5.3 * dz + ph3));
      const r = C.webRadius * mod * (0.82 + 0.18 * hash(i * 11.7));
      nodes.push({ rest: [dx * r, dy * r, dz * r], disp: [0, 0, 0], vel: [0, 0, 0], px: 0, py: 0, s: 1 });
    }
    maxR = C.webRadius * (1 + C.webIrregularity);
    // k-nearest links
    const k = Math.round(C.linksPerNode);
    const set = new Set();
    edges = [];
    for (let i = 0; i < N; i++) {
      const d2 = [];
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const a = nodes[i].rest, b = nodes[j].rest;
        d2.push([(a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2, j]);
      }
      d2.sort((x, y) => x[0] - y[0]);
      for (let m = 0; m < k && m < d2.length; m++) {
        const j = d2[m][1];
        const key = i < j ? i * MAX_N + j : j * MAX_N + i;
        if (set.has(key)) continue;
        set.add(key);
        edges.push({ a: i, b: j, len: Math.sqrt(d2[m][0]) });
      }
    }
  }
  rebuildWeb();

  // ---- interaction: drag a node, or drag space to rotate ----
  // yaw chases yawTarget with a lag, so node drags swing the whole web
  // around the spin axis at a slight delay while the spin keeps running
  let yaw = 0.5, yawTarget = 0.5, pitch = -0.25, pitchTarget = -0.25;
  let dragIdx = -1, rotating = false;
  let spinDir = 1, tiltDir = 1;      // idle rotation follows the last drag direction
  let lastU = [0, 0], dragTarget = [0, 0];
  const toUnit = ev => {
    const r = canvas.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width - 0.5) * 2, (0.5 - (ev.clientY - r.top) / r.height) * 2];
  };
  canvas.addEventListener('pointerdown', ev => {
    const u = toUnit(ev);
    let best = -1, bestD = 0.09;
    for (let i = 0; i < nodes.length; i++) {
      const d = Math.hypot(nodes[i].px - u[0], nodes[i].py - u[1]);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) { dragIdx = best; dragTarget = u; }
    else rotating = true;
    lastU = u;
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', ev => {
    const u = toUnit(ev);
    const dxu = u[0] - lastU[0], dyu = u[1] - lastU[1];
    if (dragIdx >= 0 || rotating) {
      // the idle spin continues in whichever direction you dragged
      if (Math.abs(dxu) > 0.001) spinDir = dxu > 0 ? 1 : -1;
      if (Math.abs(dyu) > 0.001) tiltDir = dyu > 0 ? -1 : 1;
    }
    if (dragIdx >= 0) {
      dragTarget = u;
      // pulling a node tows the whole web around both rotation axes
      const g = C.dragSwing / Math.max(nodes[dragIdx].s, 0.4);
      yawTarget += dxu * g;
      pitchTarget -= dyu * g;
    } else if (rotating) {
      yawTarget += dxu * 2.6;
      pitchTarget -= dyu * 2.6;
    }
    lastU = u;
  });
  const release = () => { dragIdx = -1; rotating = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  let simT = 0;
  return {
    rebuild() { rebuildBlobs(); rebuildWeb(); },
    dispose() {                            // stop the video decode when the effect is torn down
      canvas._bgVideo = null;              // release the cropper's shared reference
      if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); videoEl = null; }
      if (videoObjURL) { URL.revokeObjectURL(videoObjURL); videoObjURL = null; }
    },
    frame(dt, mouse) {
      if (!C.blobStatic) simT += dt;   // static freezes drift and hue motion
      const bound = 0.95;
      // waterline in unit space; fill 1 lifts the line plus its soft edge
      // fully above the frame so the pool reaches the very top
      const level = -1 + C.fillLevel * (2 + C.boundarySoft * 2);
      const yTop = Math.min(level, bound);
      const nPal = Math.min(Math.max(Math.round(C.paletteCount), 1), 6);
      const mouseNear = Math.hypot(mouse[0], mouse[1]) < 5;
      const R2 = C.cursorRadius * C.cursorRadius;
      const damp = Math.exp(-C.damping * dt);
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        if (!C.blobStatic) {
          // slow infinite wall bounce, ceiling = the waterline
          b.x += b.dx * C.speed * dt;
          b.y += b.dy * C.speed * dt;
          if (b.x > bound) { b.x = bound; b.dx = -Math.abs(b.dx); }
          if (b.x < -bound) { b.x = -bound; b.dx = Math.abs(b.dx); }
          if (b.y < -bound) { b.y = -bound; b.dy = Math.abs(b.dy); }
        }
        if (b.y > yTop) { b.y = yTop; b.dy = -Math.abs(b.dy); }   // waterline clamps even when static
        // cursor stir: gaussian pull (negative repels) with a spring back home
        let fx = 0, fy = 0;
        if (mouseNear && C.cursorPull !== 0) {
          const ddx = mouse[0] - (b.x + b.ox), ddy = mouse[1] - (b.y + b.oy);
          const d2 = ddx * ddx + ddy * ddy;
          const force = C.cursorPull * Math.exp(-d2 / R2);
          const d = Math.max(Math.sqrt(d2), 1e-4);
          fx = (ddx / d) * force; fy = (ddy / d) * force;
        }
        b.vx += (fx * 1.5 - b.ox * C.stiffness * 0.02) * dt * 60 * 0.05;
        b.vy += (fy * 1.5 - b.oy * C.stiffness * 0.02) * dt * 60 * 0.05;
        b.vx *= damp; b.vy *= damp;
        b.ox += b.vx * dt * 60 * 0.05; b.oy += b.vy * dt * 60 * 0.05;
        posData[i * 4] = b.x + b.ox;
        posData[i * 4 + 1] = b.y + b.oy;
        posData[i * 4 + 2] = C.size * (1 + b.rf * C.sizeVariation);
        // subtle continuous hue drift around each blob's palette colour
        const base = hex(C['blobColor' + (i % nPal + 1)]);
        const hsv = rgb2hsv(base[0], base[1], base[2]);
        hsv[0] = (hsv[0] + C.colorDrift * Math.sin(simT * C.driftSpeed + b.phase) + 1) % 1;
        const rgb = hsv2rgb(hsv[0], hsv[1], hsv[2]);
        colData[i * 3] = rgb[0]; colData[i * 3 + 1] = rgb[1]; colData[i * 3 + 2] = rgb[2];
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.uniform2f(U('uRes'), canvas.width, canvas.height);
      gl.uniform1f(U('uTime'), simT);
      gl.uniform4fv(U('uBlobs'), posData);
      gl.uniform3fv(U('uBlobCols'), colData);
      gl.uniform1i(U('uNB'), C.blobsOn ? blobs.length : 0);   // blobs off -> pure gradient
      gl.uniform1f(U('uSoftK'), 3.0 / Math.max(C.edgeSoftness, 0.05));
      gl.uniform1f(U('uOpacity'), C.opacity);
      gl.uniform1f(U('uAngle'), C.gradientAngle * Math.PI / 180);
      gl.uniform1f(U('uEdgeBlur'), C.edgeBlur);
      gl.uniform1f(U('uLevel'), level);
      gl.uniform1f(U('uBSoft'), Math.max(C.boundarySoft, 0.003));
      gl.uniform1f(U('uLineA'), C.surfaceLine);
      gl.uniform3f(U('uLineCol'), ...hex(C.surfaceColor));
      gl.uniform3f(U('uBg1'), ...hex(C.bg1));
      gl.uniform3f(U('uBg2'), ...hex(C.bg2));
      gl.uniform1f(U('uImgOn'), C.imageOn && imgTex ? 1 : 0);
      gl.uniform1f(U('uImgAspect'), imgAspect);
      gl.uniform1f(U('uCanvasA'), canvas.width / Math.max(canvas.height, 1));
      gl.uniform1f(U('uImgRot'), C.imageRotate * Math.PI / 180);
      gl.uniform1f(U('uImgZoom'), C.imageZoom);
      gl.uniform1f(U('uImgX'), C.imageX);
      gl.uniform1f(U('uImgY'), C.imageY);
      gl.uniform1f(U('uImgFlip'), C.imageFlip ? 1 : 0);
      gl.uniform1f(U('uImgAlpha'), C.imageOpacity);
      if (videoEl && videoReady) {         // pump the current video frame
        gl.bindTexture(gl.TEXTURE_2D, imgTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.uniform1i(U('uImg'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // ---- web overlay on top ----
      if (C.webOn) {

        yawTarget += dt * Math.abs(C.autoSpin) * spinDir;   // spin follows drag direction
        pitchTarget += dt * Math.abs(C.autoTilt) * tiltDir;
        const chase = 1 - Math.exp(-dt * C.swingDelay);
        yaw += (yawTarget - yaw) * chase;
        pitch += (pitchTarget - pitch) * chase;
        const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        // R = Ry(yaw) * Rx(pitch); columns for model->view
        const rot = m => {
          const y1 = m[1] * cp - m[2] * sp, z1 = m[1] * sp + m[2] * cp;
          return [m[0] * cy + z1 * sy, y1, -m[0] * sy + z1 * cy];
        };
        const invRot = v => {           // transpose
          const x1 = v[0] * cy - v[2] * sy, z1 = v[0] * sy + v[2] * cy;
          return [x1, v[1] * cp + z1 * sp, -v[1] * sp + z1 * cp];
        };

        // ---- spring physics in model space ----
        const kWeb = C.webStiffness, kSnap = C.snapStiffness;
        const wDamp = Math.exp(-C.snapDamping * dt);
        for (const e of edges) {
          const A = nodes[e.a], B = nodes[e.b];
          const ax = A.rest[0] + A.disp[0], ay = A.rest[1] + A.disp[1], az = A.rest[2] + A.disp[2];
          const bx = B.rest[0] + B.disp[0], by = B.rest[1] + B.disp[1], bz = B.rest[2] + B.disp[2];
          let dx = ax - bx, dy = ay - by, dz = az - bz;
          const len = Math.max(Math.hypot(dx, dy, dz), 1e-5);
          const f = kWeb * (len - e.len) / len * dt;
          dx *= f; dy *= f; dz *= f;
          A.vel[0] -= dx; A.vel[1] -= dy; A.vel[2] -= dz;
          B.vel[0] += dx; B.vel[1] += dy; B.vel[2] += dz;
        }
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (i === dragIdx) {
            // hard constraint: dragged node follows the pointer in its depth plane
            const view = rot([n.rest[0] + n.disp[0], n.rest[1] + n.disp[1], n.rest[2] + n.disp[2]]);
            const target = invRot([dragTarget[0] / Math.max(n.s, 0.3), dragTarget[1] / Math.max(n.s, 0.3), view[2]]);
            n.disp[0] = target[0] - n.rest[0]; n.disp[1] = target[1] - n.rest[1]; n.disp[2] = target[2] - n.rest[2];
            n.vel = [0, 0, 0];
            continue;
          }
          for (let a = 0; a < 3; a++) {
            n.vel[a] -= n.disp[a] * kSnap * dt;   // snap home -> core stays fixed
            n.vel[a] *= wDamp;
            n.disp[a] += n.vel[a] * dt;
          }
        }

        // ---- project, depth-sort, fill instance buffers ----
        const persp = C.perspective;
        const order = [];
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const v = rot([n.rest[0] + n.disp[0], n.rest[1] + n.disp[1], n.rest[2] + n.disp[2]]);
          const s = persp / Math.max(persp - v[2], 0.4);
          n.px = v[0] * s; n.py = v[1] * s; n.s = s;
          n.depth = Math.min(Math.max((v[2] + maxR) / (2 * maxR), 0), 1);
          n.z = v[2];
          order.push(i);
        }
        order.sort((a, b) => nodes[a].z - nodes[b].z);           // far first
        const eOrder = edges.map((e, i) => i)
          .sort((a, b) => (nodes[edges[a].a].z + nodes[edges[a].b].z) - (nodes[edges[b].a].z + nodes[edges[b].b].z));

        const dprScale = canvas.width / Math.max(canvas.clientWidth, 1);
        const fade = C.depthFade, dSize = C.depthShrink;
        let nE = 0;
        for (const ei of eOrder) {
          const e = edges[ei], A = nodes[e.a], B = nodes[e.b];
          const depth = (A.depth + B.depth) * 0.5;
          segData[nE * 4] = A.px; segData[nE * 4 + 1] = A.py;
          segData[nE * 4 + 2] = B.px; segData[nE * 4 + 3] = B.py;
          segMeta[nE * 2] = C.lineWidth * (1 - dSize * (1 - depth)) * dprScale;
          segMeta[nE * 2 + 1] = C.lineOpacity * (1 - fade * (1 - depth));
          nE++;
        }
        let nD = 0;
        for (const i of order) {
          const n = nodes[i];
          dotData[nD * 4] = n.px; dotData[nD * 4 + 1] = n.py;
          dotData[nD * 4 + 2] = C.nodeSize * (1 - dSize * (1 - n.depth)) * n.s * dprScale;
          dotData[nD * 4 + 3] = 1 - fade * (1 - n.depth);
          nD++;
        }

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(wProgLine);
        gl.uniform2f(WU(wProgLine, 'uRes'), canvas.width, canvas.height);
        gl.uniform3f(WU(wProgLine, 'uColor'), ...wHex(C.lineColor));
        gl.bindVertexArray(wVaoLine);
        gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, segData.subarray(0, nE * 4));
        gl.bindBuffer(gl.ARRAY_BUFFER, segMetaBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, segMeta.subarray(0, nE * 2));
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nE);

        gl.useProgram(wProgDot);
        gl.uniform2f(WU(wProgDot, 'uRes'), canvas.width, canvas.height);
        gl.uniform3f(WU(wProgDot, 'uColor'), ...wHex(C.nodeColor));
        gl.uniform1f(WU(wProgDot, 'uShape'), Math.round(C.nodeShape));
        gl.bindVertexArray(wVaoDot);
        gl.bindBuffer(gl.ARRAY_BUFFER, dotBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, dotData.subarray(0, nD * 4));
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nD);
        gl.bindVertexArray(null);
      }
    },
  };
}
