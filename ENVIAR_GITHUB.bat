@echo off
chcp 65001 >nul
title Enviar para o GitHub - CPR XIII
echo ======================================================
echo    ENVIANDO CONTROLE DE EXTRAS PARA O GITHUB
echo ======================================================
echo.
echo Repositório configurado: https://github.com/igorjoaodev/Controle_Extras_CPR_XIII.git
echo.
git push -u origin main
echo.
if errorlevel 1 (
  echo ------------------------------------------------------
  echo AVISO: Se apareceu "Repository not found", crie primeiro
  echo o repositório vazio em https://github.com/new com o nome:
  echo Controle_Extras_CPR_XIII
  echo e depois execute este arquivo novamente.
  echo ------------------------------------------------------
) else (
  echo Sucesso! Os arquivos foram enviados ao seu GitHub.
)
echo.
pause
