@echo off
chcp 65001 >nul
cd /d "%~dp0"
where ffmpeg >nul 2>nul || (
  echo Falta ffmpeg. Instalalo con:  winget install Gyan.FFmpeg
  echo y vuelve a abrir este archivo.
  pause
  exit /b 1
)
if not exist .venv (
  echo Instalando el editor por primera vez, tarda unos minutos...
  py -3 -m venv .venv || python -m venv .venv
  .venv\Scripts\python -m pip install --upgrade pip
  .venv\Scripts\python -m pip install -r requirements.txt
)
.venv\Scripts\python -m editor
pause
