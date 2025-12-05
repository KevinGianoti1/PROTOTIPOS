@echo off
echo 🛑 Parando todos os processos Node.js...
taskkill /F /IM node.exe /T 2>nul

echo 🛑 Parando processos do Chrome/Puppeteer...
taskkill /F /IM chrome.exe /T 2>nul

echo 🧹 Limpando sessao do WhatsApp (opcional, remova o REM da linha abaixo se quiser resetar o login)
REM rmdir /s /q .wwebjs_auth 2>nul

echo 🚀 Iniciando servidor...
node server.js
pause
