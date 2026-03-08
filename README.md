
# AI Chat App (ChatGPT-like UI)

ChatGPTのようなUI/UXを目指したAIチャットアプリです。  
ストリーミング応答・自動スクロール・エラーハンドリング・IME（日本語変換）対応など、実用的なチャット体験を重視して作り込みました。

## 主な機能

- AIチャットの送受信
- ストリーミング応答表示
- 自動スクロール
- ローディング表示
- エラーハンドリング
- IME（日本語変換）対応
- ChatGPT風のUIレイアウト

## スクリーンショット 
![AI Chat App Screenshot](docs/screenshot.png)

## Demo
- Local: `http://localhost:4000/chat`

（ここにスクリーンショットやGIFを後で追加予定）

---

## Features
- ✅ リアルタイム ストリーミング応答
- ✅ メッセージの送受信（楽観的UI更新）
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
---

## Environment Variables
`apps/web/.env.local` を作成して、以下を設定してください：

```env
OPENAI_API_KEY=your_key_here
```

## Project Structure (main)
```text
/apps/web/src/app/chat/page.jsx                 # チャット画面（UI本体：表示・入力・送信）
/apps/web/src/app/api/chat/route.js             # チャットAPI（/api/chat：OpenAIへ送信）
/apps/web/src/utils/useHandleStreamResponse.js  # ストリーミング処理（返答を少しずつ表示）
/apps/web/src/utils/useAuth.js                  # 認証関連（今後使う/拡張用）
/apps/web/src/utils/useUpload.js                # アップロード関連（今後使う/拡張用）
```

