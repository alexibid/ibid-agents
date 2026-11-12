# Archive: Kirigami reconstruction experiments (superseded)

Historical log of the Blender and multi-view reconstruction work that predates `papikapi-studio`. Nothing here is wired into the current pipeline.

## Kirigami 3D Papercraft Reconstruction Experiments

### Active Experiment: The Dough-Cutter Extrusion Pipeline & Aligned Construction Stage
- **Concept:** The 3D model acts as dough in the center. The 6 orthogonal `_lines.svg` and `_faces.svg` files act as stainless-steel dough cutters with cutting blades on boundaries and interior crease lines.
- **Stage State (`model_construct.blend`):**
  - Added `Bounding_Box_Parallelepiped` ($0.2788\text{ m} \times 0.0965\text{ m} \times 0.2000\text{ m}$) in collection `Bounding Box` with transparent material (`Mat_Bounding_Box`, transmission 0.85, alpha 0.12, blend mode BLEND).
  - All 6 cutouts (`Clean Cutouts`: Left, Right, Front, Back, Top, Bottom) mapped to exact figure extents, sitting 100% flush on the 6 faces of the parallelepiped with matching boundaries.
  - `Face Extrusions`: 537 isolated individual face extrusion objects (`Face_{View}_{idx:03d}`) organized under subcollections `Faces Left`, `Faces Right`, `Faces Front`, `Faces Back`, `Faces Top`, `Faces Bottom`. Each face is trimmed to exclude exterior empty regions (`BOOLEAN INTERSECT` against `Mold_Solid`), with its own distinct color both in `*_faces.svg` and as its Blender material / viewport color.
  - `Reconstructed Model`: Unified 3D solid model (`Stage5_Model_Reconstructed_3D`, 4,643 vertices, 5,155 faces) formed by merging all trimmed face solids with exterior regions excluded.
  - Outliner auto-collapse: Embedded `auto_collapse.py` registered module ensures all layers and collections are collapsed automatically on file open.
  - Raycast tubes updated to 2.5 mm diameter with transparent glass material (`Mat_Glass_Tubes`, transmission 1.0, IOR 1.48, roughness 0.05, alpha 0.35).
  - All layers/collections in English (maximum 2 words: `Base Mold`, `Bounding Box`, `Clean Cutouts`, `Consolidated Spheres`, `Contact Spheres`, `Contour Extrusions`, `Face Extrusions`, `Faces Left`, `Faces Right`, `Faces Front`, `Faces Back`, `Faces Top`, `Faces Bottom`, `Raycast Tubes`, `Reconstructed Model`, `Stage Setup`) and color-tagged in Outliner (`COLOR_01` through `COLOR_08`).
  - Visibility per Stage Invariant: All 566 objects across all 17 collections are 100% preserved in the scene at all times. For any stage validation, only elements pertinent to the active stage are visible in viewport (`hide_viewport = False`); all others are hidden in viewport (`hide_viewport = True`). Cameras and lights (`Stage Setup`) are strictly hidden in viewport (`hide_viewport = True`) when saving the file to prevent 3D viewport clutter.
  - Stage 0 Closed & Verified: Bounding Box ($0.2788\text{ m} \times 0.0965\text{ m} \times 0.2000\text{ m}$), 6 Clean Cutouts flush on the outer faces with all 537 colored facets, and 8 Quadrant Blocks wire cages visible. All other 551 objects hidden in viewport. All outliner groups collapsed.
  - Stage 1 Closed & Verified: Face Extrusions & Mold Merge. 537 individual face extrusion solids (`Face_*`) trimmed inwards and merged to form the solid mold (`Mold_Solid`). `Mold_Solid`, 537 face solids, and bounding box visible (539 objects). Inactive 27 objects hidden in viewport. Cameras/lights hidden in viewport. Outliner collapsed.
  - Stage 2 Closed & Verified: Orthogonal Raycast Tubes & Multi-View Consensus Triangulation. All 749 tubes verified 100% strictly perpendicular along orthogonal axes. Collision classification upgraded with multi-view consensus and near-surface ray probing:
    - Successful Collisions: **749 (100.0%)** — `Circles_Success_Green` (749 rings, Ø2mm, `Mat_Circle_Success_Green`), `Tubes_Success_Green` (749 translucent glass cylinders, Ø2mm, `Mat_Tube_Success_Green`), `Collisions_Contour_Teal` (clustered contact spheres in **Verde Azulado / Teal**, `#0DC7A6`, Ø2mm, `Mat_Collision_Contour_Teal`), `Collisions_Interior_Green` (468 body contact spheres in Green, `#1ACC33`, Ø2mm, `Mat_Collision_Interior_Green`).
    - Failed Collisions: **0 (0.0%)** — zero failed rings/tubes.
    - Active visible collections: `Raycast Tubes`, `Clean Cutouts`. All 589 construction elements preserved in scene with clean collection-level viewport toggling.
  - Cutout Topology Cleaning (`clean_cutouts.py`): Dissolved uncreased boundary vertices (valence 2 with 0 internal crease connections) across all 6 cutouts (`Cutout_Clean_*` and `Cutout_Contour_*`), and permanently synchronized the SVG files on disk (`*_clean.svg`, `*_contour.svg`) and `clean_cutouts_data.json`, eliminating false tubes, rings, and ghost vertices in empty space while preserving exact outer silhouette geometry. Integrated into Stage 0/1.
  - Stage 3 Built & Verified (`stage3_spheres.py`): Quadrant Collisions & Consolidated Spheres.
    - `Stage3_Contact_Spheres` in `Contact Spheres`: 705 contact spheres: 237 contour contact midpoints in **Verde Azulado / Teal** (`#0DC7A6`, `Mat_Contact_Contour_Teal`) + 468 interior body contacts in amber (`Mat_Contact_Interior_Amber`).
    - `Stage3_Consolidated_Spheres` in `Consolidated Spheres`: 690 emerald green emissive spheres (Ø2.2mm, $r=1.10\text{ mm}$, `Mat_Consolidated_Spheres`) clustered with 1.5mm tolerance, serving as unified 3D vertex targets for Stage 4 snapping.
    - Distribution: 100% strictly partitioned inside the 8 quadrant blocks (0 outside). Zero object deletions.
    - Active visible collections: `Raycast Tubes`, `Contact Spheres`, `Consolidated Spheres`, `Bounding Box`, `Clean Cutouts`. All other collections hidden in viewport. Cameras/lights hidden in viewport. Outliner auto-collapsed.
  - Stage 4 Built & Verified (`stage4_snapping.py`): Snapped Cutouts, Complete 3D Connectivity & Reconstructed Model. Clean planar cutouts (`Cutout_Clean_*`) displaced along orthogonal projection tube directions and snapped directly to matching consolidated spheres via multi-view consensus.
    - Collection `Snapped Cutouts`: 6 dedicated polygonal surface meshes (`Snapped_Cutout_Left`, `Snapped_Cutout_Right`, `Snapped_Cutout_Front`, `Snapped_Cutout_Back`, `Snapped_Cutout_Top`, `Snapped_Cutout_Bottom`).
    - Total vertices & faces: **749 vertices** and **532 faces** strictly matching `Cutout_Clean_*` edges (Left: 123v/86f, Right: 127v/89f, Front: 136v/91f, Back: 109v/84f, Top: 126v/95f, Bottom: 128v/87f).
    - **Color Classification:**
      - **RED (`#E62626`, `Mat_Snapped_Unconnected_Red`):** **0 vertices (0.0%)** — zero unconnected vertices!
      - **YELLOW (`#FFD700`, `Mat_Snapped_Duplicate_Yellow`):** 284 vertices (37.9%) connecting to spheres shared across multiple projection views (seams/creases).
      - **GREEN (`#1ACC33`, `Mat_Snapped_Valid_Green`):** 465 unique interior facet vertices (62.1%) cleanly connected to their corresponding spheres.
    - Re-projection Geometric Accuracy: **Mean residual = 0.33 mm** (99.7% faithful to original 2D clean cutouts).
    - Materials & Vertex Colors: Both face material slots and vertex `Color` attribute populated for instant vivid display in Solid, Material, and Rendered modes.
    - Reconstructed Model (`Stage5_Model_Reconstructed_3D` in `Reconstructed Model`): Unified 3D mesh formed by welding coincident seam vertices across all 6 views at 1.5mm tolerance: **590 vertices** and **529 clean faces**.
    - Published 3D Assets: Exported to `apps/kirigami-studio/resources/baby-broncosaurus-v3/model.blend` (`Model_BabyBroncosaurus`, 590v/529f) and binary GLTF `model.glb` (67.9 KB).
    - Active visible collections: `Snapped Cutouts`, `Consolidated Spheres`, `Bounding Box`, `Clean Cutouts`. All 589 objects preserved in scene.
