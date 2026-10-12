@echo off
chcp 65001 >nul
cd /d "%~dp0"

where ffmpeg >nul 2>nul || (
  echo Falta ffmpeg. Instalalo con:  winget install Gyan.FFmpeg
  echo y vuelve a abrir este archivo.
  pause
  exit /b 1
)

set "PY=python"
where py >nul 2>nul && set "PY=py -3"
%PY% --version >nul 2>nul || (
  echo Falta Python. Instalalo desde https://www.python.org/downloads/
  pause
  exit /b 1
)

rem El entorno va en una ruta corta para no chocar con el limite de 260 caracteres de Windows.
set "VENV=%LOCALAPPDATA%\editor-youtube\venv"
if not exist "%VENV%\instalado.ok" (
  echo Instalando el editor por primera vez, tarda unos minutos...
  if exist "%VENV%" rmdir /s /q "%VENV%"
  %PY% -m venv "%VENV%" || goto :fallo
  "%VENV%\Scripts\python" -m pip install --upgrade pip || goto :fallo
  "%VENV%\Scripts\python" -m pip install -r requirements.txt || goto :fallo
  echo ok> "%VENV%\instalado.ok"
)

"%VENV%\Scripts\python" -m editor
pause
exit /b 0

:fallo
echo.
echo *** La instalacion no termino. Revisa tu conexion a internet y vuelve a abrir este archivo. ***
echo Si el error menciona "Long Path", mueve la carpeta youtube-editor a C:\editor-youtube y prueba otra vez.
if exist "%VENV%" rmdir /s /q "%VENV%"
pause
exit /b 1
