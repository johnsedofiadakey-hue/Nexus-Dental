#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [[ ! -x "$CHROME" ]]; then
  printf 'Google Chrome was not found at the expected macOS path.\n' >&2
  exit 1
fi

mkdir -p "$ROOT/meta-square" "$ROOT/tiktok-vertical" "$ROOT/tiktok-upload"

render() {
  local format="$1"
  local slide="$2"
  local width="$3"
  local height="$4"
  local output="$5"
  local profile
  profile="$(mktemp -d /tmp/nexus-carousel-chrome.XXXXXX)"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --disable-background-networking \
    --disable-sync \
    --no-first-run \
    --no-default-browser-check \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    --window-size="$width,$height" \
    --virtual-time-budget=2200 \
    --user-data-dir="$profile" \
    --screenshot="$output" \
    "file://$ROOT/carousel.html?format=$format&slide=$slide" >/dev/null 2>&1 &
  local chrome_pid=$!
  for _ in {1..100}; do
    [[ -s "$output" ]] && break
    sleep .1
  done
  kill "$chrome_pid" >/dev/null 2>&1 || true
  wait "$chrome_pid" >/dev/null 2>&1 || true
  find "$profile" -depth -delete >/dev/null 2>&1 || true
  [[ -s "$output" ]] || { printf 'Failed to render %s\n' "$output" >&2; exit 1; }
}

for slide in {1..7}; do
  printf -v number '%02d' "$slide"
  render meta "$slide" 1080 1080 "$ROOT/meta-square/${number}.png"
  render tiktok "$slide" 720 1280 "$ROOT/tiktok-vertical/${number}.png"
  sips -s format jpeg -s formatOptions 82 "$ROOT/meta-square/${number}.png" --out "$ROOT/meta-square/${number}.jpg" >/dev/null
  sips -s format jpeg -s formatOptions 54 "$ROOT/tiktok-vertical/${number}.png" --out "$ROOT/tiktok-upload/${number}.jpg" >/dev/null
done

printf 'Rendered Meta and TikTok carousel sets in %s\n' "$ROOT"
