#!/usr/bin/env python3
"""
Lightweight telemetry helper for Codex mentoring sessions.

This script centralizes payload normalization so the agent does not need to
handcraft raw JSON or worry about quoting, identity, or lesson-path parsing.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_CONFIG_PATH = Path.home() / ".codex" / "telemetry_config.json"


@dataclass
class Config:
    endpoint: str
    token: str
    export_dir: Path
    timeout_seconds: int = 10


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send a normalized telemetry report.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH))
    parser.add_argument("--trigger", required=True, choices=["manual", "session_end", "lesson_switch", "idle_timeout"])
    parser.add_argument("--status", required=True, choices=["clear", "partial", "stuck"])
    parser.add_argument("--progress", required=True, type=int)
    parser.add_argument("--confidence", required=True, type=int)
    parser.add_argument("--lesson-confidence", default="medium", choices=["high", "medium", "low"])
    parser.add_argument("--summary", required=True)
    parser.add_argument("--action", required=True)
    parser.add_argument("--repeated", type=int, default=1)
    parser.add_argument("--report-date", default=date.today().isoformat())
    parser.add_argument("--month", type=int)
    parser.add_argument("--week", type=int)
    parser.add_argument("--day", type=int)
    parser.add_argument("--path")
    parser.add_argument("--lesson-path")
    parser.add_argument("--assignment-path")
    parser.add_argument("--gap", action="append", dest="gaps", default=[])
    parser.add_argument("--cause", action="append", dest="causes", default=[])
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def load_config(path_str: str) -> Config:
    path = Path(path_str).expanduser()
    if not path.exists():
      raise SystemExit(f"Telemetry config not found: {path}")

    raw = json.loads(path.read_text(encoding="utf-8"))
    endpoint = str(raw.get("endpoint", "")).strip()
    token = str(raw.get("token", "")).strip()
    timeout = int(raw.get("timeout_seconds", 10))
    export_dir = Path(raw.get("export_dir") or (Path.home() / ".codex" / "telemetry_exports"))

    if not endpoint:
        raise SystemExit("Telemetry config is missing 'endpoint'.")
    if not token:
        raise SystemExit("Telemetry config is missing 'token'.")

    return Config(
        endpoint=endpoint,
        token=token,
        export_dir=export_dir,
        timeout_seconds=timeout,
    )


def machine_identity() -> str:
    for key in ("USERNAME", "USER"):
        value = os.environ.get(key, "").strip()
        if value:
            return value

    return Path.home().name


def bounded(value: int, minimum: int, maximum: int, field_name: str) -> int:
    if value < minimum or value > maximum:
        raise SystemExit(f"{field_name} must be between {minimum} and {maximum}.")
    return value


def infer_position(*paths: str | None) -> tuple[int | None, int | None, int | None]:
    joined = " / ".join(part for part in paths if part)
    if not joined:
        return (None, None, None)

    month_match = re.search(r"month[\s_-]*(\d+)", joined, re.IGNORECASE)
    week_match = re.search(r"week[\s_-]*(\d+)", joined, re.IGNORECASE)
    day_match = re.search(r"day[\s_-]*(\d+)", joined, re.IGNORECASE)

    month = int(month_match.group(1)) if month_match else None
    week = int(week_match.group(1)) if week_match else None
    day = int(day_match.group(1)) if day_match else None
    return (month, week, day)


def normalize_paths(args: argparse.Namespace) -> tuple[str | None, str | None]:
    lesson_path = args.lesson_path or args.path
    assignment_path = args.assignment_path or args.path
    return lesson_path, assignment_path


def build_payload(args: argparse.Namespace) -> dict[str, Any]:
    student = machine_identity()
    lesson_path, assignment_path = normalize_paths(args)
    inferred_month, inferred_week, inferred_day = infer_position(lesson_path, assignment_path)

    month = args.month if args.month is not None else inferred_month
    week = args.week if args.week is not None else inferred_week
    day = args.day if args.day is not None else inferred_day

    if month is None or week is None or day is None:
        raise SystemExit(
            "Could not infer course month/week/day. Pass --month/--week/--day or provide a path containing Month/Week/Day."
        )

    payload = {
        "studentId": student,
        "studentName": student,
        "reportDate": args.report_date,
        "month": bounded(month, 1, 12, "month"),
        "week": bounded(week, 1, 5, "week"),
        "day": bounded(day, 1, 7, "day"),
        "lessonPath": lesson_path,
        "assignmentPath": assignment_path,
        "lessonConfidence": args.lesson_confidence,
        "understandingStatus": args.status,
        "progressScore": bounded(args.progress, 0, 100, "progress"),
        "confidenceScore": bounded(args.confidence, 0, 100, "confidence"),
        "gapCategories": sorted(set(args.gaps)),
        "summary": args.summary.strip(),
        "likelyCauses": args.causes,
        "recommendedTutorAction": args.action.strip(),
        "repeatedTopicSignals": bounded(args.repeated, 0, 20, "repeated"),
        "triggerReason": args.trigger,
    }

    if not payload["gapCategories"]:
        raise SystemExit("At least one --gap value is required.")
    if not payload["likelyCauses"]:
        raise SystemExit("At least one --cause value is required.")
    if not payload["summary"]:
        raise SystemExit("--summary cannot be empty.")
    if not payload["recommendedTutorAction"]:
        raise SystemExit("--action cannot be empty.")

    return payload


def append_export(config: Config, payload: dict[str, Any], response: dict[str, Any] | None, error: str | None) -> None:
    config.export_dir.mkdir(parents=True, exist_ok=True)
    export_path = config.export_dir / f"{payload['reportDate']}.jsonl"
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
        "response": response,
        "error": error,
    }
    with export_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=True) + "\n")


def post_payload(config: Config, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        config.endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.token}",
            "User-Agent": "CodexTelemetryHelper/1.0",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=config.timeout_seconds) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    args = parse_args()
    config = load_config(args.config)
    payload = build_payload(args)

    if args.dry_run:
        print(json.dumps(payload, indent=2))
        return 0

    try:
        response = post_payload(config, payload)
        append_export(config, payload, response=response, error=None)
        print(json.dumps(response))
        return 0
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        append_export(config, payload, response=None, error=body)
        print(body, file=sys.stderr)
        return 1
    except Exception as error:  # noqa: BLE001
        append_export(config, payload, response=None, error=str(error))
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
