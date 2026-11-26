#!/usr/bin/env bash
set -euo pipefail

# flutter_onnxruntime 1.9.0 pins masicai/onnxruntime-swift-package-manager
# at 1.28.0. Its manifest points the Extensions binary target at
# download.onnxruntime.ai, whose TLS hostname is currently invalid. Fetch the
# byte-identical mirror (or use the supplied local copy), verify its SHA-256,
# then make SwiftPM consume that verified archive as a local binary target.

readonly ORT_SPM_REPOSITORY="https://github.com/masicai/onnxruntime-swift-package-manager.git"
readonly ORT_SPM_TAG="1.28.0"
readonly ORT_EXTENSIONS_URL="https://github.com/BasedHardware/omi/releases/download/desktop-build-deps-onnx-1.24.2-extensions-0.13.0/pod-archive-onnxruntime-extensions-c-0.13.0.zip"
readonly ORT_EXTENSIONS_CHECKSUM="346522d1171d4c99cb0908fa8e4e9330a4a6aad39cd83ce36eb654437b33e6b5"

: "${PUB_CACHE:=$HOME/.pub-cache}"

if [[ ! -d "$PUB_CACHE" ]]; then
  echo "::error::Pub cache not found: $PUB_CACHE (run flutter pub get first)"
  exit 1
fi

plugin_manifest="$(find "$PUB_CACHE" -type f \
  -path '*/flutter_onnxruntime-1.9.0/ios/flutter_onnxruntime/Package.swift' \
  -print -quit)"

if [[ -z "$plugin_manifest" ]]; then
  echo "::error::Could not locate flutter_onnxruntime 1.9.0 Package.swift under $PUB_CACHE"
  exit 1
fi

plugin_dir="$(dirname "$plugin_manifest")"
spm_root="$plugin_dir/onnxruntime-swift-package-manager"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
archive_name="pod-archive-onnxruntime-extensions-c-0.13.0.zip"
archive_path="$spm_root/$archive_name"
local_archive="$repo_root/tainguyen/$archive_name"

rm -rf "$spm_root"
git clone --quiet --depth 1 --branch "$ORT_SPM_TAG" "$ORT_SPM_REPOSITORY" "$spm_root"

if [[ -f "$local_archive" ]]; then
  cp "$local_archive" "$archive_path"
  echo "Using local ONNX Runtime Extensions archive: $local_archive"
else
  curl --fail --location --retry 3 --retry-delay 2 \
    "$ORT_EXTENSIONS_URL" --output "$archive_path"
  echo "Downloaded ONNX Runtime Extensions archive from the verified mirror"
fi

actual_checksum="$(shasum -a 256 "$archive_path" | awk '{print $1}')"
if [[ "$actual_checksum" != "$ORT_EXTENSIONS_CHECKSUM" ]]; then
  echo "::error::ONNX Runtime Extensions SHA-256 mismatch: $actual_checksum"
  exit 1
fi
echo "Verified ONNX Runtime Extensions SHA-256: $actual_checksum"

export ORT_PLUGIN_MANIFEST="$plugin_manifest"
export ORT_SPM_ROOT="$spm_root"
export ORT_EXTENSIONS_CHECKSUM

python3 <<'PY'
import os
import re
from pathlib import Path

plugin_path = Path(os.environ["ORT_PLUGIN_MANIFEST"])
spm_root = Path(os.environ["ORT_SPM_ROOT"])
spm_manifest = spm_root / "Package.swift"
expected_checksum = os.environ["ORT_EXTENSIONS_CHECKSUM"]

# Replace only the Extensions remote binary target with a path to the verified
# local archive. The 1.28.0 ONNX Runtime core binary and package/product
# declarations remain untouched.
spm_text = spm_manifest.read_text(encoding="utf-8")
original_url = (
    "https://download.onnxruntime.ai/"
    "pod-archive-onnxruntime-extensions-c-0.13.0.zip"
)
if spm_text.count(original_url) != 1:
    raise SystemExit(
        "Expected exactly one original ONNX Runtime Extensions URL in "
        f"{spm_manifest}; refusing to patch an unexpected manifest"
    )
if spm_text.count(expected_checksum) != 1:
    raise SystemExit("Expected exactly one Extensions SHA-256 pin; refusing to patch")
remote_target = re.compile(
    r'Target\.binaryTarget\(name:\s*"onnxruntime_extensions",\s*'
    r'url:\s*"https://download\.onnxruntime\.ai/'
    r'pod-archive-onnxruntime-extensions-c-0\.13\.0\.zip",\s*'
    r'// SHA256 checksum\s*'
    r'checksum:\s*"' + re.escape(expected_checksum) + r'"\s*\)'
)
local_target = (
    'Target.binaryTarget(name: "onnxruntime_extensions", '
    'path: "pod-archive-onnxruntime-extensions-c-0.13.0.zip")'
)
if len(remote_target.findall(spm_text)) != 1:
    raise SystemExit("Could not safely identify the remote Extensions binary target")
spm_text = remote_target.sub(local_target, spm_text, count=1)
spm_manifest.write_text(spm_text, encoding="utf-8")

# Point the Flutter plugin's SPM manifest to this local checkout. A relative
# path avoids hard-coding the runner's absolute path into the Swift manifest.
plugin_text = plugin_path.read_text(encoding="utf-8")
remote_dependency = re.compile(
    r'\.package\(url:\s*'
    r'"https://github\.com/masicai/onnxruntime-swift-package-manager",\s*'
    r'exact:\s*"1\.28\.0"\s*\)'
)
local_dependency = re.compile(r'\.package\(path:\s*"[^"]+"\s*\)')
relative_spm_path = "onnxruntime-swift-package-manager"
replacement = f'.package(path: "{relative_spm_path}")'

if len(remote_dependency.findall(plugin_text)) == 1:
    plugin_text = remote_dependency.sub(replacement, plugin_text, count=1)
elif len(local_dependency.findall(plugin_text)) == 1:
    # Make the step idempotent if GitHub Actions restored a previously patched
    # pub cache from its cache.
    plugin_text = local_dependency.sub(replacement, plugin_text, count=1)
else:
    raise SystemExit(
        f"Could not safely identify the pinned SPM dependency in {plugin_path}"
    )

plugin_path.write_text(plugin_text, encoding="utf-8")

# Final assertions make the CI log useful and catch accidental version drift.
assert local_target in spm_manifest.read_text(encoding="utf-8")
assert replacement in plugin_path.read_text(encoding="utf-8")
print(f"Configured local SPM Extensions archive: {spm_root / 'pod-archive-onnxruntime-extensions-c-0.13.0.zip'}")
print(f"Verified Extensions SHA-256: {expected_checksum}")
print(f"Kept ONNX Runtime SPM package tag: 1.28.0 ({spm_root})")
PY