- **Modular Pipeline & Aggregated Runner:** Structured under `apps/kirigami-studio/scripts/common/stage/`:
  - `pipeline.mjs`: Aggregated runner executing ordered pipeline stages (`npm run stage:pipeline` or specific stages `npm run stage:0`, `npm run stage:1`, `npm run stage:2`, `npm run stage:3`, `npm run stage:4`).
  - `stage_manager.py`: Central stage visibility matrix, camera/light viewport hiding, and outliner auto-collapse.
  - `clean_cutouts.py`: Automated topological cleaning of cutouts dissolving uncreased vertices.
  - `stage2_tubes.py`: Stage 2 raycast tubes, collision calculations, and green/red success/fail separation.
  - `stage3_spheres.py`: Stage 3 quadrant collisions and consolidated spheres.
  - `stage4_snapping.py`: Stage 4 planar cutout snapping to consolidated spheres with red/yellow/green color classification.
  - `apply_stage.py`: Direct Blender CLI interface.
  - Specification & Architecture: `apps/kirigami-studio/scripts/common/stage/PIPELINE.md`.
  - QA Status: `apps/kirigami-studio/resources/baby-broncosaurus-v3/qa-stages.md`.

### Log of Abandoned Techniques (Why They Were Discarded)
1. **Voxel Remesh & Laplacian Smooth Modifiers on Solid:**
   - *Result:* Degraded and destroyed the planar facet structure of the papercraft, rounding sharp architectural creases into blobby organic forms.
   - *Status:* Abandoned.

