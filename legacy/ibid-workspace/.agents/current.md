# Active work plan

### State

`ibid-workspace` is an Nx monorepo with four apps (`oh-save-me`, `boilerplate`, `papikapi`, `papikapi-studio`) and four
libraries (`ibid-ui`, `services`, `testing`, `utils`).

**Numbering (2026-09-29):** stages now start at 1 (1 alternatives, 2 cutout and 3D, 3 papercraft). Older entries below use the old 0/1 numbers.

**Written, not yet run (2026-09-29):** `papikapi-studio` `s2-step-3` KEY-PTS (`npx nx run papikapi-studio:stage:2:step:3 --model=<name>`): generic key-point extraction in Blender headless (cut spacing varies between 6% and 12%, from one complexity measure shared by the three axes of the length, tighter where the original mesh has more faces per surface, blue intersections and green corners, collision = two radii of 5 mm, output scene holds only the red grid and the airtight mesh; the JSON lists every vertex with the ids it connects to). Prototyped by hand on the brachiosaurus (196 crossings + 125 corners = 321 points), never executed as a script.

**Written, tests not yet run (2026-10-31):** `papikapi` child switcher UI, on top of `ChildProfilesStore`. New `papikapi-child-bust` atom, `papikapi-child-switcher` molecule (paper trigger + unfolding drawer of child cards, emits `childSelected`), `ClassroomStore` read model (profiles, active child, points per child from live state or that child's saved progress), switcher in the home top bar, and a "Sala / Crianças da Creche" grid in the backoffice. Build, lint and spec type-check green. "+ Nova Criança" has no registration form yet (`ChildProfilesStore.registerChild` is ready for it).

**In progress:** `papikapi-studio` Stage 3 (papercraft unfolding of `step-2-3d.glb` into A4 sheets, PDF). Written and
compiling, waiting for the first run on `bear`. See "Stage 3" below.

`oh-save-me` was migrated from the `SavvyJar` repository, which is **never modified from here**.
It builds, lints, passes its tests, and has its CI/CD workflows ready.

## Done

- [x] Papikapi Voice-First Dictation & Silent Translation (US1) (`apps/papikapi`, `libs/ibid-ui`, `libs/services`, 2026-10-28): implemented generic `<ibid-voice-dictation>` molecule with 3 buttons (Gravar/Retomar, Parar, Aceitar), 60s session countdown, real-time PT transcription preview, and clean listener detachment on stop/abort (preventing any spurious 'aborted' error states); mapped genuine connection issues to human-friendly feedback; decoupled translation via `TranslationProvider` and `MyMemoryTranslationProvider` in `libs/services` (Open/Closed Principle); user reviews prompt naturally in PT and translation to EN with Papikapi Studio invariants occurs silently on submit; user journey test suite and 431 tests in `papikapi` passing 100%, and monorepo `check:build` green across all 8 packages.

- [x] Papikapi Studio Stage 5 assembly animation, first step (`apps/papikapi-studio`, 2026-10-04): `s5-step-1` ASSEMBLY (`scripts/stage-5/`) turns `stage-4/step-1-net.json` into `assembly.json` per model (fold tree per piece, hinge axes and angles from the flat→3D transforms, bottom-up piece order, tray layout, face colours from the textured GLB); run on all 54 models (0 failures; worst hinge residual 16 mm on `alex`, hidden by snapping to the exact 3D polygon at the end; 1 extra root in total). New `Montagem` tab in the studio (`papikapi-studio-assembly-viewer`, `AssemblyRig`, `PieceRig`, domain `assembly-timeline`) and new `ibid-slider` atom in `libs/ibid-ui`. Specs written, NOT run (user runs them): `assembly-timeline.spec.ts`, `slider.spec.ts`. Open: hinge angles reach 180° on a few models (`creeper`, `raccoon`, `white-kitten`), camera framing makes the figure small, no glue-tab animation, progress is per piece (not driven by a child's points yet), `npm run check:build` not run.

- [x] Papikapi Studio Homogeneous Facet Sampling & Crisp Decal Collage (`apps/papikapi-studio`, 2026-10-02): implemented generic stage-2 step 5 texturizing (`s2-step-5` TEXTURIZE) across low-poly models without geometry modification or mirror bisecting; samples flat, solid cardstock colors per facet directly from Trellis (`step-2-3d.glb`) eliminating gradients and baked shadows (`facet_sampling.py`); isolates anti-aliased high-contrast decal elements (eyes, pupils, catchlights, spots, facial markings) directly from 2D art (`decal_extraction.py`, `step-5-decals.png`); projects decals cleanly as collages onto the low-poly UV atlas using camera registration from Trellis (`collage_projection.py`, `step-5-texture-atlas.png`); validated end-to-end on `cheetah`, `elephant`, and `alex`; passed monorepo compilation `npm run check:build` 100% green across all 8 packages.

- [x] Papikapi Studio reduction by Decimate collapse (`apps/papikapi-studio`, 2026-10-01): the stage-2 simplification now runs Blender Decimate (collapse, `target_faces` 600), quad join, `face_splitter.py` (no face wider than `face_max_extent_ratio` of the longest side, so the plinth bottom fits an A4 page) and `surface_repair.py` (drops floating and over-used faces that TRELLIS GLBs carry and fills holes; `weld_distance_ratio` 1e-5); the vertex-fusion and shape-guard code and its parameters were deleted; QuadriFlow was tested and rejected. Metric `featureLossMm` added to the manifest. Open: all `.blend` files under `resources/` were deleted at the user's request and must be regenerated by the steps; `cow` and `fire-truck` have no TRELLIS GLB, `donkey-kong` has an unreadable GLB (NaN), `raccoon`, `siamese`, `owl` have open or non-manifold edges in theirs (regeneration is paid, ask first); `npm run check:build` not re-run after the last edits; the rest of the work moved to the texture session (stage 2 step 3 base, 4 simplify, 5 texturize, 6 plinth).

- [x] Papikapi Studio Clean Code, Interface Isolation & Declarative Step Renaming (`apps/papikapi-studio`): renamed Stage 2 Step 4 from legacy `KEY-PTS` / `key-points` to fully declarative `SIMPLIFY` / `step-4-simplify.ts` (Low-Poly Simplification, `📐`); extracted 100% of inline interface and type declarations across all scripts into dedicated `*.interface.ts` files (zero inline interfaces remain in `.ts` scripts); decoupled and modularized scripts exceeding 300 lines down to SRP-focused components (`OutputCleaner` in `output-cleaner.ts`, `CreatorService` and `creator-service.interface.ts` in `server/`); shrunk `server.ts` from 385 to 254 lines and `stage-orchestrator.ts` from 328 to 236 lines; all files in `apps/papikapi-studio/scripts` are now strictly under 300 lines; enforced strict Clean Code standards (zero code comments, English-only, strict typing); verified `npm run check:build` 100% green across all 8 monorepo packages. (2026-10-01)

- [x] Papikapi Studio Trophy Plinth & Stage 2/3 Pipeline Renumbering (`apps/papikapi-studio`): implemented dedicated Trophy Plinth generation and artifact cleaning step (`s2-step-3` PLINTH, `scripts/stage-2/step-3-plinth.ts`, `fuse_plinth.py`, `trophy_plinth.py`); automatically eliminates detached spikes, whiskers, and floating flakes (`remove_disconnected_islands`), cleanly slices away the TRELLIS bottom slab (`cut_below`), and synthesizes an authentic trapezoidal base / pedestal spanning the full width and length of the figure as a trophy, fused seamlessly with the legs/paws into a 100% airtight, manifold mesh (`openEdges: 0, nonManifoldEdges: 0, airtight: true`); aligned the pipeline step numbering contract across Stage 2 (`s2-step-1` CUTOUT, `s2-step-2` 3D-GLB, `s2-step-3` PLINTH, `s2-step-4` KEY-PTS, `s2-step-5` TEXTURIZE) and Stage 3 (`s3-step-1` UNFOLD, `s3-step-2` SHEETS); updated `pipeline.json`, `project.json`, `stage-orchestrator.ts`, and `PIPELINE.md`; validated end-to-end on `pug` (plinth fused in 0.69s, reduced in 0.97s, textured in 5.36s, unfolded in 0.65s, and 21-page A4 PDF generated in 47.95s) and `bear` (plinth fused in 0.62s, reduced in 0.76s, textured in 4.85s, unfolded in 0.61s, and 20-page A4 PDF generated in 39.69s); verified `npm run check:build` 100% green across all 8 monorepo packages. (2026-10-01)

- [x] Papikapi Studio Pixel-Perfect PNG Texture Baking on Stage 3 Sheets (`apps/papikapi-studio`): verified end-to-end texture baking from TRELLIS original onto the simplified papercraft mesh (`step-5-texturize.glb`) and projection onto unfolded parts in A4 assembly sheets (`step-2-sheets.pdf` / `public/models/{model}/sheets.pdf`); fixed material null guard in `scripts/common/blender/baking.py` (`remove_metal`), fixed object ordering and name collision in `scripts/stage-3/blender/texture_pages.py` (importing source before target so meshes are not inadvertently merged), and configured `bake.use_clear = False` in `baking.py` to preserve pure `#FFFFFF` white page background instead of black; validated end-to-end on `bear` in 50.8s generating pristine 10.4 MB 20-page A4 PDF with printed textures, fold lines, and glue tabs; verified `npm run check:build` 100% green across all 8 monorepo packages. (2026-10-01)

- [x] Papikapi Studio: all 55 models rebuilt with plinth (2026-09-30): cutout keeps saturated coloured solids (plinth) that RMBG dropped; `scripts/common/glb/` trims the TRELLIS stretched slab after download (thin loose sheet removal, dominant plinth top, footprint + margin outline, flat bottom, closed walls); Stage 3 repairs the mesh before unfolding (`manifold_repair.py`) and `BlenderRunner` now surfaces the real Blender error; every model has `sheets.pdf` in `public/models/`. Audit: `s2-step-3` meshes are still not airtight in 45 of 55 (other session's work); Stage 3 closes the holes. Caches per pick (`step-1-art-pick-*-cutout.png`, `step-2-3d-pick-*.glb`) are reused by the steps: purge them before regenerating a model.

- [x] Papikapi Studio view, plinth and plinth trimming (2026-09-30): stage-1 cell prompts moved from TypeScript into `pipeline.json` (`cell_prompt_templates`, `view_clause`, `base_clause`), eye-level three-quarter view instead of isometric, the isometric phrase stripped from training captions, every figure stands on a low plinth; after TRELLIS, `scripts/common/glb/` trims the stretched slab into a flat closed plinth. Tested on `pug-test` only (tilt 0.0°, no dark ring). Open: the LoRA `papikapi_style_v1` was trained on isometric captions and still tilts the camera a little; the 48 models are not created yet; `pug-test` is a scratch model to delete.

- [x] Live Creation Progress & Receipt Loader (`libs/ibid-ui`, `apps/papikapi-studio`): `ProgressHub` (`scripts/common/progress-hub.ts`) collects the pipeline messages every step already logs (alternatives, pick, cutout, TRELLIS), keeps the last message per stage, and `GET /api/creator/progress?name=` streams them over SSE; `expected_seconds` per step lives in `pipeline.json`; `CreationProgressService` consumes the stream; `<papikapi-studio-process-loader>` is a small centred paper receipt (at most 80% wide, zigzag bottom edge): the head shows the percentage in the new `ibid-flip-text` atom (split-flap 3D digits that flip only when they change) and the clock in `ibid-folded-text`; each stage unfolds a new receipt section in 3D, finished stages keep a check mark and their final server message, the current stage shows the live message; percentage is per step, linear to 90% of each step then creeping, with one decimal after 90% overall; falls back to the local step timeline when no server event exists (`ReceiptStages`); temporary "Ver loader" button in the studio header must be removed once approved; `npm run check:build` green across all 8 packages. (2026-09-28)

- [x] Local Transparent Cutout (Stage 1: Step 1) & 3D Neural Synthesis (Stage 1: Step 2) (`apps/papikapi-studio`): restructured Stage 1 pipeline into two explicit decoupled steps: `s1-step-1` (Create Cutout, `CUTOUT`, `step-1-cutout.ts`) executing local neural segmentation with `briaai/RMBG-1.4` via `@xenova/transformers` and `canvas` (~1.5s, $0.00 cost) with connected component artifact filtering; eliminates 100% of background and floor contact shadows while preserving 100% of white facets/details without eroding animal bodies; outputs transparent RGBA PNG (`step-1-art-cutout.png` / `art-cutout.png`) cached per pick (`step-1-art-pick-{pick}-cutout.png`); and `s1-step-2` (3D Generation, `3D-GLB`, `step-2-trellis.ts`) providing transparent conditioned image to Microsoft TRELLIS with zero box/slab artifacts and granular per-pick GLB caching (`model-pick-{pick}.glb`); updated `pipeline.json`, `stage-orchestrator.ts`, `server.ts` (`/api/creator/pick` and `/api/creator/info`), `catalogue-manager.ts`, `project.json`, and root/app `package.json` scripts; verified 100% green compilation across all 8 packages via `npm run check:build` in 3.4s. (2026-09-26)

- [x] Automatic GPU Background Cutout & Transparent Alpha 3D Synthesis (`apps/papikapi-studio`, `apps/papikapi-studio/scripts/runpod`): implemented Option A architecture where Stage 0 (Pick) isolates the chosen cell and Stage 1 (TRELLIS) extracts GPU-accelerated background cutout via `rembg`, preserving full RGBA transparency; eliminates destructive `.convert("RGB")` in `apps/papikapi-studio/scripts/runpod/rp_handler.trellis.py` and returns both `glb_base64` and `cutout_base64`; updated `apps/papikapi-studio/scripts/stage-1/step-1-trellis.ts` and `step-2-pick.ts` to cache and synchronize `art-cutout.png` and `art-pick-{pick}-cutout.png` alongside `model-pick-{pick}.glb`; updated `apps/papikapi-studio/scripts/runpod/Dockerfile.trellis` and `setup_remote_trellis.sh` with `onnxruntime-gpu`; verified monorepo compilation `npm run check:build` 100% green across all 8 packages in 3.6s. (2026-09-26)

- [x] RunPod Direct SSH Deployment Architecture & CI Workflow Purge (`apps/papikapi-studio/scripts/runpod`, `tools/xbar`, `tools/ci`): transitioned serverless container management from GitHub Actions CI builds to direct RunPod SSH execution; deleted legacy `.github/workflows/build-runpod-workers.yml`, purged GitHub Actions serverless build and package links from `tools/xbar/ibid-runner.10s.sh` and `tools/ci/runpod-stats.mjs`; updated `apps/papikapi-studio/scripts/runpod/README.md` documenting the direct SSH compilation and disaster recovery flow; preserved `Dockerfile.trellis`, `Dockerfile.flux`, `rp_handler.trellis.py`, and `rp_handler.flux.py` with fully pinned dependencies (`kaolin`, `xformers==0.0.28.post1`, `spconv-cu120`, `pygltflib`) as reproducible disaster-recovery templates; confirmed monorepo compilation `npm run check:build` 100% green across all 8 packages in 3.9s. (2026-09-26)

- [x] TRELLIS Serverless Live GPU Verification & 3D Synthesis for Dalmatian & Sonic (`apps/papikapi-studio`, `apps/papikapi-studio/scripts/runpod`): successfully verified Microsoft TRELLIS neural 3D synthesis pipeline live on dedicated NVIDIA RTX 4090 GPU Pod (`hdzmi1dv35v94c`); diagnosed and resolved upstream xFormers 0.0.28+ `BlockDiagonalMask` deprecation (`xformers.ops.fmha.attn_bias`), forced sparse attention to `xformers` (`SPARSE_ATTN_BACKEND='xformers'`), and pinned PyTorch 2.4.0 CUDA 12.1 Kaolin / SpConv wheels; generated clean watertight 3D models for both `dalmatian` (1.1 MB `model.glb`) and `sonic` (1.3 MB `model.glb`), synchronized to `public/models/` and `resources/`; updated `apps/papikapi-studio/scripts/runpod/Dockerfile.trellis` and `apps/papikapi-studio/scripts/runpod/rp_handler.trellis.py` with the exact verified recipe and narrowed `TORCH_CUDA_ARCH_LIST="8.0;8.6;8.9"`; verified monorepo compilation 100% green across all 8 packages via `npm run check:build` in 1.2s. (2026-09-26)

- [x] RunPod Serverless Live Monitor & Cost Intelligence in macOS Menu Bar (`tools/xbar`): created `tools/ci/runpod-stats.mjs` integrating with RunPod GraphQL API and health endpoints; displays real-time account balance ($9.94 USD), scale-to-zero active spend rate ($0.00/s when idle), endpoint worker states (initializing, running, ready, unhealthy), per-second and per-model pricing ($0.00016/s for TRELLIS, $0.00 on Apple Silicon M4 for FLUX.2), and direct 1-click links to RunPod Serverless Console, billing, GitHub Actions serverless builds, and GitHub Container Packages; integrated `Papikapi Studio` into macOS menu bar projects list; verified 100% green compilation via `npm run check:build` in 0.7s. (2026-09-25)

- [x] RunPod Serverless Migration for FLUX.2 & TRELLIS (`Papikapi`): completed full migration from continuous HTTP-proxied RunPod GPU pods to dedicated RunPod Serverless Endpoints (`papikapi-trellis` and `papikapi-flux`) with Scale-to-Zero ($0.00 idle cost, billed strictly per second of active execution); developed independent container handlers and Dockerfiles (`rp_handler.trellis.py` / `Dockerfile.trellis` for `microsoft/TRELLIS-image-large` and `rp_handler.flux.py` / `Dockerfile.flux` for `black-forest-labs/FLUX.2-klein-4B`); implemented resilient TypeScript RunPod client (`RunPodClient` in `runpod-client.ts`) with `/runsync` execution, polling on `/status/{jobId}` for cold-starts, nested output unwrapping, and dynamic endpoint ID detection via `RUNPOD_TRELLIS_ENDPOINT_ID` and `RUNPOD_FLUX_ENDPOINT_ID`; refactored `TrellisGenerator` (`step-1-trellis.ts`) and `AlternativesGenerator` (`step-1-alternatives.ts`) to leverage serverless architecture with base64 image conditioning, dynamic cost accounting ($0.00016/s TRELLIS, $0.00015/s FLUX.2), and immutable manifest reporting; strictly verified zero `||` operators across scripts; passed `npm run check:build` 100% green across all 8 packages in 3.5s. (2026-09-25)

- [x] Complete Savanna/Safari Batch Generation with FLUX.2-klein-4B (`apps/papikapi-studio`): generated all 6 savanna animals (`safari`: `lion`, `elephant`, `giraffe`, `zebra`, `hippo`, `cheetah`) into `public/models/` and `resources/` based on ground truth references; each model includes 6 pristine unsevered 512x512 picks, seamless 1536x1024 3x2 alternatives sheet (`alternatives.jpeg`), default Pick #3 training parity (`art.jpeg` / `art-pick-3.jpeg`), and compliant manifests (`manifest.json`, `step-1-manifest.json`, `step-2-manifest.json`); confirmed 100% green compilation via `npm run check:build` across all 8 packages in 4.8s. (2026-09-25)

- [x] Complete `pipeline.json` Single Source of Truth & Zero-Hardcoding Enforcement (`apps/papikapi-studio`): completed total elimination of hardcoded filenames (`step-1-3d.glb`, `model.glb`, `step-1-art.jpeg`, `art.jpeg`, `alternatives.jpeg`), stage directory names (`stage-0`, `stage-1`), and pricing constants across all TypeScript backend/orchestration scripts (`server.ts`, `stage-orchestrator.ts`, `step-1-alternatives.ts`, `step-2-pick.ts`, `step-1-trellis.ts`, `catalogue-manager.ts`, `manifest-manager.ts`); removed 100% of fallback operators (`||`) across the entire `apps/papikapi-studio/scripts` codebase; added `local_processing_usd: 0.0`, `public_url_pattern`, `manifest_contract` to `pipeline.json` steps `s0-step-1`, `s0-step-2`, and `s1-step-1`; verified monorepo compilation `npm run check:build` 100% green across all 8 packages in 4.0s. (2026-09-25)

- [x] Strict `pipeline.json` Single Source of Truth & Zero-Fallback Elimination (`apps/papikapi-studio`): eliminated 100% of hardcoded fallback operators (`||`), inline default strings, and hardcoded messages across `step-1-trellis.ts`, `step-1-alternatives.ts`, and `step-2-pick.ts`; updated `pipeline.json` to be the absolute single source of truth declaring all engine parameters, runner metadata, console log templates (`start`, `progress`, `completed`, `cache_hit`), pricing, and the full `manifest_contract` structure written by `ManifestManager.writeStepResult`; completely purged all Gemini references from `pipeline.json` in favor of FLUX.2-klein-4B; regenerated `submarine` and `tractor` with verified 6 unsevered picks and seamless 3x2 alternatives sheets; stopped all background tasks cleanly; verified monorepo compilation `npm run check:build` 100% green across all 8 packages in 4.4s. (2026-09-25)

- [x] Authentic Papercraft Kinetic Origami Loader & 3D Stepped Progress Ribbon (`apps/papikapi-studio`): transformed `<papikapi-studio-process-loader>` using user-provided Dribbble design inspirations (Pedro Aquino's Google-style kinetic folding animation + Ruslan's 3D stepped isometric progress ribbon) re-imagined entirely in authentic papercraft cardstock; replaced spiky polyhedrons with an authentic 4-petal kinetic origami paper folding mechanism featuring diagonal mountain/valley score creases, dual-tone cardstock facets (amber, sky-blue, coral, mint with matching pastel underfolds), 3D hinge flips, and smooth cluster rotation; redesigned the progress tracker as an axonometric 3D folded papercraft zig-zag ribbon with physical isometric milestone pedestals (completed steps showing green papercraft blocks with score lines and checkmarks, active step elevated with sky-blue facets and a geometric folded paper crystal on top, and future steps showing cardstock fold guides), connecting leaping arc indicator, dotted paper fold path with floating timer/percentage pill, and live step description; eliminated all outer container boxes, borders, and blueprint grids in favor of a pure white drafting surface (`#ffffff`); verified monorepo compilation `npm run check:build` 100% green across all 8 packages in 3.5s. (2026-09-25)

- [x] Photorealistic Three.js Papercraft Origami Canvas Loader (`apps/papikapi-studio`): transformed `<papikapi-studio-process-loader>` into an authentic, tactile folded papercraft experience matching user specifications and reference art; replaced flat disconnected CSS polygon shards with a dedicated Three.js WebGL scene (`PerspectiveCamera`, `WebGLRenderer` with alpha transparency and high-DPI scaling) rendering a volumetric stellated origami polyhedron / kusudama (60 triangular paper facets with flat shading, `roughness: 0.94`, and an authentic matte paper cardstock palette of pastel mint, warm apricot, ivory, and chalk white); implemented real-time vertex breathing/morphing of the stellation apexes and smooth 3D tumbling rotation with soft ground contact shadow; redesigned frontal progress bar as an authentic physical strip of folded cardstock resting on the table with folded paper end-tabs, centerline 3D mountain crease dividing upper highlight from lower shade, forward-pointing diagonal origami fold tip, and soft contact drop shadow; refined stacked status typography (`0%`/`100%` bounds, 3-tiered vertical step hierarchy) with a multi-facet geometric origami crane SVG; styled seamless architectural drafting surface with subtle blueprint grid and zero outer card borders; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-25)

- [x] Full Canvas Loader Lifecycle, Vite Reload Suppression & Seamless 3D Transitions (`apps/papikapi-studio`): diagnosed and resolved the root cause behind the canvas loader disappearing or failing to trigger; disabled Vite WebSocket reloads by setting `"liveReload": false` and `"hmr": false` in `project.json` (`ws: false`), stopping Vite from triggering unwanted browser `window.location.reload()` cycles whenever the backend saves generated assets to `public/models/**`; eliminated premature `unlinkSync(publicPath)` in `TrellisGenerator` that caused 404s in Three.js `GLTFLoader` before the new GLB finished downloading; updated `preview` computed signal in `StudioPage` to cleanly unload the stage while 3D generation is in progress, ensuring `<papikapi-studio-process-loader>` renders uninterrupted with the rotating 3D origami polyhedron, live timer, and active steps; restarted server daemon cleanly on ports 4500 and 4502; verified end-to-end browser execution on `t-rex` pick 3 with 0 errors and verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)

- [x] Multi-Model Canvas Loading State & Independent In-Flight Generation Tracking (`apps/papikapi-studio`): positioned informative process loader directly on top of the 3D canvas (`.p-studio__canvas-loader` with frosted glass backdrop blur) so modal dialogs close immediately when selecting an uncached option; decoupled generation state by model into `Active3DGeneration` record (`modelName`, `pick`, `startedAt`), ensuring that if multiple models are in production concurrently, each maintains its own independent timer, active step, and progress bar; user only sees the loader over the canvas when selecting a model that is currently being generated; switching between models immediately shows their specific live state or their completed 3D mesh; enriched catalogue list with live `⟳ 3D...` indicators for both catalogued and in-flight models; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)

