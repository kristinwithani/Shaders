function createEffect(canvas, C) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, desynchronized: true, powerPreference: 'high-performance' });
  const VS = `#version 300 es
  void main(){vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(v*2.0-1.0,0.,1.);}`;
  const FS = `#version 300 es
  precision highp float;
  uniform vec2 uRes, uMouse;
  uniform float uTime, uMouseOn;
  uniform vec4 uBlobs[16]; uniform int uCount;
  uniform float uSteps, uSoft, uWarpAmt, uWarpScale, uCore, uCoreStart;
  uniform float uTight, uGlow, uShatter, uRingA, uRingStep;
  uniform vec3 uBg, uBg2;
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
  uniform vec3 uCols[8]; uniform int uNCols;
  out vec4 o;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x),
               mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  vec3 ramp(float v) {
    // bands 1..N-1 spaced evenly up to uCoreStart; the LAST active color
    // is always the core, entering at uCoreStart (its position control)
    v = clamp(v, 0.0, 1.0);
    float n1 = max(float(uNCols - 1), 1.0);
    vec3 c = uBg;
    for (int i = 0; i < 7; i++) {
      if (i >= uNCols - 1) break;
      float p0 = uCoreStart * float(i) / n1;
      float p1 = uCoreStart * float(i + 1) / n1;
      c = mix(c, uCols[i], clamp((v - p0) / max(p1 - p0, 0.01), 0.0, 1.0));
    }
    c = mix(c, uCols[uNCols - 1], clamp((v - uCoreStart) / max(0.92 - uCoreStart, 0.05), 0.0, 1.0));
    return c;
  }
  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y));
    vec2 w = p + uWarpAmt * vec2(
      sin(p.y * uWarpScale + uTime * 0.31) + 0.5 * sin(p.x * uWarpScale * 2.1 - uTime * 0.17),
      sin(p.x * uWarpScale * 1.3 - uTime * 0.23) + 0.5 * sin(p.y * uWarpScale * 1.7 + uTime * 0.13));
    float f = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i >= uCount) break;
      vec2 d = w - uBlobs[i].xy;
      f += uBlobs[i].z * uBlobs[i].z / max(dot(d, d), 1e-5);
    }
    // cursor shatter: carve noise holes near the cursor so approaching it
    // splits the lava apart, sometimes into small floating fragments
    if (uMouseOn > 0.5) {
      vec2 dm = p - uMouse;
      float m = exp(-dot(dm, dm) / 0.16);
      float n = vnoise(p * 14.0 + vec2(uTime * 0.9, -uTime * 0.7));
      f *= 1.0 - uShatter * m * smoothstep(0.30, 0.70, n);
    }
    float v = pow(f / (f + 1.0), 1.0 / uCore);
    // band tightness: contrast around the band region wraps rings closer
    v = clamp(0.5 + (v - 0.5) * uTight, 0.0, 1.0);
    float x = v * uSteps;
    float q = (floor(x) + smoothstep(1.0 - uSoft, 1.0, fract(x))) / uSteps;
    vec3 band = ramp(q);
    float inBlob = smoothstep(0.22, 0.28, v);
    // edge glow: brightness spike where one band snaps into the next
    float e = min(fract(x), 1.0 - fract(x));
    float glow = exp(-e * e * 40.0) * uGlow * inBlob;
    band += glow * (band * 0.5 + vec3(0.6));
    // soft gradient background
    vec3 bg = mix(uBg2, uBg, smoothstep(-1.1, 1.1, p.y));
    bg = bgSample(gl_FragCoord.xy / uRes, bg);
    // per-ring opacity: the outermost ring renders at uRingA, and every
    // ring inward gains uRingStep opacity (50% -> 43% -> 36% transparent...)
    float ring = max(floor(x) - floor(0.28 * uSteps), 0.0);
    float shell = clamp(uRingA + uRingStep * ring, 0.0, 1.0);
    float alpha = clamp(inBlob * shell + glow, 0.0, 1.0);
    o = vec4(mix(bg, band, alpha), 1.0);
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

  let blobs = [];
  const blobData = new Float32Array(16 * 4);
  function rebuild() {
    const hash = n => { const x = Math.sin(n + C.seed * 1013.7) * 43758.5453123; return x - Math.floor(x); };
    blobs = [];
    for (let i = 0; i < Math.min(C.blobCount, 16); i++) {
      const h = k => hash(i * 17.23 + k * 91.7);
      blobs.push({
        cx: (h(1) - 0.5) * 1.1,
        cy: (h(2) - 0.5) * 0.9,
        ax: 0.15 + 0.35 * h(3),
        ay: 0.2 + 0.5 * h(4),
        sx: 0.4 + 0.8 * h(5),
        sy: 0.3 + 0.7 * h(6),
        p1: h(7) * 6.283, p2: h(8) * 6.283,
        r: 0.55 + 0.9 * h(9),
        dx: 0, dy: 0, vx: 0, vy: 0,
      });
    }
  }
  rebuild();

  // optional background media (uploaded asset): still image or looping video
  let imgTex = null, imgAspect = 1, videoEl = null, videoReady = false, videoObjURL = null;
  const texParams = () => {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const bgAsset = document.getElementById('asset-lavabg');
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

  let simT = 0, mEase = [99, 99];
  return {
    rebuild,
    dispose() {                            // stop the video decode when the effect is torn down
      canvas._bgVideo = null;              // release the cropper's shared reference
      if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); videoEl = null; }
      if (videoObjURL) { URL.revokeObjectURL(videoObjURL); videoObjURL = null; }
    },
    frame(dt, mouse) {
      simT += dt * C.speed;
      const t = simT;
      const mouseNear = Math.hypot(mouse[0], mouse[1]) < 5;
      // eased cursor for the shatter field (fast, but not instant)
      if (mouseNear) {
        if (mEase[0] > 50) mEase = [...mouse];
        const k = 1 - Math.exp(-dt * 8);
        mEase[0] += (mouse[0] - mEase[0]) * k;
        mEase[1] += (mouse[1] - mEase[1]) * k;
      } else {
        mEase = [99, 99];
      }
      const R2 = C.cursorRadius * C.cursorRadius;
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        let x = b.cx + Math.sin(t * b.sx + b.p1) * b.ax;
        let y = b.cy + Math.sin(t * b.sy + b.p2) * b.ay * (0.4 + C.rise);
        let fx = 0, fy = 0;
        if (mouseNear) {
          const ddx = mouse[0] - (x + b.dx), ddy = mouse[1] - (y + b.dy);
          const d2 = ddx * ddx + ddy * ddy;
          const force = C.cursorPull * Math.exp(-d2 / R2);
          const d = Math.max(Math.sqrt(d2), 1e-4);
          fx = (ddx / d) * force; fy = (ddy / d) * force;
        }
        b.vx += (fx * 1.5 - b.dx * C.stiffness * 0.02) * dt * 60 * 0.05;
        b.vy += (fy * 1.5 - b.dy * C.stiffness * 0.02) * dt * 60 * 0.05;
        const damp = Math.exp(-C.damping * dt);
        b.vx *= damp; b.vy *= damp;
        b.dx += b.vx * dt * 60 * 0.05; b.dy += b.vy * dt * 60 * 0.05;
        blobData[i * 4] = x + b.dx;
        blobData[i * 4 + 1] = y + b.dy;
        blobData[i * 4 + 2] = C.blobSize * b.r;
        blobData[i * 4 + 3] = 0;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.uniform2f(U('uRes'), canvas.width, canvas.height);
      gl.uniform2f(U('uMouse'), mEase[0], mEase[1]);
      gl.uniform1f(U('uMouseOn'), mouseNear ? 1 : 0);
      gl.uniform1f(U('uTime'), t);
      gl.uniform4fv(U('uBlobs'), blobData);
      gl.uniform1i(U('uCount'), blobs.length);
      gl.uniform1f(U('uSteps'), Math.max(Math.round(C.steps), 2));
      gl.uniform1f(U('uSoft'), C.softness);
      gl.uniform1f(U('uWarpAmt'), C.warpAmount);
      gl.uniform1f(U('uWarpScale'), C.warpScale);
      gl.uniform1f(U('uCore'), C.coreSize);
      gl.uniform1f(U('uCoreStart'), C.coreStart);
      gl.uniform1f(U('uTight'), C.tightness);
      gl.uniform1f(U('uGlow'), C.glow);
      gl.uniform1f(U('uShatter'), C.shatter);
      gl.uniform1f(U('uRingA'), C.ringOpacity);
      gl.uniform1f(U('uRingStep'), C.opacityStep);
      gl.uniform3f(U('uBg'), ...hex(C.bg));
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
      const nB = Math.min(Math.max(Math.round(C.bandCount), 2), 8);
      for (let i = 0; i < 8; i++) {
        gl.uniform3f(U('uCols[' + i + ']'), ...hex(C['color' + (Math.min(i, nB - 1) + 1)]));
      }
      gl.uniform1i(U('uNCols'), nB);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
