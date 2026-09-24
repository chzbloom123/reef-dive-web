# Reef Dive (web)

A calm coral-reef diving simulator that runs in the browser. Swim freely around a sunlit reef with coral,
schooling fish, and a sea turtle. There's no combat, score, or fail state; it's all about atmosphere.

**Play:** https://reef-dive-web.vercel.app/

Built with Three.js + Vite in plain JavaScript. Every model, texture, and sound is generated in code;
the whole site is about 155 KB to download.

## Controls
| Input | Action |
|---|---|
| Mouse | Look around |
| W A S D | Swim |
| Space / C | Rise / sink |
| Shift | Strong fin kick |
| Esc | Pause and settings (graphics preset, sound, mouse sensitivity) |
| M | Sound on/off |
| F3 | Frame-rate counter |

**Graphics presets:** Low (default) targets integrated graphics at 30+ fps; High targets a dedicated GPU at 60 fps.
The choice is remembered in the browser.

## Run it locally
Requires Node.js LTS.
```
npm install
npm run dev        # live-reloading dev server at http://localhost:5173
npm run build      # production build into dist/
npm run capture    # screenshots of every viewpoint in both presets → screenshots/
```
Page options: `?vp=vp_overview&preset=high&capture=1` (named viewpoint, preset, screenshot mode) or
`?cam=x,y,z,tx,ty,tz` (free camera).

## Twin parity (for the Godot build)
World conventions: meters, Y up, water surface at `y = 0` (depth = −y).
- **Reef area:** x −7.5…7.5, z −14…14. Seabed ≈ 8 m deep at z = +14, 11 m at z = 0, 18 m at z = −14, then falls to ≈ 26 m.
  Six pinnacles rise to 3.5–9.5 m depth (see `src/scene/rock-field.js`).
- **Sun direction:** normalize(0.12, 1, −0.4) (`src/scene/sun.js`).
- **Viewpoints** (`src/scene/viewpoints.js`), position → target:
  - `vp_overview`: (0, −6, 17) → (0, −9.5, −6)
  - `vp_coral_closeup`: (−1.5, −6.3, 15.1) → (−3.3, −7.5, 12.6)
  - `vp_looking_up`: (0, −9, −2) → (0.8, 0, −5)
  - `vp_deep_edge`: (0, −12, −11) → (0, −17, −24)
- **Life:** brain, branching, table/plate, tube coral, anemones, seagrass; chromis, yellow tang, blue tang, clownfish;
  one green sea turtle on a 61 m loop.
- **Swim feel:** push 2.2 m/s², drag 1.5 /s (≈1.5 m/s cruise), Shift ×2.3; surface limit 0.3 m below the water line.

## Project layout
```
src/main.js            wiring and the render loop
src/scene/             water, seabed, rocks, lighting, caustics, light shafts, particles
src/scene/coral/       coral, anemone and seagrass generators and placement
src/creatures/         fish (boids + shader wiggle) and the sea turtle
src/diver/             controls, swimming physics, oxygen, bubbles
src/shaders/           shared GLSL (water color, noise)
src/ui/                HUD, mask frame, menus, FPS counter
src/audio/             synthesized ambient sound
tools/capture.js       Playwright screenshot tool
```
See `LEARNING.md` for a milestone-by-milestone explanation of how each part works, and `CREDITS.md` for attributions.
