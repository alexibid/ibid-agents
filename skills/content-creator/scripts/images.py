#!/usr/bin/env python3
"""Deterministic image work for web content: inspect, crop, resize and compress."""
import argparse
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

FORMATS = {"webp": "WEBP", "avif": "AVIF", "jpeg": "JPEG", "png": "PNG"}
GRAVITIES = {"center": (0.5, 0.5), "top": (0.5, 0.0), "bottom": (0.5, 1.0), "left": (0.0, 0.5), "right": (1.0, 0.5)}


def opened(path):
    image = ImageOps.exif_transpose(Image.open(path))
    return image.convert("RGBA") if image.mode in ("P", "LA") else image


def described(path):
    with Image.open(path) as image:
        return {"file": str(path), "width": image.width, "height": image.height, "format": image.format, "bytes": Path(path).stat().st_size}


def cropped_to_aspect(image, aspect, gravity):
    wide, tall = (int(part) for part in aspect.split(":"))
    target = wide / tall
    width, height = image.size
    if width / height > target:
        new_width, new_height = round(height * target), height
    else:
        new_width, new_height = width, round(width / target)
    weight_x, weight_y = GRAVITIES[gravity]
    left = round((width - new_width) * weight_x)
    top = round((height - new_height) * weight_y)
    return image.crop((left, top, left + new_width, top + new_height))


def cropped_to_box(image, box):
    left, top, width, height = (int(part) for part in box.split(","))
    return image.crop((left, top, left + width, top + height))


def resized(image, width):
    if width >= image.width:
        return image
    return image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)


def encoded(image, fmt, quality):
    buffer = io.BytesIO()
    frame = image.convert("RGB") if fmt in ("jpeg",) and image.mode != "RGB" else image
    frame.save(buffer, FORMATS[fmt], quality=quality, optimize=True)
    return buffer.getvalue()


def smallest_within(image, fmt, max_kb):
    for quality in range(90, 39, -5):
        data = encoded(image, fmt, quality)
        if len(data) <= max_kb * 1024:
            return data, quality
    return encoded(image, fmt, 40), 40


def run(arguments):
    source = Path(arguments.input)
    image = opened(source)
    if arguments.aspect:
        image = cropped_to_aspect(image, arguments.aspect, arguments.gravity)
    if arguments.box:
        image = cropped_to_box(image, arguments.box)
    if arguments.width:
        image = resized(image, arguments.width)
    if arguments.max_kb:
        data, quality = smallest_within(image, arguments.format, arguments.max_kb)
    else:
        data, quality = encoded(image, arguments.format, arguments.quality), arguments.quality
    Path(arguments.output).write_bytes(data)
    return {"before": described(source), "after": described(arguments.output), "quality": quality}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    info = commands.add_parser("info", help="print size, format and bytes")
    info.add_argument("input")
    make = commands.add_parser("make", help="crop, resize and compress into a new file")
    make.add_argument("input")
    make.add_argument("output")
    make.add_argument("--aspect", help="crop to a ratio such as 16:9 or 1:1")
    make.add_argument("--gravity", choices=sorted(GRAVITIES), default="center")
    make.add_argument("--box", help="crop to x,y,width,height in pixels")
    make.add_argument("--width", type=int, help="largest width in pixels; never enlarges")
    make.add_argument("--format", choices=sorted(FORMATS), default="webp")
    make.add_argument("--quality", type=int, default=80)
    make.add_argument("--max-kb", type=int, help="highest quality that fits this size")
    arguments = parser.parse_args()
    result = described(arguments.input) if arguments.command == "info" else run(arguments)
    json.dump(result, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
