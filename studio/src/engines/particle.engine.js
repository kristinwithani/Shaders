function createEffect(canvas, C) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, desynchronized: true, powerPreference: 'high-performance' });

  const VS_TRI = `#version 300 es
  void main(){vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(v*2.0-1.0,0.,1.);}`;
  const FS_BG = `#version 300 es
  precision highp float;
  uniform vec2 uRes;
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
  out vec4 o;
  void main(){
    vec2 fuv = gl_FragCoord.xy / uRes;
    vec3 col = mix(uBg2, uBg, fuv.y);      // top color blends down to bottom color
    o = vec4(bgSample(fuv, col), 1.0);
  }`;

  const VS_PART = `#version 300 es
  layout(location=0) in vec2 corner;
  layout(location=1) in vec4 iP;           // x, y (unit space), radius px, alpha
  layout(location=2) in vec3 iM;           // speck seed, rotation, stretch random
  uniform vec2 uRes; uniform float uStretch;
  out vec2 vLocal; out float vRad; out float vA; out float vSeed;
  void main(){
    float scale=0.5*min(uRes.x,uRes.y);
    float rU=(iP.z+1.0)/scale;
    float e=uStretch*iM.z*0.6;             // per-speck random elongation
    vec2 c2=corner*vec2(1.0+e,1.0-e);
    float cr=cos(iM.y),sr=sin(iM.y);
    c2=mat2(cr,sr,-sr,cr)*c2;              // ...at a random angle
    vec2 p=iP.xy+c2*rU;
    gl_Position=vec4(p*scale/(0.5*uRes),0.,1.);
    vLocal=corner*(iP.z+1.0); vRad=iP.z; vA=iP.w; vSeed=iM.x;
  }`;
  const FS_PART = `#version 300 es
  precision highp float;
  in vec2 vLocal; in float vRad; in float vA; in float vSeed;
  uniform vec3 uColor; uniform float uSoft, uIrreg, uGrain;
  out vec4 o;
  void main(){
    float d = length(vLocal);
    // ragged outline: per-speck angular harmonics eat into the disc so no
    // two speckles share a silhouette
    float ang = atan(vLocal.y, vLocal.x);
    float w = sin(ang*3.0+vSeed*13.7)*0.5 + sin(ang*5.0-vSeed*7.3)*0.3 + sin(ang*9.0+vSeed*29.1)*0.2;
    float rEff = vRad * (1.0 - uIrreg*(0.28 + 0.30*w));
    float edge = max(vRad*uSoft, 0.7);
    float a = smoothstep(rEff+0.7, rEff-edge, d);
    // interior grain: hashed micro-holes keep the speck dusty, never a flat fill
    float g = fract(sin(dot(vLocal + vSeed*31.7, vec2(127.1,311.7))) * 43758.5453123);
    a *= 1.0 - uGrain*g*0.85;
    o = vec4(uColor, a*vA);
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
  const progBg = program(VS_TRI, FS_BG);
  const progPart = program(VS_PART, FS_PART);
  const U = (p, n) => gl.getUniformLocation(p, n);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

  // one quad, instanced per particle
  const partBuf = gl.createBuffer(), metaBuf = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const cBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.bindBuffer(gl.ARRAY_BUFFER, metaBuf);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);

  // seeded field: z is fixed per particle, so depth order never changes and
  // the far-to-near sort happens once per rebuild, not per frame
  let parts = [], data;
  function rebuild() {
    const hash = n => { const x = Math.sin(n * 127.1 + C.seed * 311.7) * 43758.5453123; return x - Math.floor(x); };
    parts = [];
    const n = Math.max(Math.round(C.count), 1);
    for (let i = 0; i < n; i++) {
      const h = k => hash(i * 13.37 + k * 7.77);
      parts.push({
        x: (h(1) - 0.5) * 2.6, y: (h(2) - 0.5) * 2.6,   // unit space with overscan
        z: h(3) * 2 - 1,
        rSize: h(4), ph: h(5) * 6.28318, ph2: h(6) * 6.28318,
        vx: h(7) - 0.5, vy: h(8) - 0.5,                  // per-particle drift variance
        mSeed: h(9) * 100, mRot: h(10) * 6.28318, mStretch: h(11),  // speck character
        dx: 0, dy: 0, ux: 0, uy: 0,                      // cursor displacement + velocity
      });
    }
    parts.sort((a, b) => a.z - b.z);
    data = new Float32Array(n * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    const meta = new Float32Array(n * 3);                // static per speck
    parts.forEach((p, i) => { meta[i * 3] = p.mSeed; meta[i * 3 + 1] = p.mRot; meta[i * 3 + 2] = p.mStretch; });
    gl.bindBuffer(gl.ARRAY_BUFFER, metaBuf);
    gl.bufferData(gl.ARRAY_BUFFER, meta, gl.STATIC_DRAW);
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
  const bgAsset = document.getElementById('asset-particlebg');
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

  let simT = 0, rawT = 0;
  return {
    rebuild,
    dispose() {                            // stop the video decode when the effect is torn down
      canvas._bgVideo = null;              // release the cropper's shared reference
      if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); videoEl = null; }
      if (videoObjURL) { URL.revokeObjectURL(videoObjURL); videoObjURL = null; }
    },
    frame(dt, mouse) {
      simT += dt * C.driftSpeed;
      rawT += dt;                          // wobble/twinkle clock, independent of drift speed
      const t = simT;
      const mouseNear = Math.hypot(mouse[0], mouse[1]) < 5;
      const persp = C.perspective;
      const dprScale = canvas.width / Math.max(canvas.clientWidth, 1);
      const wrap = v => { v = (v + 1.3) % 2.6; return (v < 0 ? v + 2.6 : v) - 1.3; };
      const R2 = C.cursorRadius * C.cursorRadius;
      const dampF = Math.exp(-C.damping * dt);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const z = p.z * C.depth;
        const s = persp / Math.max(persp - z, 0.4);
        const dn = (p.z + 1) * 0.5;        // 0 = far, 1 = near
        let px = wrap(p.x + (C.wind + p.vx * 0.25) * t);
        let py = wrap(p.y + (C.rise + p.vy * 0.25) * t);
        px += Math.sin(rawT * C.wobbleSpeed + p.ph) * C.wobbleAmp;
        py += Math.cos(rawT * C.wobbleSpeed * 0.87 + p.ph2) * C.wobbleAmp;
        // cursor: gaussian pull (− repels) in screen space, spring returns home
        let sx = px * s + p.dx, sy = py * s + p.dy;
        if (mouseNear && C.cursorPull !== 0) {
          const ddx = mouse[0] - sx, ddy = mouse[1] - sy;
          const d2 = ddx * ddx + ddy * ddy;
          const f = C.cursorPull * 5 * Math.exp(-d2 / R2) * dt;
          const d = Math.max(Math.sqrt(d2), 1e-4);
          p.ux += (ddx / d) * f;
          p.uy += (ddy / d) * f;
        }
        p.ux -= p.dx * C.stiffness * dt * 0.12;
        p.uy -= p.dy * C.stiffness * dt * 0.12;
        p.ux *= dampF; p.uy *= dampF;
        p.dx += p.ux * dt; p.dy += p.uy * dt;
        sx = px * s + p.dx; sy = py * s + p.dy;
        const sizeF = 1 - C.sizeVar * p.rSize;
        let alpha = C.opacity * (1 - C.depthFade * (1 - dn));
        if (C.twinkle > 0) alpha *= 1 - C.twinkle * (0.5 + 0.5 * Math.sin(rawT * C.twinkleSpeed * 2.0 + p.ph2 * 5.0));
        data[i * 4] = sx;
        data[i * 4 + 1] = sy;
        data[i * 4 + 2] = Math.max(C.size * sizeF * s * (1 - C.depthShrink * (1 - dn)) * dprScale, 0.1);
        data[i * 4 + 3] = alpha;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND);
      gl.useProgram(progBg);
      gl.uniform2f(U(progBg, 'uRes'), canvas.width, canvas.height);
      gl.uniform3f(U(progBg, 'uBg'), ...hex(C.bg));
      gl.uniform3f(U(progBg, 'uBg2'), ...hex(C.bg2));
      gl.uniform1f(U(progBg, 'uImgOn'), C.imageOn && imgTex ? 1 : 0);
      gl.uniform1f(U(progBg, 'uImgAspect'), imgAspect);
      gl.uniform1f(U(progBg, 'uCanvasA'), canvas.width / Math.max(canvas.height, 1));
      gl.uniform1f(U(progBg, 'uImgRot'), C.imageRotate * Math.PI / 180);
      gl.uniform1f(U(progBg, 'uImgZoom'), C.imageZoom);
      gl.uniform1f(U(progBg, 'uImgX'), C.imageX);
      gl.uniform1f(U(progBg, 'uImgY'), C.imageY);
      gl.uniform1f(U(progBg, 'uImgFlip'), C.imageFlip ? 1 : 0);
      gl.uniform1f(U(progBg, 'uImgAlpha'), C.imageOpacity);
      if (videoEl && videoReady) {         // pump the current video frame
        gl.bindTexture(gl.TEXTURE_2D, imgTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.uniform1i(U(progBg, 'uImg'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(progPart);
      gl.uniform2f(U(progPart, 'uRes'), canvas.width, canvas.height);
      gl.uniform3f(U(progPart, 'uColor'), ...hex(C.color));
      gl.uniform1f(U(progPart, 'uSoft'), C.softness);
      gl.uniform1f(U(progPart, 'uIrreg'), C.irregular);
      gl.uniform1f(U(progPart, 'uGrain'), C.grain);
      gl.uniform1f(U(progPart, 'uStretch'), C.stretch);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, parts.length);
      gl.bindVertexArray(null);
    },
  };
}
