# Learning log

One short entry per milestone: what was built, the key technique, and one thing to try yourself.

---

## Milestone 0: Setup and the shipping pipeline

### What was built
A tiny "hello reef" page: a sandy floor, some lumpy placeholder blobs, blue haze, an FPS counter (F3),
and a screenshot tool that photographs the scene from named camera viewpoints.

### The key idea: how files become a website
Some vocabulary first:
- **npm** is Node's package manager. It downloads libraries listed in `package.json` into `node_modules/`.
  `package-lock.json` records the exact versions of those libraries *and of everything they depend on*, so every
  machine installs an identical set.
- **Three.js** is the 3D library. It wraps **WebGL**, the browser's low-level interface to the graphics chip.
- A **bundler** (Vite) follows every `import` starting from `index.html`, merges the files, strips what's unused,
  and writes a few compact files to `dist/`. The **dev server** (`npm run dev`) does the same on the fly and reloads
  the page every time you save a file.

```
 src/*.js ─┐
 index.html├─> Vite build ─> dist/ (1 HTML, 1 JS, 1 CSS ≈ 130 KB compressed)
 three ────┘                   │
                               ├─> npm run preview   (your PC, localhost)
                               └─> Vercel            (the internet; it runs the same build on its servers)
```

**What happens every frame (the render loop):**
```
 browser says "screen is about to refresh"   (≈60 times a second)
   └─> main.js loop
         ├─ timer: how many seconds since the last frame? (dt)
         ├─ update: move things by speed × dt
         ├─ renderer.render(scene, camera)  → the GPU draws the pixels
         └─ fps counter + capture signal
```
Multiplying by `dt` is why motion looks the same at 30 fps and 144 fps: a slow machine takes bigger steps less often.

**Coordinates**, shared with the Godot twin: 1 unit = 1 meter, Y is up, the water surface is `y = 0`, so depth is
`-y`. Godot uses the same Y-up, meters convention, so viewpoint numbers in `src/scene/viewpoints.js` copy straight across.

### Stack comparison
- **Easier here:** shipping. A web build is a folder of static files, and anyone with the link runs it. In Godot you
  export per platform and hand out a download.
- **Harder here:** everything the Godot editor gives you for free: a scene tree you can click through, an
  inspector, a play button, and built-in FPS/profiler panels. Here we write that ourselves, which is why the FPS counter
  and screenshot tool come first.
- **Screenshot tool:** Godot can screenshot its own viewport from a script. The web version needs an outside robot
  browser (Playwright) because a web page isn't allowed to save files to your disk.

### Try it yourself
In `src/scene/hello-reef.js`, find `new THREE.FogExp2(WATER_COLOR, 0.055)`. Run `npm run dev`, open the link it
prints, and change `0.055` to `0.02`, then to `0.12`, saving each time. Watch how far you can "see" through the water.
This one number is most of what makes a scene read as underwater. *(That file was replaced in Milestone 1 by a more
physical water model. See the Milestone 1 entry for its version of this experiment.)*

---

## Milestone 1: Swimming, water color, and menus

### What was built
- **The diver** (`src/diver/`): mouse look, swimming with momentum and water drag, fin-kick pulses, breathing
  buoyancy, a surface you can reach but not leave, and soft invisible walls around the reef.
- **Water optics** (`src/shaders/`, `src/scene/water-optics.js`): distance haze that eats red first, then green,
  then blue, plus sunlight that dims and loses red the deeper something sits.
- **Menus** (`src/ui/`): "Click to dive", and a pause menu with Resume, Low/High graphics, and mouse sensitivity.
- **Test tank** (`src/scene/test-tank.js`): a stand-in sandy slope with blobs and three **color posts**
  (red, orange, yellow, green, blue, white bands every meter) to show the water physics.

### Key technique 1: push, don't set
The diver never sets speed directly. Keys only *push* (acceleration), and water *drag* removes a fixed fraction of
speed every second:
```
velocity += push × dt
velocity × = e^(−drag × dt)       ← the glide
position += velocity × dt
```
Top speed is where push and drag balance (push ÷ drag). This is the same first-order lag you'd see in a
reactor-power or pump coast-down curve: an exponential approach to equilibrium with a time constant of 1/drag.