- [x] 3D Viewer Cache-Busting, Pick 2D/3D Icon Status & Pipeline Fixes (`apps/papikapi-studio`): resolved `ManifestManager.readStepResult` runtime failure that was blocking pick execution; added dynamic cache-busting revision signals (`previewVersion`) in `StudioPage` and `ModelViewer3DComponent` (`modelPath?v=...`, `art.jpeg?v=...`) to ensure Three.js GLTFLoader and browser caches immediately reload and display the new 3D model when switching options on the currently viewed figure; enriched 3x2 alternatives grid with prominent `🎨 Sem 3D` icon badges on pending cells (automatically removed when 3D is produced, replaced with `⚡ 3D Pronto` / `✓ Ativo`); added smooth micro-loader transition (600ms) on cached pick activations; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)

- [x] Pick-Specific 3D Model Caching & Instant Option Activation (`apps/papikapi-studio`): implemented granular per-pick 3D caching (`model-pick-${pick}.glb` and `step-1-3d-pick-${pick}.glb`) across `TrellisGenerator`, `AlternativePicker`, and `server.ts`; whenever a 3D model is generated for a chosen pick, the binary GLB and art are saved under their pick identifier; when choosing any pick that has already been generated, the remote RunPod GPU synthesis is completely bypassed, restoring the 3D model locally in ~50ms ($0.00 cost); added `cachedPicks` and `currentPick` detection in `/api/creator/info`; enriched `<papikapi-studio-model-creator>` grid with `⚡ 3D Pronto` / `Ativo` badges and instant `⚡ Ativar Opção (3D já gravado)` action; seeded all existing production models (`darth-cat`, `cheetah`, `bear`, `lion`, etc.); verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)

