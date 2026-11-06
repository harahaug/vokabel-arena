#!/bin/sh
# Baut die veröffentlichte Version: JavaScript wird verkleinert und unlesbar gemacht.
set -e
mkdir -p dist
cp index.html style.css manifest.json icon.svg impressum.html datenschutz.html _headers dist/
cp -r ocr dist/ocr
npx --yes terser@5.31.0 app.js --compress passes=2 --mangle toplevel --format comments=false -o dist/app.js
npx --yes terser@5.31.0 examples.js --compress --format comments=false -o dist/examples.js
npx --yes terser@5.31.0 slang.js --compress --format comments=false -o dist/slang.js
npx --yes terser@5.31.0 store.js --compress --mangle --format comments=false -o dist/store.js
npx --yes terser@5.31.0 sw.js --compress --mangle --format comments=false -o dist/sw.js
