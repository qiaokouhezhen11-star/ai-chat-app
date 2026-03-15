import useHandleStreamResponse from "@/utils/useHandleStreamResponse";
import {
  AlertCircle,
  ChevronDown,
  Plus,
  RotateCcw,
  Send,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ACCEPTED_FILE_TYPES } from "@/constants/fileUpload";
import {
  formatFileSize,
  getFileBadgeClassName,
} from "@/utils/fileDisplay";
import useChatFileInput from "@/hooks/useChatFileInput";

export default function ChatPage() {
  const STORAGE_KEY = "ai_chat_messages_v1";
  const MODEL_STORAGE_KEY = "ai_chat_selected_model_v1";

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const {
    fileInputRef,
    handleClearFile,
    handleFileChange,
  } = useChatFileInput({
    setSelectedFile,
    setUploadError,
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    try {
      const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
      return savedModel || "gpt-4o-mini";
    } catch {
      return "gpt-4o-mini";
    }
  });
  const [isComposing, setIsComposing] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);


  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const textareaRef = useRef(null);
  const streamingMessageRef = useRef("");
  const lastSubmittedRequestRef = useRef({
    text: "",
    file: null,
  });

  const MAX_CHARS = 10000;
  
  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSend = (!!inputText.trim() || !!selectedFile) && !isOverLimit && !isStreaming && isOnline;

  // オンライン/オフライン検出
  useEffect(() => {

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // messages が変わるたびに履歴を保存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error("履歴の保存に失敗しました:", error);
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    } catch (error) {
      console.error("モデル設定の保存に失敗しました:", error);
    }
  }, [selectedModel]);

  // 自動スクロール
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
      setShouldAutoScroll(true);
      setShowScrollButton(false);
    }
  }, []);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom(false);
    }
  }, [messages, streamingMessage, shouldAutoScroll, scrollToBottom]);

  // スクロール位置監視
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom > 200) {
      setShouldAutoScroll(false);
      setShowScrollButton(true);
    } else {
      setShouldAutoScroll(true);
      setShowScrollButton(false);
    }
  }, []);

  // ストリーミング処理（完了時）
  // ストリーミング処理（完了時）
