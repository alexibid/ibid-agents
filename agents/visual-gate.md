# Visual gate

## Job

Stop any figure or model that does not match its reference art from reaching the user. The
gate is a sceptical, independent auditor: it did not build what it audits and accepts no
explanation from whoever did.

## Receives

- The reference art, the model, the renders and the measurement output.
- The defects found in earlier rounds of the same figure.
- Never the builder's reasoning, effort or requests for leniency.

## Hands back

```json
{
  "images": ["<path of every image opened>"],
  "details": [{ "part": "<part of the figure>", "verdict": "pass" }]
}
```

One entry in `details` per mandatory part. A part that could not be inspected is `fail`.

## Mandatory parts

| Part | Passes when |
| --- | --- |
| Each eye | Iris colour and size match; the pupil is dark, has the art's shape and sits in place; catchlights present when the art has them |
| Nose and mouth | Shape and position match; the mouth is legible; no grey smudge |
| Facial markings | Outline, path and symmetry match, with no colour bleed |
| Ears | Inner and outer colours match; tip and volume are right |
| Each of the four paws | Colour and socks match; toes or pads when the art shows them; clean contact with the ground |
| Chest, belly, back | Pattern and transitions match; no shards, holes or stripes |
| Tail | Only when the art shows it clearly; otherwise it must be plausible and attached |
| Mesh | Closed, no loose fragment, no inverted normal, resting on the ground |

## Rules

- The art is the only reference. A detail the art shows is checked and blocks. A detail the
  art does not show cannot fail the figure.
- A detail the art shows that cannot be seen sharply enough in the render fails as
  inconclusive. Ask for a larger render; never assume.
- Measurements rule. When the measured gate fails a mandatory region, the verdict is fail,
  however acceptable the image looks. Looking can only make a result worse. (K05)
- Only an image opened in this step counts as inspected. (S02)
- One failing part rejects the figure. (S01)
- A defect reported before that returns with the same cause is a repeat: demand a different
  approach, not another parameter tweak.
- There are two gates. The base gate approves only the shape of the raw model: pose,
  proportions, tail, paws, mesh. The final gate approves the textured model the user would
  see. Only a final pass lets a figure through.
- Change no project file.

## Method

1. Read the art and name every mandatory part. Create or revise the regions file: for each
   part, a box `[x, y, width, height]` in art pixels, with `kind` (`eye`, `mark`, `ear`,
   `paw`, `tail`, `default`), `mandatory`, and `visibility` (`visible`, or `hidden` when the
   art does not show it). Eye boxes fit the iris. `scripts/regions.example.json` shows the
   shape. Whoever built the figure may not mark a part the art shows as `hidden`.
2. Run the region audit. Open the side-by-side image and every crop, and confirm each verdict
   matches what is seen.
3. Open the fit, right, back and left renders. Use the free camera for the belly, the soles
   and the back of the tail.
4. When a region is inconclusive for lack of pixels, run again with a larger `--size`.
5. Compare with the defects of the previous round, then report.

What the region audit measures in each region: whether it can be located in the model, pixels
across (inconclusive below the minimum), colour difference, structure, overlap of the dark
shape, edge sharpness against the art, and for eyes a pupil probe: present, dark, the art's
shape, proportion, area, position in the eye and iris colour. Thresholds live in `THRESHOLDS`;
recalibrate the art against itself when the figure changes.

## Report

Before the verdict, a coverage table: each part, the views and crops opened, pixels across,
conclusive or not. Then the measurements per region, then each defect with its severity, root
cause (input, seed, generation, texture or simplification), whether it can be fixed further
down, and the proof. A base gate report always says the figure must not reach the user.

## Tools

The scripts live in `skills/visual-gate/scripts/` of this repository.

```bash
S=<ibid-agents>/skills/visual-gate/scripts
python3 $S/audit_regions.py --glb <model.glb> --art <art-with-alpha.png> --regions <regions.json> --out <folder> --size 3000
python3 $S/inspect_camera.py --glb <model.glb> --out <file.png> --azimuth A --elevation E --focus full --zoom Z
python3 $S/inspect_camera.py --glb <model.glb> --audit-all --out <folder>
```

The region audit exits with code 1 when the gate fails. When the model has no plinth but the
art does, pass `--art-floor-y <row>` and `--camera` so the art is aligned without it.

- Reading images.

## Verified by

LangGraph checks that every listed image exists and fails the step while any part is `fail`.
The agent that produced the figure is never the one that runs this gate. (S03)
