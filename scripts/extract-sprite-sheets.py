import argparse
import json
from collections import deque
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SHEETS_DIR = ROOT / "art-source" / "sprite-sheets-illustrated"
OUT_DIR = ROOT / "assets" / "resources" / "sprites"
BACKUP_DIR = ROOT / "art-source" / "backup" / "sprites-cartoon"
CHECKS_DIR = ROOT / "art-source" / "checks"
CANVAS_SIZE = 192
DEFAULT_FILL = 0.92
PAD_PX = 4
SQUARE_SPRITES = {"cardboard_closed", "cardboard_cracked"}

SHEETS: dict[str, list[str]] = {
    "sheet_01": [
        "handbag",
        "ukulele",
        "yarn",
        "succulent",
        "headphone",
        "umbrella",
        "gamepad",
        "sneaker",
        "watering_can",
    ],
    "sheet_02": [
        "candle",
        "cap",
        "backpack",
        "cardboard_closed",
        "cardboard_cracked",
        "keychain",
        "teddy",
        "lamp",
        "pillow",
    ],
    "sheet_03": [
        "slipper",
        "alarm_clock",
        "sweater",
        "iron",
        "sunglasses",
        "pan",
        "baguette",
        "cat_can",
        "snack_bag",
    ],
    "sheet_04": [
        "kettle",
        "teapot",
        "apple",
        "banana",
        "milk_carton",
        "thermos",
        "soap_bottle",
        "towel_roll",
        "bath_sponge",
    ],
    "sheet_05": [
        "shampoo",
        "comb",
        "bath_bomb",
        "mirror_hand",
        "bucket_wash",
        "rubber_duck",
        "toothbrush",
        "hairdryer",
        "skincare",
    ],
    "sheet_06": [
        "perfume",
        "globe",
        "fountain_pen",
        "magnifying_glass",
        "paint_tube",
        "scissors",
        "tape_roll",
        "calculator",
        "telescope",
    ],
    "sheet_07": [
        "book",
        "notebook",
        "paint_palette",
        "camera",
        "cactus",
        "watch",
        "macaron",
        "boba_tea",
        "croissant",
    ],
    "sheet_08": [
        "ice_cream",
        "pudding",
        "cupcake",
        "cherry_pie",
        "menu_board",
        "cake",
        "donut",
        "coffee_cup",
        "teacup",
    ],
    "sheet_09": [
        "cookie_box",
        "jam_jar",
        "handbag_v2",
        "ukulele_v2",
        "yarn_v2",
        "succulent_v2",
        "headphone_v2",
        "umbrella_v2",
        "gamepad_v2",
    ],
    "sheet_10": [
        "sneaker_v2",
        "watering_can_v2",
        "candle_v2",
        "cap_v2",
        "backpack_v2",
        "handbag_v3",
        "yarn_v3",
        "succulent_v3",
        "backpack_v3",
    ],
    "sheet_11": [
        "soap_bottle_v2",
        "towel_roll_v2",
        "bath_sponge_v2",
        "shampoo_v2",
        "mirror_hand_v2",
        "bucket_wash_v2",
        "rubber_duck_v2",
        "hairdryer_v2",
        "perfume_v2",
    ],
    "sheet_12": [
        "book_v2",
        "notebook_v2",
        "camera_v2",
        "cactus_v2",
        "boba_tea_v2",
        "cupcake_v2",
        "coffee_cup_v2",
        "jam_jar_v2",
        "cake_v2",
    ],
    "sheet_13": [
        "thermos_v2",
        "thermos_v3",
        "kettle_v2",
        "teapot_v2",
        "snack_bag_v2",
        "teddy_v2",
        "teddy_v3",
        "pillow_v2",
        "sweater_v2",
    ],
    "sheet_14": [
        "sweater_drape_back",
        "sweater_drape_back_v2",
        "sweater_drape_back_v3",
        "sweater_drape_edge",
        "sweater_drape_edge_v2",
        "sweater_drape_edge_v3",
        "towel_roll_drape",
        "towel_roll_drape_v2",
        "ukulele_lean",
    ],
    "sheet_15": [
        "ukulele_lean_v2",
        "ukulele_lean_v3",
        "umbrella_lean",
        "umbrella_lean_v2",
        "book_open",
        "book_open_v2",
        "thermos_lie",
        "thermos_lie_v2",
        "cat_can_tilt",
    ],
    "sheet_16": [
        "cat_can_tilt_v2",
        "snack_bag_tuck",
        "keychain_tuck",
    ],
}

