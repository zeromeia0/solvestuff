#!/usr/bin/env bash
# Uploads code + syncs data with the live site. See hosting/deploy.py.
exec python3 -I "$(dirname "$0")/deploy.py"
