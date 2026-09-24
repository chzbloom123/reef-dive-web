# Reef Dive Web — CLAUDE.md

## What this is
A small, beautiful coral reef diving simulator **that runs in a web browser**, hosted on Vercel, with Low and High graphics presets. The player swims freely around one reef area and looks at coral formations and fish. There's no combat, no score, and no fail state. The whole thing is about atmosphere.

This is also a **learn-to-build-by-building exercise**. Chaz is learning how real game scenes and simulators are built with a proper stack. The learning matters as much as the result, so read "How to work with Chaz" before starting.

## Twin project
Chaz is building a desktop twin of this sim in **Godot** on another computer at the same time, so he can compare two stacks side by side. Keep the two worlds comparable:
- Same reef size, depth range, creatures, controls, and HUD.
- The same named camera viewpoints: `vp_overview`, `vp_coral_closeup`, `vp_looking_up`, `vp_deep_edge`.

Don't try to share code with the Godot project. It's a separate build in a separate stack.

## Reference image
`reference/reef_reference.png` is the visual target. It's inspiration, not a pixel-exact spec. Aim for its mood: bright sunlit shallows, blue-green water falling off into haze, light shafts from the surface, dense colorful coral in the foreground, schools of small fish, a sea turtle, and a dive-mask frame with oxygen and depth readouts. Ignore the sparkle watermark in the lower right.

## Hardware and presets (hard constraint)
The sim runs on the *visitor's* graphics chip, not on Vercel's servers, so the presets have to cover two very different machines:
- **Low:** for Chaz's machines, which have **AMD Ryzen integrated Radeon graphics with no dedicated GPU**, on Windows 11. Must hold **30+ fps at 1080p**.
- **High:** for Brie's gaming PC, an older but once top-end machine with a dedicated GPU (it runs Skyrim Special Edition on Ultra). Should hold 60 fps.

How the presets work:
- **Default to Low.** A settings toggle in the pause menu switches presets, and the choice is remembered in the browser.
- **What they control:** coral and seagrass density, fish count, view distance, shadow quality, particle counts, render resolution (pixel ratio), and whether post-processing effects such as bloom are on.
- **Cheap tricks over expensive effects,** in both presets. Use fake light-shaft meshes and a shader-based caustics projection, and use instancing (drawing many copies of one mesh in a single GPU call) for anything repeated in large numbers.
- **FPS counter:** show one on screen (toggle with F3) so Chaz can check performance himself.

## Stack
- **Three.js** for 3D rendering (the standard 3D library for the web). Use its WebGL renderer for the widest browser support. Pin an exact version in `package.json`.
- **Vite** as the dev server and build tool. It runs a local preview while building and bundles the finished site for upload.
- **Plain JavaScript** using ES modules. No TypeScript and no UI framework such as React; this is one canvas plus a small HTML overlay for the HUD and menu.
- **Node.js LTS**, needed by Vite. If it isn't installed, tell Chaz and wait.
- **Playwright** for automated screenshots (see the feedback loop below).
- **Git** for version control, and **GitHub + Vercel** for hosting. Ask Chaz before creating the GitHub repo or connecting Vercel.
- **Everything must be free.** No paid services, APIs, or asset stores.
- **Ask before adding any npm package** beyond three, vite, and playwright. Say what it does and why it's needed.

## Scope
**In:**
- One reef area roughly the size of a basketball court, depth from about 3 m to 18 m.
- Seabed with sand, rocks, and seagrass.
- Procedural coral: brain, branching, table/plate, tube, and anemones.
- At least three small fish species that school together (boids flocking), plus one sea turtle on a slow looping path.
- A visible water surface from below, sun rays, caustics, floating particles, and bubbles from the diver.
- A dive-mask HUD with an oxygen gauge, a depth meter, a subtle lens frame, and a vignette.
- Collisions, so the diver can't swim through rock or coral.
- A "click to dive" start screen (browsers require a click before capturing the mouse) and a pause menu with the preset toggle, a sensitivity slider, and resume.

**Out:** combat, inventory, save files, multiplayer, accounts, analytics, cookies, sound beyond a simple ambient loop, and mobile or touch controls. This is a desktop browser build, targeting Chrome, Edge, and Firefox.

## How the swimming should feel
- **Controls:** mouse look (pointer lock), WASD to swim, Space to ascend, C to descend, Shift for a stronger fin kick, and Esc to pause.
- **Movement:** momentum with water drag, so the diver glides and slows gently rather than stopping dead. Add slight neutral buoyancy drift when idle.
- **Surface limit:** the diver can reach the surface but not leave the water.
- **Oxygen:** drains slowly and refills when the diver is at the surface. When low, the gauge warns; it never kills or resets the player.
- **Depth meter:** shows true depth, meaning the camera's distance below the water surface.

## Look and physics
Keep it believable, like real shallow seawater:
- **Color by distance:** water absorbs red light first, then yellow, so distant objects shift toward blue-green. Tie this to depth and view distance.
- **Visibility:** falls off into haze at roughly 25–35 m.
- **Caustics and light shafts:** stronger in the shallows, fading with depth.
- **Fish animation:** a vertex-shader wiggle, a sine wave traveling down the body. No rigging.
- **Coral:** cheap fake translucency (a wrap-lighting or rim-light shader trick) on High only.