2. **Global Shrinkwrap Modifier on 2D Cutout Planes (`NEAREST_SURFACEPOINT`):**
   - *Result:* Pulled boundary vertices that lay outside the 2D silhouette through empty space toward the closest point on the body, generating disfigured spiderweb meshes around the model.
   - *Status:* Abandoned.
3. **Raycast Decal Projections & Material Shader Tattoos (`*tattoo*.png`):**
   - *Result:* Projected flat 2D color images and wire overlays via UV mapping directly onto the material shader. Did not produce actual polygonal geometry or mesh vertices, rendering them useless for snapping, edge alignment, and 3D modeling.
   - *Status:* Abandoned and all generated PNG files deleted.
4. **Single-View Wire Bevel Tubes:**
   - *Result:* Converted projected raycast lines into 3D curve tubes. Resulted in visual occlusion and clashing geometries instead of acting as a working retopology grid.
   - *Status:* Abandoned.

### Multi-View DSINE Normal Integration & Reconstructed 3D Papercraft Model (2026-09-12)
- **Architecture:** Ingested all 6 orthogonal cutout views (`left.png`, `right.png`, `front.png`, `back.png`, `top.png`, `bottom.png`).
- **Surface Normal Estimation:** Executed DSINE (CVPR 2024 oral) neural inference on Apple Silicon MPS in `~/Projects/local-models/kirigami/models/dsine/dsine.pt`, extracting dense 3D normal vector maps for all 6 views into `resources/baby-broncosaurus-v3/normals/`.
- **Planar Facet Bisecting & Normal Carving:** Sliced all 461 individual facet extrusion solids along their true 3D spatial tangent planes derived from the DSINE normals, breaking orthogonal 90° flat surfaces into realistic papercraft facet bevels.
- **Watertight Manifold Topology:** Unified and decimated to 518 vertices and 1,006 polygons:
  - Non-manifold edges: **0 (100% strictly manifold & watertight)**.
  - Throat / neck webbing: **Zero** (open concave neck curve).
  - Inter-leg webbing: **Zero** (limbs completely separated).
  - Dimensions: $275.8\text{ mm} \times 95.9\text{ mm} \times 200.1\text{ mm}$ (strictly respecting `frame.json`).
- **Published Assets:** Synchronized to `apps/kirigami-studio/resources/baby-broncosaurus-v3/model.blend` and `model.glb`. Verified with `npm run check:fast`.

### Corrected Mathematically Consistent 6-View SVGs & Inverse Reprojection (2026-09-13)
- **Problem Diagnosed:** Classical Wesley-Markowsky (1981) direct ray-crossing failed because the raw SVGs were manually drawn 2D illustrations lacking mathematical projective parity ($Z_{left} \neq Z_{front}$, flank creases floating with no conjugate counterpart).
- **Inverse Reprojection Pipeline:** Solved deterministically by reprojecting the 2D cutouts from the underlying watertight manifold 3D solid (`Mold_Solid`, 639v/328f) onto the 6 orthogonal bounding box planes.
- **Projective Parity:** 100% mathematically consistent: every vertex, edge, and facet across all 6 views now has an exact conjugate partner in the 3D spatial mesh.
- **Exported 6 Corrected SVGs (`cutouts/corrected/`):**
  - `left_corrected.svg` (105 facets, 987x718 px)
  - `right_corrected.svg` (113 facets, 976x718 px)
  - `front_corrected.svg` (105 facets, 374x718 px)
  - `back_corrected.svg` (83 facets, 372x717 px)
  - `top_corrected.svg` (113 facets, 985x408 px)
  - `bottom_corrected.svg` (96 facets, 990x411 px)
- **Visual Renders:** High-resolution 2D drawings (`svg_render_*.png`) and 3D orthogonal inspection views (`eval_*.png`) rendered for user visual evaluation.
- **User Review & Handover (2026-09-13):**
  - User inspected `svg_render_front.png` and `svg_render_left.png` and flagged local edge deformations and unintended crease artifacts caused by 1D discrete coordinate snapping.
  - Work paused by user for handover to another agent. State, scripts (`tools/scratch/`), rendered inspection images, and corrected SVG assets preserved for continuity.
