@echo off
chcp 65001 > nul
echo Copiando a logo para a pasta do projeto...

copy /y "C:\Users\lucas\.gemini\antigravity\brain\e783f1bd-3e0d-4c5f-8d41-d61855d74078\user_images\image_2.jpg" "logo.jpg"
copy /y "C:\Users\lucas\.gemini\antigravity\brain\e783f1bd-3e0d-4c5f-8d41-d61855d74078\user_images\image_1.jpg" "logo.jpg"

echo.
echo ================================================
echo   Logo RT SPORTS instalada com sucesso!
echo ================================================
echo.
echo Agora é só atualizar a página (F5) no seu navegador.
echo.
pause
