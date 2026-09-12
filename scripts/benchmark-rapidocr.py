"""Run RapidOCR on one image and print text regions for comparison."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
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
    parser.add_argument("--detector", type=Path, default=None)
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
    if args.detector:
        session = ort.InferenceSession(str(args.detector), providers=["CPUExecutionProvider"])
        size = 1024
        scale = min(size / image.shape[1], size / image.shape[0])
        width, height = max(1, round(image.shape[1] * scale)), max(1, round(image.shape[0] * scale))
        resized = cv2.resize(image, (width, height))
        canvas = np.full((size, size, 3), 114, dtype=np.uint8)
        offset_x, offset_y = (size - width) // 2, (size - height) // 2
        canvas[offset_y:offset_y + height, offset_x:offset_x + width] = resized
        # This Ultralytics ONNX export performs its own /255 normalization.
        # Passing an already normalized tensor makes all confidences nearly 0.
        tensor = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB).astype(np.float32)
        tensor = np.transpose(tensor, (2, 0, 1))[None, ...]
        detections = session.run(None, {"images": tensor})[0][0]
        requested_boxes = []
        for x1, y1, x2, y2, confidence, class_id in detections:
            if confidence >= 0.35 and int(class_id) == 1:
                requested_boxes.append({
                    "x": float(max(0, (x1 - offset_x) / scale)),
                    "y": float(max(0, (y1 - offset_y) / scale)),
                    "width": float(max(1, (x2 - x1) / scale)),
                    "height": float(max(1, (y2 - y1) / scale)),
                })
        requested_boxes = requested_boxes[:64]
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
