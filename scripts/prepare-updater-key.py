#!/usr/bin/env python3
"""Turn the GitHub updater secret into a key file Tauri can actually sign with.

`tauri signer generate` writes a single-line base64 blob. Decoded, that blob
starts with `untrusted comment: rsign encrypted secret key`. GitHub secrets
often arrive as the blob, the decoded two-liner with newlines stripped, or
with a dummy password set. Any of those produces:

    incorrect updater private key password: Missing comment in secret key
"""
from __future__ import annotations

import base64
import os
import re
import sys
from pathlib import Path


def fail(message: str) -> None:
    print(f"::error::{message}", file=sys.stderr)
    raise SystemExit(1)


def strip_wrapping(value: str) -> str:
    text = value.strip().strip('"').strip("'").strip()
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text


def maybe_decode(value: str) -> str:
    if "untrusted comment:" in value:
        return value
    compact = "".join(value.split())
    try:
        decoded = base64.b64decode(compact, validate=False).decode("utf-8")
    except Exception:
        return value
    return decoded if "untrusted comment:" in decoded else value


def restore_newline(value: str) -> str:
    if "\n" in value or "untrusted comment:" not in value:
        return value
    match = re.match(
        r"(untrusted comment:.*?key)\s+(\S.*)$",
        value,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return value
    return f"{match.group(1)}\n{match.group(2).strip()}\n"


def main() -> None:
    raw = os.environ.get("TAURI_SIGNING_PRIVATE_KEY", "")
    if not raw.strip():
        fail(
            "TAURI_SIGNING_PRIVATE_KEY is empty. Add a repository secret "
            "(Settings → Secrets and variables → Actions) with the exact "
            "contents of ~/.tauri/stremo-updater.key. Do not create "
            "TAURI_SIGNING_PRIVATE_KEY_PASSWORD unless the key was generated "
            "with a password."
        )

    key = restore_newline(maybe_decode(strip_wrapping(raw)))
    if "untrusted comment:" not in key:
        fail(
            "Updater private key is missing the `untrusted comment:` header. "
            "Paste the full ~/.tauri/stremo-updater.key file into the "
            "TAURI_SIGNING_PRIVATE_KEY repository secret."
        )

    dest_dir = Path(os.environ.get("RUNNER_TEMP") or os.environ.get("TEMP") or "/tmp")
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "stremo-updater.key"
    dest.write_text(key if key.endswith("\n") else key + "\n", encoding="utf-8")

    github_env = os.environ.get("GITHUB_ENV")
    if not github_env:
        fail("GITHUB_ENV is not set; this script is meant to run in GitHub Actions.")

    with open(github_env, "a", encoding="utf-8") as handle:
        handle.write(f"TAURI_SIGNING_PRIVATE_KEY_PATH={dest}\n")
        # An empty or dummy password secret is what usually triggers
        # `Missing comment in secret key` for a passwordless key.
        password = os.environ.get("TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "").strip()
        if password:
            handle.write(f"TAURI_SIGNING_PRIVATE_KEY_PASSWORD={password}\n")

    print(f"Updater signing key written to {dest}")
    print("Key header is present.")
    if os.environ.get("TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "").strip():
        print("Using TAURI_SIGNING_PRIVATE_KEY_PASSWORD from secrets.")
    else:
        print("No updater key password set (correct for a passwordless key).")


if __name__ == "__main__":
    main()
