@echo off
cd /d "%~dp0"
set "DUONG_NODE=node"
where node >nul 2>&1
if errorlevel 1 set "DUONG_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%DUONG_NODE%" if exist "%ProgramFiles%\nodejs\node.exe" set "DUONG_NODE=%ProgramFiles%\nodejs\node.exe"
"%DUONG_NODE%" scripts/dev-local.mjs
if errorlevel 1 pause
