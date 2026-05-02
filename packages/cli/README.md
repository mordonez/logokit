# @mordonezdev/logokit

CLI for [logokit](https://github.com/mordonez/logokit): generate brand lockups (SVG or PNG) from any logo.

## Run without installing

```bash
npx @mordonezdev/logokit --text "Acme Labs" --out ./acme.svg
```

## Install globally

```bash
npm install -g @mordonezdev/logokit
logokit --help
```

## Common options

```bash
logokit \
  --text "Acme Labs" \
  --secondary "Research Studio" \
  --layout horizontal \
  --variant color \
  --logo ./mark.svg \
  --format png \
  --out ./acme.png
```

See the main repository README for the full command reference.

## License

MIT
