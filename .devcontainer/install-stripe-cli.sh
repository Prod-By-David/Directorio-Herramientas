#!/usr/bin/env bash
# Instala la Stripe CLI en el Codespace (Debian/Ubuntu). Se ejecuta solo al crear el Codespace
# (postCreateCommand) y se puede lanzar a mano: bash .devcontainer/install-stripe-cli.sh
set -e

if command -v stripe >/dev/null 2>&1; then
  echo "Stripe CLI ya instalada: $(stripe --version)"
  exit 0
fi

curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee /etc/apt/sources.list.d/stripe.list >/dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq stripe
echo "Stripe CLI instalada: $(stripe --version)"