- [x] Informative Process Loader, Multi-Step Timeline & 3D Origami Visualizer (`apps/papikapi-studio`): created `<papikapi-studio-process-loader>` component with pure CSS 3D rotating origami polyhedron (`preserve-3d`), live elapsed timer and progressive percentage meter; designed interactive multi-step timeline (Stage 0: Prompt & reference analysis, Kirigami styling, 6-alternative synthesis, grid calibration; Stage 1: Option cropping, GPU neural cluster connection, 3D spatial reconstruction, watertight mesh & texture synthesis, studio 3D finalization); added rotating papercraft trivia cards ("Sabias que?"); integrated seamlessly into `<papikapi-studio-model-creator>` for both 3D generation and 6-alternative exploration with bilingual translations (PT/EN); configured `--watch` in `project.json` for `scripts/server.ts`; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)

- [x] Signature Style Architecture, Studio Model Management & Training Reference Auto-Conditioning (`apps/papikapi-studio`): codified studio signature aesthetic in `pipeline.json` (large cute round eyes with white catchlight reflection painted flat on facet, vibrant authentic papercraft palette matching references, simple foldable macro-volumes with zero black ink crease lines, and micro-details like teeth, whiskers, and spots painted as flat 2D surface UV textures); created `TrainingReferences` auto-resolution helper mapping 36 training reference images (`cats`, `dogs`, `dinosaurs`, `forest`, `safari`, `vehicles`); updated `stage-orchestrator.ts` and `server.ts` to automatically inject matching reference images when not provided; default pick set to #3 (signature training style); added `/api/creator/sheet` endpoint to eliminate 404 cache delays; implemented "Alterar Opção (Pick)" and "Apagar Modelo" in Studio UI and backend; regenerated and validated `cheetah`, `t-rex`, and `lion` production models with 0 incidents; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)

