#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

[[ -x "$CHROME" ]] || { printf 'Google Chrome was not found.\n' >&2; exit 1; }
mkdir -p "$ROOT/meta-mobile" "$ROOT/tiktok-mobile" "$ROOT/tiktok-upload"

render() {
  local format="$1" slide="$2" width="$3" height="$4" output="$5"
  local profile chrome_pid
  profile="$(mktemp -d /tmp/nexus-credible-carousel.XXXXXX)"
  rm -f "$output"
  "$CHROME" --headless=new --disable-gpu --disable-background-networking --disable-sync \
    --no-first-run --no-default-browser-check --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$width,$height" --virtual-time-budget=2500 --user-data-dir="$profile" \
    --screenshot="$output" "file://$ROOT/carousel.html?format=$format&slide=$slide" >/dev/null 2>&1 &
  chrome_pid=$!
  for _ in {1..120}; do [[ -s "$output" ]] && break; sleep .1; done
  kill "$chrome_pid" >/dev/null 2>&1 || true
  wait "$chrome_pid" >/dev/null 2>&1 || true
  find "$profile" -depth -delete >/dev/null 2>&1 || true
  [[ -s "$output" ]] || { printf 'Failed to render %s\n' "$output" >&2; exit 1; }
}

for slide in {1..7}; do
  printf -v number '%02d' "$slide"
  render meta "$slide" 1080 1350 "$ROOT/meta-mobile/${number}.png"
  render tiktok "$slide" 720 1280 "$ROOT/tiktok-mobile/${number}.png"
  sips -s format jpeg -s formatOptions 84 "$ROOT/meta-mobile/${number}.png" --out "$ROOT/meta-mobile/${number}.jpg" >/dev/null
  sips -s format jpeg -s formatOptions 66 "$ROOT/tiktok-mobile/${number}.png" --out "$ROOT/tiktok-mobile/${number}.jpg" >/dev/null
  sips -s format jpeg -s formatOptions 42 "$ROOT/tiktok-mobile/${number}.png" --out "$ROOT/tiktok-upload/${number}.jpg" >/dev/null
done

printf 'Rendered credible mobile-first campaign.\n'
