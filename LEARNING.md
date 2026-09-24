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
This one number is most of what makes a scene read as underwater. Milestone 1 replaces it with a more physical version.

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