- [x] Concurrent Dev Server & API Lifecycle Orchestration (`apps/papikapi-studio`): reconfigured `papikapi-studio:serve` via `nx:run-commands` with `parallel: true` to launch both backend API server on port 4502 (`scripts/server.ts`) and Angular dev server on port 4500 (`serve-app`) in tandem; implemented robust signal handling (`SIGINT`, `SIGTERM`, `SIGHUP`, `disconnect`) and parent-PID watchdog timer in `server.ts` to ensure the API server terminates automatically whenever `nx serve` is stopped; added root shortcut `serve:papikapi-studio`; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)
- [x] Flat-Shaded Low-Poly Prompts, Visual Reference Conditioning (`--ref`) & Strict `nx run` Target Routing (`apps/papikapi-studio`): eliminated artificial solid black crease lines (`#000000`) in `pipeline.json` in favor of clean planar low-poly facets, natural directional lighting, and zero cartoon borders; added `--ref` flag in `stage-orchestrator.ts` and `AlternativesGenerator` supporting visual reference conditioning via Gemini API; fixed `imageConfig.aspectRatio` in `gemini-client.ts`; routed all commands strictly through `nx run papikapi-studio:stage:0:step:1` (and `stage:0:step:2`, `stage:1:step:1`) with `--args` expansion and root `package.json` shortcut scripts; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)
- [x] Kirigami 8-Model Production Batch Validation, Node Type Isolation & Full Documentation Synchronization (`apps/papikapi-studio`): executed Stage 1 TRELLIS 3D synthesis across 7 requested models (`bear`, `cheetah`, `dalmatian`, `giraffe`, `lion`, `police-car`, `t-rex`) plus `fox` on NVIDIA RTX PRO 4500 SE (~19s, ~$0.003 USD/model), verifying 100% clean watertight `.glb` output, immutable manifests, and index registration; purged legacy stage-0 and stage-1 artifact residue; isolated Node.js typing for server and CLI scripts via `tsconfig.scripts.json` and resolved all `node:path` TypeScript diagnostics; aligned modal accessibility using `<ibid-scrim>` atom in `studio.page.html` (passing strict template linting); fully synchronized product documentation across `PIPELINE.md`, `AGENTS.md`, and `qa-stages.md`; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)
- [x] Pure TypeScript OOP Architecture & Complete Python Abandonment (`apps/papikapi-studio`): eliminated 100% of legacy Python scripts, SVG geometry utilities, and `.mjs` files; rewritten the entire pipeline, orchestrator, and backend in modular, strictly typed TypeScript (classes with Single Responsibility Principle, zero comments, English-only): `WorkspacePaths`, `PipelineConfigLoader`, `GeminiClient`, `ImageCropper`, `ManifestManager`, `StageReporter`, `AlternativesGenerator` (`step-1-alternatives.ts`), `AlternativePicker` (`step-2-pick.ts`), `TrellisGenerator` (`step-1-trellis.ts`), `CreatorApiServer` (`server.ts`), and `StageOrchestrator` (`stage-orchestrator.ts`); updated `package.json` with `"type": "module"` and `tsx` execution; validated Stage 0 and Stage 1 with 0 incidents; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)
- [x] Kirigami 3D Creator UI, 3x2 Alternatives Grid & Pipeline Settings Integration (`apps/papikapi-studio`): reconfigured Stage 0 in `pipeline.json` with 100% of prompts, system prompt, aspect ratio, 3x2 grid layout, maturity progressions, and rules; implemented `step-1-alternatives-sheet.mjs` (Gemini axonometric alternatives) and `step-2-pick-art.mjs` (canvas cell cropping); created standalone backend API server (`scripts/server.mjs`) with proxy configuration (`proxy.conf.json`); created `<papikapi-studio-model-creator>` Angular component with prompt textarea, up to 3 optional photo references, interactive 3x2 grid selection, live progress timers, and automatic 3D TRELLIS generation; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)
- [x] Stage 1 TRELLIS 3D Generation & RunPod Cloud Deployment (`apps/papikapi-studio`): deployed Microsoft TRELLIS on remote RunPod GPU instance (NVIDIA RTX PRO 4500 Blackwell Server Edition, 32GB VRAM, sm_120, PyTorch 2.12 cu128 dev) with FastAPI server on port 8888 and public HTTPS proxy; created `scripts/stage-1/step-1-trellis.mjs` with live progress interval, compute cost accounting ($0.00016/s, $0.58/hr), and manifest aggregation; purged obsolete local python venv/weights (21 GB) and legacy pipeline stages (stages 2 and 3, old stage 1 steps 2-4); validated 3D mesh generation on `fox` generating 1.6 MB `step-1-3d.glb` in 22.9s with 0 incidents; verified monorepo compilation `npm run check:build` 100% green across all 8 packages. (2026-09-24)
- Migration of SavvyJar into `apps/oh-save-me`, with tests, E2E, Storybook, and native
  distribution.
