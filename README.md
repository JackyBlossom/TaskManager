# 工程管理アプリ

**「簡単操作で楽々プロジェクト管理」**

プロジェクト・タスクの計画/進捗/実績を、ガントチャートを中心に一元管理する Web アプリケーションです。
[doc/要件定義書.md](doc/要件定義書.md) の MVP スコープ（優先度: 高）を実装しています。

## 技術構成

| 区分 | 技術 |
|---|---|
| バックエンド | Python 3.12 / FastAPI / SQLAlchemy |
| フロントエンド | React 18 / Vite / react-router |
| データベース | SQLite（ファイルベース・無料。初回起動時に自動作成） |
| 認証 | ID / パスワード + JWT |

DB はサーバー不要の SQLite を採用しています。`backend/taskmanager.db` に自動作成され、
初回起動時に管理者アカウントとデモデータが投入されます。

## 環境構築方法

### 前提

- **Python 3.10 以上**（開発時は 3.12 で確認）
  - <https://www.python.org/downloads/> からインストール（または `winget install Python.Python.3.12`）
- **Node.js 18 以上（LTS 推奨）**
  - <https://nodejs.org/> からインストール（または `winget install OpenJS.NodeJS.LTS`）

### かんたん起動（Windows）

リポジトリ直下のバッチファイルをダブルクリックするだけで、初回セットアップ込みで起動します。

1. `start_backend.bat` を実行（APIサーバー: http://127.0.0.1:8000）
2. `start_frontend.bat` を実行（画面: http://localhost:5173）
3. ブラウザで <http://localhost:5173> を開く

### 手動セットアップ

#### 1. バックエンド（FastAPI）

```powershell
cd backend
python -m venv venv
venv\Scripts\activate        # macOS/Linux は source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- 起動すると `backend/taskmanager.db`（SQLite）が自動作成され、初期データが投入されます。
- API ドキュメント（Swagger UI）: <http://127.0.0.1:8000/docs>

#### 2. フロントエンド（React + Vite）

別のターミナルで:

```powershell
cd frontend
npm install
npm run dev
```

- <http://localhost:5173> で画面が開きます。
- `/api` へのリクエストは Vite の proxy 設定でバックエンド（127.0.0.1:8000）へ転送されます。

### 初期アカウント

| ユーザー名 | パスワード | 権限 |
|---|---|---|
| admin | admin123 | 管理者 |
| sato / suzuki / tanaka | password | 一般 |

デモデータ（サンプルプロジェクト2件・タスク・課題・工数実績）が投入済みです。
まっさらな状態から始めたい場合は、バックエンド停止後に `backend/taskmanager.db` を削除して
再起動し、マスタメンテナンスからユーザーを登録し直してください
（DB を削除すると初期データが再投入されます）。

## 主な機能（MVPスコープ）

- **全体ガントチャート**
  - タスクの登録・更新・削除・完了（CRUD）、親子タスクの階層表示
  - バーのドラッグ＆ドロップで日程移動、端のドラッグで期間変更
  - ダブルクリック（またはタスク名クリック）でタスク詳細を表示・編集
    （期日・完了条件・担当者・内容・状況・進行状況（晴れ/曇り/雨）・メモ・引き継ぎ情報）
  - タスク間の関連線（依存関係）の設定・表示
  - いなずま線（日付指定・ON/OFF）による進捗の見える化
  - 表示期間切替（日/週/月）、表示階層レベル切替
  - マイルストーン（◆）表示、進捗率のバー表示、今日線
  - タスク検索によるハイライト、CSV出力、過去プロジェクトの複製
- **個人ガントチャート**: メンバー選択で個人のタスクを横断表示、負荷状況の色分け（青/黄/赤）
- **ToDoリスト**: ガントチャートと表示切替、期限切れタスクの強調、状態のインライン更新
- **工数管理**: タスク別の予定・実績工数の入力（代理入力可）と予実集計
- **リマインド**: ログイン時に期限接近（3日以内）/超過タスクをポップアップ通知
- **課題管理表**: タスクに紐づく課題の一覧・状態管理・CSV出力
- **ダッシュボード**: 平均進捗率・遅延タスク・課題消化率・ステータス内訳・メンバー負荷を俯瞰
- **マスタ管理**: プロジェクト / ユーザー（アカウント）/ 組織（階層対応）の管理
- **監査ログ**: 登録・変更・削除操作の証跡を DB に記録

## ディレクトリ構成

```
TaskManager/
├── backend/               # FastAPI バックエンド
│   ├── app/
│   │   ├── main.py        # エントリポイント（CORS・ルーター登録）
│   │   ├── database.py    # SQLite 接続設定
│   │   ├── models.py      # DBモデル（Task/Project/User/Organization 等）
│   │   ├── schemas.py     # リクエスト/レスポンス スキーマ
│   │   ├── auth.py        # JWT認証・パスワードハッシュ
│   │   ├── seed.py        # 初期データ投入
│   │   └── routers/       # APIルーター（auth/users/projects/tasks/issues 等）
│   ├── requirements.txt
│   └── taskmanager.db     # SQLite DB（自動生成・git管理外）
├── frontend/              # React フロントエンド
│   ├── src/
│   │   ├── pages/         # 画面（ログイン/ダッシュボード/ガント/課題/工数/マスタ）
│   │   ├── components/    # ガントチャート・タスク詳細モーダル・ToDoリスト等
│   │   └── api.js         # APIクライアント
│   └── package.json
├── doc/要件定義書.md
├── start_backend.bat      # バックエンド起動（Windows）
└── start_frontend.bat     # フロントエンド起動（Windows）
```

## 運用時の注意

- **秘密鍵**: JWT の署名鍵は開発用の既定値が入っています。本番運用時は環境変数
  `TASKMANAGER_SECRET_KEY` に十分に長いランダム文字列を設定してください。
- **HTTPS**: 本番ではリバースプロキシ（nginx 等）配下で HTTPS 化してください。
- **バックアップ**: DB は `backend/taskmanager.db` の1ファイルです。定期的にコピーするだけでバックアップできます。
- **初期パスワード**: 運用開始時に admin のパスワードを必ず変更してください（マスタメンテナンス → アカウント管理）。

## 今後の拡張（次フェーズ候補・要件定義書 6.2 参照)

- スマホ/タブレット対応、業務指示書のPDF/印刷出力、クリティカルパス表示、
  チャットツール連携通知、PDF/Excel出力 など
