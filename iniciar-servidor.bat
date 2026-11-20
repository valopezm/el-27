@echo off
chcp 65001 >nul
title El 27 - servidor local
echo.
echo  ====================================================
echo   El 27 - servidor local para probar el login Google
echo  ====================================================
echo.
echo  Se abrira la app en tu navegador en http://localhost:8127
echo  Deja esta ventana abierta mientras pruebas.
echo  Para terminar, cierra esta ventana.
echo.
start "" http://localhost:8127/index.html
python -m http.server 8127 2>nul
if errorlevel 1 (
  py -m http.server 8127 2>nul
)
if errorlevel 1 (
  echo.
  echo  No se encontro Python en este computador.
  echo  Pidele a Claude que te ayude a instalarlo o a probar directo en GitHub Pages.
  pause
)