- Rebrand to **Oh Save Me!** (PT: **Oh poupa-me!**), with the name per language in the
  `appName` translation key.
- Shared build engine in the `targetDefaults` of `nx.json`; tooling in `tools/`.
- `libs/testing` (`@ibid/testing`) holding the generic test engines.
- `oh-save-me` now consumes `ibid-ui`: 35 duplicated components removed, styles reduced to a
  single import.
- `ibid-header`, `ibid-header-nav`, and `ibid-scrim` extracted into the design system.
- Selector prefixes: `ibid-` for the library, `ohsaveme-` and `boilerplate-` for the apps.
  `app-` no longer exists anywhere.
- `apps/oh-save-me/src/app/ui/components/atoms/` no longer exists: every atom lives in
  `ibid-ui`. `category-select`, at 449 lines with domain models, was reclassified as a product
  molecule rather than promoted.
- Three Storybooks, with the products composing the design system into their sidebar.
- The boilerplate carries a showcase page rendering every component with its states.
- The boilerplate root route is a home page listing every colour and typography token, read from
  the live custom property on the body rather than copied, so it reports the active theme.
- Theme system in `libs/ibid-ui/src/themes/`: each theme is the stylesheet an app points at, and
  pulls in the generic ibid stack itself. `glass-surface` and `kirigami` exist; a theme is a body
  class, applied by `ThemeService`. Theme rules lead with `body.<theme>` so they outrank the
  Angular component stylesheets they skin.
- `ibid-currency-display` is now `ibid-feature-display`. The old selector and the old exported
  names are kept as aliases so `oh-save-me` compiles untouched.
- The boilerplate root route is a home page listing every colour and typography token of the
  design system, with the value read from the live CSS custom property rather than copied.
- [x] Pure token-driven architecture: eliminate `_surfaces.scss`, inject `--ibid-contour-edges` / `--ibid-contour-corners` via `HandDrawnDirective`, and encapsulate styling inside each atom/molecule/organism. (2026-09-03)
- [x] Refactor `SelectComponent` with Angular CDK Overlay, full hand-drawn pebble panel, uniform 38px height, and 8px anchor offset matching calendar. (2026-09-03)
- [x] Expand glass palette with pastel color variants (blue, green, red, purple, indigo, cyan, lime, gray) and map `FeatureDisplayComponent` states (informative/positive/negative). (2026-09-03)
- [x] Formalize design system `--z-*` stacking elevation tokens and eliminate ad-hoc z-index values across Header, Sidenav, and popovers. (2026-09-03)
- [x] Upgrade QA test runner (`tools/qa/`) with auto-project discovery for targeted journey execution (`npm run check:e2e -- <journey>`). (2026-09-03)
- [x] Rename theme from `glass-surface` to `sea-glass-pebbles`, eliminate Sass compiler interpolation warnings, and apply hand-drawn pebble contours across all pages (Dashboard, Movements, Budget, Database, Categories, Portfolio). (2026-09-04)
- [x] Style `m-budget-execution-summary` progress bars with organic hand-drawn pebble contours (`[ibidHandDrawn]="2"`), frosted sea glass transparency, and category dynamic color tinting. (2026-09-04)
- [x] Create `FeatureIconComponent` (`ibid-feature-icon`) atom with generous padding, pastel/category color tinting, and sea-glass pebble styling. (2026-09-04)
- [x] Create `ToggleTabsComponent` (`ibid-toggle-tabs`) molecule with sliding active pebble indicator, full keyboard navigation, and theme integration. (2026-09-04)
- [x] Configure Independent Package Versioning (Nx Release) across the monorepo: independent tags (`{projectName}-v{version}`), automatic changelog generation per package, `updateDependents: "auto"`, and updated CI/CD release workflows. (2026-09-04)
- [x] Fix Android Gradle 9 build deprecations (`jcenter` -> `mavenCentral`, `proguard-android.txt` -> `proguard-android-optimize.txt`) and verify automated APK generation (`dist/oh-save-me/*.apk`). (2026-09-04)
- [x] Configure Firebase Hosting multi-site on project `ibid-32cbe` (`ibid-ohsaveme.web.app`, `ibid-boilerplate.web.app`, `ibid-papikapi.web.app`), add package deploy scripts, and configure `FIREBASE_SERVICE_ACCOUNT` in GitHub Secrets for automated CI deployment. (2026-09-04)
- [x] Refactor macOS xbar plugin (`tools/xbar/ibid-runner.10s.sh`) to serve the entire `ibid-workspace` monorepo infrastructure: minimal `.i` template icon, local CI runner control, 1-click desktop (`.dmg`) and Android (`.apk` via USB/ADB) builds/installs, Firebase deploys, and Google Drive delivery sync. (2026-09-04)
- [x] Route CI (`ci.yml`) and automatic versioning (`auto-version.yml`) to the local self-hosted macOS ARM64 runner (`[self-hosted, macOS, ARM64]`) for $0.00 zero-cost builds, eliminate billable minutes, expand E2E server timeout to 600s with streaming output, and remove stale daemon data from cache. (2026-09-04)
- [x] Reorganize macOS xbar plugin with clean submenus (`Abrir ↗`, `Workspace`, `Projetos` at the bottom, runner controls before projects) and create dual-pane split TUI CI dashboard (`tools/ci/dashboard.sh`, `tools/ci/stream-logs.sh`) with full mouse drag-and-drop resize and independent pane scrolling. (2026-09-05)
- [x] Configure Monorepo Split architecture (Approach A): create 8 independent private repositories on GitHub (`oh-save-me`, `papikapi`, `boilerplate`, `ibid-ui`, `services`, `testing`, `utils`, `tools`), create `tools/ci/split.mjs` subtree synchronizer, add `.github/workflows/split.yml`, add npm scripts (`npm run split`), and wire into macOS xbar menu with direct links. (2026-09-05)
- [x] Implement Worktree & Sparse-Checkout Isolated Workflow across entire monorepo (`tools/workspace/worktree.mjs`): create dedicated worktrees in `~/Projects/` for all 8 components (apps: `oh-save-me`, `papikapi`, `boilerplate`; libs: `ibid-ui`, `services`, `testing`, `utils`; tools: `tools`) with cone-mode sparse-checkout, clean branch names, instant shared `node_modules`, zero disk bloat, and automated batch creation (`create-all`). (2026-09-05)
- [x] Diagnose and resolve Antigravity directive drop & context loss: configure native root `GEMINI.md` as Antigravity Executive Rules & Memory Sync Engine (mandating Turn 1 project memory sync from `.agents/current.md`), streamline `.agents/AGENTS.md` to eliminate silent 24KB prompt truncation, and align `.agents/GEMINI.md`. (2026-09-05)
- [x] Implement 1-click Auto-PR merge actions and full 8-worktree ecosystem (`tools/workspace/worktree.mjs`, `ibid-runner.10s.sh`): 1-click merge of individual worktree branches (`oh-save-me`, `papikapi`, `boilerplate`, `ibid-ui`, etc.) and `merge-all` directly into monorepo `main` from macOS menu bar or CLI (`npm run merge:all`, `npm run merge:<branch>`), with clean branch isolation and zero disk duplication. (2026-09-05)
- [x] Implement CI execution timing & task performance insights in xbar and CLI dashboard (`flow.mjs`): display last run duration, job/step breakdown, bottleneck identification, daily stats, and execution timers for local check tasks. (2026-09-05)
- [x] Conduct comprehensive Security & Privacy Audit on xbar runner: remediate AppleScript injection with safe argv passing, isolate temp cache to user-private 0700 directory (`$TMPDIR/ibid-xbar-$UID`), enforce project name allowlist (`validate_app`), and mask auth tokens in error outputs. (2026-09-05)
- [x] Purge redundant ignore rules workspace-wide: strip the root `.gitignore` of `apps/*/platforms/**` rules made inert by the submodule migration and of patterns subsumed by `*.log`, `dist` and `coverage/`; replace the verbatim root-file copy in `tools/workspace/setup-submodules.mjs` with `tools/workspace/package-gitignore.mjs`, which composes a package-shaped file from the structural `apps/` vs `libs/` split; regenerate all 7 submodule copies; extend `no-empty`/`allowEmptyCatch` to `.mjs` in `eslint.config.mjs`; reclaim 2.1 GB from `tmp/submodule-backup`. (2026-09-05)
- [x] Configure 100% solid opaque black Terminal profiles (`Clear Dark` and `Pro` with alpha 1.0, 0.0 blur) in macOS preferences to eliminate window transparency and background bleed on the CI dashboard. (2026-09-05)
- [x] Migrate monorepo to Git Submodules Container Orchestrator architecture: isolate `apps/oh-save-me`, `apps/boilerplate`, `apps/papikapi`, `libs/ibid-ui`, `libs/services`, `libs/testing`, and `libs/utils` as independent submodules tracking remote `main`, enabling isolated single-repository management in GitHub Desktop with zero folder duplication. (2026-09-05)
- [x] Implement Smart 1-Click Deploy & Release pipeline in xbar (`tools/ci/deploy-pipeline.mjs`): automated pre-flight checks, semantic version calculation, release commit/PR generation, submodule pointer synchronization, and direct Firebase/GitHub publishing. (2026-09-05)
- [x] Add 1-click GitHub Desktop switchers per project in macOS xbar (`Projects ➔ [App] ➔ 🖥 Open in GitHub Desktop`) and submodule batch synchronization actions (`submodule-update`, `submodule-push`, `submodule-status`). (2026-09-05)
- [x] Propagate `.gitignore` to all 7 Git Submodules with unanchored ignore paths for mobile platforms, build artifacts, and environment secrets. (2026-09-05)
- [x] Eliminate disabled gray text styling in macOS xbar: remove thin Menlo font and tiny size, wire interactive actions (`bash=/usr/bin/open ...`) into all CI status lines, benchmark stats, and runner status entries to ensure 100% solid, crisp native typography. (2026-09-05)
- [x] Commit and push initial `.gitignore` and code changes across all 7 independent repositories (`papikapi`, `boilerplate`, `ibid-ui`, `services`, `testing`, `utils`, `oh-save-me`) and update root container `ibid-workspace` on remote `main` (zero co-authorship trailers, pure user identity). (2026-09-05)
- [x] Repair CI under the submodule architecture: every `actions/checkout` that needs source now
  fetches `submodules: recursive` with `RELEASE_TOKEN` (the 7 submodules are private, so the
  default `GITHUB_TOKEN` cannot read them), and `tools/ci/verify-submodules.mjs` fails the run
  when any submodule is empty instead of letting Nx report success over an empty graph. (2026-09-05)