HOLE_SPRITES = {
    "handbag",
    "handbag_v2",
    "handbag_v3",
    "coffee_cup",
    "coffee_cup_v2",
    "teacup",
    "teapot",
    "teapot_v2",
    "kettle",
    "kettle_v2",
    "watering_can",
    "watering_can_v2",
    "scissors",
    "headphone",
    "headphone_v2",
    "keychain",
    "keychain_tuck",
    "donut",
    "tape_roll",
    "umbrella",
    "umbrella_v2",
    "sunglasses",
    "bath_sponge",
    "bath_sponge_v2",
    "bucket_wash",
    "bucket_wash_v2",
    "backpack",
    "backpack_v2",
    "backpack_v3",
    "thermos_v3",
    "iron",
    "paint_palette",
}


def minimum_rgb(img: Image.Image) -> Image.Image:
    red, green, blue = img.convert("RGB").split()
    return ImageChops.darker(ImageChops.darker(red, green), blue)


def bg_mask_candidates(img: Image.Image, min_luma: int = 238, max_chroma: int = 22) -> Image.Image:
    """Marks pure/near-white low-chroma background pixels as 255."""
    rgb = img.convert("RGB")
    r, g, b = rgb.split()
    lo = ImageChops.darker(ImageChops.darker(r, g), b)
    hi = ImageChops.lighter(ImageChops.lighter(r, g), b)
    chroma = ImageChops.subtract(hi, lo)
    lo_px = lo.load()
    ch_px = chroma.load()
    out = Image.new("L", rgb.size, 0)
    out_px = out.load()
    w, h = rgb.size
    for y in range(h):
        for x in range(w):
            if lo_px[x, y] >= min_luma and ch_px[x, y] <= max_chroma:
                out_px[x, y] = 255
    return out


