import argparse
import json
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np

BLENDER_BIN = "/Applications/Blender.app/Contents/MacOS/Blender"
FIT_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fit_render.py")
RESULT_MARKER = "VISUALQA_RESULT "
CONTEXT_MARGIN = 0.6
FLAT_STD = 6.0
LOW_CONTRAST_RANGE = 60
FLAT_SHARPNESS = 2.0
SCALE_STEPS = np.linspace(0.8, 1.25, 7)
WIDE_SCALE_STEPS = np.linspace(0.55, 1.6, 15)
SHOW_HEIGHT = 384

THRESHOLDS = {
    "min_locatability": 0.30,
    "min_pixels_across": {"eye": 90, "default": 60},
    "max_delta_e": {"eye": 28.0, "mark": 30.0, "default": 32.0},
    "min_structure": {"eye": 0.30, "mark": 0.25, "default": 0.20},
    "min_shape_iou": {"eye": 0.60, "mark": 0.70, "default": 0.55},
    "min_sharpness_ratio": 0.35,
    "max_shift_ratio": 0.08,
    "pupil_aspect_ratio": (0.6, 1.6),
    "pupil_area_ratio": (0.45, 2.2),
    "pupil_max_offset": 0.25,
    "pupil_min_iou": 0.5,
    "pupil_max_darkness_gap": 14.0,
    "pupil_min_contrast_ratio": 0.7,
    "iris_max_delta_e": 25.0,
}


def figure_box(image: np.ndarray, floor: int) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(image[:, :, 3] > floor)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def flatten(image: np.ndarray) -> np.ndarray:
    alpha = image[:, :, 3:] / 255.0
    ground = np.full(image.shape[:2] + (3,), 229, np.uint8)
    return (image[:, :, :3] * alpha + ground * (1 - alpha)).astype(np.uint8)


def render_views(glb: str, art: str, output_dir: str, label: str, size: int, camera=None) -> dict:
    settings = json.dumps({"glb": os.path.abspath(glb), "art": os.path.abspath(art), "output_dir": os.path.abspath(output_dir), "label": label, "size": size, "camera": camera})
    outcome = subprocess.run([BLENDER_BIN, "-b", "-P", FIT_SCRIPT, "--", settings], capture_output=True, text=True)
    lines = [line for line in outcome.stdout.splitlines() if line.startswith(RESULT_MARKER)]
    if outcome.returncode != 0 or not lines:
        raise RuntimeError(f"Render failed: {outcome.stderr[-400:]}")
    return json.loads(lines[-1][len(RESULT_MARKER):])


ECC_WORK_SIZE = 1500
ECC_BLUR = 5
ECC_ITERATIONS = 300


def global_mapper(art_gray, art_fig, render_gray, render_fig, isotropic):
    ax0, ay0, ax1, ay1 = art_fig
    rx0, ry0, rx1, ry1 = render_fig
    sy = (ry1 - ry0) / (ay1 - ay0)
    sx = sy if isotropic else (rx1 - rx0) / (ax1 - ax0)
    start = np.array([[sx, 0, rx0 - ax0 * sx], [0, sy, ry0 - ay0 * sy], [0, 0, 1]], np.float64)
    reduction = ECC_WORK_SIZE / max(render_gray.shape)
    shrink = np.diag([reduction, reduction, 1.0])
    work = (int(render_gray.shape[1] * reduction), int(render_gray.shape[0] * reduction))
    placed = cv2.warpAffine(art_gray, (shrink @ start)[:2], work, flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
    template = cv2.GaussianBlur(cv2.resize(render_gray, work, interpolation=cv2.INTER_AREA), (0, 0), ECC_BLUR).astype(np.float32)
    moving = cv2.GaussianBlur(placed, (0, 0), ECC_BLUR).astype(np.float32)
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        _, warp = cv2.findTransformECC(template, moving, warp, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, ECC_ITERATIONS, 1e-6), None, 5)
    except cv2.error:
        warp = np.eye(2, 3, dtype=np.float32)
    inverse = np.linalg.inv(np.vstack([warp, [0, 0, 1]]).astype(np.float64))
    full = np.linalg.inv(shrink) @ inverse @ shrink @ start
    scale = float(np.sqrt(abs(np.linalg.det(full[:2, :2]))))

    def mapper(px, py):
        point = full @ np.array([px, py, 1.0])
        return float(point[0]), float(point[1]), scale
    return mapper


