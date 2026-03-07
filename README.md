# AI Chat App (ChatGPT-like UI)

ChatGPTのようなUI/UXを目指したAIチャットアプリです。  
ストリーミング応答・自動スクロール・エラーハンドリング・IME（日本語変換）対応など、実用的なチャット体験を重視して作り込みました。

## Demo
- Local: `http://localhost:4000/chat`

（ここにスクリーンショットやGIFを後で追加予定）

---

## Features
- ✅ リアルタイム ストリーミング応答
- ✅ メッセージ送受信（楽観的UI更新）
- ✅ 生成停止（AbortController）
- ✅ 自動スクロール / 「最新へ」ボタン
- ✅ オフライン検出バナー
- ✅ 送信失敗時の再送・削除
- ✅ 文字数カウンタ（上限: 10,000）
- ✅ IME対応（変換確定Enterで誤送信しない）
- ✅ Markdown表示（GFM対応）
- ✅ コードブロックのコピー機能

---

## Tech Stack
- Frontend: React + Vite（react-router dev）
- UI: Tailwind CSS / lucide-react
- Backend: `/api/chat` 経由でAIへ接続（ストリーミング対応）
- Markdown: react-markdown + remark-gfm

---

## Getting Started

### 1) Install
```bash
cd apps/web
npm install --legacy-peer-deps
npm run dev

## Environment Variables
Create `apps/web/.env.local` and set:

```bash
git add README.md
git commit -m "Update README: env setup and run steps"
git push



```env
OPENAI_API_KEY=your_key_here
