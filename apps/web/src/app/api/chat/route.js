export async function POST(request) {
  try {
    const body = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY が未設定です（apps/web/.env.local を確認）" },
        { status: 500 }
      );
    }

    const cleanMessages = Array.isArray(body?.messages) ? body.messages : [];

    const selectedModel =
      typeof body?.model === "string" && body.model.trim()
       ? body.model.trim()
       : "gpt-4o-mini";

    const systemMessage = {
      role: "system",
      content:
        "あなたは優秀なAIエンジニアです。初心者にもわかりやすく日本語で、手順を1つずつ提示して支援してください。コマンドやコードはコピペで実行できる形で出してください。エラーが出たら原因の切り分けから案内してください。",
    };

    // OpenAI（SSEで返ってくる）
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [systemMessage, ...cleanMessages],
        stream: true,
      }),
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return Response.json(
        { error: `OpenAI error: ${upstream.status} ${text}`.trim() },
        { status: upstream.status }
      );
    }

    // SSE（data: {...}\n\n）→ 文字だけに変換して流す
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body.getReader();
        let buffer = "";

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;

              const payload = trimmed.slice("data:".length).trim();
              if (payload === "[DONE]") {
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(payload);
                const delta = json?.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch {
                // JSONじゃない行は無視
              }
            }
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    // 返すのは「文字だけのストリーム」
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}