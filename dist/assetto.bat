@echo off
tm-bt-led.exe --game assetto-sharedmemory %*
if %errorlevel% neq 0 pause
