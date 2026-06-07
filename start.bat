@echo off
REM Serve Mazecore TD over HTTP (ES modules can't be opened as file://).
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  echo Serving on http://localhost:8000  ^(Ctrl+C to stop^)
  python -m http.server 8000
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  echo Serving on http://localhost:8000  ^(Ctrl+C to stop^)
  py -m http.server 8000
  goto :eof
)
where npx >nul 2>nul
if %errorlevel%==0 (
  echo Serving with npx serve  ^(Ctrl+C to stop^)
  npx --yes serve -l 8000 .
  goto :eof
)
echo Need python or npx to serve. Install one, then re-run.