### Key technique 2: the water is a shader
A **shader** is a tiny program that runs on the graphics chip, once per corner of every shape (vertex shader) and
once per pixel (fragment shader), all in parallel. Three.js builds every material's shader from snippets called
**chunks**. We replaced the fog chunks with our own (`underwater-fog.js`), so every object in the scene gets water
physics without touching its material:
```
for every pixel of every object:
   color = lit surface color
   color × = e^(−sunlightLoss × depth)            ← deeper = dimmer, less red
   t     = e^(−viewLoss × distance)   (per channel: red fades fastest)
   pixel = mix(waterColor(direction, yourDepth), color, t)
```
The background is a giant ball around the camera painted with the **same** `waterColor` function, so far objects
dissolve into exactly the water behind them with no seam.

Look at the color posts in the screenshots: the red band at the bottom (~10 m deep, 10+ m away) is nearly black,
and yellow looks green. That's real: divers lose red first, which is why underwater photographers carry red filters.

### Stack comparison
- **Harder here:** Godot has an environment resource with volumetric fog you can turn on in the inspector.
  Here we wrote the fog math ourselves. But we also get *exactly* the physics we want, including per-channel color loss,
  which Godot's stock fog doesn't do either.
- **Harder here:** "Click to dive" exists because browsers won't let a page capture the mouse without a click, and
  Esc always releases it (so a web page can't trap you). A desktop Godot game can grab the mouse whenever it likes.
- **Same:** the swim physics (push, drag, clamp) would be nearly identical code in Godot's `_physics_process`.

### Try it yourself
In `src/diver/diver-controller.js`, change `drag: 1.5` to `drag: 0.5`, save, and swim with `npm run dev`. You'll
glide like you're on ice. Then try `drag: 4` for a thick, syrupy feel. Top speed changes too, because it's push ÷ drag.

---

## Milestone 2: The ground, rocks, sunlight, and the surface from below

### What was built
- **Seabed** (`terrain-height.js`, `seabed.js`, `sand-textures.js`): a sloping sandy floor from ~8 m at the shallow end
  to 18 m at the deep edge, then falling away into the haze. The sand has rippled texture and darkens near rocks.
- **Rocks** (`rock-shapes.js`, `rock-field.js`): six big pinnacles framing a sandy channel, low ledges, scattered
  boulders, and distant towers you only see as silhouettes. Algae and pink coralline crust grow on their upward faces.
- **Collision**: you can't swim through rock; you slide along it.
- **Sunlight**: a sun plus soft sky light. High adds real shadows.
- **The surface from below** (`water-surface.js`): moving waves, Snell's window, and sun glare.

### Key technique 1: noise, the building block of procedural worlds
**Noise** is a smooth random field: nearby inputs give nearby outputs. Layer a few copies at doubling detail
("fractal noise") and you get natural-looking shapes. Almost everything here is noise plus a formula:
```
sand height   = slope profile + noise(x, z)
rock surface  = sphere radius × (1 + noise(direction) + ledge bands)
algae patches = noise(position) where the rock faces upward
sand ripples  = sin(wave + noise), baked into a tiny tiling texture
```
Change a seed number and you get a whole new reef for free, with nothing extra to download.

### Key technique 2: one shape function for sight and touch
Each rock is defined by a *function*: "for any direction from my center, how far out is my surface?" The mesh is
built by pushing sphere points out to that distance, and collision asks the same function whether you're inside.
To push you out, it samples the function a few centimeters around you to find the surface's true outward
direction (its **normal**). An early version pushed straight away from the rock's *center* instead, and the tests
caught a bug: pressing into a tall pinnacle slowly ratcheted you up its side.

### Key technique 3: Snell's window
Light bends when it crosses from air into water. Looking up from below, the entire sky is squeezed into a bright
circle overhead, about 97° wide. Past its edge the surface acts as a mirror and reflects the dark water below
(**total internal reflection**). The surface shader does this bending calculation for every pixel, using GLSL's
built-in `refract()`. Wave slopes wobble the window's edge, which gives the bright, broken-up look of real surface light.

### Key technique 4: bake it once, not every frame
Contact shadows around rock bases, algae placement, and rock shading are all computed **once, at load time**,
and stored as per-vertex colors. The graphics chip then just paints them, with no cost per frame. The same trick
cut load time from about 3.5 s to under 1 s: every rock starts from the same sphere, so we build that sphere once and copy it.

### Stack comparison
- **Harder here:** Godot has a terrain editor, a physics engine with collision shapes, and a shadow toggle in
  the inspector. Here we wrote the terrain function, the collision math, and the shadow setup ourselves.
- **Easier here (sort of):** since everything is code, a procedural reef is natural. In Godot you'd usually sculpt
  or import meshes, then write a script to scatter them.
- **Same:** Godot's water would also need a custom shader for Snell's window. Neither engine does it out of the box.

### Try it yourself
In `src/scene/rock-field.js`, change `createRandom(5)` to `createRandom(6)` and reload. All the boulders and
distant towers move to new random spots (the six main pinnacles are hand-placed, so they stay put). Then in
`rock-shapes.js`, change the `0.3` in `1 + 0.3 * fbm(` to `0.6` for wilder, lumpier rocks.

---

## Milestone 3: Coral, anemones, and seagrass

### What was built
Everything alive and attached, in `src/scene/coral/`:
- **Brain coral**: lumpy domes with meandering grooves (single, wide, and twin-domed varieties).
- **Branching coral**: staghorn antlers and bushy finger clumps, grown by a recursive branching rule.
- **Table and plate coral**: tables on stalks on flat rock; wavy plates jutting out of rock walls as shelves.
- **Tube sponges**: clusters of hollow tubes with dark openings.
- **Anemones**: fleshy columns with curling tentacles that sway.
- **Seagrass meadows**: up to 6,000 swaying blades.
- About 540 corals in total, and you bump into them (except anemones and grass, which are soft).

### Key technique 1: instancing (why 7,000 living things run on integrated graphics)
Each draw call (the CPU telling the GPU "draw this object") has a fixed overhead, so 7,000 separate objects
would choke even a strong machine. Instead, each *variety* is one shape uploaded once, plus a list of
placements and colors:
```
one staghorn shape  +  [ (position, rotation, size, color) × 130 ]  →  1 draw call
one seagrass blade  +  [ (position, rotation, size, color) × 6000 ] →  1 draw call
```
The whole reef's life is **18 draw calls**. Variety comes from mixing 3–4 shapes per species with random
size, spin, tilt, and color, so no two corals look alike.

### Key technique 2: let the shader do the fine detail
- **Brain coral grooves** aren't geometry. The shader computes a smooth noise field for each pixel and draws its
  *contour lines*, which meander exactly like brain coral valleys. Carving them into triangles would need about 50× the geometry.
  Far away, where grooves would be finer than a pixel and flicker, they fade to an even color.
- **Swaying** happens on the GPU: each blade vertex stores a "sway weight" (0 at the root, 1 at the tip), and the
  vertex shader pushes it sideways by `sin(time + position)`. The CPU does nothing per blade per frame.

### Key technique 3: same reef on both presets
Every coral is placed on both presets, so the random sequence (and therefore the reef) is identical. Low
then draws a fixed half of them. Your Low screenshots are a true subset of Brie's High ones, not a different reef.

### Key technique 4 (High only): fake translucency
Real coral tissue is thin and lets light through. A cheap trick imitates it: surfaces seen edge-on get a soft glow in
their own color ("rim light"). It's one line of shader math instead of real light-through-material simulation.

### Stack comparison
- **Same idea, different buttons:** Godot has `MultiMeshInstance3D`, the same thing as instancing, plus a
  scatter tool in the editor. Here, placement is our own code (on rock faces, near rocks, in gardens), which is
  more work but lets us encode reef ecology rules directly.
- **Harder here:** the shader edits (grooves, sway, glow) are spliced into three.js's built-in shaders by string
  replacement. Godot's visual shader editor or `shader_type spatial` makes that cleaner.

### Try it yourself
In `src/scene/coral/reef-life.js`, change `branching: 260` in `BASE_COUNTS` to `branching: 600` and reload.
Watch the F3 counter: frame rate barely moves, because it's still one draw call per variety, just longer lists.
Then in `coral-material.js`, change `field * 15.0` to `field * 6.0` for fat, lazy brain-coral grooves.
