@echo off
title Moniteur externe Etudia
node "%~dp0scripts\keep-demo-awake.cjs"
if errorlevel 1 pause