- [x] Keep `nx release` as the versioning engine under submodules, through
  `tools/ci/release.mjs`. Nx cannot drive git here: it writes `package.json` and `CHANGELOG.md`
  inside submodule working trees and the container cannot stage them (`git add` exits 128), and
  its conventional-commit resolver never attributes a gitlink-only commit to its project, so
  every bump came out as a meaningless patch with an empty changelog. Nx now runs with
  `release.version.git` disabled and receives the specifier read from each submodule's own
  history (`tools/ci/conventional-commits.mjs`); it still resolves versions and dependent
  ranges. The orchestrator commits and tags `v{version}` inside each submodule, then records the
  pointers and tags `{projectName}-v{version}` on the container, which is what `release.yml`
  fires on. Verified end to end against a throwaway Nx workspace with a real submodule and bare
  remotes. (2026-09-05)
- [x] Restore the CI Nx cache, which had never been used: `setup-workspace` moved
  `NX_CACHE_DIRECTORY` outside the workspace but left `NX_WORKSPACE_DATA_DIRECTORY` at its default
  `.nx/workspace-data`, which `actions/checkout` deletes on every job because `.nx/` is gitignored.
  The artifacts survived and the database describing them did not, so Nx reported
  `Unrecognized Cache Artifacts` and re-ran everything. Measured on a throwaway cache: same
  artifacts with a fresh database gave 0/1 hit, the two paired gave 1/1. (2026-09-05)
- [x] Give `papikapi` the same device pipeline as `oh-save-me`, and stop the engine being written
  twice: the six `desktop*` and `mobile*` targets moved from `apps/oh-save-me/project.json` into
  the `targetDefaults` of `nx.json`, parameterised with `{projectRoot}` and `{projectName}`, so
  both apps declare them empty and inherit. `papikapi` gained a Capacitor Android project and a
  Tauri desktop project, aligned to Gradle 9.5.0 and AGP 9.3.1 (the fresh Capacitor scaffold came
  with 8.14.3, which cannot run on the installed Java 25) and carrying the same
  `proguard-android-optimize.txt` fix. `tools/ci/release-target.mjs` derives the targets from the
  filesystem, so it now reports `has_android` and `has_desktop` for `papikapi` with no workflow
  edit. The xbar menu gained the five device actions for it. (2026-09-05)
- [x] Make a broken release stop instead of grinding on: `tools/ci/stop-release.mjs`, wired into
  every delivery job through the `stop-release` composite action, annotates the failing job and
  step, writes what was already delivered and what will not run into the job summary, and cancels
  the rest of the run. Found because `boilerplate-v0.1.5` failed on `Deliver · Storybook` with
  `could not find site "ibid-storybook"` and the run carried on regardless for another six
  minutes. (2026-09-05)
- [x] Publish the design system Storybook on every `boilerplate` or `ibid-ui` release rather than
  only on `boilerplate`, so the page reflects the library whichever of the two moved. The
  `ibid-storybook` Firebase site still has to be created for the deploy to succeed. (2026-09-05)
- [x] Create the `ibid-chip` and `ibid-textarea` atoms in `ibid-ui`, with story and spec, so the
  `papikapi` diary page compiles. Its `mvp` branch already consumed them from the library, which
  is where an element is born; the build was red only because they had never been written.
  (2026-09-05)
- [x] Stop the release commit from re-running CI: the `chore(release)` commit the orchestrator
  pushes only carries version bumps and submodule pointers that CI already verified, yet it
  queued a full verify plus the whole E2E suite on the single self-hosted runner. `ci.yml` now
  skips it the way `auto-version.yml` already did, and the run still reports green because
  `findBrokenJobs` counts a skipped group as passed. (2026-09-05)
- [x] Disarm the monorepo split: `tools/ci/split.mjs` refuses any prefix that is a gitlink, and
  `split.yml` lost its automatic trigger. A subtree split now resolves to the pre-migration
  snapshot and would have force-pushed it over all 7 standalone repositories. (2026-09-05)
- Workflows: `ci.yml`, `release.yml`, `split.yml` with multi-project tagging and upload to Google Drive.
- [x] Replace the Papikapi Studio generator with a Blender multi-agent pipeline. The whole
  in-app generation stack is gone — `figure-wire`, `figure-unfolder`, `figure-fold-rig`,
  `plate-geometry`, `rigid-transform`, `figure-svg`, the hardcoded `tyrannosaurus`, the Gemini
  service with its prompt and response schema, the PDF/SVG exporter, the lab page and its
  runs, and the dev-server proxy that carried the API key into a served asset. Geometry now
  comes from headless Blender: `apps/papikapi-studio/scripts/common/blender/` holds a `studio` API whose four tiers
  (4-6 blocks, 7-9 wedges, 10-12 low-poly, 13+ high density) are enforced at build time rather
  than suggested in a prompt, welds every part with a boolean `EXACT` union, and refuses any
  mesh carrying one of thirteen offender classes — the epsilons match Export Paper Model's own
  `check_correct`, so a clean report means the unfolder will accept it. `apps/papikapi-studio/scripts/common/mcp/`
  is a stdio MCP server exposing nine tools over that runtime; `.agents/mcp_config.json`
  registers it. Three agent skills replace the old eight: `kirigami-director` fixes the tier
  and names the parts, `kirigami-physicist` writes millimetres, mass and weld overlaps, and
  `kirigami-gem-modeler` writes the Python. The app is now purely the viewer: it reads
  `uploads/gallery.json` and renders the published GLB with three.js, linking one printable
  PDF per welded part. `npm run check:kirigami` proves all four tier examples weld clean and
  unfold. Also restored the `libs/ibid-ui/assets` entry the app's `project.json` had dropped,
  which was 404ing every icon. (2026-09-07)

