#!/bin/sh
set -eu

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

unit() {
  docker compose --profile checks build checks
  docker compose --profile checks run --rm --no-deps checks
}

reference() {
  docker compose --profile checks build reference
  docker compose --profile checks run --rm --no-deps reference
}

e2e() {
  docker compose --profile checks build game e2e
  docker compose up -d game
  docker compose --profile checks run --rm e2e
}

case "${1:-unit}" in
  unit) unit ;;
  reference) reference ;;
  e2e) e2e ;;
  all) unit; reference; e2e ;;
  *) echo "Usage: $0 [unit|reference|e2e|all]" >&2; exit 2 ;;
esac
