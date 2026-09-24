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
