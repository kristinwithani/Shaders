// Orb shader — Figma shader fill (WGSL / WebGPU)
//
// 4-level radial gradient sphere with 250 blue spikes that float when idle
// and steer away from the cursor.
//
// Figma's shader runtime injects uniforms for resolution, time, and cursor.
// The names below follow the common convention (resolution / time / mouse);
// when pasting into Figma's shader agent, ask it to wire its runtime
// uniforms to these three values — the body needs no other changes.

struct Uniforms {
  resolution : vec2f,  // node size in px
  time       : f32,    // seconds
  mouse      : vec2f,  // cursor in px over the node; (-1,-1) when absent
};
@group(0) @binding(0) var<uniform> u : Uniforms;

const C1   = vec3f(0.976, 0.722, 0.373); // #f9b85f  ring 1: 0–25%
const C2   = vec3f(0.851, 0.800, 0.690); // #d9ccb0  ring 2: 25–35%
const C3   = vec3f(0.714, 0.851, 1.000); // #B6D9FF  ring 3: 35–55%
const C4   = vec3f(1.0, 1.0, 1.0);       // white    ring 4: rest
const BLUE = vec3f(0.165, 0.0, 1.0);     // #2A00FF  spikes

const CIRCLE_R : f32 = 0.90;
const N : i32 = 250;
const GA : f32 = 2.39996322973; // golden angle

fn hash(n : f32) -> f32 { return fract(sin(n) * 43758.5453123); }

fn sdSegment(p : vec2f, a : vec2f, b : vec2f, t : ptr<function, f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  *t = h;
  return length(pa - ba * h);
}

@fragment
fn main(@builtin(position) pos : vec4f) -> @location(0) vec4f {
  let scale = 0.5 * min(u.resolution.x, u.resolution.y);
  // unit space, y up, origin at node center
  var p = (pos.xy - 0.5 * u.resolution) / scale;
  p.y = -p.y;
  let px = 1.0 / scale;

  // ---------- 4-level radial gradient ----------
  let r = length(p) / CIRCLE_R;
  var col = C1;
  col = mix(col, C2, smoothstep(0.20, 0.29, r));
  col = mix(col, C3, smoothstep(0.34, 0.44, r));
  col = mix(col, C4, smoothstep(0.50, 0.66, r));

  // ---------- slow idle tumble ----------
  let a1 = u.time * 0.10;
  let a2 = u.time * 0.07;
  let rotY = mat3x3f(
    vec3f(cos(a1), 0.0, -sin(a1)),
    vec3f(0.0, 1.0, 0.0),
    vec3f(sin(a1), 0.0, cos(a1)));
  let rotX = mat3x3f(
    vec3f(1.0, 0.0, 0.0),
    vec3f(0.0, cos(a2), sin(a2)),
    vec3f(0.0, -sin(a2), cos(a2)));
  let rot = rotY * rotX;

  // cursor in unit space; treat off-node as "away"
  var mouseU = vec2f(99.0, 99.0);
  if (u.mouse.x >= 0.0 && u.mouse.y >= 0.0) {
    mouseU = (u.mouse - 0.5 * u.resolution) / scale;
    mouseU.y = -mouseU.y;
  }
  let mouseNear = length(mouseU) < 5.0;

  // ---------- 250 spikes ----------
  var acc : f32 = 0.0;
  for (var i : i32 = 0; i < N; i++) {
    let fi = f32(i);
    let h1 = hash(fi * 12.9898);
    let h2 = hash(fi * 78.2330);
    let h3 = hash(fi * 39.4260);

    var z = 1.0 - 2.0 * (fi + 0.5) / f32(N);
    z = clamp(z + (h1 - 0.5) * 0.15, -0.995, 0.995);
    let th = fi * GA + h2 * 0.6;
    let s = sqrt(1.0 - z * z);
    let v = rot * vec3f(s * cos(th), s * sin(th), z);

    let proj = max(length(v.xy), 1e-4);
    let dir = v.xy / proj;
    let len3 = mix(0.16, 0.42, h3);
    var rho = len3 * proj;
    let lenN = clamp((rho - 0.03) / 0.39, 0.0, 1.0);

    var ang = atan2(dir.y, dir.x);
    ang += sin(u.time * 0.5 + fi * 1.7) * 0.025;   // idle wobble

    if (mouseNear) {
      let e0 = dir * rho;
      let dm = e0 - mouseU;
      let md = length(dm);
      let force = exp(-md * md * 22.0);
      let mAng = atan2(mouseU.y, mouseU.x);
      var dAng = ang - mAng;
      dAng = atan2(sin(dAng), cos(dAng));
      let side = select(-1.0, 1.0, dAng >= 0.0);
      ang += side * force * 0.85;
      rho *= 1.0 - force * 0.35;
    }

    let d2 = vec2f(cos(ang), sin(ang));
    let rin = 0.015 + 0.05 * h1;
    let A = d2 * rin;
    let E = d2 * max(rho, rin + 0.02);

    var t : f32;
    let d = sdSegment(p, A, E, &t);
    let wTip = mix(0.1, 0.5, lenN) * px;
    let w = mix(wTip * 0.10, wTip, t);
    let lineA = smoothstep(w + px, max(w - px, 0.0), d)
              * mix(0.10, 1.0, smoothstep(0.0, 0.6, t));
    acc = max(acc, lineA);

    let nr = mix(0.7, 2.6, lenN) * px;
    let nd = length(p - E) - nr;
    acc = max(acc, smoothstep(px, -px, nd));
  }

  col = mix(col, BLUE, acc);
  return vec4f(col, 1.0);
}