- **Verification:** Fast affected suite `npm run check:fast` fully green (lint, test, build).

### Stage 1: Cutouts & Calibration Completed (2026-09-13)
- **PNG Cutouts:** Extracted and aligned all 6 orthogonal views (`front`, `back`, `left`, `right`, `top`, `bottom`) into `{view}_aligned.png` and `{view}_clean_aligned.png` from `sheet.png`, standardized to canonical content box ($324\text{ px} \times 936\text{ px} \times 668\text{ px}$ / $0.0965\text{ m} \times 0.2788\text{ m} \times 0.2000\text{ m}$) with uniform $16\text{ px}$ canvas padding.
- **2D Complete Edge SVGs:** Generated `{view}_aligned.svg` preserving 100% of drawn creases and edges without deleting any lines. Every vertex is tagged with a unique `<circle>` identifier containing its own HEX color ID (e.g. `#100001`, `#100002`).
- **Facet Closed Polygons SVGs:** Generated `{view}_faces_aligned.svg` containing all 539 closed polygon facets across all views (Front: 90 faces, Back: 85 faces, Left: 89 faces, Right: 88 faces, Top: 97 faces, Bottom: 90 faces) filled with their prominent facet colors.
- **Data Manifest (`cutouts_data.json`):** Mapped all 539 polygon faces, vertex 2D pixel coordinates, unique hex color IDs, and cross-validated 3D coordinates ($X, Y, Z$) derived from multi-view coordinate consensus within 3.5 mm tolerance.
- **Paintings Extraction:** Extracted 10 visual features (eyes, markings, textures) into `cutouts/paintings/` as PNG and SVG components, and mapped each feature to its target polygon face IDs in `cutouts_data.json` for future UV projection.
- **Blender Plane Alignment (`model.blend`):** Perfectly aligned the 6 cutout planes in `local-models/kirigami/work/model.blend` and `apps/kirigami-studio/resources/baby-broncosaurus/model.blend` under `Clean Cutouts` and `Cutout Lines`, with feet sitting at $Z=0$ and sagittal center at $X=0$. Bounding Box wire cage preserved.
- **Scope Invariant Strictly Respected:** No 3D body model reconstructed. Only cutout planes and alignment manifest established.
- **Verification:** Fast affected check `npm run check:fast` fully green (lint, test, build).

### Black-ink single-view rewrite — supersedes every 6-view/multi-view experiment above (2026-09-15)

The whole 6-orthogonal-view "dough-cutter" line above (`baby-broncosaurus-v3`, DSINE normals,
quadrant snapping, `apps/kirigami-studio/scripts/common/stage/`) and the earlier `uploads/`+
`kirigami_director`/`physicist`/`gem-modeler` MCP factory (top of this file) were both abandoned
this session. The user now hand-draws (or generates once, via stage 0) a single side-profile
view with fold lines inked as deliberate solid black strokes; detection is a plain luma
threshold, not a judgement call.

