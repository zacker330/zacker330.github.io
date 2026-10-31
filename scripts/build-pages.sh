#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-https://showme.codes/}"
destination="${2:-public}"
base_url="${base_url%/}/"
build_options=(--minify --noBuildLock --destination "$destination" --baseURL "$base_url")

case "$base_url" in
  https://showme.codes/)
    hugo --environment production "${build_options[@]}"
    node scripts/verify-site.mjs "$destination" "$base_url"
    ;;
  https://zacker330.github.io/)
    preview_dir=$(mktemp -d "${TMPDIR:-/tmp}/showme-preview.XXXXXX")
    trap 'rm -f "$preview_dir/hugo.toml"; rmdir "$preview_dir"' EXIT
    printf '[params]\nenv = "preview"\n' > "$preview_dir/hugo.toml"
    hugo --environment preview --config "config.toml,$preview_dir/hugo.toml" "${build_options[@]}"
    node scripts/verify-site.mjs "$destination" "$base_url"
    ;;
  *)
    echo "Refusing to publish at an unexpected URL: $base_url" >&2
    exit 1
    ;;
esac
