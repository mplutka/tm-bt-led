@echo off
tm-bt-led.exe --game f1 %*
if %errorlevel% neq 0 pause
