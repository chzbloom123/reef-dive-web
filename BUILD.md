# Reef Dive (web): Build and Tech Stack

A calm coral-reef diving simulator that runs in any desktop browser. Every model, texture, and sound is generated
in code when the page loads, so the whole site is about **155 KB** to download (the budget was 10 MB).

- **Live:** https://reef-dive-web.vercel.app/
- **Source:** github.com/chzbloom123/reef-dive-web (private)
- **Size:** about 3,900 lines of JavaScript/GLSL across 55 source files
- **Built:** 2026-09-23, in 8 milestones (see `LEARNING.md` for each one)

---

## Tech stack

| Layer | Choice | Version | What it does |
|---|---|---|---|
| 3D rendering | **Three.js** (WebGL renderer) | 0.186.0 (pinned) | Turns meshes, lights, and shaders into pixels on the visitor's GPU |
| Language | **Plain JavaScript** (ES modules) + **GLSL** shaders | — | No TypeScript and no UI framework; GLSL runs on the graphics chip |
| Build / dev server | **Vite** | 8.3.0 (pinned) | Live-reloading local preview; bundles the site into `dist/` |
| Runtime for tools | **Node.js** LTS | 24.13.0 | Runs Vite and the screenshot tool |
| Visual testing | **Playwright** (drives installed Chrome/Edge) | 1.63.0 (pinned) | Automated screenshots of named viewpoints in both presets |
| UI / HUD | **HTML + CSS + SVG** | — | Menus, mask frame, gauges, layered over the 3D canvas |
| Audio | **Web Audio API** | built into browsers | Synthesized ambient rumble and reef crackle; no sound files |
| Version control | **Git** + **GitHub** | — | Commit per working step; private repo |
| Hosting | **Vercel** (Hobby, free) | — | Rebuilds and redeploys automatically on every `git push` |

**Runtime dependencies shipped to visitors:** Three.js only. Vite and Playwright are development tools.
**Targets:** Chrome, Edge, Firefox on desktop. Low preset for integrated graphics (30+ fps at 1080p); High for a dedicated GPU (60 fps).

---

## How the build flows

```
 src/*.js, index.html ──> Vite ──> dist/  (1 HTML, 1 JS, 1 CSS, ~155 KB compressed)
                                    │
     npm run dev ───────────────────┼──> http://localhost:5173 (live reload)
     npm run capture ───────────────┼──> robot Chrome photographs 4 viewpoints × 2 presets → screenshots/
     git push → GitHub → Vercel ────┴──> https://reef-dive-web.vercel.app/
                                              │
                    visitor's browser downloads the code, GENERATES the reef on their machine,
                    and their own GPU draws it every frame (Low or High preset)
```

### What happens each frame (the render loop in `src/main.js`)

```
browser: "screen is about to refresh" (~60×/s)
  ├─ timer → dt (seconds since last frame)
  ├─ diver: mouse + keys → push → velocity (water drag) → position → collide with rock/coral
  ├─ oxygen drains/refills → HUD updates only if a shown value changed
  ├─ fish schools (boids) → instance matrices;  turtle moves along its spline
  ├─ bubbles, caustic time + sun direction, shaft/snow/sway clocks
  └─ renderer.render(scene, camera) → GPU draws everything
```

---

## Scene contents

| Part | Technique |
|---|---|
| Water color and haze | Custom fog shader: per-channel light absorption (red fades first), matching water backdrop dome |
| Seabed | Height function (slope + noise); code-generated tiling sand color and normal textures; baked contact shading |
| Rocks | 6 hand-placed pinnacles, ledges, boulders, distant towers; one shape function drives both mesh and collision |
| Water surface | Shader-only waves with real refraction: Snell's window, total internal reflection, sun glare |
| Coral | Brain (shader-drawn grooves), branching (recursive), table/plate, tube sponge, anemone (swaying), seagrass |
| Instancing | Each coral/fish variety is one draw call; the whole reef's life is ~22 draw calls |
| Fish | 4 species, procedural bodies, vertex-shader swim wave, boids schooling, flee the diver |
| Sea turtle | Procedural shell (Voronoi plates), animated flippers, Catmull-Rom spline loop |
| Atmosphere | Baked caustic texture (2–3 sliding reads), camera-facing light shafts, marine snow, pooled bubbles |
| HUD | SVG mask frame and vignette, arc oxygen gauge, depth ruler |

### Presets (`src/presets.js`)

| | Low (default) | High |
|---|---|---|
| Pixel ratio cap / antialiasing | 1.0 / off | 2.0 / on |
| Coral / seagrass | ~270 / 2,500 | ~540 / 6,000 |
| Fish | 90 | 260 |
| Shadows | off (baked contact shading) | on, 2048 map |
| Lighting model | Lambert | Standard (physically based) |
| Coral translucency glow | off | on |
| Caustic layers | 2 | 3 |
| Light shafts / specks / bubbles | 28 / 600 / 60 | 56 / 2,500 / 140 |

---

## File tree

