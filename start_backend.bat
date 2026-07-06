@echo off
rem バックエンド（FastAPI）起動スクリプト
cd /d "%~dp0backend"
if not exist venv (
    echo [初回] 仮想環境を作成しています...
    python -m venv venv
    venv\Scripts\pip install -r requirements.txt
)
echo バックエンドを起動します: http://127.0.0.1:8000
venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
