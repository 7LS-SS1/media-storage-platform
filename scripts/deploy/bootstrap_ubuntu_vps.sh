#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (sudo -i then run this script)."
  exit 1
fi

TARGET_USER="${SUDO_USER:-}"
if [[ -z "${TARGET_USER}" ]]; then
  echo "SUDO_USER is empty. Add docker group manually for your login user later."
fi

echo "[1/6] Update OS packages"
apt update
apt upgrade -y

echo "[2/6] Install base tools"
apt install -y curl git jq unzip ca-certificates gnupg lsb-release fail2ban ufw

echo "[3/6] Install Docker"
curl -fsSL https://get.docker.com | sh

if [[ -n "${TARGET_USER}" ]]; then
  usermod -aG docker "${TARGET_USER}"
fi

echo "[4/6] Configure firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[5/6] Enable fail2ban"
systemctl enable --now fail2ban

echo "[6/6] Install ffmpeg"
apt install -y ffmpeg

echo "Bootstrap completed."
echo "Next steps:"
echo "- Re-login to apply docker group membership."
echo "- Verify: docker --version && docker compose version && ffmpeg -version"
