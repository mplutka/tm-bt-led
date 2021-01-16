@echo off

if [%1]=="--help" goto usage
if [%1]==[] goto usage

if exist %1.mjs (
    @echo Running %1
    node %1.mjs %2 %3 %4 %5 %6
    goto :eof
) else (
    @echo Error: Game file not found
    @echo.
    goto usage
)

:usage
@echo Usage: run.bat ^<Game name^> ^<--metric^> ^<--imperial^> ^<--interval [num]^>
@echo.
@echo Supported games:
@echo run.bat f1        (F1 2019, F1 2020)
@echo run.bat assetto   (Assetto Corsa, Assetto Corsa Competizione)
@echo run.bat iracing   (iRacing)
@echo run.bat dirt      (Dirt 4, Dirt Rally, Dirt Rally 2)
exit /B 1
