import {
  FILE_TOO_LARGE_MESSAGE,
  MAX_FILE_SIZE,
  PDF_EXTENSION,
  PDF_MIME_TYPE,
  PDF_NOT_SUPPORTED_MESSAGE,
  TEXT_FILE_EXTENSIONS,
  UNSUPPORTED_FILE_MESSAGE,
} from "@/constants/fileUpload";

const ALLOWED_MODELS = ["gpt-4o-mini", "gpt-4.1-mini"];

export async function POST(request) {
  try {
    const formData = await request.formData();

    const rawMessages = formData.get("messages");
    const rawModel = formData.get("model");
    const uploadedFile = formData.get("file");

    let cleanMessages = [];
    try {
      const parsedMessages = JSON.parse(rawMessages || "[]");
      cleanMessages = Array.isArray(parsedMessages)
        ? parsedMessages
            .filter((message) => {
              if (!message || typeof message !== "object") {
                return false;
              }

              const validRole =
                message.role === "user" ||
                message.role === "assistant" ||
                message.role === "system";

              return validRole && typeof message.content === "string";
            })
            .map((message) => ({
              role: message.role,
              content: message.content.trim(),
            }))
            .filter((message) => message.content)
            .slice(-20)
        : [];
    } catch {
      cleanMessages = [];
    }

    const selectedModel =
      typeof rawModel === "string" && ALLOWED_MODELS.includes(rawModel.trim())
        ? rawModel.trim()
        : "gpt-4o-mini";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY が未設定です（apps/web/.env.local を確認）" },
        { status: 500 }
      );
    }

    let fileContext = "";

    if (uploadedFile && typeof uploadedFile.text === "function") {
      const fileType = uploadedFile.type || "";
      const fileName = uploadedFile.name || "";
      const lowerFileName = fileName.toLowerCase();

      if (uploadedFile.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: FILE_TOO_LARGE_MESSAGE },
          { status: 400 }
        );
      }

      const isTextFile = TEXT_FILE_EXTENSIONS.some((extension) =>
        lowerFileName.endsWith(extension)
      );

      const isPdfFile =
        fileType === PDF_MIME_TYPE ||
        lowerFileName.endsWith(PDF_EXTENSION);

      if (isPdfFile) {
        return Response.json(
          { error: PDF_NOT_SUPPORTED_MESSAGE },
          { status: 400 }
        );
      }

      if (!isTextFile) {
        return Response.json(
          { error: UNSUPPORTED_FILE_MESSAGE },
          { status: 400 }
        );
      }

      const fileText = await uploadedFile.text();
      fileContext = fileText.slice(0, 8000);
    }

    const systemMessage = {
      role: "system",
      content:
        "あなたは優秀なAIエンジニアです。初心者にもわかりやすく日本語で、手順を1つずつ提示して支援してください。コマンドやコードはコピペで実行できる形で出してください。エラーが出たら原因の切り分けから案内してください。ユーザーがファイルをアップロードしている場合は、ファイルが未アップロードとは言わず、渡されたファイル内容を優先して読んで回答してください。最新の天気・ニュース・株価など、リアルタイムの外部情報が必要な質問については、この構成では取得できない場合があるため、確認しているふりはせず、その旨を正直に伝えてください。",
    };

    const fileMessage = fileContext
      ? {
          role: "system",
          content:
            "以下はユーザーがアップロードしたファイル内容です。この内容をもとに回答してください。\n\n" +
            fileContext,
        }
      : null;

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: fileMessage
          ? [systemMessage, fileMessage, ...cleanMessages]
          : [systemMessage, ...cleanMessages],
        stream: true,
      }),
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      let errorDetail = "";

      try {
        const errorJson = await upstream.json();
        errorDetail = errorJson?.error?.message || errorJson?.error || "";
      } catch {
        errorDetail = await upstream.text().catch(() => "");
      }

      return Response.json(
        {
          error: `OpenAI error: ${upstream.status} ${String(errorDetail).trim()}`.trim(),
        },
        { status: upstream.status }
      );
    }

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

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return new Response(null, { status: 499 });
    }

    console.error("Chat API error:", error);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
