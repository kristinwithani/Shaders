function createEffect(canvas, C) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, desynchronized: true, powerPreference: 'high-performance' });
  const VS = `#version 300 es
  void main(){vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(v*2.0-1.0,0.,1.);}`;
  const FS = `#version 300 es
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime, uSoftK, uOpacity, uAngle, uEdgeBlur, uFlood, uSplit, uSat, uShapeAmt;
  uniform float uLevel, uBSoft, uLineA;
  uniform vec3 uLineCol;
  uniform vec4 uBlobs[12];      // x, y, radius, shape phase
  uniform vec4 uSquish[12];     // contact dir x, y, amount, light angle
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
    vec3 acc = vec3(0.0);
    vec3 wsum = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      if (i >= uNB) break;
      vec2 d = p - uBlobs[i].xy;
      float r = max(uBlobs[i].z, 1e-3);
      // shape: seeded angular harmonics pull each blob away from a perfect
      // disc; slow time terms make the silhouettes breathe
      if (uShapeAmt > 0.0) {
        float ang = atan(d.y, d.x);
        float ph = uBlobs[i].w;
        float w = sin(ang * 2.0 + ph + uTime * 0.10) * 0.5
                + sin(ang * 3.0 - ph * 1.7 - uTime * 0.07) * 0.3
                + sin(ang * 5.0 + ph * 2.3) * 0.2;
        r *= 1.0 + uShapeAmt * w * 0.55;
      }
      // collision squish: the side pressed against a neighbour flattens,
      // the far side bulges slightly — soft bodies, not overlapping ghosts
      vec4 sq = uSquish[i];
      if (sq.z > 0.001) {
        float along = dot(d / max(length(d), 1e-4), sq.xy);
        r *= 1.0 - sq.z * 0.5 * max(along, 0.0) + sq.z * 0.22 * max(-along, 0.0);
      }
      // rgb edge split: each channel sees a different blob radius, so the
      // falloffs part into chromatic fringes where blob edges bleed together
      float rr = r * (1.0 + uSplit * 1.2), rb = r * max(1.0 - uSplit * 1.2, 0.05);
      vec3 a3 = vec3(exp(-dot(d, d) / (rr * rr) * softK),
                     exp(-dot(d, d) / (r * r) * softK),
                     exp(-dot(d, d) / (rb * rb) * softK));
      col = mix(col, uBlobCols[i], a3 * uOpacity * mask);
      // light: each blob carries its own light direction (swinging toward its
      // travel); dispersion gathers on the lit limb like a moving body
      // catching light on its leading edge
      vec2 Li = vec2(cos(sq.w), sin(sq.w));
      vec2 dir = d / max(length(d), 1e-4);
      float lit = 0.30 + 0.70 * smoothstep(-0.35, 0.9, dot(dir, Li));
      float aG = a3.g;
      float band = aG * (1.0 - aG) * 4.0;      // peaks mid-falloff, dark at core and far field
      vec3 spec = 0.5 + 0.5 * cos(6.28318 * ((1.0 - aG) * 0.75 + vec3(0.0, -0.33, -0.67)));
      col += spec * band * band * lit * (uSplit * 1.5) * uOpacity * mask;
      // specular flare near the lit edge, with a slim perpendicular glint —
      // a lens-like flick that breathes slowly per blob
      vec2 hp = uBlobs[i].xy + Li * r * 0.45;
      vec2 hd = p - hp;
      float fl = exp(-dot(hd, hd) / (r * r * 0.045));
      float tw = 0.8 + 0.2 * sin(uTime * 1.1 + uBlobs[i].w * 3.7);
      vec2 gx = vec2(Li.y, -Li.x);
      float ga = dot(hd, gx), gb = dot(hd, Li);
      float glint = exp(-(ga * ga / (r * r * 0.16) + gb * gb / (r * r * 0.004)));
      col += (vec3(1.0, 0.98, 0.94) * fl * 0.55 + spec * glint * 0.35) * tw * uSplit * uOpacity * mask;
      acc += uBlobCols[i] * (a3 + 1e-4);
      wsum += a3 + 1e-4;
    }
    // at the fill endpoint the pool floods: the normalized blob blend is
    // defined at every pixel (gaussian tails never reach zero), so blobs
    // cover the whole frame with no background peeking through the gaps
    if (uFlood > 0.0 && uNB > 0) {
      col = mix(col, acc / wsum, uFlood * uOpacity * mask);
    }
    // saturation: 0 greyscale, 1 as-authored, 2 vivid
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(lum), col, uSat), 0.0, 1.0);
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
        x: (h(1) - 0.5) * 1.5,
        y: (h(2) - 0.5) * 1.8,             // free float: anywhere in the frame
        dx: Math.cos(a), dy: Math.sin(a),
        rf: (h(4) - 0.5) * 2,
        phase: h(5) * 6.28318,
        ox: 0, oy: 0, vx: 0, vy: 0,                     // cursor stir displacement + velocity
      });
    }
    for (const b of blobs) {
      b.lastPx = b.x; b.lastPy = b.y;
      b.lx = -0.5547; b.ly = 0.8321;                    // per-blob light, starts at the global source
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
  const squishData = new Float32Array(12 * 4);   // contact dir x, y, amount, light angle


  let simT = 0;
  return {
    rebuild() { rebuildBlobs(); },
    dispose() {                            // stop the video decode when the effect is torn down
      canvas._bgVideo = null;              // release the cropper's shared reference
      if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); videoEl = null; }
      if (videoObjURL) { URL.revokeObjectURL(videoObjURL); videoObjURL = null; }
    },
    frame(dt, mouse) {
      if (!C.blobStatic) simT += dt;   // static freezes drift and hue motion
      const bound = 0.95;
      // waterline in unit space; fill 1 lifts the line plus its soft edge —
      // including the widest frame-edge-blur widening (0.35) — fully above
      // the frame, so the pool floods to the very top in every configuration
      const level = -1 + C.fillLevel * (2 + C.boundarySoft * 2 + 0.4);
      const nPal = Math.min(Math.max(Math.round(C.paletteCount), 1), 10);
      const mouseNear = Math.hypot(mouse[0], mouse[1]) < 5;
      const R2 = C.cursorRadius * C.cursorRadius;
      const damp = Math.exp(-C.damping * dt);
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        if (!C.blobStatic) {
          // idle wander: headings curve gently on two slow sine clocks, so
          // blobs meander around the frame instead of ping-ponging straight
          const turn = (Math.sin(simT * 0.35 + b.phase * 2.3)
                      + Math.sin(simT * 0.13 + b.phase * 5.1)) * 0.35 * dt;
          const ct = Math.cos(turn), st = Math.sin(turn);
          const ndx = b.dx * ct - b.dy * st, ndy = b.dx * st + b.dy * ct;
          b.dx = ndx; b.dy = ndy;
          const sf = 1 + b.rf * 0.35;            // per-blob pace variation
          b.x += b.dx * C.speed * sf * dt;
          b.y += b.dy * C.speed * sf * dt;
          if (b.x > bound) { b.x = bound; b.dx = -Math.abs(b.dx); }
          if (b.x < -bound) { b.x = -bound; b.dx = Math.abs(b.dx); }
          if (b.y > bound) { b.y = bound; b.dy = -Math.abs(b.dy); }
          if (b.y < -bound) { b.y = -bound; b.dy = Math.abs(b.dy); }
        }
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
        b.px = b.x + b.ox;
        b.py = b.y + b.oy;
        b.rad = C.size * (1 + b.rf * C.sizeVariation);
        // subtle continuous hue drift around each blob's palette colour
        const base = hex(C['blobColor' + (i % nPal + 1)]);
        const hsv = rgb2hsv(base[0], base[1], base[2]);
        hsv[0] = (hsv[0] + C.colorDrift * Math.sin(simT * C.driftSpeed + b.phase) + 1) % 1;
        const rgb = hsv2rgb(hsv[0], hsv[1], hsv[2]);
        colData[i * 3] = rgb[0]; colData[i * 3 + 1] = rgb[1]; colData[i * 3 + 2] = rgb[2];
      }

      // ---- soft contact: blobs press and squish instead of overlapping ----
      for (let i = 0; i < blobs.length; i++) { const b = blobs[i]; b.sqx = 0; b.sqy = 0; b.sqa = 0; }
      if (C.blobSquish > 0) {
        const relax = Math.min(dt * 6, 1);   // overlap resolves over ~1/6s: squishy, not snappy
        for (let i = 0; i < blobs.length; i++) for (let j = i + 1; j < blobs.length; j++) {
          const A = blobs[i], B = blobs[j];
          const dxp = B.px - A.px, dyp = B.py - A.py;
          const minD = (A.rad + B.rad) * 0.62;   // gaussians read as solid around 0.6r
          const dist = Math.max(Math.hypot(dxp, dyp), 1e-4);
          if (dist >= minD) continue;
          const ux = dxp / dist, uy = dyp / dist;
          const depth = 1 - dist / minD;
          if (!C.blobStatic) {
            // resolve most of the overlap gradually; what remains reads as squish
            const corr = (minD - dist) * 0.35 * relax;
            A.x -= ux * corr; B.x += ux * corr;
            A.y = Math.min(Math.max(A.y - uy * corr, -bound), bound);
            B.y = Math.min(Math.max(B.y + uy * corr, -bound), bound);
            A.px -= ux * corr; A.py -= uy * corr;
            B.px += ux * corr; B.py += uy * corr;
            // steer travel apart so head-on pairs slide off each other
            A.dx -= ux * depth * dt * 2; A.dy -= uy * depth * dt * 2;
            B.dx += ux * depth * dt * 2; B.dy += uy * depth * dt * 2;
          }
          A.sqx += ux * depth; A.sqy += uy * depth;
          B.sqx -= ux * depth; B.sqy -= uy * depth;
          A.sqa = Math.min(A.sqa + depth, 1); B.sqa = Math.min(B.sqa + depth, 1);
        }
        if (!C.blobStatic) for (const b of blobs) {
          const m = Math.hypot(b.dx, b.dy) || 1;   // steering must not change speed
          b.dx /= m; b.dy /= m;
        }
      }
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        posData[i * 4] = b.px;
        posData[i * 4 + 1] = b.py;
        posData[i * 4 + 2] = b.rad;
        posData[i * 4 + 3] = b.phase;      // per-blob shape seed
        const m = Math.hypot(b.sqx, b.sqy);
        squishData[i * 4] = m > 1e-4 ? b.sqx / m : 0;
        squishData[i * 4 + 1] = m > 1e-4 ? b.sqy / m : 0;
        squishData[i * 4 + 2] = Math.min(b.sqa * C.blobSquish, 1);
        // the light swings toward each blob's direction of travel and eases
        // back to the global source when the blob rests
        const mvx = (b.px - b.lastPx) / Math.max(dt, 1e-3);
        const mvy = (b.py - b.lastPy) / Math.max(dt, 1e-3);
        b.lastPx = b.px; b.lastPy = b.py;
        const sp = Math.hypot(mvx, mvy);
        let tx = -0.5547, ty = 0.8321;
        if (sp > 0.005) {
          const k = Math.min(sp / 0.2, 1) * 0.85;
          tx = tx * (1 - k) + (mvx / sp) * k;
          ty = ty * (1 - k) + (mvy / sp) * k;
        }
        const ease = 1 - Math.exp(-dt * 3);
        b.lx += (tx - b.lx) * ease;
        b.ly += (ty - b.ly) * ease;
        squishData[i * 4 + 3] = Math.atan2(b.ly, b.lx);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.uniform2f(U('uRes'), canvas.width, canvas.height);
      gl.uniform1f(U('uTime'), simT);
      gl.uniform4fv(U('uBlobs'), posData);
      gl.uniform4fv(U('uSquish'), squishData);
      gl.uniform3fv(U('uBlobCols'), colData);
      gl.uniform1i(U('uNB'), C.blobsOn ? blobs.length : 0);   // blobs off -> pure gradient
      gl.uniform1f(U('uSoftK'), 3.0 / Math.max(C.edgeSoftness, 0.05));
      gl.uniform1f(U('uOpacity'), C.opacity);
      gl.uniform1f(U('uAngle'), C.gradientAngle * Math.PI / 180);
      gl.uniform1f(U('uEdgeBlur'), C.edgeBlur);
      gl.uniform1f(U('uSplit'), C.rgbSplit);
      gl.uniform1f(U('uSat'), C.saturation);
      gl.uniform1f(U('uShapeAmt'), C.blobShape);
      // flood ramps in over the last 10% of the fill slider: at the endpoint
      // the blob blend covers every pixel of the frame
      gl.uniform1f(U('uFlood'), Math.min(Math.max((C.fillLevel - 0.9) * 10, 0), 1));
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
    },
  };
}