def find_valley_splits(
    foreground: Image.Image,
    cols: int = 3,
    rows: int = 3,
) -> tuple[list[int], list[list[int]], list[str]]:
    width, height = foreground.size
    pixels = foreground.load()
    warnings: list[str] = []

    def best_cut(counts: list[int], total: int, frac: float, label: str, span_frac: float = 0.14) -> int:
        center = int(total * frac)
        span = int(total * span_frac)
        lo = max(1, center - span)
        hi = min(total - 2, center + span)
        min_val = min(counts[lo : hi + 1])
        candidates = [i for i in range(lo, hi + 1) if counts[i] == min_val]
        cut = candidates[len(candidates) // 2]
        if min_val > 2:
            warnings.append(f"{label} cut at {cut} crosses {min_val} foreground pixels")
        return cut

    col_counts = [0] * width
    for row in range(height):
        for col in range(width):
            col_counts[col] += bool(pixels[col, row])
    xs = [0]
    for c in range(1, cols):
        xs.append(best_cut(col_counts, width, c / cols, f"col-{c}"))
    xs.append(width)

    ys_per_col: list[list[int]] = []
    for col in range(cols):
        if rows == 1:
            ys_per_col.append([0, height])
            continue
        row_counts = [
            sum(bool(pixels[x_pos, row]) for x_pos in range(xs[col], xs[col + 1]))
            for row in range(height)
        ]
        col_ys = [0]
        for r in range(1, rows):
            col_ys.append(best_cut(row_counts, height, r / rows, f"col{col}-row-{r}", span_frac=0.16))
        col_ys.append(height)
        ys_per_col.append(col_ys)

    return xs, ys_per_col, warnings


def remove_white_matte(rgba: Image.Image, name: str) -> None:
    width, height = rgba.size
    darkest = minimum_rgb(rgba)
    white = darkest.load()
    candidates = bg_mask_candidates(rgba, min_luma=238, max_chroma=22)
    padded = Image.new("L", (width + 2, height + 2), 255)
    padded.paste(candidates, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    exterior = padded.crop((1, 1, width + 1, height + 1))
    background = exterior.point(lambda value: 255 if value == 128 else 0)
    if name in HOLE_SPRITES:
        unvisited = exterior.load()
        foreground_area = width * height - background.histogram()[255]
        for row in range(1, height - 1):
            for col in range(1, width - 1):
                if unvisited[col, row] != 255:
                    continue
                component = []
                pending = deque([(col, row)])
                unvisited[col, row] = 0
                while pending:
                    x_pos, y_pos = pending.popleft()
                    component.append((x_pos, y_pos))
                    for nx, ny in ((x_pos - 1, y_pos), (x_pos + 1, y_pos), (x_pos, y_pos - 1), (x_pos, y_pos + 1)):
                        if 0 <= nx < width and 0 <= ny < height and unvisited[nx, ny] == 255:
                            pending.append((nx, ny))
                            unvisited[nx, ny] = 0
                if max(24, foreground_area * 0.004) <= len(component) <= foreground_area * 0.42:
                    if sum(white[pos] >= 240 for pos in component) >= len(component) * 0.92:
                        ImageDraw.Draw(background).point(component, fill=255)

    edge = ImageChops.subtract(background.filter(ImageFilter.MaxFilter(5)), background).load()
    reference = darkest.filter(ImageFilter.MinFilter(7)).load()
    pixels = rgba.load()
    matte = background.load()
    for row in range(height):
        for col in range(width):
            if matte[col, row]:
                pixels[col, row] = (0, 0, 0, 0)
            elif edge[col, row] and white[col, row] >= 180:
                contrast = 255 - reference[col, row]
                opacity = min(1, (255 - white[col, row]) / contrast) if contrast >= 12 else 1
                if opacity <= 0.04:
                    pixels[col, row] = (0, 0, 0, 0)
                elif opacity < 1:
                    rgb = tuple(max(0, round(255 - (255 - channel) / opacity)) for channel in pixels[col, row][:3])
                    pixels[col, row] = (*rgb, round(opacity * 255))


def alpha_box(sprite: Image.Image) -> tuple[int, int, int, int] | None:
    return sprite.getchannel("A").point(lambda alpha: 255 if alpha > 16 else 0).getbbox()


def clean_cell_to_sprite(cell: Image.Image, name: str, has_alpha: bool) -> Image.Image:
    rgba = cell.convert("RGBA")
    if has_alpha:
        alpha = rgba.getchannel("A")
        near_silhouette = alpha.point(lambda value: 255 if value >= 96 else 0).filter(ImageFilter.MaxFilter(7))
        rgba.putalpha(ImageChops.multiply(alpha.point(lambda value: value if value > 12 else 0), near_silhouette))
    else:
        remove_white_matte(rgba, name)

    bounds = alpha_box(rgba)
    if bounds is None:
        raise ValueError(f"No foreground extracted for {name}")
    left, top, right, bottom = bounds
    cropped = rgba.crop((
        max(0, left - 2),
        max(0, top - 2),
        min(rgba.width, right + 2),
        min(rgba.height, bottom + 2),
    ))
    if name in SQUARE_SPRITES:
        scale = round(CANVAS_SIZE * 0.88) / max(cropped.width, cropped.height)
        size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
        resized = cropped.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
        canvas.paste(resized, ((CANVAS_SIZE - size[0]) // 2, (CANVAS_SIZE - size[1]) // 2))
        return canvas

    # Preserve tight natural non-square aspect ratio (longest edge = CANVAS_SIZE)
    max_content = CANVAS_SIZE - PAD_PX * 2
    scale = max_content / max(cropped.width, cropped.height)
    new_w = max(1, round(cropped.width * scale))
    new_h = max(1, round(cropped.height * scale))
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (new_w + PAD_PX * 2, new_h + PAD_PX * 2), (0, 0, 0, 0))
    canvas.paste(resized, (PAD_PX, PAD_PX))
    return canvas


def quantize_and_save(sprite: Image.Image, out_path: Path) -> None:
    quantized = sprite.quantize(
        colors=256,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    )
    quantized.save(out_path, optimize=True)


def build_contact_sheet(sprites: list[tuple[str, Image.Image]], out_path: Path) -> None:
    cols = 3
    cell = 232
    rows = (len(sprites) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (222, 198, 170, 255))
    draw = ImageDraw.Draw(sheet)

    for idx, (name, im) in enumerate(sprites):
        gx = (idx % cols) * cell
        gy = (idx // cols) * cell
        # Left warm wood half + right dark slate half so any white halo or trapped hole jumps out
        draw.rectangle([gx + 4, gy + 4, gx + cell - 4, gy + cell - 4], fill=(232, 212, 186, 255))
        draw.rectangle([gx + cell // 2, gy + 24, gx + cell - 4, gy + cell - 4], fill=(58, 48, 56, 255))
        sheet.alpha_composite(im, (gx + (cell - im.width) // 2, gy + 12))
        draw.text((gx + 8, gy + 5), name, fill=(45, 28, 22, 255))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def find_sheet_path(sheets_dir: Path, sheet_name: str) -> Path:
    for ext in (".png", ".jpg", ".jpeg"):
        cand = sheets_dir / f"{sheet_name}{ext}"
        if cand.exists():
            return cand
    raise FileNotFoundError(f"Missing sprite sheet: {sheets_dir / sheet_name}.[png|jpg]")


def process_sheet(sheet_name: str, sheets_dir: Path, checks_dir: Path) -> dict[str, float]:
    sheet_path = find_sheet_path(sheets_dir, sheet_name)
    names = SHEETS[sheet_name]
    cols = 3
    rows = 1 if len(names) <= 3 else 3
    with Image.open(sheet_path) as source:
        img = source.convert("RGBA")
    alpha = img.getchannel("A")
    has_alpha = alpha.getextrema()[0] < 255
    foreground = (
        alpha.point(lambda value: 1 if value >= 96 else 0)
        if has_alpha
        else bg_mask_candidates(img, min_luma=238, max_chroma=22).point(lambda value: 0 if value else 1)
    )
    xs, ys_per_col, warnings = find_valley_splits(foreground, cols=cols, rows=rows)
    for warning in warnings:
        print(f"[WARN] {sheet_name}: {warning}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    extracted: list[tuple[str, Image.Image]] = []
    aspects: dict[str, float] = {}
    for row in range(rows):
        for col in range(cols):
            idx = row * cols + col
            if idx >= len(names):
                continue
            name = names[idx]
            ys = ys_per_col[col]
            cell = img.crop((xs[col], ys[row], xs[col + 1], ys[row + 1]))
            sprite = clean_cell_to_sprite(cell, name, has_alpha)
            out_file = OUT_DIR / f"{name}.png"
            quantize_and_save(sprite, out_file)
            saved = Image.open(out_file).convert("RGBA")
            aspects[name] = round(saved.width / max(1, saved.height), 3)
            extracted.append((name, saved))

    check_path = checks_dir / f"sheet_check_illustrated_{sheet_name}.png"
    build_contact_sheet(extracted, check_path)
    print(f"[OK] {sheet_name}: extracted {len(extracted)} sprites -> {check_path}")
    return aspects


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract 3x3 or 3x1 illustrated sprite sheets into transparent PNG-8 assets.")
    parser.add_argument("sheets", nargs="*", help="Sheet names (e.g. sheet_01) or --all")
    parser.add_argument("--all", action="store_true", help="Extract all defined sheets")
    parser.add_argument("--source-dir", type=Path, default=SHEETS_DIR, help="Directory containing source sprite sheets")
    parser.add_argument("--checks-dir", "--scratch-dir", type=Path, default=CHECKS_DIR, help="Directory for visual check contact sheets")
    parser.add_argument("--write-aspects", type=Path, default=None, help="Optional path to write sprite aspectRatio JSON map")
    args = parser.parse_args()

    targets = list(SHEETS.keys()) if args.all else args.sheets
    if not targets:
        parser.error("Specify one or more sheet names or --all")

    all_aspects: dict[str, float] = {}
    for name in targets:
        if name not in SHEETS:
            raise SystemExit(f"Unknown sheet '{name}'. Valid: {', '.join(SHEETS.keys())}")
        all_aspects.update(process_sheet(name, args.source_dir, args.checks_dir))

    if args.write_aspects:
        args.write_aspects.parent.mkdir(parents=True, exist_ok=True)
        existing = {}
        if args.write_aspects.exists():
            try:
                existing = json.loads(args.write_aspects.read_text("utf-8"))
            except Exception:
                existing = {}
        existing.update(all_aspects)
        args.write_aspects.write_text(json.dumps(existing, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"[OK] wrote {len(existing)} sprite aspect ratios -> {args.write_aspects}")


if __name__ == "__main__":
    main()
