#!/usr/bin/env bash
set -euo pipefail

GO_VERSION="${PERSONAL_OS_GO_VERSION:-1.23.4}"
PREFIX="${PERSONAL_OS_GO_PREFIX:-/usr/local}"
INSTALL_DIR="$PREFIX/go"

case "$(uname -m)" in
  x86_64) GO_ARCH="amd64" ;;
  aarch64 | arm64) GO_ARCH="arm64" ;;
  *)
    echo "不支持的架构: $(uname -m)" >&2
    exit 1
    ;;
esac

if [ -x "$INSTALL_DIR/bin/go" ]; then
  current_version="$("$INSTALL_DIR/bin/go" version | awk '{print $3}')"
  echo "已检测到 Go $current_version：$INSTALL_DIR/bin/go"
  exit 0
fi

archive="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"
url="https://go.dev/dl/${archive}"
download_dir="$(mktemp -d)"
trap 'rm -rf "$download_dir"' EXIT

echo "下载 Go ${GO_VERSION} (${GO_ARCH})..."
curl -fL "$url" -o "$download_dir/$archive"
echo "安装到 $INSTALL_DIR（需要 sudo 密码）..."
sudo rm -rf "$INSTALL_DIR"
sudo tar -C "$PREFIX" -xzf "$download_dir/$archive"

if ! grep -qs '/usr/local/go/bin' "$HOME/.profile"; then
  printf '\nexport PATH="/usr/local/go/bin:$PATH"\n' >> "$HOME/.profile"
fi

"$INSTALL_DIR/bin/go" version
echo "安装完成。新终端会自动启用 Go；当前终端可执行：export PATH=\"/usr/local/go/bin:\$PATH\""
