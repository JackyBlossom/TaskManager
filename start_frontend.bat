@echo off
rem フロントエンド（React + Vite）起動スクリプト
cd /d "%~dp0frontend"
if not exist node_modules (
    echo [初回] npm パッケージをインストールしています...
    call npm install
)
echo フロントエンドを起動します: http://localhost:5173
call npm run dev
