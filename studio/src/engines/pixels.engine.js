function createEffect(canvas, C) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, desynchronized: true, powerPreference: 'high-performance' });
  const VS = `#version 300 es
  void main(){vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(v*2.0-1.0,0.,1.);}`;
  const FS = `#version 300 es
  precision highp float;
  uniform vec2 uRes, uCursor;             // cursor in unit coords
  uniform float uOn, uImgOn, uImgAspect, uFocus;
  uniform float uImgRot, uImgZoom, uImgX, uImgY, uImgFlip;
  uniform float uUnits, uMix, uMaxPx, uMinPx, uSpotR, uCoreFrac, uBlurMax, uSoft;
  uniform float uSeed, uBlinkDen, uBlinkBand, uSpotPx, uJitter;
  uniform sampler2D uImg;
  uniform vec3 uBg;
  out vec4 o;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453123);
  }
  float hashS(vec2 p) {                   // stable (not re-seeded by the blink clock)
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123);
  }
  vec2 coverUV(vec2 uv) {                 // uv top-down; cover-crop to square
    vec2 tq = uv - 0.5;
    if (uImgFlip > 0.5) tq.x = -tq.x;
    float cr = cos(uImgRot), sr = sin(uImgRot);
    tq = mat2(cr, -sr, sr, cr) * tq;
    tq /= max(uImgZoom, 0.05);
    uv = tq + 0.5 + vec2(-uImgX, uImgY);  // pan: +X right, +Y up on screen, like every other engine
    if (uImgAspect < 1.0) {
      float a = uImgAspect;
      uv.y = mix(0.0, 1.0 - a, uFocus) + uv.y * a;
    } else {
      float a = 1.0 / uImgAspect;
      uv.x = (1.0 - a) * 0.5 + uv.x * a;
    }
    return clamp(uv, 0.0, 1.0);
  }
  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec3 col = uBg;
    if (uImgOn > 0.5) {
      // quadtree mosaic: pixel sizes halve from uMaxPx down to uMinPx
      // (each step 4x the area). uMix is the chance a block subdivides.
      vec2 posU = uv * uUnits;
      float size = uMaxPx;
      for (int i = 0; i < 4; i++) {
        float nextSize = size * 0.5;
        if (nextSize < uMinPx) break;
        if (hashS(floor(posU / size) + float(i) * 11.7) >= uMix) break;
        size = nextSize;
      }
      vec2 blockId = floor(posU / size);
      vec2 q = (blockId + 0.5) * size / uUnits;
      col = textureLod(uImg, coverUV(vec2(q.x, 1.0 - q.y)), 0.0).rgb;

      if (uOn > 0.5) {
        // ragged boundary, evaluated per variable-size block. ALL interior
        // gradients also follow this block-quantized jittered parameter, so
        // no smooth circular contour survives anywhere in the spotlight.
        vec2 bp = q * 2.0 - 1.0;
        float db = distance(bp, uCursor);
        float tb = db / uSpotR + (hashS(blockId + size * 7.7) - 0.5) * uJitter;
        if (tb < 1.0) {
          // blur deepens toward the rim; LOD 0 = untouched image
          float lod = uBlurMax * smoothstep(uCoreFrac, 1.0, tb);
          // uniform pixel size (in units) throughout the spotlight interior
          vec2 sq = (floor(posU / uSpotPx) + 0.5) * uSpotPx / uUnits;
          vec3 pixeled = textureLod(uImg, coverUV(vec2(sq.x, 1.0 - sq.y)), lod).rgb;
          vec3 clear = textureLod(uImg, coverUV(vec2(uv.x, 1.0 - uv.y)), 0.0).rgb;
          vec3 spot = mix(clear, pixeled, smoothstep(uCoreFrac * 0.5, uCoreFrac, tb));
          float rim = smoothstep(1.0, 1.0 - uSoft, tb);
          col = mix(col, spot, rim);
        } else {
          // blinking blocks around the spotlight: each winks at a
          // random 20-50% fade, uniform in the band (no halo ring shape)
          float bandT = (tb - 1.0) * uSpotR / max(uBlinkBand, 1e-3);
          if (bandT < 1.0) {
            float gate = step(hash(blockId + size), uBlinkDen);
            col = mix(col, uBg, gate * mix(0.2, 0.5, hash(blockId + size + 57.31)));
          }
        }
      }
    }
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

  // source: a still image OR a looping video (embedded default or user upload).
  // both feed one mipmapped texture, so the spotlight's LOD blur keeps working.
  let imgTex = null, imgAspect = 1, videoEl = null, videoReady = false, videoObjURL = null;
  const texParams = () => {                 // shared once the level-0 image exists
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const bgAsset = document.getElementById('asset-pixelbg');
  const src = bgAsset ? bgAsset.textContent.trim() : '';
  if (src && /^data:video\/|\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(src)) {
    videoEl = document.createElement('video');
    Object.assign(videoEl, { muted: true, loop: true, autoplay: true, playsInline: true, crossOrigin: 'anonymous' });
    canvas._bgVideo = videoEl;             // shared with the cropper: it previews this exact decoder
    videoEl.addEventListener('loadeddata', () => {
      imgAspect = (videoEl.videoWidth / videoEl.videoHeight) || 1;
      imgTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
      gl.generateMipmap(gl.TEXTURE_2D);
      texParams();
      videoReady = true;
    });
    const play = () => videoEl && videoEl.play().catch(() => {});  // muted autoplay is allowed
    if (src.startsWith('data:')) {
      // <video> won't reliably load a large data: URL — feed it a blob URL instead
      fetch(src).then(r => r.blob()).then(b => {
        if (!videoEl) return;
        videoObjURL = URL.createObjectURL(b);
        videoEl.src = videoObjURL;
        play();
      }).catch(() => {});
    } else {
      videoEl.src = src;                   // http(s) URL passthrough
      play();
    }
  } else if (src) {
    const img = new Image();
    img.onload = () => {
      imgAspect = img.width / img.height;
      imgTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      texParams();
    };
    img.src = src;
  }

  let simT = 0, eased = [0, 0], blinkPhase = 0;
  return {
    rebuild() {},
    dispose() {                            // stop the video decode when the effect is torn down
      canvas._bgVideo = null;              // release the cropper's shared reference
      if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); videoEl = null; }
      if (videoObjURL) { URL.revokeObjectURL(videoObjURL); videoObjURL = null; }
    },
    frame(dt, mouse) {
      simT += dt;
      blinkPhase += dt * C.blinkSpeed;
      const seed = (Math.floor(blinkPhase) * 0.6180339887) % 1;
      // spotlight target: live cursor, else idle wander
      let target = null;
      if (Math.hypot(mouse[0], mouse[1]) < 5) target = mouse;
      else if (C.wander) {
        const wt = simT * C.wanderSpeed;
        target = [0.55 * Math.sin(wt * 0.9), 0.45 * Math.sin(wt * 1.37 + 1.7)];
      }
      if (target) {
        const k = 1 - Math.exp(-dt * C.followEase);
        eased[0] += (target[0] - eased[0]) * k;
        eased[1] += (target[1] - eased[1]) * k;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.uniform2f(U('uRes'), canvas.width, canvas.height);
      gl.uniform2f(U('uCursor'), eased[0], eased[1]);
      gl.uniform1f(U('uOn'), target ? 1 : 0);
      gl.uniform1f(U('uImgOn'), C.imageOn && imgTex ? 1 : 0);
      gl.uniform1f(U('uImgAspect'), imgAspect);
      gl.uniform1f(U('uFocus'), C.imageFocus);
      gl.uniform1f(U('uImgRot'), C.imageRotate * Math.PI / 180);
      gl.uniform1f(U('uImgZoom'), C.imageZoom);
      gl.uniform1f(U('uImgX'), C.imageX);
      gl.uniform1f(U('uImgY'), C.imageY);
      gl.uniform1f(U('uImgFlip'), C.imageFlip ? 1 : 0);
      gl.uniform1f(U('uUnits'), Math.max(Math.round(C.pixelScale), 16));
      gl.uniform1f(U('uMix'), C.sizeMix);
      const maxPx = Math.max(Math.round(C.maxPixel), 1);
      gl.uniform1f(U('uMaxPx'), maxPx);
      gl.uniform1f(U('uMinPx'), Math.min(Math.max(Math.round(C.minPixel), 1), maxPx));
      gl.uniform1f(U('uSpotR'), C.spotRadius);
      gl.uniform1f(U('uCoreFrac'), C.coreSize);
      gl.uniform1f(U('uBlurMax'), C.edgeBlur);
      gl.uniform1f(U('uSoft'), C.edgeSoftness);
      gl.uniform1f(U('uSeed'), seed);
      gl.uniform1f(U('uBlinkDen'), C.blinkDensity);
      gl.uniform1f(U('uBlinkBand'), C.blinkBand);
      gl.uniform1f(U('uSpotPx'), Math.max(Math.round(C.spotPixel), 1));
      gl.uniform1f(U('uJitter'), C.rimJitter);
      // pump the current video frame into the texture, rebuilding mipmaps so the
      // edge-blur LOD stays valid on live footage
      if (videoEl && videoReady) {
        gl.bindTexture(gl.TEXTURE_2D, imgTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
        gl.generateMipmap(gl.TEXTURE_2D);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.uniform1i(U('uImg'), 0);
      gl.uniform3f(U('uBg'), ...hex(C.bg));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