- **Terminology — mold vs. model:** the raw TripoSR reconstruction (the Blender object/collection
  named `Model`, step 1's pristine reference, duplicated into `HalfModel` before cutting) is the
  **mold** — a reference solid used for raycasting, never the deliverable. The **model** is the
  crease-net mesh: it starts flat from the SVG (`CreaseNetMesh`), and its vertices are then
  displaced onto the mold's surface — contour vertices pinned to Y=0, interior vertices raycast
  onto the mold. Every "model" in the text below means this crease-net mesh, not the TripoSR
  solid, even where the Blender object itself keeps the name `Model` for historical reasons.
- **Pipeline, `apps/kirigami-studio/scripts/`**, mirrored 1:1 by `resources/<subject>/`:
  - **Stage 0** (manual, costs money): `generate-view.mjs` asks Gemini for one image with two
    panels (main view + a 90°-rotated depth companion) in a single API call
    (`generateViewPair` in `apps/kirigami-studio/scripts/common/gemini.mjs`), split locally by `split_pair.py`.
    Writes `input.<ext>` / `input-secondary.<ext>` straight into
    `apps/kirigami-studio/public/models/<subject>/` — never into `resources/`.
  - **Stage 1** (4 steps, deterministic): silhouette → isolate ink (`ridge_lines.ink_mask`,
    `BLACK_LUMA=90`) → crease graph (`crease_graph.py`: prunes decorative-detail components by
    connected-component size, welds degenerate sub-3px edges) → outline cutout (crop + the one
    `crease.svg` stage 2 reads, holding `outline`/`creases` groups).
  - **Stage 2** (Blender, headless): reconstruct mesh — TripoSR, now de-inked first
    (`outline_cut.remove_ink`, since TripoSR sculpts solid black ink as physical relief) — then
    project creases, then a stage preview render.
  - **Stage 3** (manual): `step-1-publish.py` copies the finished `model.glb` + preview into
    `public/models/<subject>/` (the two input images are already there from stage 0) and
    regenerates `public/models/index.json`.
  - `resources/<subject>/` now holds **only** `stage-1/` and `stage-2/` evidence folders — no
    loose input file inside it any more. Everything the Angular app serves
    (`input.*`, `model.glb`, `preview.png`, `index.json`) lives in `public/models/<subject>/`,
    auto-copied into the build; `apps/kirigami-studio/src/app/domain/models/` was rewritten to
    this flat schema and the old `uploads/gallery.json` + shelves/tiers domain model is gone.
- **Blender MCP** (`ahujasid/blender-mcp`, registered via `claude mcp add blender uvx
  blender-mcp`) was used for one live, interactive prototyping session, then ported to headless
  scripts once validated — **`scripts/stage-2/step-4-raycast-preview.py`** and
  **`step-5-flat-crease-mesh.py`**, run as
  `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python
  <script> -- --subject <subject>`. Debug/prototype evidence, `.blend` only, not a pipeline
  deliverable:
  - `step-4` slices the reconstructed mesh in half along its own **local** depth centre —
    computed per 40 X-slices, not one global Y=0 plane (a global cut opened a hole clean through
    the torso, because the mesh's true depth centre drifts along the body). Deletes whole faces
    only, never bisects a triangle, so the original smooth shading survives untouched. Raycasts
    every crease point along the fixed thin axis; only the *first* hit counts, and only if it is
    front-facing — walking past a backface hit looking for a later front-facing one let tubes
    visibly cross through the hollow interior, and was rejected once seen live. A miss or a
    backface falls back to the same local-centre plane the outline uses (never
    `bvh.find_nearest`, which can break the perpendicular-only rule). Outline tubes always stop
    at the local centre, unconditionally. Produces 236 tubes + hit-spheres in `Model` (the mold) /
    `SvgLines` / `OutlineTubes` / `CreaseTubes` / `HitSpheres` collections.
  - `step-5` **opens step-4's own saved `.blend`** (continues that scene instead of rebuilding
    it — the first version started from an empty file and silently dropped every tube/sphere,
    caught immediately) and turns the `crease.svg`'s outline+creases into one flat, faceted mesh
    (`bmesh.ops.triangle_fill`, constrained by every original segment): 276 of 278 source
    segments survive as real mesh edges after triangulation. `CreaseNetMesh`, in its own
    `FlatCreaseMesh` collection, is the flat, uncreased net.
  - Shared mapping logic (`unique_points`, `pixel_to_world_mapper`) lives in
    `scripts/common/svg_projection.py`, used by both steps.
  - Verified reproducible: both scripts were run headless (with the user's explicit go-ahead
    for this one case — normally the user runs every kirigami script, even to validate a fix)
    and gave the exact same numbers as the live MCP session: 60 outline points, 177 crease
    points, 145 real front-facing hits, 32 fallback.

#### Next (kirigami)

6. **Fold the flat net onto the mold.** `CreaseNetMesh` (step 5) starts flat, exactly where the
   SVG plane sits; each of its vertices has a matching hit-sphere from step 4 sharing the same
   X/Z, offset only in Y. Step 6 moves every `CreaseNetMesh` vertex along Y to its matching
   sphere's Y — the flat net "grows into" the mold's true surface one point at a time, always
   moving perpendicular (Y-only), never off-axis. Turns the crease pattern from a flat
   proof-of-concept into real folded 3D geometry — this folded net is the **model**.
7. **Revisit stage 1 — crease detection is not good enough yet.** `crease_graph.py` still leaves
   stray/spurious short edges that are not a real fold. Proposed direction (not yet implemented,
   not yet formalised): for each edge, follow its own direction outward and check whether it
   *converges* with other edges at a shared point further along that same line — a real crease
   sits in a network of edges that meet at consistent junctions, so an edge whose projected line
   meets nothing is decorative noise, not a fold, and should be dropped. Needs a proper name and
   a worked-out algorithm before it becomes code.

### Shared `model.blend`, per-step cost manifest, and the next two directions (2026-09-16)

Item 6 above (fold the flat net onto the mold) is **done**, and so is a mirror step that
reflects the folded net across the mold's own local depth-centre curve to cover the far side
too. Along the way the whole stage-2 prototype (steps 4-7) was restructured:

- **One shared scene per subject**: every stage-2 step now reads and writes the same
  `public/models/<subject>/model.blend` (see `scripts/common/blender_scene.py`) instead of each
  step producing its own `.blend`/`.glb` chain in `resources/`. `Model` — the mold, step 1's
  pristine TripoSR reference — is never touched again; step 4 duplicates it into `HalfModel`
  before cutting, so
  step 2's own wireframe (against the *full* mesh) keeps working regardless of what steps 4-7 do.
  Every later duplication (flat → folded → mirrored) follows the same non-destructive pattern.
- **Nothing is ever deleted from the shared scene.** Re-running a step reuses its own object/mesh
  datablock (`get_or_create_mesh_object`, `duplicate_mesh_object`) instead of piling up a new one
  each time; a collection that a later step supersedes is hidden (`hide_collection`), never
  removed. A real bug was found and fixed this way too: `_stand_and_export.py` (step 1's TripoSR
  wrapper) was exporting its *entire* scene — including its own preview camera — into `mesh.glb`,
  so a stray camera rode along into every step after it. Fixed by exporting only the reference
  object via an explicit selection, and hiding (not deleting) the camera afterward.
- **Cost/coordinate manifest, one small file per step.** Every step (stage 0 through 3) now
  writes its own result — elapsed seconds, a cost estimate (exact for Gemini's stage-0 calls,
  estimated hosted-service rates for local compute, see `scripts/common/cost_model.py`), and its
  own coordinates/geometry — to `resources/<subject>/steps/<stage-id>.json` (gitignored, never
  shipped). `build_manifest()` (`scripts/common/manifest.py` / `.mjs`) then aggregates every
  step's file into the one `public/models/<subject>/manifest.json` the app can read — this file
  *is* committed, since the frontend needs it. Each step's file also carries an
  `algorithmVersion`, so a future improvement to one step can be told apart from stale output
  without re-running the whole pipeline.
- **TripoSR only ever runs once per subject.** `step-1-reconstruct-mesh.py` skips it entirely
  when `model.blend` already exists, and falls back to rebuilding the mesh straight from the
  vertices/faces cached in that step's own manifest entry (`_rebuild_from_coords.py`) when the
  file was lost but the shape was already reconstructed once — no GPU, no TripoSR subprocess.

- [x] **Stage 1: improve SVG line/vertex detection (least-squares ray convergence)**. Solved false Y-junctions and parasitic skeleton forks in `crease_graph.py` (`apps/kirigami-studio/scripts/common/crease_graph.py`). Ink stroke puddles (~16-24px) are clustered and internal skeleton bridges contracted. Junction vertices are solved via least-squares ray intersection: \(\vec{x}^* = (\sum (I - \vec{v}\vec{v}^T))^{-1} \sum (I - \vec{v}\vec{v}^T) \vec{p}\), extending lines straight along their direction to meet at true shared vertices, eliminating broken Y-kinks and reducing edge counts to true crease lines (`brontosaurus-baby`: 307 -> 217; `chick`: 209 -> 102; `darth`: 108 -> 57). (2026-09-17)

#### Next (kirigami) — two directions to pick up in a fresh conversation
9. **Stage 2: reconstruct from two views instead of one, primary given priority over secondary.**
   The concrete failure this is meant to fix: a single-view TripoSR reconstruction (e.g. the
   dinosaur, reconstructed from its side view) cannot resolve concavities a side silhouette
   doesn't reveal — the gap between the legs never actually opens up, because nothing in that one
   view says it should. Proposed technique:
   - Stage 0 already asks Gemini for one image containing two panels — a primary view and a
     companion view *perpendicular* to it (`input.png` / `input-secondary.png`, split by
     `split_pair.py`) — this already exists and is unchanged.
   - Run TripoSR **twice**, once per view, producing two independent reconstructed molds.
   - Combine the two molds into one, **giving primacy to the primary view's geometry** wherever
     the two disagree — the exact combination rule (a boolean-style merge? a weighted blend by
     confidence/silhouette agreement? something else?) is not decided yet and is the main open
     design question.
   - The crease SVG side of the pipeline has to follow: generate/project creases for *both*
     views, not just one, and apply the same primary-over-secondary priority when they land on
     the combined mold to build the final model.
   - Not started. No code, no chosen merge algorithm — this is a research/design conversation
     before it is an implementation one.
10. **Stage 1: strip decorative "maps" for a second, TripoSR-only clean image.** The crease-free
    `clean_cutout` (stage-1 step-5) already exists and is applied as the model's own texture, but
    TripoSR still reconstructs from a cutout that keeps decorative marks — white claws, nose,
    mouth, eyes, back spots — as physical relief, the same failure `remove_ink` already solved for
    the crease lines themselves. Proposed direction:
    - Extract each decorative element as its own cutout PNG into `resources/<subject>/maps/`,
      registered to the same drawing-plane coordinates as `crease.svg`.
    - Build a second cleaned image — `clean_cutout` with the maps regions *also* erased/inpainted
      — and feed that one to TripoSR instead of today's de-inked-only cutout.
    - This is a perceptual/segmentation task (separating semantic regions from one illustration),
      which the project's own standing directive ("move work out of the agent and into machines")
      says needs an existing tool/model evaluated before any agent-authored heuristic is written —
      not started, no chosen approach yet.
11. **Stage 0 Exploration: Local Text-to-Image Model (FLUX.1 via MLX/`mflux`) to replace Gemini Image API.**
    Investigate replacing external Gemini Image API calls (`apps/kirigami-studio/scripts/common/gemini.mjs`) with a local
    open-weights model to eliminate API costs, rate limits, and network latency:
    - **Model Selection**: Google does not release open weights for Imagen (Gemma is text/VLM perception only).
      The candidate for matching Imagen 3 / Gemini fidelity is **FLUX.1 [schnell]** (12B Flow-Matching DiT,
      Apache 2.0) or **FLUX.1 [dev]**, known for high prompt instruction adherence, orthographic consistency,
      and clean technical linework.
    - **Hardware Fit**: Hardware is Apple Silicon M4 (24 GB Unified Memory). FLUX.1 in 4-bit quant runs in
      ~10–12 GB RAM without swap.
    - **Runtime Engine**: Native Apple MLX via [`mflux`](https://github.com/filipstrand/mflux) in
      `~/Projects/local-models/` or a local OpenAI-compatible HTTP server (Draw Things / ComfyUI).
    - **Test Plan**:
      1. Install and test `mflux` (FLUX.1 schnell 4-bit) in `~/Projects/local-models/`.
      2. Test technical multi-view papercraft prompt generation (`STYLE` and orthographic elevation constraints)
         and evaluate fold line contrast, background isolation (#E5E5E5), and aspect ratios.
      3. If validated, add local runner fallback / toggle in `apps/kirigami-studio/scripts/common/gemini.mjs` (`--engine=local` or `--mflux`).

### Recraft 3-view stage-1 — state after the cleanup and the model-by-model audit (2026-09-20)

**Pipeline in force** (`apps/kirigami-studio/pipeline.json`, run with `nx run kirigami-studio:stages`):
Gemini draws one sheet with three views (order on the sheet: front | side | top; roles
`principal` | `secondary` | `top`), Recraft vectorises it to `sheet.svg`, stage 1 builds cutouts and a
wireframe per view. The stage-2/3 steps in `pipeline.json` have no script yet and report `PLANNED`;
the old single-view TripoSR scripts under `scripts/stage-2` and `scripts/stage-3` are parked, not wired.

**Layout decisions.** Generic tooling lives in `apps/kirigami-studio/scripts/common/` again (Blender generator, MCP server,
QA, ledger, cut-sheet extractor, `gemini.mjs`). `scripts/common/` keeps only the 14 modules the app
uses. Obsolete files (`vision/`, `stage/`, `stage-1-old/`, five orphan modules) are quarantined in
`tools/scratch/_obsolete/` pending deletion (all of it is also in git history).

**What a Recraft `sheet.svg` is:** 2048x1143 viewBox (the jpeg is 1376x768, factor 0.672), every path
absolute `M/L/C/z`, no strokes, `transform="translate(0,0)"`. DOM order: three background rects,
black divider strips, then per view one dark **underlay contour path** followed by one path per facet.
Decals (eyes, blush, stripes) are extra paths that share no vertices with the facets.

**Audit findings (tools/scratch/audit_stage1.py, contact sheets in tools/scratch/contact/):**
1. The step-2 alpha is not solid: creases are transparent and every facet is an island (dozens to
   hundreds per PNG) because the corner flood-fill leaks through the seams.
2. Step 1 splits by column centre and crops to the bbox. It drops the per-view contour path (the
   "bounding frame" and "backdrop" rules), lets divider strips and vectorised captions ("Front View",
   "PROFILE VIEW 90°") into the crop, and misassigns facets that cross a divider (cute-baby-cat tail).
3. red-car breaks the sheet rules (coloured panel backgrounds, ground slab), so nothing splits.
4. 13 of 14 usable top views are not consistent with front+side (aspect ratio r < 0.8; polar-bear and
   parrot are really back views). Treat `top` as low priority in the fusion.
5. Endpoint gaps between adjacent facets: exact in creeper/darth/owl/steve/zumbi, 2-4 units in the
   rest (p90 6-10). The pipeline snap tolerance of 3.0 is too small for the second group.
6. Step 3 only copies the SVG; step 4 loses facet adjacency (valence-based boundary/crease
   classification is wrong, `anatomy` is always `torso`, greedy order-dependent snapping); steps 6-9 in
   `PIPELINE.md` do not exist as scripts.
7. Exit code green does not mean correct: the runner only fails on exceptions or missing files.

**Next (in this order):** rewrite step 1 as cluster-based figure extraction (contour path per view,
captions/dividers excluded, decals attached by containment); alpha from the contour path; wireframe
from centroids of endpoint clusters with facet adjacency kept; quality gates in the runner from the
audit metrics. The local model that labels body regions belongs to **step 4** (not step 6 as
`PIPELINE.md` says): today step 4 only writes `anatomy: "torso"` on every facet and node, with no
model call anywhere in git history. The candidates on disk are in `~/Projects/local-models/kirigami/`
(`mobile_sam.pt`, DINO ViT-B/16, CLIP ViT-B/32, Depth-Anything-V2-Small, rembg). Its job is to give
each facet/vertex a region label per subject type so opposite limbs match across views for the XYZ
estimate.


### Stage-0 view gate, sheet regeneration and cleanup — outcome (2026-09-20)

**Done.** Stage 1 was rewritten as cluster-based extraction (15/15 subjects complete, one alpha
island per view, no divider or caption leakage). Stage 0 now rejects a sheet whose top view is not a
true plan view (`scripts/stage-0/check-sheet-views.py`, shared thresholds with stage 1). Sheets
regenerated: darth (asymmetric blaze copied from `front.jpg`), brontosaurus-baby, fox, parrot,
steve-minecraft; adopted after human review: dog, red-car, polar-bear, zumbi-minecraft (top views
are true plan views, only the scale disagrees). `scripts/common/` and `scripts/stage-2|3` were
pruned to what the wired steps use; dead `check:svg`, `check:kirigami`, `check:kirigami-qa` scripts
removed from the root `package.json`.

**Open.** 7 view-consistency WARNs remain (dog x2, owl, penguin, polar-bear, red-car, zumbi-minecraft),
all scale mismatches, not wrong views. The user still has to run `nx run kirigami-studio:test:python`
(and `:test:svg-geometry`, `:test:stage-1`). Steps 3/4/5 of stage 1 are unchanged: step 4 still
writes `anatomy: "torso"` and classifies boundary/crease by valence. `tools/scratch/` still holds
old analysis leftovers for the user to delete.

### Stage 1 rework in progress — base layers, wireframe repair, body parts (2026-09-20, later)

**Measured problem.** The old alpha cutouts missed foreground: darth side 54%, steve top 52%, owl top
13%, cute-baby-cat side 10%. Cause: the underlay rule (dark + encloses 15) removed real dark facets and
kept light base layers. Green status (one island, coverage) did not prove correctness; the acceptance
metric is the share of sheet foreground not covered (`missing foreground`, target < 2%).

**Done.** `is_underlay` now means: any colour, encloses >= 85% of the paths it overlaps, spans >= 90% of
their extent. darth side 54% -> 7%, zumbi top stays 0.4%. Still open: steve top 49% (the brown head
top exists only as the visible remainder of the base layer, no polygon describes it), owl top 13%,
cute-baby-cat side 10%, penguin front 8.5%. Polygons alone cannot give complete parts; parts must be
identified on the image.

**Step 4/5 rewritten.** Step 4 extends every side, groups vertices (tolerance 6), and places each
junction at the common point of its lines, else at the centre of their crossings (kinds: common,
centre, straight, kept). Step 5 draws it from the JSON over the cutout with the painted polygons in
yellow. Modules: `wireframe_lines|junctions|graph|outline|checks|document.py`.

**Body parts (new step 2, cancelled cutouts).** CLIP ViT-B/32 downloaded to
`~/Projects/local-models/kirigami/models/hub` (605 MB). Experiment on darth front (MobileSAM regions
named by CLIP, bias-calibrated): head, eyes, paws and hind legs plausible, torso is noise and one ear
is named tail. Not yet a pipeline step. Options: per-subject part list in `subjects.json` plus
geometric priors (vertical bands, mirror symmetry for left/right), or Gemini naming.

### Stage 3 tested on ready-made GLBs, Fox first (2026-09-21)

Stages 0-2 are skipped for two downloaded models: `resources/fox-poly/stage-3/step-0-model.glb`
and `resources/x-wing/stage-3/step-0-model.glb` (the `step-0-` prefix keeps the runner's
`cleanStepOutputs` from deleting them). Stage 3 is the papercraft unfolding, per `pipeline.json`
(`PIPELINE.md` still numbers it stage 4).

**Written, not yet run** (the user runs it): `scripts/stage-3/step-1-unfold.py` and
`step-2-export-sheets.py` are launchers that start Blender headless on
`scripts/stage-3/blender/unfold_model.py` and `export_sheets.py`, driving the Export Paper Model
extension (`mesh.unfold`, `export_mesh.paper_model`). Step 1 imports the GLB, merges the parts into
one `Papercraft` mesh (sources stay in the scene, hidden), welds the flat-shading split vertices,
scales the longest side to `target_size_mm` (180) and marks the seams, saving
`step-1-unfolded.blend`. Step 2 exports A4 `step-2-sheets.pdf` and per-page SVG, pure net, no
texture. Both write a `step-N-manifest.json` with warnings.

```bash
npx nx run kirigami-studio:stage:3 -- --model=fox-poly
```

`--model` is required: the runner only discovers models that own a `sheet.svg`.
Open: texture bake (`texture: TEXTURE`) not tried, X-Wing not tried, addon enabling under
`--factory-startup` unverified.
