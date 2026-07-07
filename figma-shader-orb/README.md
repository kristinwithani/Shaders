# Orb shader

A circular 4-level radial gradient "sphere" with 250 blue spikes that drift
slowly when idle and steer away from the cursor on hover.

## Design recipe (shared by all three versions)

| Element | Value |
|---|---|
| Ring 1 (center, 0–25%) | `#f9b85f` |
| Ring 2 (25–35%) | `#d9ccb0` |
| Ring 3 (35–55%) | `#B6D9FF` |
| Ring 4 (rest) | `#ffffff` |
| Spikes | 250 × `#2A00FF`, tip width 0.1–0.5pt, tapering to ~0 + fading toward the center |
| End nodes | circle at each spike tip, radius scales with spike length |
| 3D feel | spike directions sampled on a Fibonacci **sphere**, projected to 2D — spikes pointing at the viewer foreshorten, giving the sphere illusion; idle animation is a slow 3D tumble |
| Hover | each spike's angle steers away from an **eased** cursor position (the easing is what makes it feel like smooth "steering", not snapping) |

## Files

- `index.html` — pure-fragment-shader version (SDF). WebGL2/GLSL, zero
  dependencies. Open it in a browser: `open index.html`.
  Supports `?t=2&mx=0.22&my=0.08` to freeze a frame for captures.
- `particles.html` — **particle-system version**: same visual recipe, but
  the 250 spikes are instanced quads driven by CPU spring physics instead of
  a per-pixel loop. Has an FPS meter, plus the same `?t=…&mx=…&my=…` capture
  mode and `?bench=1600` for GPU-synced timings.
- `studio.html` — **shader studio**: four toggleable shaders (tabs at the
  top of the panel), each with its own debug controls, live FPS meter, and
  per-shader export (standalone HTML with the config baked in, or a preset
  JSON). Open with `open studio.html`.
  - **orb** — the spike-sphere particle system (all original controls)
  - **lava** — lava-lamp metaballs in glowing stepped bands with per-ring
    opacity; the cursor repels and shatters the blobs
  - **pixels** — blinking pixel cluster dragged behind the cursor over a
    pixelated reference image that un-pixelates around the cursor
  - **aura** — soft blurred colour blobs bouncing over an irregular
    gradient background, with an interactive 3D spring-web overlay
    (drag nodes, drag space to rotate; spin follows your drag direction)
  Tweaks persist per shader while toggling. Capture mode works per shader
  (`?shader=lava&t=4&mx=0.1&my=-0.1`), and `?set=key:value,...` deep-links
  any config override. "Save settings" persists all shader configs, the hero
  text overlay, and code edits to localStorage across refreshes. The bottom
  code drawer shows the active shader's engine source — edit it, apply live
  (broken edits auto-revert), copy it, and exports carry the edited code.
- `orb.wgsl` — the SDF shader in WGSL for **Figma shader fills**
  (Figma renders shaders with WebGPU/WGSL and shaders are authored through
  the Figma agent — there is no API to push shader source from outside).

### Measured on Apple M5, 1600×1600 backing store (Retina)

| Version | ms/frame | fps |
|---|---|---|
| `index.html` as shipped | 60.7 | 16 |
| `index.html` + radius early-exit + 1× DPR | 4.8 | 200+ |
| `particles.html` | **0.54** (0.01 CPU) | 1800+ |

The particle version is ~112× faster than the shipped SDF version and nearly
resolution-independent (0.48 ms at 422², 0.54 ms at 1600²) because spikes
only touch the pixels they cover. It also uses slightly-underdamped springs,
so spikes overshoot and settle when dodging the cursor — true inertia the
stateless shader can't express. The SDF version remains the one that
translates 1:1 to the Figma shader fill (`orb.wgsl`).

## Getting the live shader into Figma

1. In Figma, select the circle → **Fill → + → Shader fill** (paid plans).
2. In the shader prompt, paste the contents of `orb.wgsl` and say:
   *"Use exactly this WGSL fragment shader; wire your runtime's resolution,
   time and cursor uniforms to `u.resolution`, `u.time`, `u.mouse`."*
3. Once saved, the shader lands in your account library. From there it is
   scriptable: `figma.listAvailableShaders()` → `figma.importShaderById(id)`
   → `node.fills = [{ type: 'SHADER', id }]`.

## Figma canvas (static)

The playground file also contains a frozen frame of the shader built as real
vector nodes (radial gradient + 250 tapered vector spikes + end nodes),
generated via the Figma MCP with the same math and constants.