## Papikapi Studio — Architecture & Pipeline

Papikapi Studio transforms text prompts and optional visual reference images into 3D low-poly papercraft figures (`.glb`) through an interactive Angular UI and an automated pipeline (Stages 0, 1 and 2, the last one not yet run).

### Architectural Principles

* **Pure TypeScript OOP**: 100% of legacy Python, Blender, and `.mjs` scripts eliminated. Every module adheres to Single Responsibility Principle, zero code comments, and strict TypeScript types.
* **Declarative Pipeline Config**: 100% of pipeline parameters (prompts, aspect ratio, models, GPU endpoints) reside in `pipeline.json`.
* **Nx Target Execution**: All tasks execute strictly via Nx (`nx run papikapi-studio:...`).
* **Clean Pre-Execution**: Each stage/step automatically purges its previous output files before generating new artifacts (`cleanOutputs`).
* **Audited Accounting**: Every execution produces an immutable step manifest with duration, cost in USD, and device metadata.

### Pipeline Stages

1. **Stage 1: 3D Papercraft Figure Alternatives & Selection**
   * **Step 1 (`s1-step-1`)**: `scripts/stage-1/step-1-alternatives.ts`
     * Engine: Google Gemini multimodal image generation (`gemini-3.1-flash-image`).
     * Visual Conditioning: Supports `--ref` to condition generation on existing art/photos, faithfully preserving pose, proportions, markings, and expression.
     * Style: Clean planar low-poly facets, natural directional lighting, flat shading, and zero solid black crease lines (`#000000`).
     * Output: `resources/<model>/stage-1/step-1-alternatives.jpeg` (3×2 grid showing 6 maturity variations) and `step-1-manifest.json`.
   * **Step 2 (`s1-step-2`)**: `scripts/stage-1/step-2-pick.ts`
     * Engine: Pure Node Canvas cropping (`scripts/common/image-cropper.ts`).
     * Input: `step-1-alternatives.jpeg` + cell number (`1..6`).
     * Output: `resources/<model>/stage-1/step-1-art.jpeg` and `public/models/<model>/art.jpeg`.

2. **Stage 2: 3D Model Generation**
   * **Step 1 (`s2-step-1`, CUTOUT)**: `scripts/stage-2/step-1-cutout.ts`
     * Engine: local `briaai/RMBG-1.4` through `@xenova/transformers` and `canvas`, about 2 s, $0.00.
     * Output: `resources/<model>/stage-2/step-1-art-cutout.png` (transparent RGBA) and `step-1-art-pick-{pick}-cutout.png`.
   * **Step 2 (`s2-step-2`, 3D-GLB)**: `scripts/stage-2/step-2-trellis.ts`
     * Engine: Microsoft TRELLIS (`microsoft/TRELLIS-image-large`) on RunPod Serverless (RTX 4090 worker, scale to zero, $0.00031/s active).
     * Input: the transparent cutout. Performance: about 25 s per model.
     * Output: `resources/<model>/stage-2/step-2-3d.glb`, `step-2-3d-pick-{pick}.glb`, `public/models/<model>/model.glb`, `model-pick-{pick}.glb` and `step-2-manifest.json`.
   * `scripts/stage-2/step-1-trellis.ts` is a leftover from the one-step Stage 2: nothing imports it and `pipeline.json` no longer lists it.

   * `s2-step-3` KEY-PTS (`scripts/stage-2/step-3-key-points.ts`, Blender headless): simplification of the 3D model to key points, rules in PIPELINE.md.

3. **Stage 3: Papercraft Unfolding** (`s3-step-1` UNFOLD, `s3-step-2` SHEETS): see "Stage 3" below.

### Service & UI Integration

* **Backend API Server**: `scripts/server.ts` listening on `http://localhost:4502`, providing endpoints for the Studio web interface:
  * `POST /api/creator/generate`: Generates the 3×2 alternatives grid.
  * `POST /api/creator/pick`: Crops the chosen figure and triggers automatic 3D TRELLIS generation.
  * `GET /api/health`: Health status of the API bridge and remote GPU server.
* **Angular Studio Frontend**:
  * `<papikapi-studio-model-creator>` modal with prompt input, visual reference photo uploads, interactive 3×2 grid alternative selector, and real-time generation timers.
  * Three.js 3D viewer rendering the resulting `.glb` with interactive orbit controls and papercraft inspection.

### Everyday Commands

```bash
# Start backend API server
nx run papikapi-studio:server

# Start Angular Studio frontend
npm start -- papikapi-studio

# Pipeline Step 1 (Stage 1): Generate alternatives with visual reference
nx run papikapi-studio:stage:1:step:1 --model=cheetah --ref=resources/cheetah/stage-1/step-1-art.jpeg --prompt="A cute baby cheetah cub sitting down, identical pose and spots, clean low-poly papercraft facets without black crease lines"

# Pipeline Step 2 (Stage 1): Pick alternative cell (e.g. 4)
nx run papikapi-studio:stage:1:step:2 --model=cheetah --pick=4

# Pipeline Step 1 (Stage 2): Transparent cutout of the picked art
nx run papikapi-studio:stage:2:step:1 --model=cheetah

# Pipeline Step 2 (Stage 2): Synthesize 3D mesh via RunPod GPU
nx run papikapi-studio:stage:2:step:2 --model=cheetah
```

### Stage 3 — papercraft booklet (rebuilt and run 2026-10-01)

Rules in `apps/papikapi-studio/PIPELINE.md`. The Export Paper Model extension is no longer used.

- `s2-step-3` simplifies the original TRELLIS mesh by fusing vertices at their midpoint under a shape guard
  (1.2% tolerance), so ears, snouts and legs survive; bear 191 vertices / 289 faces, closed.
- `s3-step-1` flattens quads, scales to 300 mm and unfolds with its own algorithm into compact parts numbered in
  assembly order (`step-1-net.json`).
- `s3-step-2` renders one Blender image per step and builds the booklet with pdf-lib: cover, step pages with 3D
  render and glue edges, template sheets nested by shape. Texts in `scripts/stage-3/sheet-translations.json` (pt/en).
- Run and checked page by page: bear 31 parts / 9 sheets, brachiosaurus 24 / 4, blue-eyed-pug 47 / 11, all with
  0 overlapping numbers.
- Open: the bear still needs about 230 glued edges, which is a medium-difficulty build.

**Colour and plinth (2026-10-01, run on `cheetah` and `bear`, checked by Blender renders and rasterised PDF pages).**
Stage 2 is now: `s2-step-3` BASE (cuts the TRELLIS plinth, feet on z=0 centred at 0,0) → `s2-step-4` SIMPLIFY (reduce) →
`s2-step-5` TEXTURIZE (art PNG projected on the faces facing the recovered camera, TRELLIS texture on the hidden ones,
Cycles bake with a smooth cage into a per-face-island atlas) → `s2-step-6` PLINTH (white trapezoidal plinth with the
footprint of the figure, fused to the feet on the reduced mesh and on the textured GLB). The plinth only exists after
the texture step, so texturize never considers one. Stage 3 unfolds `step-6-plinth.json`; the sheet colour comes from a
Cycles bake done after nesting (UV = placement on the sheet, 200 dpi, 1.5 mm bleed), drawn 1:1 under the vector lines.
No `.blend` file is written any more (the net JSON carries the repaired mesh).

