@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py -3 MIGRAR_DADOS_ANTIGOS.py) else (python MIGRAR_DADOS_ANTIGOS.py)
pause
