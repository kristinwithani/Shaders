function createEffect(canvas, C) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, desynchronized: true, powerPreference: 'high-performance' });
  const VS_TRI = `#version 300 es
  void main(){vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(v*2.0-1.0,0.,1.);}`;
  const FS_RINGS = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uCircleR, uE1, uE2, uE3, uSoft;
  uniform vec3 uC1, uC2, uC3, uC4;
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
    vec2 p=(gl_FragCoord.xy-0.5*uRes)/(0.5*min(uRes.x,uRes.y));
    float r=length(p)/uCircleR, s=uSoft*0.5;
    vec3 col=uC1;
    col=mix(col,uC2,smoothstep(uE1-s,uE1+s,r));
    col=mix(col,uC3,smoothstep(uE2-s,uE2+s,r));
    col=mix(col,bgSample(gl_FragCoord.xy/uRes,uC4),smoothstep(uE3-s,uE3+s,r));
    o=vec4(col,1.0);
  }`;
  const VS_SPIKE = `#version 300 es
  layout(location=0) in vec2 corner;
  layout(location=1) in vec4 iSeg;
  layout(location=2) in vec2 iMeta;
  uniform vec2 uRes; uniform float uTaper;
  out float vT; out float vAcross; out float vHalfPx;
  void main(){
    vec2 a=iSeg.xy, e=iSeg.zw;
    vec2 dir=normalize(e-a), perp=vec2(-dir.y,dir.x);
    float scale=0.5*min(uRes.x,uRes.y);
    float wPx=mix(iMeta.x*uTaper,iMeta.x,corner.x);
    float halfU=(wPx*0.5+1.0)/scale;
    vec2 p=mix(a,e,corner.x)+perp*halfU*corner.y;
    gl_Position=vec4(p*scale/(0.5*uRes),0.,1.);
    vT=corner.x; vAcross=corner.y*(wPx*0.5+1.0); vHalfPx=wPx*0.5;
  }`;
  const FS_SPIKE = `#version 300 es
  precision highp float;
  in float vT; in float vAcross; in float vHalfPx;
  uniform vec3 uColor; uniform float uFade, uReach;
  out vec4 o;
  void main(){
    float edge=smoothstep(vHalfPx+0.7,max(vHalfPx-0.7,0.0),abs(vAcross));
    float fade=mix(uFade,1.0,smoothstep(0.0,uReach,vT));
    o=vec4(uColor,edge*fade);
  }`;
  const VS_DOT = `#version 300 es
  layout(location=0) in vec2 corner;
  layout(location=1) in vec3 iDot;
  uniform vec2 uRes;
  out vec2 vLocal; out float vRad;
  void main(){
    float scale=0.5*min(uRes.x,uRes.y);
    float rU=(iDot.z+1.0)/scale;
    vec2 p=iDot.xy+corner*rU;
    gl_Position=vec4(p*scale/(0.5*uRes),0.,1.);
    vLocal=corner*(iDot.z+1.0); vRad=iDot.z;
  }`;
  const FS_DOT = `#version 300 es
  precision highp float;
  in vec2 vLocal; in float vRad;
  uniform vec3 uColor;
  out vec4 o;
  void main(){ o=vec4(uColor,smoothstep(vRad+0.7,vRad-0.7,length(vLocal))); }`;

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
  const U = (p, n) => gl.getUniformLocation(p, n);
  const progRings = program(VS_TRI, FS_RINGS);
  const progSpike = program(VS_SPIKE, FS_SPIKE);
  const progDot = program(VS_DOT, FS_DOT);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const GA = 2.39996322973;
  let P = [], segData, metaData, dotData;
  const segBuf = gl.createBuffer(), metaBuf = gl.createBuffer(), dotBuf = gl.createBuffer();
  function makeVao(corners, instances) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const cBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const it of instances) {
      gl.bindBuffer(gl.ARRAY_BUFFER, it.buf);
      gl.enableVertexAttribArray(it.loc);
      gl.vertexAttribPointer(it.loc, it.size, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(it.loc, 1);
    }
    gl.bindVertexArray(null);
    return vao;
  }
  const vaoSpike = makeVao(new Float32Array([0,-1, 1,-1, 0,1, 1,1]),
    [{ buf: segBuf, loc: 1, size: 4 }, { buf: metaBuf, loc: 2, size: 2 }]);
  const vaoDot = makeVao(new Float32Array([-1,-1, 1,-1, -1,1, 1,1]),
    [{ buf: dotBuf, loc: 1, size: 3 }]);

  function rebuild() {
    const N = C.count;
    const hash = n => { const x = Math.sin(n + C.seed * 1013.7) * 43758.5453123; return x - Math.floor(x); };
    const lenLo = Math.min(C.lenMin, C.lenMax), lenHi = Math.max(C.lenMin, C.lenMax);
    const inLo = Math.min(C.innerMin, C.innerMax), inHi = Math.max(C.innerMin, C.innerMax);
    P = [];
    for (let i = 0; i < N; i++) {
      const h1 = hash(i * 12.9898), h2 = hash(i * 78.2330), h3 = hash(i * 39.4260);
      let z = 1 - 2 * (i + 0.5) / N;
      z = Math.min(Math.max(z + (h1 - 0.5) * 0.15, -0.995), 0.995);
      const th = i * GA + h2 * 0.6, s = Math.sqrt(1 - z * z);
      P.push({ base: [s * Math.cos(th), s * Math.sin(th), z],
        len3: lenLo + (lenHi - lenLo) * h3, rin: inLo + (inHi - inLo) * h1,
        phase: i * 1.7, defl: 0, deflV: 0, squish: 0, squishV: 0 });
    }
    segData = new Float32Array(N * 4); metaData = new Float32Array(N * 2); dotData = new Float32Array(N * 3);
    for (const [buf, data] of [[segBuf, segData], [metaBuf, metaData], [dotBuf, dotData]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    }
  }

  let simT = 0;
  function simulate(t, dt, mouse) {
    const clampf = (x, a, b) => Math.min(Math.max(x, a), b);
    const a1 = t * C.tumbleY, a2 = t * C.tumbleX;
    const cy = Math.cos(a1), sy = Math.sin(a1), cx = Math.cos(a2), sx = Math.sin(a2);
    const dprScale = canvas.width / Math.max(canvas.clientWidth, 1);
    const mouseNear = Math.hypot(mouse[0], mouse[1]) < 5;
    const lenLo = Math.min(C.lenMin, C.lenMax), lenHi = Math.max(C.lenMin, C.lenMax);
    const span = Math.max(lenHi - lenLo, 1e-4);
    const k = 2 / (C.cursorRadius * C.cursorRadius);
    const wLo = Math.min(C.tipWidthMin, C.tipWidthMax), wHi = Math.max(C.tipWidthMin, C.tipWidthMax);
    const nLo = Math.min(C.nodeMin, C.nodeMax), nHi = Math.max(C.nodeMin, C.nodeMax);
    for (let i = 0; i < P.length; i++) {
      const pt = P[i];
      const [bx, by, bz] = pt.base;
      const y1 = by * cx - bz * sx, z1 = by * sx + bz * cx;
      const x2 = bx * cy + z1 * sy;
      const proj = Math.max(Math.hypot(x2, y1), 1e-4);
      let rho = pt.len3 * proj;
      const lenN = clampf((rho - lenLo * 0.2) / span, 0, 1);
      let ang = Math.atan2(y1, x2) + Math.sin(t * C.wobbleSpeed + pt.phase) * C.wobbleAmp;
      let tD = 0, tS = 0;
      if (mouseNear) {
        const ex = Math.cos(ang) * rho, ey = Math.sin(ang) * rho;
        const dx = ex - mouse[0], dy = ey - mouse[1];
        const force = Math.exp(-(dx * dx + dy * dy) * k);
        let dAng = ang - Math.atan2(mouse[1], mouse[0]);
        dAng = Math.atan2(Math.sin(dAng), Math.cos(dAng));
        tD = (dAng >= 0 ? 1 : -1) * force * -C.cursorPull;   // pull convention: − steers away
        tS = force * C.squish;
      }
      pt.deflV += (tD - pt.defl) * C.stiffness * dt;  pt.deflV *= Math.exp(-C.damping * dt);
      pt.defl += pt.deflV * dt;
      pt.squishV += (tS - pt.squish) * C.stiffness * dt;  pt.squishV *= Math.exp(-C.damping * dt);
      pt.squish += pt.squishV * dt;
      ang += pt.defl;
      rho *= 1 - clampf(pt.squish, -0.5, 0.95);
      const dxu = Math.cos(ang), dyu = Math.sin(ang);
      const rout = Math.max(rho, pt.rin + 0.02);
      segData[i * 4] = dxu * pt.rin;      segData[i * 4 + 1] = dyu * pt.rin;
      segData[i * 4 + 2] = dxu * rout;    segData[i * 4 + 3] = dyu * rout;
      metaData[i * 2] = (wLo + (wHi - wLo) * lenN) * dprScale;
      metaData[i * 2 + 1] = lenN;
      dotData[i * 3] = dxu * rout;        dotData[i * 3 + 1] = dyu * rout;
      dotData[i * 3 + 2] = (nLo + (nHi - nLo) * lenN) * dprScale;
    }
  }

  function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(progRings);
    gl.uniform2f(U(progRings, 'uRes'), canvas.width, canvas.height);
    gl.uniform1f(U(progRings, 'uCircleR'), C.circleRadius);
    gl.uniform1f(U(progRings, 'uE1'), C.ringEnd1);
    gl.uniform1f(U(progRings, 'uE2'), C.ringEnd2);
    gl.uniform1f(U(progRings, 'uE3'), C.ringEnd3);
    gl.uniform1f(U(progRings, 'uSoft'), C.blendSoft);
    gl.uniform3f(U(progRings, 'uC1'), ...hex(C.ring1));
    gl.uniform3f(U(progRings, 'uC2'), ...hex(C.ring2));
    gl.uniform3f(U(progRings, 'uC3'), ...hex(C.ring3));
    gl.uniform3f(U(progRings, 'uC4'), ...hex(C.ring4));
    gl.uniform1f(U(progRings, 'uImgOn'), C.imageOn && imgTex ? 1 : 0);
    gl.uniform1f(U(progRings, 'uImgAspect'), imgAspect);
    gl.uniform1f(U(progRings, 'uCanvasA'), canvas.width / Math.max(canvas.height, 1));
    gl.uniform1f(U(progRings, 'uImgRot'), C.imageRotate * Math.PI / 180);
    gl.uniform1f(U(progRings, 'uImgZoom'), C.imageZoom);
    gl.uniform1f(U(progRings, 'uImgX'), C.imageX);
    gl.uniform1f(U(progRings, 'uImgY'), C.imageY);
    gl.uniform1f(U(progRings, 'uImgFlip'), C.imageFlip ? 1 : 0);
    gl.uniform1f(U(progRings, 'uImgAlpha'), C.imageOpacity);
    if (videoEl && videoReady) {           // pump the current video frame
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.uniform1i(U(progRings, 'uImg'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(progSpike);
    gl.uniform2f(U(progSpike, 'uRes'), canvas.width, canvas.height);
    gl.uniform1f(U(progSpike, 'uTaper'), C.taper);
    gl.uniform3f(U(progSpike, 'uColor'), ...hex(C.spikeColor));
    gl.uniform1f(U(progSpike, 'uFade'), C.centerFade);
    gl.uniform1f(U(progSpike, 'uReach'), C.fadeReach);
    gl.bindVertexArray(vaoSpike);
    gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);  gl.bufferSubData(gl.ARRAY_BUFFER, 0, segData);
    gl.bindBuffer(gl.ARRAY_BUFFER, metaBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, metaData);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, P.length);
    if (C.showNodes) {
      gl.useProgram(progDot);
      gl.uniform2f(U(progDot, 'uRes'), canvas.width, canvas.height);
      gl.uniform3f(U(progDot, 'uColor'), ...hex(C.nodeColor));
      gl.bindVertexArray(vaoDot);
      gl.bindBuffer(gl.ARRAY_BUFFER, dotBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dotData);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, P.length);
    }
    gl.bindVertexArray(null);
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
  const bgAsset = document.getElementById('asset-orbbg');
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
  return {
    rebuild,
    dispose() {                            // stop the video decode when the effect is torn down
      canvas._bgVideo = null;              // release the cropper's shared reference
      if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); videoEl = null; }
      if (videoObjURL) { URL.revokeObjectURL(videoObjURL); videoObjURL = null; }
    },
    frame(dt, mouse) {
      const s = C.timeScale;
      simT += dt * s;
      simulate(simT, dt * Math.max(s, 0.05), mouse);
      draw();
    },
  };
}