const handleFinish = useCallback((message) => {
  // 空なら追加しない（空欄バブル対策）
  if (!message || !message.trim()) {
    streamingMessageRef.current = "";
    setStreamingMessage("");
    setIsStreaming(false);
    return;
  }

  setMessages((prev) => [
    ...prev,
    {
      role: "assistant",
      content: message,
      status: "done",
      timestamp: new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);

  streamingMessageRef.current = "";
  setStreamingMessage("");
  setIsStreaming(false);
}, []);

  const handleStreamResponse = useHandleStreamResponse({
    onChunk: (content) => {
      streamingMessageRef.current = content;
      setStreamingMessage(content);
    },
    onFinish: (finalText) => {
      handleFinish(finalText);
    },
  });

  const createUserMessage = useCallback((text, file) => {
    return {
      role: "user",
      content: text.trim() || "ファイルを送信しました",
      status: "sending",
      timestamp: new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      fileName: file ? file.name : "",
      fileSize: file ? file.size : 0,
    };
  }, []);

  // メッセージ送信
  const handleSendMessage = useCallback(
    async (overrideText, overrideFile) => {
      const textToSend =
        typeof overrideText === "string" ? overrideText : inputText;
  
      const fileToSend =
        typeof overrideFile !== "undefined" ? overrideFile : selectedFile;
  
      const currentCharCount = textToSend.length;
      const isCurrentOverLimit = currentCharCount > MAX_CHARS;
  
      setUploadError("");
  
      if (isCurrentOverLimit || isStreaming) {
        return;
      }
  
      if (!isOnline) {
        setUploadError("オフラインです。インターネット接続を確認してください。");
        return;
      }
  
      if (!textToSend.trim() && !fileToSend) {
        return;
      }
  
      // 直前に送った内容を保持しておく
      lastSubmittedRequestRef.current = {
        text: textToSend,
        file: fileToSend,
      };
  
      const userMessage = createUserMessage(textToSend, fileToSend);
  
      setMessages((prev) => [...prev, userMessage]);
  
      if (typeof overrideText !== "string") {
        setInputText("");
      }
  
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
  
      try {
        setMessages((prev) =>
          prev.map((msg, idx) =>
            idx === prev.length - 1 ? { ...msg, status: "done" } : msg
          )
        );
  
        setIsStreaming(true);
        setStreamingMessage("");
        streamingMessageRef.current = "";
        abortControllerRef.current = new AbortController();
  
        const requestMessages = [
          ...messages.filter((m) => m.status === "done"),
          userMessage,
        ].map((m) => ({
          role: m.role,
          content: m.content,
        }));
  
        const formData = new FormData();
        formData.append("model", selectedModel);
        formData.append("messages", JSON.stringify(requestMessages));
        formData.append("stream", "true");
  
        if (fileToSend) {
          formData.append("file", fileToSend);
        }
  
        const response = await fetch("/api/chat", {
          method: "POST",
          body: formData,
          signal: abortControllerRef.current.signal,
        });
  
        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
  
          try {
            const errorData = await response.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // JSONで読めないときは既定メッセージのまま
          }
  
          throw new Error(errorMessage);
        }
  
        await handleStreamResponse(response);
  
        setStreamingMessage("");
        handleClearFile();
      } catch (error) {
        console.error("Send message error:", error);
  
        if (error.name === "AbortError") {
          const stoppedMessage = streamingMessageRef.current;
  
          if (stoppedMessage && stoppedMessage.trim()) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: stoppedMessage,
                status: "done",
                stopped: true,
                timestamp: new Date().toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ]);
          }
  
          streamingMessageRef.current = "";
          setStreamingMessage("");
        } else {
          setUploadError(error.message);
          setMessages((prev) =>
            prev.map((msg, idx) =>
              idx === prev.length - 1
                ? { ...msg, status: "failed", error: error.message }
                : msg
            )
          );
        }
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [
      inputText,
      isOnline,
      isStreaming,
      messages,
      selectedModel,
      selectedFile,
      handleStreamResponse,
      handleClearFile,
      createUserMessage,
    ]
  );

  // 再送
  const handleRetry = useCallback(
    (messageIndex) => {
      const failedMessage = messages[messageIndex];
  
      if (failedMessage.role !== "user" || failedMessage.status !== "failed") {
        return;
      }
  
      setMessages((prev) => prev.filter((_, idx) => idx !== messageIndex));
      handleSendMessage(failedMessage.content);
    },
    [messages, handleSendMessage],
  );

  // 停止後の再送
  const handleRetryStopped = useCallback(
    (messageIndex) => {
      const stoppedMessage = messages[messageIndex];
  
      if (!stoppedMessage || stoppedMessage.role !== "assistant" || !stoppedMessage.stopped) {
        return;
      }
  
      // 停止メッセージの直前にある user メッセージを探す
      for (let i = messageIndex - 1; i >= 0; i -= 1) {
        const prevMessage = messages[i];
  
        if (prevMessage.role === "user") {
          handleSendMessage(prevMessage.content);
          return;
        }
      }
  
      setUploadError("再送できる元のメッセージが見つかりませんでした。");
    },
    [messages, handleSendMessage]
  );

  // メッセージ削除
  const handleDeleteMessage = useCallback((messageIndex) => {
    setMessages((prev) => prev.filter((_, idx) => idx !== messageIndex));
  }, []);

  // 生成停止
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // 新規チャット
  const handleNewChat = useCallback(() => {
    if (
      window.confirm("新しいチャットを開始しますか？現在の会話は削除されます。")
    ) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
  
      localStorage.removeItem(STORAGE_KEY);
      setMessages([]);
      streamingMessageRef.current = "";
      setStreamingMessage("");
      setIsStreaming(false);
      setInputText("");
      handleClearFile();
    }
  }, [STORAGE_KEY, handleClearFile]);

  // テキストエリア自動リサイズ
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 144) + "px";
    }
  }, [inputText]);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-[#0E0E10] to-[#1A1B25]">
      {/* オフラインバナー */}
      {!isOnline && (
        <div className="bg-[#FF5656] text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-poppins">
          <WifiOff size={16} />
          <span>オフラインです。インターネット接続を確認してください。</span>
        </div>
      )}

      {/* ヘッダー */}
      <div className="bg-[#1B1B1E] px-4 md:px-6 py-3 md:py-4 flex items-center justify-between border-b border-[#262630] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-[#614BFF] to-[#8360FF] rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 md:w-5 md:h-5 bg-white rounded-sm"></div>
          </div>
          <h1 className="font-poppins font-semibold text-white text-base md:text-lg">
            AIチャット
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="model-select"
              className="text-sm text-[#B4B4B8] font-poppins"
            >
              モデル
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isStreaming}
              className="px-3 py-2 bg-[#1F1F26] border border-[#353538] rounded-lg text-white text-sm font-poppins focus:outline-none focus:border-[#614BFF]"
            >
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            </select>
          </div>

          <button
            onClick={handleNewChat}
            disabled={isStreaming}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg border transition-all duration-200 text-sm md:text-base ${
              isStreaming
                ? "bg-[#2A2A36] border-[#353538] text-[#67676D] cursor-not-allowed opacity-40"
                : "bg-gradient-to-b from-[#252528] to-[#1E1E21] border-[#353538] text-[#F4F4F5] hover:bg-[#2E2E31] hover:text-white active:bg-[#1A1A1D]"
            }`}
            aria-label="新規チャット"
          >
            <Plus size={16} strokeWidth={2} />
            <span className="hidden md:inline">新規チャット</span>
          </button>
        </div>
      </div>

      {/* メッセージエリア */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6"
      >
        {messages.length === 0 && !streamingMessage && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-r from-[#614BFF] to-[#8360FF] rounded-full flex items-center justify-center mb-6">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg"></div>
            </div>
            <h2 className="font-poppins font-semibold text-white text-xl md:text-2xl mb-3">
              何でも聞いてください
            </h2>
            <p className="font-poppins text-[#8B8B90] text-sm md:text-base max-w-md mb-6">
              AIアシスタントがあなたの質問にお答えします。下のボックスからメッセージを送信してください。
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["プログラミングのヘルプ", "文章の校正", "アイデア出し"].map(
                (suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(suggestion + "をお願いします");
                      if (uploadError) {
                        setUploadError("");
                      }
                    }}
                    className="px-4 py-2 bg-[#1F1F26] border border-[#353538] rounded-lg text-[#F4F4F5] hover:bg-[#2E2E31] hover:border-[#614BFF] active:bg-[#1A1A1D] transition-all duration-200 text-sm font-poppins"
                  >
                    {suggestion}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} group`}
          >
            <div
              className={`max-w-[85%] md:max-w-[70%] ${message.role === "user" ? "order-2" : "order-1"}`}
            >
              {/* タイムスタンプ */}
              <div
                className={`flex items-center gap-2 mb-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <span className="font-poppins text-xs text-[#8B8B90]">
                  {message.role === "user" ? "あなた" : "AI"}
                </span>
                {message.timestamp && (
                  <span className="font-poppins text-xs text-[#67676D]">
                    {message.timestamp}
                  </span>
                )}
              </div>

              {/* メッセージバブル */}
              <div
                className={`px-4 py-3 rounded-2xl font-poppins text-sm md:text-base leading-relaxed ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-[#614BFF] to-[#8360FF] text-white"
                    : "bg-[#1F1F26] text-white border border-[#353538]"
                }`}
              >
                <div className="break-words">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ inline, children, ...props }) {
                        if (inline) {
                          return (
                            <code
                              className="px-1 py-0.5 rounded bg-[#262630] text-[#E6E6E8]"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }
                        return <code {...props}>{children}</code>;
                      },
                      pre({ children }) {
                        const codeText =
                          (children?.props?.children &&
                            String(children.props.children).replace(/\n$/, "")) ||
                          "";

                        return (
                          <div className="mt-2 rounded-lg bg-[#0F0F14] border border-[#353538] overflow-hidden">
                            <div className="flex items-center justify-end px-2 py-2 border-b border-[#353538]">
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded bg-[#262630] hover:bg-[#303040] text-white"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(codeText);
                                  } catch (e) {
                                    console.error("copy failed", e);
                                  }
                                }}
                              >
                                コピー
                              </button>
                            </div>

                            <pre className="p-3 overflow-x-auto">{children}</pre>
                          </div>
                        );
                      },
                    }}
                  >
                    {message.content || ""}
                  </ReactMarkdown>

                  {message.role === "user" && message.fileName && (
                    <div className="mt-3 pt-3 border-t border-white border-opacity-20">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white text-opacity-90">
                        <span
                          className={`rounded-md px-2 py-1 ${getFileBadgeClassName(message.fileName)}`}
                        >
                          {message.fileName.split(".").pop()?.toUpperCase() || "FILE"}
                        </span>
                        <span className="break-all">{message.fileName}</span>
                        <span className="text-white text-opacity-70">
                          {formatFileSize(message.fileSize)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 状態表示 */}
                {message.status === "sending" && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-white text-opacity-70">
                    <span>送信中...</span>
                    {message.fileName && (
                      <span className="rounded-md bg-white bg-opacity-10 px-2 py-1 text-[11px]">
                        ファイル付き
                      </span>
                    )}
                  </div>
                )}

                {message.status === "failed" && (
                  <div className="mt-3 pt-3 border-t border-[#FF5656] border-opacity-30">
                    <div className="flex items-start gap-2 text-[#FF5656] text-xs mb-2">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        送信に失敗しました。
                        {message.error ? `エラー: ${message.error}` : ""}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRetry(idx)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#614BFF] hover:bg-[#553DE8] active:bg-[#4B35CC] text-white rounded-lg transition-colors duration-200 text-xs"
                      >
                        <RotateCcw size={12} />
                        再送
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(idx)}
                        className="px-3 py-1.5 bg-[#2A2A36] hover:bg-[#303040] active:bg-[#1F1F26] text-white rounded-lg transition-colors duration-200 text-xs"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 停止後の表示はバブルの外に出す */}
              {message.stopped && (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs text-[#8B8B90] italic">
                    途中で停止されました
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRetryStopped(idx)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#614BFF] hover:bg-[#553DE8] active:bg-[#4B35CC] text-white transition-colors duration-200 text-xs"
                  >
                    <RotateCcw size={12} />
                    再送
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* ストリーミング中のメッセージ */}
        {isStreaming && streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-[85%] md:max-w-[70%]">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-poppins text-xs text-[#8B8B90]">AI</span>
                <span className="font-poppins text-xs text-[#35D57F]">
                  生成中...
                </span>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-[#1F1F26] text-white border border-[#353538] font-poppins text-sm md:text-base leading-relaxed">
                <div className="whitespace-pre-wrap break-words">
                  {streamingMessage}
                  <span className="inline-block w-1 h-4 bg-white ml-1 animate-pulse"></span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 最新へボタン */}
      {showScrollButton && (
        <div className="absolute bottom-32 md:bottom-36 right-4 md:right-6 z-10">
          <button
            onClick={() => scrollToBottom(true)}
            className="w-12 h-12 bg-gradient-to-r from-[#614BFF] to-[#8360FF] rounded-full flex items-center justify-center text-white shadow-lg hover:from-[#553DE8] hover:to-[#7352E8] active:from-[#4B35CC] active:to-[#6442CC] transition-all duration-200"
            aria-label="最新のメッセージへ"
          >
            <ChevronDown size={24} />
          </button>
        </div>
      )}

      {/* 入力エリア */}
      <div className="bg-[#1D1D25] px-4 md:px-6 py-4 border-t border-[#262630] flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* 文字数カウンタ（上限超過時のみ表示） */}
          {isOverLimit && (
            <div className="mb-2 flex items-center gap-2 text-[#FF5656] text-sm">
              <AlertCircle size={16} />
              <span>
                文字数が上限を超えています（{charCount.toLocaleString()} /{" "}
                {MAX_CHARS.toLocaleString()}文字）
              </span>
            </div>
          )}

          {uploadError && (
            <div className="mb-2 flex items-center gap-2 text-[#FF5656] text-sm">
              <AlertCircle size={16} />
              <span>{uploadError}</span>
            </div>
          )}

          {selectedFile && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#353538] bg-[#1F1F26] px-3 py-2 text-sm font-poppins">
              <div className="flex items-center gap-2 text-[#F4F4F5]">
              <span
                className={`rounded-md px-2 py-1 text-xs ${getFileBadgeClassName(selectedFile.name)}`}
              >
                {selectedFile.name.split(".").pop()?.toUpperCase() || "FILE"}
              </span>
                <span className="break-all">{selectedFile.name}</span>
              </div>

              <span className="text-xs text-[#8B8B90]">
                {formatFileSize(selectedFile.size)}
              </span>

              <button
                type="button"
                onClick={handleClearFile}
                className="px-2 py-1 text-xs rounded-md border border-[#353538] text-[#F4F4F5] hover:bg-[#2E2E31] transition-all duration-200"
              >
                クリア
              </button>
            </div>
          )}

          <div className="bg-[#262630] border border-[#353538] rounded-xl p-3 md:p-4">
            <textarea
              ref={textareaRef}
              value={inputText}
              placeholder={
                selectedFile
                  ? "必要ならファイルについて質問を書いて送信"
                  : "メッセージを入力してください"
              }
              className="w-full bg-transparent text-white resize-none outline-none focus:outline-none"
              onChange={(e) => {
                setInputText(e.target.value);
                if (uploadError) {
                  setUploadError("");
                }
              }}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={(e) => {
                // 変換中（IME）なら Enter で送信しない
                if (isComposing || e.nativeEvent.isComposing) return;

                // Shift + Enter は改行
                if (e.key === "Enter" && e.shiftKey) return;

                // Enter は送信
                if (e.key === "Enter") {
                  e.preventDefault(); // 改行を入れない
                  handleSendMessage();
                }
              }}
            />

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-xs text-[#8B8B90]">
                <span
                  className={
                    charCount > MAX_CHARS * 0.9 ? "text-[#FF5656]" : ""
                  }
                >
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
                {isOnline ? (
                  <span className="flex items-center gap-1 text-[#35D57F]">
                    <Wifi size={12} />
                    オンライン
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[#FF5656]">
                    <WifiOff size={12} />
                    オフライン
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {isStreaming ? (
                  <button
                    onClick={handleStopGeneration}
                    className="flex items-center gap-2 px-4 py-2 bg-[#FF5656] hover:bg-[#E64545] active:bg-[#CC3333] text-white rounded-lg font-poppins font-semibold text-sm transition-all duration-200"
                  >
                    <Square size={14} fill="currentColor" />
                    <span>停止</span>
                  </button>
                ) : (
                  <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isStreaming}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isStreaming}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-poppins transition-all duration-200 ${
                      isStreaming
                        ? "bg-[#2A2A36] border-[#353538] text-[#67676D] cursor-not-allowed opacity-40"
                        : "bg-[#1F1F26] border-[#353538] text-[#F4F4F5] hover:bg-[#2E2E31] hover:text-white active:bg-[#1A1A1D]"
                    }`}
                  >
                    ファイル選択
                  </button>

                  <button
                    onClick={handleSendMessage}
                    disabled={!canSend}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-poppins font-semibold text-sm transition-all duration-200 ${canSend
                      ? "bg-gradient-to-r from-[#614BFF] to-[#8360FF] text-white hover:from-[#553DE8] hover:to-[#7352E8] active:from-[#4B35CC] active:to-[#6442CC]"
                      : "bg-[#2A2A36] text-[#67676D] cursor-not-allowed opacity-40"
                      }`}
                  >
                    <Send size={14} />
                    <span>{selectedFile ? "ファイル送信" : "送信"}</span>
                  </button>
                </>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .font-poppins {
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .animate-pulse {
          animation: pulse 1s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        /* Custom scrollbar */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #353538;
          border-radius: 3px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #4A4A4D;
        }
        
        /* Touch-friendly tap targets on mobile */
        @media (max-width: 768px) {
          button {
            min-height: 44px;
          }
        }
      `}</style>
    </div>
  );
}