```
reef-sim-cv2/
├── index.html                  Page shell: canvas, loading text, start screen, pause menu
├── package.json                Scripts (dev, build, preview, capture) and pinned versions
├── package-lock.json           Exact versions of every installed package
├── vite.config.js              Build settings
├── .gitignore / .gitattributes Ignore rules; LF line endings
├── CLAUDE.md                   Project brief and working rules
├── README.md                   Overview, controls, twin-parity numbers
├── BUILD.md                    This file
├── LEARNING.md                 What was built and how, milestone by milestone
├── CREDITS.md                  Attributions and licenses
├── references/
│   └── reef-reference.png      Visual target image
├── screenshots/                Capture history (gitignored)
├── tools/
│   └── capture.js              Builds, serves, and screenshots every viewpoint × preset
└── src/
    ├── main.js                 Entry point: builds everything, runs the render loop and game states
    ├── presets.js              Low / High settings; remembers the choice
    ├── storage.js              Safe localStorage wrapper for settings
    ├── url-options.js          ?vp= ?preset= ?capture= ?cam= page options
    ├── capture-signal.js       Tells the screenshot tool when the scene has settled
    ├── style.css               Menus, HUD, FPS counter styles
    ├── audio/
    │   └── ambience.js         Synthesized underwater rumble + snapping-shrimp crackle
    ├── diver/
    │   ├── input.js            Keyboard, mouse, pointer lock
    │   ├── diver-controller.js Swim physics: push, drag, kicks, buoyancy, limits, collision
    │   ├── oxygen.js           Depth-dependent air use, surface refill, no fail state
    │   └── bubbles.js          Pooled exhale bubbles tied to the breathing cycle
    ├── creatures/
    │   ├── fish-geometry.js    Procedural fish body, tail and dorsal fin with painted colors
    │   ├── fish-species.js     Chromis, yellow tang, blue tang, clownfish definitions
    │   ├── fish-material.js    Vertex-shader swim wave
    │   ├── fish-school.js      Boids flocking, avoidance, diver flee
    │   ├── sea-life.js         Builds schools and turtle; per-frame update
    │   └── turtle.js           Procedural sea turtle and its spline path
    ├── scene/
    │   ├── renderer.js         WebGL renderer setup and resize
    │   ├── viewpoints.js       Named camera views shared with the Godot twin
    │   ├── sun.js              Single source of truth for the sun direction
    │   ├── water-optics.js     Water backdrop dome and lights (sun, sky, shadows)
    │   ├── water-surface.js    Underside of the surface: waves, Snell's window
    │   ├── terrain-height.js   Seabed height function (used for drawing and collision)
    │   ├── seabed.js           Sand mesh with baked shading
    │   ├── sand-textures.js    Code-generated tiling sand color and normal maps
    │   ├── rock-shapes.js      Rock shape function, mesh building, distance
    │   ├── rock-field.js       Rock layout, coloring, collision, surface sampling
    │   ├── materials.js        Lambert (Low) vs Standard (High) matte materials
    │   ├── caustics.js         Baked caustic texture patched into every lit material
    │   ├── light-shafts.js     Camera-facing additive sunbeams around the diver
    │   ├── marine-snow.js      Drifting particles computed in the shader
    │   ├── noise.js            Perlin gradient noise and fractal layering
    │   ├── random.js           Seeded random numbers (same reef every load)
    │   └── coral/
    │       ├── geometry-kit.js     Shared helpers: paint, merge, orient
    │       ├── coral-material.js   Brain grooves, sway, High-only translucency
    │       ├── brain-coral.js      Lumpy domes
    │       ├── branching-coral.js  Recursive staghorn and bushy coral
    │       ├── table-coral.js      Tables on stalks and wall plates
    │       ├── tube-coral.js       Tube sponge clusters
    │       ├── anemone.js          Column with curling tentacles
    │       ├── seagrass.js         A single swaying blade (instanced ×6,000)
    │       └── reef-life.js        Placement rules, instancing, coral collision
    ├── shaders/
    │   ├── water-color.glsl.js Shared water color and absorption math
    │   ├── underwater-fog.js   Replaces three.js fog chunks with water physics
    │   └── noise.glsl.js       GPU value noise
    └── ui/
        ├── hud.js              Oxygen gauge, depth meter, reticle
        ├── mask-frame.js       SVG dive-mask lens frame and vignette
        ├── start-screen.js     "Click to dive"
        ├── pause-menu.js       Resume, preset, sound, sensitivity
        ├── controls-list.js    Shared controls list for both menus
        └── fps-counter.js      F3 frame-rate / depth / speed readout
```

---

## Commands

```
npm install                              install dependencies
npm run dev                              local preview with live reload
npm run build                            production build into dist/
npm run capture                          screenshots of all viewpoints, both presets
npm run capture -- --vp=vp_overview      one viewpoint
npm run capture -- --cam=0,-5,10,0,-10,0 a one-off camera
```

## Assets and licenses
No downloaded assets: every model, texture, and sound is procedural. Three.js and Vite are MIT, and Playwright is Apache 2.0
(development only). The small shader hash formula is MIT (Dave Hoskins). See `CREDITS.md`.
