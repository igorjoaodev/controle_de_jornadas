@echo off
chcp 65001 >nul
title Configurar rede - Controle de Extras CPR XIII
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Solicitando permissao de administrador...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo Configurando regra do Firewall do Windows para a rede privada...
netsh advfirewall firewall delete rule name="Controle de Extras CPR XIII - TCP 8765" >nul 2>&1
netsh advfirewall firewall add rule name="Controle de Extras CPR XIII - TCP 8765" dir=in action=allow protocol=TCP localport=8765 profile=private
if %errorlevel% neq 0 (
  echo.
  echo ERRO ao criar a regra do firewall. Verifique as politicas de seguranca do computador.
  pause
  exit /b 1
)
echo.
echo Regra criada para a porta TCP 8765 em redes privadas.
echo Se a rede do Windows estiver marcada como Publica, solicite ao administrador que valide a classificacao da rede antes de altera-la.
echo Agora execute INICIAR.bat.
pause
