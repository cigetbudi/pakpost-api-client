#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [[ -z "$ROOT" ]]; then
  echo "ERROR: Jalankan dari dalam Git repository."
  exit 1
fi

export PROJECT_ROOT="$ROOT"

python3 <<'PY'
import os
import subprocess
import zipfile
from pathlib import Path

root = Path(os.environ["PROJECT_ROOT"])
output = root / f"{root.name}-source-clean.zip"

excluded_dirs = {
    ".git", "node_modules", "bin", "obj", "dist",
    "build", "coverage", "test-results", "playwright-report",
    ".next", ".nuxt", ".output", ".turbo", ".vite",
    ".cache", ".venv", "venv", "__pycache__",
    ".idea", ".terraform", "vendor",
    "debug", "release", "publish"
}

excluded_files = {
    ".npmrc", ".pypirc", ".netrc",
    "secrets.json", "credentials.json",
    "token.json", "launchsettings.json",
    "id_rsa", "id_ed25519"
}

allowed_extensions = {
    ".cs", ".csproj", ".sln", ".slnx",
    ".props", ".targets",
    ".go", ".mod", ".sum",
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".py", ".sh", ".sql",
    ".json", ".jsonc", ".yaml", ".yml", ".toml",
    ".xml", ".html", ".css", ".scss",
    ".md", ".txt", ".svg",
    ".config", ".conf", ".ini", ".lock",
    ".proto", ".graphql", ".http", ".rest"
}

allowed_names = {
    "dockerfile", "makefile", "license",
    "readme", ".gitignore", ".gitattributes",
    ".dockerignore", ".editorconfig",
    ".env.example", ".env.sample", ".env.template"
}

max_size = 5 * 1024 * 1024

result = subprocess.run(
    [
        "git", "-C", str(root),
        "ls-files", "--cached", "--others",
        "--exclude-standard", "-z"
    ],
    check=True,
    capture_output=True
)

paths = sorted(set(
    os.fsdecode(p)
    for p in result.stdout.split(b"\0") if p
))

included = []
skipped = 0

with zipfile.ZipFile(
    output, "w",
    compression=zipfile.ZIP_DEFLATED,
    compresslevel=9
) as archive:

    for rel in paths:
        relative = Path(rel)
        file = root / relative
        name = file.name.lower()

        if not file.is_file() or file.is_symlink():
            continue

        if any(part.lower() in excluded_dirs
               for part in relative.parts[:-1]):
            skipped += 1
            continue

        if name in excluded_files:
            skipped += 1
            continue

        if name.startswith("appsettings") and name.endswith(".json"):
            skipped += 1
            continue

        if name.startswith(".env") and name not in allowed_names:
            skipped += 1
            continue

        if (
            name.endswith((".key", ".pem", ".pfx", ".p12",
                           ".bak", ".patch", ".diff", ".log"))
            or name.startswith("service-account")
        ):
            skipped += 1
            continue

        if (
            relative.suffix.lower() not in allowed_extensions
            and name not in allowed_names
        ):
            skipped += 1
            continue

        if file.stat().st_size > max_size:
            skipped += 1
            continue

        # Additional binary detection
        with file.open("rb") as f:
            if b"\x00" in f.read(4096):
                skipped += 1
                continue

        archive.write(file, arcname=rel)
        included.append(rel)

print()
print("=== SOURCE ARCHIVE CREATED ===")
print(f"Output   : {output}")
print(f"Included : {len(included)} files")
print(f"Skipped  : {skipped} files")
print(f"Size     : {output.stat().st_size / 1024 / 1024:.2f} MB")
print("================================")
print("Review ZIP for hardcoded secrets before sharing.")
PY
