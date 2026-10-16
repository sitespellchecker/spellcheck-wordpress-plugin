#!/usr/bin/env bash
# Build the WordPress.org release zip: one top-level folder named after the slug,
# runtime files only.
set -euo pipefail
slug="site-spell-checker"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(sed -n 's/^ \* Version: *//p' "$root/$slug.php" | head -n 1)"
out="${1:-$root/dist/$slug-$version.zip}"
stage="$(mktemp -d)"
mkdir -p "$stage/$slug/assets" "$(dirname "$out")"
cp "$root/$slug.php" "$root/uninstall.php" "$root/readme.txt" "$root/LICENSE" "$stage/$slug/"
cp "$root"/assets/{typo.js,tokenizer.js,editor.js,editor.css,en_US.aff,en_US.dic,LICENSE-typo.txt,README_en_US.txt} "$stage/$slug/assets/"
rm -f "$out"
(cd "$stage" && zip -qrX "$out" "$slug")
rm -rf "$stage"
echo "Created $out"
