#!/bin/sh
# Build dist/thwundersearch-<version>.xpi from the source tree.
set -eu
cd "$(dirname "$0")/.."
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
out="dist/thwundersearch-$version.xpi"
mkdir -p dist
rm -f "$out"
zip -q -X "$out" manifest.json api/schema.json api/searchStyle.js search-results.css icons/thwundersearch.svg LICENSE icons/LICENSE
echo "$out"
