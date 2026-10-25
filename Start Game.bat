@echo off
setlocal
rem pushd supports folder names with spaces and UNC paths.
pushd "%~dp0" || exit /b 1
echo Wildhaven - Wildlife Rescue
echo Keep this window open while playing. Press Ctrl+C to stop.

where node >nul 2>&1
if not errorlevel 1 (
  set "PORT=4173"
  call :open_browser
  node server.mjs
  goto :finish
)

py -3 -c "import sys; sys.exit(sys.version_info[0] != 3)" >nul 2>&1
if not errorlevel 1 (
  call :open_browser
  py -3 -m http.server 4173 --bind 127.0.0.1
  goto :finish
)

python3 -c "import sys; sys.exit(sys.version_info[0] != 3)" >nul 2>&1
if not errorlevel 1 (
  call :open_browser
  python3 -m http.server 4173 --bind 127.0.0.1
  goto :finish
)

python -c "import sys; sys.exit(sys.version_info[0] != 3)" >nul 2>&1
if not errorlevel 1 (
  call :open_browser
  python -m http.server 4173 --bind 127.0.0.1
  goto :finish
)

echo.
echo Node.js or Python 3 is needed to start the local game server.
echo Install either one, then run this launcher again.
goto :finish

:open_browser
start "" /b powershell.exe -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:4173/'"
exit /b

:finish
popd
pause
endlocal
