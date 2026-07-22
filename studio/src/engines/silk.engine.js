function createEffect(canvas, C) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, desynchronized: true, powerPreference: 'high-performance' });
  const VS = `#version 300 es
  void main(){vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(v*2.0-1.0,0.,1.);}`;
  const FS = `#version 300 es
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime, uSoftK, uWarp, uWScale, uGrain, uSeed;
  uniform vec4 uAnchors[6];     // x, y, radius, -
  uniform vec3 uACols[6];
  uniform int uNA;
  uniform vec3 uBase;
  uniform int uStreakN;
  uniform float uStreakAngle, uStreakW, uStreakLen, uStreakI, uShimmer;
  uniform vec3 uStreakCol;
  uniform float uLevel, uBSoft, uLineA;
  uniform vec3 uLineCol;
  out vec4 o;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x),
               mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y));
    // cloud-soft domain warp: boundaries between colour masses wander like
    // out-of-focus weather rather than sitting on clean curves
    vec2 w = vec2(fbm(p * uWScale + uTime * 0.012),
                  fbm(p * uWScale + 7.31 - uTime * 0.009));
    vec2 q = p + (w - 0.5) * uWarp;
    // normalized soft-anchor blend: defined at every pixel, so the gradient
    // always covers the frame with photographic softness
    vec3 acc = uBase * 0.03;
    float wsum = 0.03;
    for (int i = 0; i < 6; i++) {
      if (i >= uNA) break;
      vec2 d = q - uAnchors[i].xy;
      float r = max(uAnchors[i].z, 1e-3);
      float wgt = exp(-dot(d, d) / (r * r) * uSoftK);
      acc += uACols[i] * wgt;
      wsum += wgt;
    }
    vec3 col = acc / wsum;
    // boundary: the gradient pools below an adjustable waterline — above it
    // only the base colour remains (fill 1 floods the whole frame)
    float mask = smoothstep(uLevel + uBSoft, uLevel - uBSoft, p.y);
    col = mix(uBase, col, mask);
    // light streaks: long anisotropic shafts along one axis, screen-blended
    // so they glow into the gradient without ever clipping to white
    vec3 glow = vec3(0.0);
    vec2 sdir = vec2(cos(uStreakAngle), sin(uStreakAngle));
    vec2 sperp = vec2(-sdir.y, sdir.x);
    for (int i = 0; i < 6; i++) {
      if (i >= uStreakN) break;
      float h1 = fract(sin(float(i) * 12.9898 + uSeed * 0.731) * 43758.5453123);
      float h2 = fract(h1 * 91.17);
      float off = (h1 - 0.5) * 1.7;
      float wob = sin(uTime * uShimmer + h2 * 6.28318) * 0.05;
      float across = dot(q, sperp) - off - wob;
      float along = dot(p, sdir) - (h2 - 0.5) * 0.6;
      float wd = uStreakW * (0.6 + h2 * 0.9);
      float body = exp(-across * across / (wd * wd));
      float ends = exp(-along * along * uStreakLen);
      float tw = 0.85 + 0.15 * sin(uTime * (uShimmer * 0.7 + 0.2) + h1 * 9.42);
      glow += uStreakCol * body * ends * tw * uStreakI * (0.55 + 0.45 * h2);
    }
    col = 1.0 - (1.0 - col) * (1.0 - min(glow, vec3(0.95)) * mask);
    // optional hairline right at the waterline
    float ln = 1.0 - smoothstep(0.004, 0.016, abs(p.y - uLevel));
    col = mix(col, uLineCol, ln * uLineA);
    // film grain doubling as dither: kills banding on the long soft ramps
    float g = h21(gl_FragCoord.xy * 0.7 + fract(uTime) * 13.1);
    col += (g - 0.5) * (0.012 + uGrain * 0.05);
    o = vec4(clamp(col, 0.0, 1.0), 1.0);
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

  // art-directed anchor layout echoing the reference photograph:
  // cool masses up top, a warm core, soft light below, one hot corner
  const BASE = [
    [-0.45, 0.95, 1.05],
    [0.60, 0.95, 0.95],
    [0.05, -0.10, 0.75],
    [0.90, 0.05, 0.70],
    [-0.15, -0.85, 0.85],
    [-0.95, -1.05, 0.55],
  ];
  const anchorData = new Float32Array(6 * 4);
  const colData = new Float32Array(6 * 3);


  let simT = 0, cx = 0, cy = 0;
  return {
    rebuild() {},
    frame(dt, mouse) {
      if (!C.silkStatic) simT += dt;
      // smoothed cursor sway: anchors lean toward the pointer, deeper ones less
      const near = Math.hypot(mouse[0], mouse[1]) < 5;
      const ke = 1 - Math.exp(-dt * 3);
      cx += ((near ? mouse[0] : 0) - cx) * ke;
      cy += ((near ? mouse[1] : 0) - cy) * ke;
      const hash = n => { const x = Math.sin(n * 127.1 + C.seed * 311.7) * 43758.5453123; return x - Math.floor(x); };
      const n = Math.min(Math.max(Math.round(C.anchorCount), 3), 6);
      const t = simT * C.driftSpeed;
      for (let i = 0; i < n; i++) {
        const [bx, by, br] = BASE[i];
        const j1 = hash(i * 7.3 + 1) - 0.5, j2 = hash(i * 7.3 + 2) - 0.5;
        const ph = hash(i * 7.3 + 3) * 6.28318;
        const dx = Math.sin(t * 0.21 + ph) * 0.09 + Math.sin(t * 0.07 + ph * 2.7) * 0.05;
        const dy = Math.cos(t * 0.17 + ph * 1.3) * 0.09;
        const sway = 0.06 * (1 - i * 0.12);
        anchorData[i * 4] = bx + j1 * 0.3 + dx + cx * sway;
        anchorData[i * 4 + 1] = by + j2 * 0.3 + dy + cy * sway;
        anchorData[i * 4 + 2] = br * C.spread * (0.85 + hash(i * 7.3 + 4) * 0.3);
        anchorData[i * 4 + 3] = 0;
        const rgb = hex(C['color' + (i + 1)]);
        colData[i * 3] = rgb[0]; colData[i * 3 + 1] = rgb[1]; colData[i * 3 + 2] = rgb[2];
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.uniform2f(U('uRes'), canvas.width, canvas.height);
      gl.uniform1f(U('uTime'), simT);
      gl.uniform4fv(U('uAnchors'), anchorData);
      gl.uniform3fv(U('uACols'), colData);
      gl.uniform1i(U('uNA'), n);
      gl.uniform3f(U('uBase'), ...hex(C.baseColor));
      gl.uniform1f(U('uSoftK'), 2.2 / Math.max(C.softness, 0.05));
      gl.uniform1f(U('uWarp'), C.warp);
      gl.uniform1f(U('uWScale'), C.warpScale);
      gl.uniform1f(U('uGrain'), C.grain);
      gl.uniform1f(U('uSeed'), C.seed);
      gl.uniform1i(U('uStreakN'), Math.round(C.streakCount));
      gl.uniform1f(U('uStreakAngle'), C.streakAngle * Math.PI / 180);
      gl.uniform1f(U('uStreakW'), C.streakWidth);
      gl.uniform1f(U('uStreakLen'), 1 / (C.streakLen * C.streakLen));
      gl.uniform1f(U('uStreakI'), C.streakIntensity);
      gl.uniform1f(U('uShimmer'), C.shimmer);
      gl.uniform3f(U('uStreakCol'), ...hex(C.streakTint));
      // waterline: fill 1 lifts the line plus its soft edge above the frame
      gl.uniform1f(U('uLevel'), -1 + C.fillLevel * (2 + C.boundarySoft * 2 + 0.1));
      gl.uniform1f(U('uBSoft'), Math.max(C.boundarySoft, 0.003));
      gl.uniform1f(U('uLineA'), C.surfaceLine);
      gl.uniform3f(U('uLineCol'), ...hex(C.surfaceColor));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
