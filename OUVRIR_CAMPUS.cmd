@echo off
cd /d "%~dp0"
start "Campus" http://127.0.0.1:3030
node server/index.cjs
pause