**Texture, generic version (2026-10-01 evening).** `s2-step-5` now does "TRELLIS decides where, the art decides how it
looks": art camera ranked among candidate views by colour agreement with TRELLIS (settles front/back), dense optical flow
(OpenCV in the system Python, `scripts/stage-2/python/art_flow.py`, smoothed so it moves elements without bending them),
4x enlarged art, and mirroring of the frontal faces onto the hidden side through a vertical symmetry plane searched on
the mesh and validated by colour agreement (off for asymmetric figures such as mario). Checked by renders on cheetah,
bear, owl, zebra, creeper, mario and fire-truck. `s2-step-3` also copes with a TRELLIS plinth that is a separate island
(fire-truck). The cheetah experiments in `tools/scratch/` (hard-coded coordinates, hand-drawn eyes and spots) are not part
of the pipeline and are superseded. Open: only cheetah, bear, owl, zebra, creeper, mario and fire-truck were re-run with
this version (stage 3 sheets not rebuilt for them), the other models still carry the previous texture; hidden faces whose mirror image is
not frontal keep the darker TRELLIS colours; donkey-kong still has no GLB (RunPod worker problem, endpoint restricted to
CUDA 12.0-12.4 on 2026-10-01); the old `step-3-reduce.*` and `step-3-plinth.glb` leftovers are obsolete.

```bash
npx nx run papikapi-studio:stage:3 --model=bear
```

## Next

1. Commit the container changes and push, so `CI` runs with the submodules checked out.
2. Watch that run: it must take minutes, not seconds, and name all 7 projects. A run that ends
   in under a minute means the submodules did not check out.
3. `auto-version` then releases whatever has releasable commits. The versions come from each
   submodule's own history, so a project only moves when its own repository moved.
4. Encapsulate `m-budget-actions-banner__fab` into `ibid-sticky-fab`.

## Third app: `papikapi` — Phase 0 done, the app runs

`apps/papikapi/` holds `PRD.md` (product context, lineage, technical plan), `MVP.md`
(scope, acceptance and the batch plan) and, at the workspace level, the product rules in `AGENTS.md`.

**Phase 0 delivered 2026-09-03**, 37 files, `lint test build` green across all 7 projects,
5 Playwright tests passing including the accessibility audit, Storybook building. Ports 4400
serve, 4401 e2e, 6008 Storybook.

Decisions taken on the agent's recommendation, with no objection raised: **positive only** (no
valence on `Rule`), and **six behaviour domains** — Autonomia, Escola, Casa, Afetos, Corpo,
Calma — one branch per domain. **One device** for the MVP; Drive sync and the child device are
Phase 2.

The theme is applied through `providePapikapiTheme()` in `theme.config.ts`, which bundles the
config token with an environment initializer. `ThemeService` paints on construction, so an app
without a theme picker has to instantiate it deliberately — the boilerplate gets this for free
only because its header injects the service.

**MVP redesigned 2026-09-04, mobile only.** Two screens, one profile switch in the header.

- **Child screen** — one large folded figure, the domain closest to its next fold. Real paper
  depth: every facet carries a drop shadow, tones are four mixes of one muted hue against a warm
  paper white, and what is still to fold shows as a faint ghost rather than dashed outlines.
  Below it a tray of the five figures; tapping one makes it the hero. Fits the viewport with no
  scroll.
- **Diary screen** — write a sentence, the on-device assistant proposes **several domains with
  points** (`Família +3  Tarefas +3`), and the parent confirms or overrules with chips. Only an
  overruled reading teaches the vocabulary.

**Five domains**, in a parent's language: Comportamento, Tarefas, Escola, Conversas, Família —
one folded figure each (leaf, house, plane, bird, heart).

97 unit tests, 10 Playwright tests (mobile only), accessibility clean, `lint test build` green
across 7 projects.

**Design fixes that were real defects:**

- `cut-paper` in the kirigami theme drew a fold gradient across every surface, which read as a
  stain. Replaced with soft sheet lighting from the top-left.
- `ibid-chip` and `ibid-textarea` referenced `--color-accent`, which does not exist; the fallback
  to `currentColor` made a selected chip white text on a white ground. Both now use `--color-ink`.
- The kirigami theme paints primary buttons in solid blue. Papikapi overrides them to ink on paper.
- `<ibid-header>` took 49px of flow while its shell is `position: fixed`, so the header was
  counted twice and the child screen overflowed. Papikapi zeroes its height.
- Muted small text used `opacity`, dropping contrast to 3.9:1. Replaced with a defined muted ink
  and larger minimum sizes.
- Origami SVGs inside already-labelled buttons now render `aria-hidden` instead of unnamed
  `role="img"`.

**Cut to keep the design tight:** the abstract tree scene, the prize shelf grid, the per-domain
page, and the tablet/desktop test profiles. The child/parent split has no PIN yet — the header
switch is open.
## Open (Papikapi Roadmap: Voice-First, ML Points & NestJS Server)

### Tranche 1: Voice-First & Tradução Silenciosa
- [x] **US1 — Voice-to-Prompt para Figuras Origami (Concluído na UI):**
  - Ditado de voz com controlos (**Gravar**, **Parar**, **Aceitar**) e sessão aberta até 60 segundos.
  - Transcrição apresentada na língua do utilizador (PT) para revisão sem atrito.
  - Tradução silenciosa para inglês canónico com invariantes de estúdio executada estritamente no momento do envio (`createModel`).
- [ ] **US2 — Voice-to-Text para Registo de Comportamentos (Área dos Pais):**
  - Entrada de voz em linguagem natural no ecrã dos adultos (ex: *"arrumou os brinquedos e ajudou a pôr a mesa sem birra"*).
  - Sem necessidade de selecionar caixas de categorias manuais.

### Tranche 2: NLU, Pontos e Machine Learning Adaptativo
- [ ] **US3 — Extração Canónica NLU (PT -> Ação + Modificadores em EN):**
  - O motor de NLU analisa a frase falada e extrai a estrutura canónica:
    - `domain`: `chores` | `behaviour` | `school` | `talking` | `family`
    - `action`: `clean_toys`, `set_table`
    - `modifiers`: `spontaneous: true`, `attitude: positive`
- [ ] **US4 — Motor Determinístico de Pontos com Guardrails:**
  - Atribuição transparente de pontos base com limites (*bounds*) estritos contra inflação desmedida e garantia de progressão consistente.
- [ ] **US5 — Calibração Adaptativa dos Pais (Loop de ML On-Device / Server):**
  - Sempre que os pais ajustam ou corrigem manualmente a pontuação sugerida, o modelo recalibra os pesos dos modificadores para aquela criança, aprendendo as preferências e o rigor de cada família ao longo do tempo.
- [ ] **US6 — Experiência de Auto-Commit de 3 Segundos:**
  - Ao registar a ação por voz, a pontuação é calculada e surge uma contagem decrescente de 3 segundos para confirmação automática, com botão de "Desfazer / Ajustar" para zero atrito.
- [ ] **US7 — Feedback em Tempo Real na Montagem 3D (Shelf & Pips):**
  - Os pontos ganhos refletem-se instantaneamente na animação de dobragem das peças da figura em construção na prateleira.

### Tranche 3: Arquitetura & Backend Centralizado (NestJS)
- [ ] **US8 — Criação do `papikapi-server` (NestJS) no Monorepo Nx:**
  - Novo projeto `apps/papikapi-server` baseado em NestJS.
  - Endpoints REST e WebSockets/SSE para:
    - `/api/creator/generate` (Geração de alternativas FLUX / Gemini)
    - `/api/creator/pick` (Seleção de modelo e desdobramento papercraft)
    - `/api/creator/progress` (Streaming de progresso em tempo real)
    - `/api/translation` (Tradução e canonicalização)
    - `/api/classifier` (NLU e inferência de pontos para US3 e US5)
- [ ] **US9 — Migração e Desacoplamento do `papikapi-studio`:**
  - Extração de todo o código Node/Express embutido no `papikapi-studio` para o `papikapi-server`.
  - O `papikapi-studio` passa a ser puramente uma SPA de inspeção e edição 3D/UV, comunicando com o `papikapi-server`.
- [ ] **US10 — Modo Autónomo / Offline Fallback no `papikapi`:**
  - O `papikapi` funciona a 100% mesmo quando o `papikapi-server` está desligado: cria figuras locais, gere pontos no RxDB, e sincroniza assim que a ligação ao servidor for restabelecida.

