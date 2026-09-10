#!/usr/bin/env python3
"""Prepare TAURI_SIGNING_PRIVATE_KEY for `tauri build`.

`tauri build` reads TAURI_SIGNING_PRIVATE_KEY (not PATH). The value must be the
one-line base64 blob from `tauri signer generate` — the same bytes as
~/.tauri/stremo-updater.key. That blob decodes to a minisign key starting with
`untrusted comment:`. Passing the decoded text makes signing fail.
"""
from __future__ import annotations

import base64
import os
import sys
from pathlib import Path


def fail(message: str) -> None:
    print(f"::error::{message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    raw = os.environ.get("TAURI_SIGNING_PRIVATE_KEY", "").strip().strip('"').strip("'")
    raw = "".join(raw.split())
    if not raw:
        fail(
            "TAURI_SIGNING_PRIVATE_KEY is empty. Add a repository secret with the "
            "exact contents of ~/.tauri/stremo-updater.key (one base64 line)."
        )

    try:
        decoded = base64.b64decode(raw, validate=True).decode("utf-8")
    except Exception:
        fail(
            "TAURI_SIGNING_PRIVATE_KEY is not valid base64. Paste the full "
            "~/.tauri/stremo-updater.key file, not the decoded minisign text."
        )

    if "untrusted comment:" not in decoded:
        fail(
            "Decoded updater key is missing the `untrusted comment:` header. "
            "Replace the GitHub secret with ~/.tauri/stremo-updater.key."
        )

    password = os.environ.get("TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "").strip()
    if not password:
        fail(
            "TAURI_SIGNING_PRIVATE_KEY_PASSWORD is empty. Empty-password keys "
            "cannot be decrypted by this Tauri/minisign version. Set the "
            "repository secret to the contents of ~/.tauri/stremo-updater.password."
        )

    github_env = os.environ.get("GITHUB_ENV")
    if not github_env:
        fail("GITHUB_ENV is not set; this script is meant to run in GitHub Actions.")

    # Heredoc so Windows runners cannot mangle the value.
    with open(github_env, "a", encoding="utf-8") as handle:
        handle.write("TAURI_SIGNING_PRIVATE_KEY<<EOF\n")
        handle.write(f"{raw}\n")
        handle.write("EOF\n")
        handle.write("TAURI_SIGNING_PRIVATE_KEY_PASSWORD<<EOF\n")
        handle.write(f"{password}\n")
        handle.write("EOF\n")

    dest = Path(os.environ.get("RUNNER_TEMP") or "/tmp") / "stremo-updater.key"
    dest.write_text(raw + "\n", encoding="utf-8")
    print("Updater signing key accepted (base64 minisign secret).")
    print("Password is set.")


if __name__ == "__main__":
    main()
