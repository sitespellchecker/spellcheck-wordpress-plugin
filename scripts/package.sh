#!/usr/bin/env bash
set -euo pipefail

plugin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_slug="$(basename "$plugin_dir")"
version="$(sed -n 's/^ \* Version: //p' "$plugin_dir/sitespellchecker.php" | head -n 1)"
output_dir="$(dirname "$plugin_dir")/dist"
archive="$output_dir/site-spell-checker-${version}.zip"

if [[ -z "$version" ]]; then
  echo "Could not read plugin version from sitespellchecker.php" >&2
  exit 1
fi

mkdir -p "$output_dir"
rm -f "$archive"
(
  cd "$(dirname "$plugin_dir")"
  zip -qr "$archive" "$plugin_slug" \
    -x "$plugin_slug/.DS_Store" "$plugin_slug/**/.DS_Store" \
    "$plugin_slug/scripts/*" \
    "$plugin_slug/.git/*" "$plugin_slug/**/.git/*"
)

echo "Created $archive"