def locate(art_gray, render_gray, box, art_fig, render_fig, isotropic=False, mapper=None):
    x, y, w, h = box
    ax0, ay0, ax1, ay1 = art_fig
    rx0, ry0, rx1, ry1 = render_fig
    fx, fy = (rx1 - rx0) / (ax1 - ax0), (ry1 - ry0) / (ay1 - ay0)
    if isotropic:
        fx = fy
    base = (fx + fy) / 2
    mx, my = int(w * CONTEXT_MARGIN), int(h * CONTEXT_MARGIN)
    template = art_gray[max(y - my, 0):y + h + my, max(x - mx, 0):x + w + mx]
    centre_x = rx0 + ((x + w / 2) - ax0) * fx
    centre_y = ry0 + ((y + h / 2) - ay0) * fy
    if mapper:
        centre_x, centre_y, base = mapper(x + w / 2, y + h / 2)
    best = (-1.0, None, 1.0)
    for step in SCALE_STEPS:
        scale = base * step
        resized = cv2.resize(template, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        radius_x, radius_y = int(resized.shape[1] * 0.9), int(resized.shape[0] * 0.9)
        left, top = max(int(centre_x) - radius_x, 0), max(int(centre_y) - radius_y, 0)
        window = render_gray[top:int(centre_y) + radius_y, left:int(centre_x) + radius_x]
        if window.shape[0] <= resized.shape[0] or window.shape[1] <= resized.shape[1]:
            continue
        score = cv2.matchTemplate(window, resized, cv2.TM_CCOEFF_NORMED)
        _, peak, _, where = cv2.minMaxLoc(score)
        if peak > best[0]:
            best = (float(peak), (left + where[0], top + where[1], resized.shape[1], resized.shape[0]), scale)
    if best[0] >= THRESHOLDS["min_locatability"]:
        return best
    for step in WIDE_SCALE_STEPS:
        scale = base * step
        resized = cv2.resize(template, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        if render_gray.shape[0] <= resized.shape[0] or render_gray.shape[1] <= resized.shape[1]:
            continue
        _, peak, _, where = cv2.minMaxLoc(cv2.matchTemplate(render_gray, resized, cv2.TM_CCOEFF_NORMED))
        if peak > best[0]:
            best = (float(peak), (where[0], where[1], resized.shape[1], resized.shape[0]), scale)
    return best


def structure_score(first: np.ndarray, second: np.ndarray) -> float:
    a, b = first.astype(np.float32), second.astype(np.float32)
    c1, c2 = 6.5, 58.5
    mean_a, mean_b = cv2.GaussianBlur(a, (0, 0), 2), cv2.GaussianBlur(b, (0, 0), 2)
    var_a = cv2.GaussianBlur(a * a, (0, 0), 2) - mean_a ** 2
    var_b = cv2.GaussianBlur(b * b, (0, 0), 2) - mean_b ** 2
    cov = cv2.GaussianBlur(a * b, (0, 0), 2) - mean_a * mean_b
    ssim = ((2 * mean_a * mean_b + c1) * (2 * cov + c2)) / ((mean_a ** 2 + mean_b ** 2 + c1) * (var_a + var_b + c2))
    return float(ssim.mean())


def class_masks(gray: np.ndarray):
    blurred = cv2.GaussianBlur(gray, (0, 0), 1.2)
    _, dark = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return dark > 0


def shape_overlap(art_gray: np.ndarray, render_gray: np.ndarray) -> float:
    if art_gray.std() < FLAT_STD or np.percentile(art_gray, 95) - np.percentile(art_gray, 5) < LOW_CONTRAST_RANGE:
        return 1.0
    dark_art, dark_render = class_masks(art_gray), class_masks(render_gray)
    use_dark = dark_art.mean() <= 0.5
    first = dark_art if use_dark else ~dark_art
    second = dark_render if use_dark else ~dark_render
    reach = max(int(THRESHOLDS["max_shift_ratio"] * max(first.shape)), 1)
    best = 0.0
    for dy in range(-reach, reach + 1, max(reach // 3, 1)):
        for dx in range(-reach, reach + 1, max(reach // 3, 1)):
            moved = np.roll(np.roll(second, dy, axis=0), dx, axis=1)
            union = np.logical_or(first, moved).sum()
            if union:
                best = max(best, float(np.logical_and(first, moved).sum() / union))
    return best


def sharpness(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(cv2.GaussianBlur(gray, (0, 0), 0.8), cv2.CV_32F).var())


def to_lab(bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(bgr.astype(np.float32) / 255.0, cv2.COLOR_BGR2LAB)


def ellipse_mask(shape, shrink=0.68) -> np.ndarray:
    mask = np.zeros(shape[:2], np.uint8)
    centre = (shape[1] // 2, shape[0] // 2)
    axes = (int(shape[1] / 2 * shrink), int(shape[0] / 2 * shrink))
    cv2.ellipse(mask, centre, axes, 0, 0, 360, 1, -1)
    return mask > 0


def find_pupil(bgr: np.ndarray):
    lightness = to_lab(bgr)[:, :, 0]
    inside = ellipse_mask(bgr.shape)
    values = lightness[inside]
    threshold, _ = cv2.threshold(np.clip(values * 2.55, 0, 255).astype(np.uint8).reshape(-1, 1), 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    dark = ((lightness * 2.55 < threshold) & inside).astype(np.uint8)
    if values.max() - values.min() < 18:
        return None
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(dark)
    if count < 2:
        return None
    index = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    x, y, w, h, area = stats[index]
    if area < 0.02 * inside.sum():
        return None
    return {"area": float(area) / float(inside.sum()), "aspect": float(h / max(w, 1)), "cx": float(centroids[index][0] - bgr.shape[1] / 2), "cy": float(centroids[index][1] - bgr.shape[0] / 2), "ringColour": bgr[inside & (dark == 0)].mean(axis=0).tolist(), "mask": labels == index, "darkness": float(lightness[labels == index].mean()), "contrast": float(lightness[inside & (dark == 0)].mean() - lightness[labels == index].mean())}


def eye_probe(art_crop: np.ndarray, render_crop: np.ndarray) -> dict:
    art_pupil, render_pupil = find_pupil(art_crop), find_pupil(render_crop)
    if art_pupil is None:
        return {"applicable": False}
    if render_pupil is None:
        return {"applicable": True, "pupilFound": False, "pass": False, "reason": "no enclosed dark pupil in the model eye"}
    lo, hi = THRESHOLDS["pupil_aspect_ratio"]
    aspect_ratio = render_pupil["aspect"] / max(art_pupil["aspect"], 1e-4)
    area_ratio = render_pupil["area"] / max(art_pupil["area"], 1e-4)
    lo_a, hi_a = THRESHOLDS["pupil_area_ratio"]
    width = art_crop.shape[1]
    offset = float(np.hypot(render_pupil["cx"] - art_pupil["cx"], render_pupil["cy"] - art_pupil["cy"]) / width)
    iris = float(np.linalg.norm(to_lab(np.array([[render_pupil["ringColour"]]], np.float32))[0, 0] - to_lab(np.array([[art_pupil["ringColour"]]], np.float32))[0, 0]) * 100 / 100)
    failures = []
    gap = render_pupil["darkness"] - art_pupil["darkness"]
    if gap > THRESHOLDS["pupil_max_darkness_gap"]:
        failures.append(f"pupil too light: L {render_pupil['darkness']:.0f} vs art {art_pupil['darkness']:.0f} (max +{THRESHOLDS['pupil_max_darkness_gap']})")
    contrast_ratio = render_pupil["contrast"] / max(art_pupil["contrast"], 1e-3)
    if contrast_ratio < THRESHOLDS["pupil_min_contrast_ratio"]:
        failures.append(f"pupil/iris contrast {contrast_ratio:.2f}x the art (min {THRESHOLDS['pupil_min_contrast_ratio']})")
    shift_x = int(round(art_pupil["cx"] - render_pupil["cx"]))
    shift_y = int(round(art_pupil["cy"] - render_pupil["cy"]))
    moved = np.roll(np.roll(render_pupil["mask"], shift_y, axis=0), shift_x, axis=1)
    union = np.logical_or(art_pupil["mask"], moved).sum()
    pupil_iou = float(np.logical_and(art_pupil["mask"], moved).sum() / union) if union else 0.0
    if pupil_iou < THRESHOLDS["pupil_min_iou"]:
        failures.append(f"pupil shape overlap {pupil_iou:.2f} < {THRESHOLDS['pupil_min_iou']} (slit/round/size differ from the art)")
    if not lo <= aspect_ratio <= hi:
        failures.append(f"pupil aspect {aspect_ratio:.2f}x art (allowed {lo}-{hi})")
    if not lo_a <= area_ratio <= hi_a:
        failures.append(f"pupil area {area_ratio:.2f}x art (allowed {lo_a}-{hi_a})")
    if offset > THRESHOLDS["pupil_max_offset"]:
        failures.append(f"pupil off-centre by {offset:.2f} of eye width (max {THRESHOLDS['pupil_max_offset']})")
    if iris > THRESHOLDS["iris_max_delta_e"]:
        failures.append(f"iris colour dE {iris:.1f} (max {THRESHOLDS['iris_max_delta_e']})")
    return {"applicable": True, "pupilFound": True, "aspectRatio": round(aspect_ratio, 2), "areaRatio": round(area_ratio, 2), "offset": round(offset, 3), "irisDeltaE": round(iris, 1), "pupilIou": round(pupil_iou, 2), "darknessGap": round(gap, 1), "contrastRatio": round(contrast_ratio, 2), "pass": not failures, "reason": "; ".join(failures), "masks": (art_pupil["mask"], render_pupil["mask"])}


def art_template(art, box, located, render):
    x, y, w, h = box
    mx, my = int(w * CONTEXT_MARGIN), int(h * CONTEXT_MARGIN)
    template = art[max(y - my, 0):y + h + my, max(x - mx, 0):x + w + mx, :3]
    return cv2.resize(template, (located[2], located[3]), interpolation=cv2.INTER_CUBIC)


def region_metrics(region, art, art_fig, render, render_fig, render_gray, art_gray, isotropic=False, mapper=None):
    x, y, w, h = region["box"]
    kind = region.get("kind", "default")
    if region.get("visibility", "visible") == "hidden":
        return {"name": region["name"], "kind": kind, "pass": True, "verifiable": False, "failures": [], "note": "hidden in the art: only general plausibility is required"}, None
    score, located, scale = locate(art_gray, render_gray, region["box"], art_fig, render_fig, isotropic, mapper)
    result = {"name": region["name"], "kind": kind, "locatability": round(score, 3), "pass": False, "failures": []}
    if located is None or score < THRESHOLDS["min_locatability"]:
        result["failures"].append(f"region not locatable in the model (match {score:.2f} < {THRESHOLDS['min_locatability']})")
        return result, None
    mx, my = int(w * CONTEXT_MARGIN), int(h * CONTEXT_MARGIN)
    inner = (int(mx * scale), int(my * scale), int(w * scale), int(h * scale))
    lx, ly, lw, lh = located
    rx, ry = lx + (inner[0] if x - mx >= 0 else int((x) * scale)), ly + (inner[1] if y - my >= 0 else int(y * scale))
    render_crop = render[ry:ry + inner[3], rx:rx + inner[2], :3]
    art_crop = art[y:y + h, x:x + w, :3]
    if render_crop.size == 0:
        result["failures"].append("empty crop after alignment")
        return result, None
    pixels = render_crop.shape[1]
    result["pixelsAcross"] = int(pixels)
    minimum = THRESHOLDS["min_pixels_across"].get(kind, THRESHOLDS["min_pixels_across"]["default"])
    if pixels < minimum:
        result["failures"].append(f"INCONCLUSIVE: only {pixels}px across, needs {minimum}px; re-render larger")
    art_up = cv2.resize(art_crop, (render_crop.shape[1], render_crop.shape[0]), interpolation=cv2.INTER_CUBIC)
    art_gray_crop, render_gray_crop = cv2.cvtColor(art_up, cv2.COLOR_BGR2GRAY), cv2.cvtColor(render_crop, cv2.COLOR_BGR2GRAY)
    delta_e = float(np.linalg.norm(to_lab(art_up) - to_lab(render_crop), axis=2).mean())
    structure = structure_score(art_gray_crop, render_gray_crop)
    overlap = shape_overlap(art_gray_crop, render_gray_crop)
    acuity = 1.0 if sharpness(art_gray_crop) < FLAT_SHARPNESS else sharpness(render_gray_crop) / sharpness(art_gray_crop)
    result["visualOnly"] = bool(art_gray_crop.std() < FLAT_STD or np.percentile(art_gray_crop, 95) - np.percentile(art_gray_crop, 5) < LOW_CONTRAST_RANGE)
    result.update({"deltaE": round(delta_e, 1), "structure": round(structure, 3), "shapeIou": round(overlap, 3), "sharpnessRatio": round(acuity, 2)})
    max_e = THRESHOLDS["max_delta_e"].get(kind, THRESHOLDS["max_delta_e"]["default"])
    min_s = THRESHOLDS["min_structure"].get(kind, THRESHOLDS["min_structure"]["default"])
    min_iou = THRESHOLDS["min_shape_iou"].get(kind, THRESHOLDS["min_shape_iou"]["default"])
    if delta_e > max_e:
        result["failures"].append(f"colour dE {delta_e:.1f} > {max_e}")
    if structure < min_s:
        result["failures"].append(f"structure {structure:.2f} < {min_s}")
    if overlap < min_iou:
        result["failures"].append(f"dark-shape overlap {overlap:.2f} < {min_iou} (shape/markings differ)")
    if acuity < THRESHOLDS["min_sharpness_ratio"]:
        result["failures"].append(f"blurred: edge sharpness {acuity:.2f}x the art (min {THRESHOLDS['min_sharpness_ratio']})")
    if kind == "eye":
        probe = eye_probe(art_up, render_crop)
        result["pupil"] = probe
        if probe.get("applicable") and not probe["pass"]:
            result["failures"].append("PUPIL: " + probe["reason"])
        if not probe.get("applicable"):
            result["failures"].append("PUPIL: the art region has no isolable pupil; set kind to mark or fix the box")
    result["pass"] = not result["failures"]
    return result, (art_up, render_crop)


def outline(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    drawn = image.copy()
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(drawn, contours, -1, (0, 0, 255), 1)
    return drawn


def show_pair(name: str, pair, passed: bool, masks=None) -> np.ndarray:
    art_up, render_crop = pair
    if masks is not None:
        art_up, render_crop = outline(art_up, masks[0]), outline(render_crop, masks[1])
    scale = SHOW_HEIGHT / art_up.shape[0]
    size = (int(art_up.shape[1] * scale), SHOW_HEIGHT)
    tile = np.hstack([cv2.resize(art_up, size, interpolation=cv2.INTER_CUBIC), cv2.resize(render_crop, size, interpolation=cv2.INTER_CUBIC)])
    cv2.putText(tile, f"{name} {'PASS' if passed else 'FAIL'}", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 0) if passed else (0, 0, 255), 2)
    return tile


def main():
    parser = argparse.ArgumentParser(description="Blocking detail gate: measures art regions against the 3D model")
    parser.add_argument("--glb", required=True)
    parser.add_argument("--art", required=True, help="2D reference with alpha (cutout)")
    parser.add_argument("--regions", required=True, help="JSON: {regions:[{name,kind,box:[x,y,w,h],mandatory}]} in art pixels")
    parser.add_argument("--out", required=True)
    parser.add_argument("--size", type=int, default=3000)
    parser.add_argument("--camera", type=float, nargs=2, metavar=("AZIMUTH", "ELEVATION"), default=None, help="Fixed camera, required when the model has no plinth but the art does")
    parser.add_argument("--art-floor-y", type=int, default=None, help="Art row where the paws touch the ground; the art below it (plinth) is ignored when aligning")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    label = os.path.splitext(os.path.basename(args.glb))[0]
    fit = render_views(args.glb, args.art, args.out, label, args.size, args.camera)
    art = cv2.imread(args.art, cv2.IMREAD_UNCHANGED)
    render = cv2.imread(os.path.join(args.out, f"{label}-fit.png"), cv2.IMREAD_UNCHANGED)
    flat_render = flatten(render)
    flat_art = flatten(art)
    art_fig, render_fig = figure_box(art, 40), figure_box(render, 10)
    if args.art_floor_y:
        art_fig = (art_fig[0], art_fig[1], art_fig[2], min(art_fig[3], args.art_floor_y))
    gray_art = cv2.cvtColor(flat_art, cv2.COLOR_BGR2GRAY)
    gray_render = cv2.cvtColor(flat_render, cv2.COLOR_BGR2GRAY)
    regions = json.load(open(args.regions))["regions"]
    mapper = global_mapper(gray_art, art_fig, gray_render, render_fig, bool(args.art_floor_y))
    results, tiles = [], []
    for region in regions:
        result, pair = region_metrics(region, flat_art, art_fig, flat_render, render_fig, gray_render, gray_art, isotropic=bool(args.art_floor_y), mapper=mapper)
        result["mandatory"] = region.get("mandatory", True)
        results.append(result)
        if pair:
            masks = (result.get("pupil") or {}).get("masks")
            tiles.append(show_pair(result["name"], pair, result["pass"], masks))
        (result.get("pupil") or {}).pop("masks", None)
    blocking = [r for r in results if r["mandatory"] and not r["pass"]]
    if tiles:
        width = max(t.shape[1] for t in tiles)
        padded = [cv2.copyMakeBorder(t, 0, 4, 0, width - t.shape[1], cv2.BORDER_CONSTANT, value=(229, 229, 229)) for t in tiles]
        cv2.imwrite(os.path.join(args.out, f"{label}-regions.png"), np.vstack(padded))
    report = {"glb": os.path.abspath(args.glb), "fit": fit, "gate": "FAIL" if blocking else "PASS", "blocking": [r["name"] for r in blocking], "regions": results}
    json.dump(report, open(os.path.join(args.out, f"{label}-detail-gate.json"), "w"), indent=1)
    for r in results:
        print(f"{'N/A ' if r.get('verifiable') is False else ('PASS' if r['pass'] else 'FAIL')}{'*' if r.get('visualOnly') else ' '} {r['name']:<14} dE={r.get('deltaE','-')} struct={r.get('structure','-')} px={r.get('pixelsAcross','-')}  {'; '.join(r['failures'])}")
    print("(*) low contrast or flat region: shape and sharpness not measurable; the auditor MUST verify it visually")
    print(f"DETAIL GATE: {report['gate']}  fit(az={fit['azimuth']}, el={fit['elevation']}, iou={fit['iou']:.3f})")
    sys.exit(1 if blocking else 0)


if __name__ == "__main__":
    main()
