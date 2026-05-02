#!/usr/bin/env bash
set -euo pipefail

curl -X POST http://localhost:8080/api/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Acme Labs",
    "secondaryText": "Research Studio",
    "layout": "horizontal",
    "variant": "color",
    "format": "svg"
  }' > ./acme.svg
