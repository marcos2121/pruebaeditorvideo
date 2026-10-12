#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v ffmpeg >/dev/null; then
  echo "Falta ffmpeg. En Mac: brew install ffmpeg · En Ubuntu: sudo apt install ffmpeg"
  exit 1
fi
if [ ! -d .venv ]; then
  echo "Instalando el editor por primera vez, tarda unos minutos..."
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt
fi
exec .venv/bin/python -m editor
