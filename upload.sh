#!/usr/bin/env bash
set -euo pipefail

# PRDuck upload — scans local coding-agent transcripts (Claude Code, Codex,
# opencode, Cursor), redacts credentials and your home path on this machine,
# uploads the redacted sessions, and opens your scored report.
#
# Downloads a standalone binary for this OS/arch (no Node required), verifies
# its sha512, and caches it at ~/.prduck/bin/prduck-<version>. Unrecognized
# platforms and a binary that fails to run fall through to npx.
#
# The command asks whether to upload every session on this machine or only
# the repo you are standing in. Skip the question by passing the scope
# through bash: curl … | bash -s -- --all, or -s -- --dir <path>.
#
# First run: your browser opens once so you can authorize this machine
# against your PRDuck account (email magic link — no password). After that,
# uploads are silent and land in your dashboard. Credentials live in
# ~/.prduck/credentials.json; revoke anytime from Connected devices.
# Headless/CI runs authenticate via the PRDUCK_TOKEN env var instead.

prduck_main() {
  export PRDUCK_SITE_URL='https://prduck.tryproduck.com'
  local version='0.1.19'
  local bin="$HOME/.prduck/bin/prduck-$version"
  local os arch plat url sha tmp got want keep
  os="$(uname -s)"
  arch="$(uname -m)"
  if [ "$os" = Darwin ] && [ "$arch" = x86_64 ]; then
    if [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then
      arch=arm64
    fi
  fi
  case "${os}-${arch}" in
    Darwin-arm64) plat=darwin-arm64 ;;
    Darwin-x86_64) plat=darwin-x64 ;;
    Linux-x86_64) plat=linux-x64 ;;
    Linux-aarch64|Linux-arm64) plat=linux-arm64 ;;
    *) plat= ;;
  esac
  if [ -z "$plat" ]; then
    command -v node >/dev/null 2>&1 || { echo "prduck: node is required (>= 24)" >&2; exit 1; }
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 24 ] || { echo "prduck: needs Node >= 24, found $(node -v)" >&2; exit 1; }
    exec npx -y prduck@latest upload "$@"
  fi
  if [ -x "$bin" ]; then
    exec "$bin" upload "$@"
  fi
  case "$plat" in
    darwin-arm64) url='https://registry.npmjs.org/prduck-darwin-arm64/-/prduck-darwin-arm64-0.1.19.tgz'; sha='f5c4e8d9a1391c752ddbeb593abb97ec567cc401968906fe3b24960f75d386905fb4fdc47258eb2feac174513aa4bf250c219c3b185191402370eff8f5bf97b8' ;;
    darwin-x64) url='https://registry.npmjs.org/prduck-darwin-x64/-/prduck-darwin-x64-0.1.19.tgz'; sha='7f156b6a817e5a51567d00b9f81d72b28c3e7e87cac5068a96beb872c5d3cff237a95a792501b805b0792fafc34c62ab261e1838611f133ba9c0bcc9e842cf31' ;;
    linux-x64) url='https://registry.npmjs.org/prduck-linux-x64/-/prduck-linux-x64-0.1.19.tgz'; sha='759452e6c215d6aca33ba8dea986345e4aebcc861af160962e73d20ef95b8414334443a31b864565bde465a43655fc73a20546098ac7fbbc30ecf54a6b2e6185' ;;
    linux-arm64) url='https://registry.npmjs.org/prduck-linux-arm64/-/prduck-linux-arm64-0.1.19.tgz'; sha='19c14b4dd52a88580d02a27b7dcd976a63fc575d583c537750c87cee7662cc943fd57e3c266f5fc7a77a027d4a272a42d5d5e20981ffc644148ab694cd6e5eaa' ;;
  esac
  mkdir -p "$HOME/.prduck/bin"
  tmp="$(mktemp -d "$HOME/.prduck/tmp.XXXXXX")"
  trap 'rm -rf "$tmp"' EXIT
  curl -fL --retry 3 --retry-connrefused --progress-bar -o "$tmp/pkg.tgz" "$url"
  if command -v sha512sum >/dev/null 2>&1; then
    got="$(sha512sum "$tmp/pkg.tgz" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    got="$(shasum -a 512 "$tmp/pkg.tgz" | awk '{print $1}')"
  elif command -v openssl >/dev/null 2>&1; then
    got="$(openssl dgst -sha512 "$tmp/pkg.tgz" | awk '{print $NF}')"
  else
    command -v node >/dev/null 2>&1 || { echo "prduck: node is required (>= 24)" >&2; exit 1; }
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 24 ] || { echo "prduck: needs Node >= 24, found $(node -v)" >&2; exit 1; }
    exec npx -y prduck@latest upload "$@"
  fi
  got="$(printf '%s' "$got" | tr '[:upper:]' '[:lower:]')"
  want="$(printf '%s' "$sha" | tr '[:upper:]' '[:lower:]')"
  if [ "$got" != "$want" ]; then
    echo "prduck: checksum mismatch" >&2
    command -v node >/dev/null 2>&1 || { echo "prduck: node is required (>= 24)" >&2; exit 1; }
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 24 ] || { echo "prduck: needs Node >= 24, found $(node -v)" >&2; exit 1; }
    exec npx -y prduck@latest upload "$@"
  fi
  tar -xzf "$tmp/pkg.tgz" -C "$tmp" package/prduck
  chmod +x "$tmp/package/prduck"
  mv "$tmp/package/prduck" "$bin"
  touch "$bin"
  rm -rf "$tmp"
  keep=0
  for f in $(ls -1t "$HOME/.prduck/bin"/prduck-* 2>/dev/null || true); do
    keep=$((keep + 1))
    if [ "$keep" -gt 2 ]; then
      rm -f "$f"
    fi
  done
  if ! "$bin" version >/dev/null 2>&1; then
    echo "prduck: binary failed to run; falling back to npx" >&2
    command -v node >/dev/null 2>&1 || { echo "prduck: node is required (>= 24)" >&2; exit 1; }
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 24 ] || { echo "prduck: needs Node >= 24, found $(node -v)" >&2; exit 1; }
    exec npx -y prduck@latest upload "$@"
  fi
  exec "$bin" upload "$@"
}

prduck_main "$@"
