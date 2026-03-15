@echo off
tm-bt-led.exe --fps=20 --queueDepth=1 %*
if %errorlevel% neq 0 pause