## Load size and speed
- First load under about 10 MB total. The site should be playable within a few seconds on normal home internet.
- Generate geometry and textures in code where possible, since procedural assets cost almost nothing to download.
- Show a simple loading indicator if anything takes more than a moment.

## The visual feedback loop (use this constantly)
Build a capture tool early (Milestone 0) and use it after every visual change.
- **URL parameters:** the page accepts parameters such as `?vp=vp_overview&preset=high&capture=1`. In capture mode, it skips the start screen, moves the camera to that viewpoint, waits about two seconds so the scene settles, then signals that it's ready.
- **Capture script:** a Playwright script starts the Vite preview, opens each viewpoint in both presets, and saves PNGs to `screenshots/<viewpoint>_<preset>_<timestamp>.png`. Run the browser **headed (with a visible window)** when possible, because headless browsers often draw 3D in slow software mode, which can look different.
- **Comparison:** after capturing, open the PNGs yourself and compare them to the reference image. Judge honestly, name what's off, adjust, and capture again.
- **Screenshot FPS doesn't count.** Real performance is what Chaz sees with the F3 counter on his machine (Low) and Brie's machine (High).
- **History:** keep old screenshots so progress is visible over time. They're gitignored and don't need committing.

## Milestones
Work in order. Finish, capture, commit, and report each one before moving on.
0. **Setup:** Vite + Three.js project, git repo with `.gitignore`, folder structure, FPS counter, the capture tool with one test viewpoint, and a **"hello reef" page deployed to Vercel**. Deploying early means Chaz learns the shipping pipeline on something tiny.
1. **Swimming:** the diver controller in an empty water volume, with fog and color falloff, plus the click-to-dive screen and pause menu. It should already feel good to swim around in.
2. **The ground:** seabed, rocks and outcrops, sun lighting, and the water surface seen from below.
3. **Coral:** procedural generators for each coral type, scattered with variety so no two look identical.
4. **Life:** fish with the shader wiggle, boids schooling, and the turtle on its path.
5. **Atmosphere:** light shafts, caustics, drifting particles, and diver bubbles.
6. **Mask HUD:** oxygen gauge, depth meter, and the lens frame overlay.
7. **Presets and polish:** tune Low on Chaz's hardware and High for a dedicated GPU, run a performance pass, and do a final comparison against the reference.
8. **Ship:** final Vercel deploy, a quick check in Chrome, Edge, and Firefox, and a shareable link for Brie.

## Assets
- **Procedural first.** If Claude can generate it in code, do that.
- **CC0 only** for anything downloaded. Good sources are Poly Haven, Kenney, and Quaternius. Use `.glb` format for models. Ask before using anything with a different license.
- **Credits:** log every outside asset in `CREDITS.md` with its source URL and license.

## Project conventions
- **Folders:** `src/` (code), `src/scene/`, `src/creatures/`, `src/shaders/`, `src/ui/`, `public/` (static files), `tools/` (the capture script), `reference/`, `screenshots/`.
- **Names:** `camelCase` for JavaScript variables and functions, and `kebab-case` for file names.
- **Small modules:** each file does one clear job.
- **Comments:** explain *why*, written for a learner. For example: "we reuse one fish mesh for the whole school so the GPU draws them all in a single call."
- **Git:** commit after every working step with a plain-English message. Never force-push or rewrite history.
- **Location:** stay inside the project folder. Ask before installing anything or touching files elsewhere.

## How to work with Chaz
- **Division of labor:** Chaz gives the vision and the goal; you choose the method. Don't ask him to make technical choices you can make yourself. Ask only when a decision truly depends on his taste, changes the scope, or involves accounts (GitHub, Vercel).
- **Plain language:** he's a strong systems thinker, a nuclear safety instructor with a Navy background, but new to modern dev vocabulary. Define any web or 3D term the first time it comes up, in a sentence. Don't assume he knows what npm, a bundler, a mesh, a shader, instancing, or a render loop is.
- **Diagrams:** he learns relationships well from flow and tree diagrams. Use simple text diagrams when explaining how parts connect, such as what happens each frame or how files turn into the deployed site.
- **Stack comparison:** since he's comparing this build against the Godot twin, point out when something is notably easier or harder here than it would be in a game engine, and why.
- **Explain as you go, briefly.** At each milestone, write a short entry in `LEARNING.md` covering three things: what was built, the key technique and why it works, and one thing worth trying himself (for example, a value to change in the code and what to watch for).
- **End every milestone report with:**
  - What to look at: which screenshots, the local preview link, and the live Vercel link once it exists.
  - A section headed `## Decisions made for you`: every choice the spec didn't specify, one line each, in the form "decision, choice, one-clause reason."
- **Be honest about quality.** If a screenshot doesn't look good yet, say so and say why. Beauty is the goal, not "technically done."

## Done means
Chaz opens a Vercel link on his integrated-graphics machine and swims around a reef that feels calm and alive at 30+ fps on Low. Brie opens the same link on her gaming PC, switches to High, and sees a noticeably richer version at 60 fps. Screenshots from both clearly read as the same world as the reference image. Chaz also understands, at a working level, how each major part was built, and how this stack compares to the Godot twin.
