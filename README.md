# Timesheet App

フルスタックのタイムシート管理アプリケーション

## プロジェクト構成

- **Frontend**: Next.js (React 19, TypeScript, Tailwind CSS)
- **Backend**: Fastify (Node.js, SQLite)

## セットアップ

### 依存関係のインストール

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

### 開発サーバーの起動

```bash
# Frontend (ポート3000)
cd frontend
npm run dev

# Backend
cd backend
npm run dev
```

### その他のコマンド

#### Frontend
- `npm run build` - 本番用ビルド
- `npm run start` - 本番サーバー起動
- `npm run lint` - ESLint実行

#### Backend
- `npm start` - サーバー起動

## アクセス

- Frontend: http://localhost:3000
- Backend: サーバー設定に依存