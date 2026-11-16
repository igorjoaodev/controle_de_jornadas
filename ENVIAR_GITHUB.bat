@echo off
chcp 65001 >nul
title Enviar para o GitHub - Controle de Jornadas
echo ======================================================
echo    ENVIANDO CONTROLE DE JORNADAS PARA O GITHUB
echo ======================================================
echo.
echo Repositório configurado: https://github.com/igorjoaodev/controle_de_jornadas.git
echo.
git push -u origin main
echo.
if errorlevel 1 (
  echo ------------------------------------------------------
  echo AVISO: Se apareceu "Repository not found", crie primeiro
  echo o repositório em https://github.com/new com o nome:
  echo controle_de_jornadas
  echo e depois execute este arquivo novamente.
  echo ------------------------------------------------------
) else (
  echo Sucesso! Os arquivos foram enviados ao seu GitHub.
)
echo.
pause
