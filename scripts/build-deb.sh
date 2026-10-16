#!/usr/bin/env bash
# Assemble authelia-admin_<version>_<arch>.deb from a finished build.
#
# Run `npm ci && npm run build && npm prune --omit=dev` first.
#
# Usage: scripts/build-deb.sh <version> <arch> <node-binary> <output-dir>
#   version      Debian version, e.g. 1.2.3 or 0.0.0~git20261016.abc1234
#   arch         Debian architecture: amd64 or arm64
#   node-binary  Node.js executable to bundle; must match <arch>
#   output-dir   Directory that receives the .deb
set -euo pipefail

if [ "$#" -ne 4 ]; then
	echo "usage: $0 <version> <arch> <node-binary> <output-dir>" >&2
	exit 2
fi

VERSION="$1"
ARCH="$2"
NODE_BIN="$3"
OUT_DIR="$4"
MAINTAINER="${DEB_MAINTAINER:-digennarot <noreply@github.com>}"

PKG_NAME="authelia-admin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG_SRC="${ROOT}/packaging/debian"

for path in "$ROOT/build" "$ROOT/node_modules" "$ROOT/package.json" "$NODE_BIN"; do
	if [ ! -e "$path" ]; then
		echo "missing required path: $path" >&2
		exit 1
	fi
done

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

PKG_ROOT="$STAGE/pkg"
APP="$PKG_ROOT/usr/lib/$PKG_NAME"

install -d "$APP/bin" "$PKG_ROOT/DEBIAN" "$PKG_ROOT/etc/$PKG_NAME" \
	"$PKG_ROOT/etc/default" "$PKG_ROOT/lib/systemd/system"

# Application: compiled output, production dependencies, and the Node runtime
cp -a "$ROOT/build" "$APP/build"
cp -a "$ROOT/node_modules" "$APP/node_modules"
install -m 0644 "$ROOT/package.json" "$APP/package.json"
install -m 0755 "$NODE_BIN" "$APP/bin/node"

# Configuration (conffiles, preserved across upgrades)
install -m 0640 "$PKG_SRC/$PKG_NAME.config.yml" "$PKG_ROOT/etc/$PKG_NAME/config.yml"
install -m 0640 "$PKG_SRC/$PKG_NAME.default" "$PKG_ROOT/etc/default/$PKG_NAME"
install -m 0644 "$PKG_SRC/$PKG_NAME.service" "$PKG_ROOT/lib/systemd/system/$PKG_NAME.service"

# Maintainer scripts
install -m 0644 "$PKG_SRC/conffiles" "$PKG_ROOT/DEBIAN/conffiles"
install -m 0755 "$PKG_SRC/postinst" "$PKG_ROOT/DEBIAN/postinst"
install -m 0755 "$PKG_SRC/prerm" "$PKG_ROOT/DEBIAN/prerm"
install -m 0755 "$PKG_SRC/postrm" "$PKG_ROOT/DEBIAN/postrm"

find "$PKG_ROOT" -type d -exec chmod 0755 {} +

INSTALLED_SIZE="$(du -sk "$PKG_ROOT" | cut -f1)"
sed \
	-e "s|@VERSION@|$VERSION|" \
	-e "s|@ARCH@|$ARCH|" \
	-e "s|@INSTALLED_SIZE@|$INSTALLED_SIZE|" \
	-e "s|@MAINTAINER@|$MAINTAINER|" \
	"$PKG_SRC/control.in" > "$PKG_ROOT/DEBIAN/control"

mkdir -p "$OUT_DIR"
DEB_FILE="$OUT_DIR/${PKG_NAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --build --root-owner-group "$PKG_ROOT" "$DEB_FILE"

echo "built $DEB_FILE"
