#!/bin/sh
set -e

if [ -f package-lock.json ]; then npm ci; else npm install; fi
exec "$@"
