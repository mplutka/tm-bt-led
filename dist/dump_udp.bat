@echo off
tm-bt-led.exe --game dump_udp %*
if %errorlevel% neq 0 pause

