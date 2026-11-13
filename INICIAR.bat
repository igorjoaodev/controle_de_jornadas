@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Controle de Extras - CPR XIII
where python >nul 2>nul
if errorlevel 1 (
  echo ERRO: Python nao foi encontrado.
  echo Instale o Python 3 em https://www.python.org/downloads/ e marque "Add Python to PATH".
  pause
  exit /b 1
)
echo ======================================================
echo       CONTROLE DE EXTRAS - CPR XIII
echo ======================================================
echo.
echo Enderecos para acesso pela rede local:
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue; foreach ($ip in $ips) { if ($ip.IPAddress -ne '127.0.0.1' -and $ip.IPAddress -notlike '169.254*' -and $ip.InterfaceOperationalStatus -eq 'Up') { Write-Host ('  http://' + $ip.IPAddress + ':8765') } }"
echo.
echo Se os outros computadores nao conseguirem conectar:
echo 1. Execute CONFIGURAR_REDE.bat como administrador (uma vez).
echo 2. Confirme que os computadores estao na mesma rede local.
echo 3. Mantenha esta janela aberta enquanto o sistema estiver em uso.
echo.
python server.py
pause
