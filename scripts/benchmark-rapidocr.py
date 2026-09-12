"""Run RapidOCR on one image and print text regions for comparison."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import cv2
from rapidocr_onnxruntime import RapidOCR


def _format_chars(chars, boxes) -> str:
    if not chars or not boxes or len(chars) != len(boxes):
        return ""
    widths = [max(1.0, float(box[1][0]) - float(box[0][0])) for box in boxes]
    median_width = sorted(widths)[len(widths) // 2]
    gap_threshold = max(4.0, median_width * 0.8)
    formatted = str(chars[0])
    for index in range(1, len(chars)):
        gap = float(boxes[index][0][0]) - float(boxes[index - 1][1][0])
        previous_char = str(chars[index - 1])
        current_char = str(chars[index])
        if previous_char in ",.!?;:" and current_char not in ",.!?;:'\")":
            formatted += " "
        elif gap >= gap_threshold:
            formatted += " "
        formatted += current_char
    return formatted


def _format_recognition(item) -> tuple[str, list]:
    """Use RapidOCR's character boxes to restore obvious inter-word gaps."""
    text = str(item[1] or "").strip()
    if len(item) < 6 or not item[4] or len(item[4]) != len(item[3]):
        return text, []

    chars = [str(char) for char in item[4]]
    boxes = item[3]
    return _format_chars(chars, boxes), boxes


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("--boxes", type=str, default="")
    args = parser.parse_args()

    started = time.perf_counter()
    # CPU profile for the manga preview path. These are RapidOCR's actual
    # supported parameters (the thread values are propagated to Det/Cls/Rec).
    engine = RapidOCR(
        max_side_len=1500,
        text_score=0.3,
        intra_op_num_threads=4,
        inter_op_num_threads=1,
    )
    engine_ready_ms = round((time.perf_counter() - started) * 1000, 1)
    recognition_started = time.perf_counter()
    image = cv2.imread(str(args.image))
    requested_boxes = json.loads(args.boxes) if args.boxes else None
    if requested_boxes:
        image = image if image is not None else cv2.imread(str(args.image))
        crops = []
        crop_offsets = []
        for requested in requested_boxes:
            x = max(0, int(requested["x"]) - 12)
            y = max(0, int(requested["y"]) - 12)
            right = min(image.shape[1], int(requested["x"] + requested["width"]) + 12)
            bottom = min(image.shape[0], int(requested["y"] + requested["height"]) + 12)
            crops.append(image[y:bottom, x:right])
            crop_offsets.append((x, y))
        recognition_results, _ = engine.text_rec(crops, return_word_box=True)
        result = []
        for requested, (recognized, offset) in zip(requested_boxes, zip(recognition_results, crop_offsets)):
            text, score = recognized[:2]
            chars = recognized[3] if len(recognized) > 3 else []
            char_boxes = recognized[2] if len(recognized) > 2 else []
            formatted = _format_chars(chars, char_boxes) or str(text)
            x, y = offset
            result.append([[
                [requested["x"], requested["y"]],
                [requested["x"] + requested["width"], requested["y"]],
                [requested["x"] + requested["width"], requested["y"] + requested["height"]],
                [requested["x"], requested["y"] + requested["height"]],
            ], formatted, score])
    else:
        result, _ = engine(str(args.image), return_word_box=True)
    recognition_ms = round((time.perf_counter() - recognition_started) * 1000, 1)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

    rows = []
    for item in result or []:
        box, text, score = item[:3]
        formatted_text, character_boxes = _format_recognition(item)
        rows.append({
            "text": formatted_text,
            "raw_text": text,
            "confidence": round(float(score), 4),
            "bbox": box,
        })

    print(json.dumps({
        "engine": "RapidOCR",
        "image": str(args.image),
        "elapsed_ms": elapsed_ms,
        "timings": {
            "engine_ready_ms": engine_ready_ms,
            "recognition_ms": recognition_ms,
        },
        "count": len(rows),
        "results": rows,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
