#!/bin/sh
set -e

npm ci --include=optional
exec "$@"
