import useHandleStreamResponse from "@/utils/useHandleStreamResponse";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  MessageSquare,
  PanelLeft,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ACCEPTED_FILE_TYPES } from "@/constants/fileUpload";
import { formatFileSize, getFileBadgeClassName } from "@/utils/fileDisplay";
import useChatFileInput from "@/hooks/useChatFileInput";
import { generateConversationTitle } from "@/utils/conversationTitle";
import {
  ACTIVE_CONVERSATION_ID_STORAGE_KEY,
  CONVERSATIONS_STORAGE_KEY,
  MODEL_STORAGE_KEY,
  createConversation,
  loadActiveConversationId,
  loadConversations,
  removeActiveConversationId,
  saveActiveConversationId,
  saveConversations,
} from "@/utils/conversationStorage";

export default function ChatPage() {
  const [conversations, setConversations] = useState(() => {
    const loaded = loadConversations();
    return loaded.length > 0 ? loaded : [createConversation()];
  });

  const [activeConversationId, setActiveConversationId] = useState(() => {
    const loadedConversations = loadConversations();
    const savedId = loadActiveConversationId();

    if (savedId && loadedConversations.some((conv) => conv.id === savedId)) {
      return savedId;
    }

    if (loadedConversations.length > 0) {
      return loadedConversations[0].id;
    }

    return null;
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
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const textareaRef = useRef(null);
  const streamingMessageRef = useRef("");
  const lastSubmittedRequestRef = useRef({
    text: "",
    file: null,
  });
  const lastStoppedAssistantMessageRef = useRef("");

  const MAX_CHARS = 10000;

  const activeConversation = useMemo(() => {
    return conversations.find((conv) => conv.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const messages = activeConversation?.messages || [];

  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSend =
    (!!inputText.trim() || !!selectedFile) &&
    !isOverLimit &&
    !isStreaming &&
    isOnline;

  const filteredConversations = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return conversations;

    return conversations.filter((conv) => {
      const titleHit = conv.title.toLowerCase().includes(keyword);
      const messageHit = conv.messages.some((message) =>
        String(message.content || "").toLowerCase().includes(keyword)
      );
      return titleHit || messageHit;
    });
  }, [conversations, searchText]);

  const formatConversationUpdatedAt = useCallback((isoString) => {
    if (!isoString) return "";
  
    const date = new Date(isoString);
    const now = new Date();
  
    const isSameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
  
    if (isSameDay) {
      return date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  
    return date.toLocaleDateString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
    });
  }, []);

  const resetTransientUi = useCallback(() => {
    setInputText("");
    setUploadError("");
    setStreamingMessage("");
    streamingMessageRef.current = "";
    setCopiedMessageIndex(null);
    handleClearFile();
    lastSubmittedRequestRef.current = {
      text: "",
      file: null,
    };
    lastStoppedAssistantMessageRef.current = "";
  }, [handleClearFile]);

  const updateConversationMessages = useCallback((conversationId, updater) => {
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;

        const nextMessages =
          typeof updater === "function" ? updater(conversation.messages) : updater;

        return {
          ...conversation,
          messages: nextMessages,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const updateConversationTitleIfNeeded = useCallback((conversationId, text) => {
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        if (conversation.title !== "新しいチャット") return conversation;

        return {
          ...conversation,
          title: generateConversationTitle(text),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  useEffect(() => {
    if (conversations.length === 0) {
      const newConversation = createConversation();
      setConversations([newConversation]);
      setActiveConversationId(newConversation.id);
      return;
    }

    if (!activeConversationId || !conversations.some((c) => c.id === activeConversationId)) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (activeConversationId) {
      saveActiveConversationId(activeConversationId);
    } else {
      removeActiveConversationId();
    }
  }, [activeConversationId]);

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    } catch (error) {
      console.error("モデル設定の保存に失敗しました:", error);
    }
  }, [selectedModel]);

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

  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom(false);
    }
  }, [messages, streamingMessage, shouldAutoScroll, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom > 200) {
      setShouldAutoScroll(false);
      setShowScrollButton(true);
    } else {
      setShouldAutoScroll(true);
      setShowScrollButton(false);
    }
  }, []);

  const handleFinish = useCallback(
    (message) => {
      if (!message || !message.trim() || !activeConversationId) {
        streamingMessageRef.current = "";
        setStreamingMessage("");
        setIsStreaming(false);
        return;
      }

      updateConversationMessages(activeConversationId, (prev) => [
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
    },
    [activeConversationId, updateConversationMessages]
  );

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

  const handleSendMessage = useCallback(
    async (overrideText, overrideFile, targetConversationId = activeConversationId) => {
      if (!targetConversationId) return;

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

      lastSubmittedRequestRef.current = {
        text: textToSend,
        file: fileToSend,
      };

      const userMessage = createUserMessage(textToSend, fileToSend);

      updateConversationMessages(targetConversationId, (prev) => [...prev, userMessage]);
      updateConversationTitleIfNeeded(targetConversationId, textToSend);

      if (typeof overrideText !== "string") {
        setInputText("");
      }

      if (textareaRef.current) {
        textareaRef.current.focus();
      }

      try {
        updateConversationMessages(targetConversationId, (prev) =>
          prev.map((msg, idx) =>
            idx === prev.length - 1 ? { ...msg, status: "done" } : msg
          )
        );

        setIsStreaming(true);
        setStreamingMessage("");
        streamingMessageRef.current = "";
        abortControllerRef.current = new AbortController();

        const currentConversation = conversations.find(
          (conversation) => conversation.id === targetConversationId
        );
        const currentMessages = currentConversation?.messages || [];

        const requestMessages = [
          ...currentMessages.filter((m) => m.status === "done"),
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
            // 何もしない
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
            lastStoppedAssistantMessageRef.current = stoppedMessage;

            updateConversationMessages(targetConversationId, (prev) => [
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
          updateConversationMessages(targetConversationId, (prev) =>
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
      activeConversationId,
      conversations,
      createUserMessage,
      handleClearFile,
      handleStreamResponse,
      inputText,
      isOnline,
      isStreaming,
      selectedFile,
      selectedModel,
      updateConversationMessages,
      updateConversationTitleIfNeeded,
    ]
  );

  const handleRetry = useCallback(
    (messageIndex) => {
      const failedMessage = messages[messageIndex];

      if (failedMessage.role !== "user" || failedMessage.status !== "failed") {
        return;
      }

      updateConversationMessages(activeConversationId, (prev) =>
        prev.filter((_, idx) => idx !== messageIndex)
      );
      handleSendMessage(failedMessage.content, undefined, activeConversationId);
    },
    [messages, activeConversationId, updateConversationMessages, handleSendMessage]
  );

  const handleRetryStopped = useCallback(
    (messageIndex) => {
      const { text, file } = lastSubmittedRequestRef.current;

      if (text.trim() || file) {
        handleSendMessage(text, file, activeConversationId);
        return;
      }

      const stoppedMessage = messages[messageIndex];

      if (!stoppedMessage || stoppedMessage.role !== "assistant" || !stoppedMessage.stopped) {
        return;
      }

      for (let i = messageIndex - 1; i >= 0; i -= 1) {
        const prevMessage = messages[i];

        if (prevMessage.role === "user") {
          handleSendMessage(prevMessage.content, undefined, activeConversationId);
          return;
        }
      }

      setUploadError("再送できる元のメッセージが見つかりませんでした。");
    },
    [messages, activeConversationId, handleSendMessage]
  );

  const handleContinueGeneration = useCallback(
    async (messageIndex) => {
      if (!activeConversationId) return;

      const stoppedMessage = messages[messageIndex];

      if (!stoppedMessage || stoppedMessage.role !== "assistant" || !stoppedMessage.stopped) {
        return;
      }

      const { text, file } = lastSubmittedRequestRef.current;
      const stoppedAssistantText =
        lastStoppedAssistantMessageRef.current || stoppedMessage.content || "";

      if ((!text || !text.trim()) && !file) {
        setUploadError("続きを生成する元の送信内容が見つかりませんでした。");
        return;
      }

      if (!stoppedAssistantText.trim()) {
        setUploadError("続きを生成する元の回答が見つかりませんでした。");
        return;
      }

      if (isStreaming) {
        return;
      }

      if (!isOnline) {
        setUploadError("オフラインです。インターネット接続を確認してください。");
        return;
      }

      setUploadError("");

      try {
        setIsStreaming(true);
        setStreamingMessage("");
        streamingMessageRef.current = "";
        abortControllerRef.current = new AbortController();

        const baseMessages = messages
          .slice(0, messageIndex)
          .filter((m) => m.status === "done")
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const continuePrompt = {
          role: "user",
          content:
            "直前の回答の続きを、日本語で自然につなげて出力してください。すでに出力した文章はできるだけ繰り返さないでください。",
        };

        const requestMessages = [
          ...baseMessages,
          {
            role: "assistant",
            content: stoppedAssistantText,
          },
          continuePrompt,
        ];

        const formData = new FormData();
        formData.append("model", selectedModel);
        formData.append("messages", JSON.stringify(requestMessages));
        formData.append("stream", "true");

        if (file) {
          formData.append("file", file);
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
            // 何もしない
          }

          throw new Error(errorMessage);
        }

        await handleStreamResponse(response);
        setStreamingMessage("");
      } catch (error) {
        console.error("Continue generation error:", error);

        if (error.name === "AbortError") {
          const stoppedContinuation = streamingMessageRef.current;

          if (stoppedContinuation && stoppedContinuation.trim()) {
            lastStoppedAssistantMessageRef.current = stoppedContinuation;

            updateConversationMessages(activeConversationId, (prev) => [
              ...prev,
              {
                role: "assistant",
                content: stoppedContinuation,
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
        }
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [
      activeConversationId,
      handleStreamResponse,
      isOnline,
      isStreaming,
      messages,
      selectedModel,
      updateConversationMessages,
    ]
  );

  const handleCopyMessage = useCallback(async (content, messageIndex) => {
    try {
      await navigator.clipboard.writeText(content || "");
      setCopiedMessageIndex(messageIndex);

      setTimeout(() => {
        setCopiedMessageIndex((current) =>
          current === messageIndex ? null : current
        );
      }, 1500);
    } catch (error) {
      console.error("コピーに失敗しました:", error);
      setUploadError("コピーに失敗しました。");
    }
  }, []);

  const handleDeleteMessage = useCallback(
    (messageIndex) => {
      updateConversationMessages(activeConversationId, (prev) =>
        prev.filter((_, idx) => idx !== messageIndex)
      );
    },
    [activeConversationId, updateConversationMessages]
  );

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleCreateNewConversation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const newConversation = createConversation();
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    resetTransientUi();
  }, [resetTransientUi]);

  const handleSelectConversation = useCallback(
    (conversationId) => {
      if (conversationId === activeConversationId) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      setActiveConversationId(conversationId);
      resetTransientUi();
    },
    [activeConversationId, resetTransientUi]
  );

  const handleDeleteConversation = useCallback(
    (conversationId) => {
      const target = conversations.find((conversation) => conversation.id === conversationId);
      if (!target) return;

      const ok = window.confirm(`「${target.title}」を削除しますか？`);
      if (!ok) return;

      const nextConversations = conversations.filter(
        (conversation) => conversation.id !== conversationId
      );

      if (nextConversations.length === 0) {
        const newConversation = createConversation();
        setConversations([newConversation]);
        setActiveConversationId(newConversation.id);
        resetTransientUi();
        return;
      }

      setConversations(nextConversations);

      if (activeConversationId === conversationId) {
        setActiveConversationId(nextConversations[0].id);
        resetTransientUi();
      }
    },
    [conversations, activeConversationId, resetTransientUi]
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 144) + "px";
    }
  }, [inputText]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#0E0E10] to-[#1A1B25]">
      {/* サイドバー */}
      <div
        className={`${
          isSidebarOpen ? "w-[300px]" : "w-0"
        } transition-all duration-300 overflow-hidden border-r border-[#262630] bg-[#111117] flex-shrink-0`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-[#262630]">
            <button
              type="button"
              onClick={handleCreateNewConversation}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-[#614BFF] to-[#8360FF] text-white font-poppins font-medium hover:from-[#553DE8] hover:to-[#7352E8] active:from-[#4B35CC] active:to-[#6442CC] transition-all duration-200"
            >
              <Plus size={16} />
              新しい会話
            </button>

            <div className="mt-3 relative">
  <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B90]"
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="会話を検索"
                className="w-full rounded-lg border border-[#353538] bg-[#1A1A22] pl-10 pr-10 py-2.5 text-sm text-white outline-none focus:border-[#614BFF]"
              />

              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8B90] hover:text-white transition-colors duration-200"
                  aria-label="検索文字をクリア"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="px-1 pb-1 text-[11px] font-poppins text-[#67676D]">
              {searchText
                ? `${filteredConversations.length}件ヒット`
                : `${conversations.length}件の会話`}
            </div>

            {filteredConversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const conversationMessages = Array.isArray(conversation.messages)
                ? conversation.messages
                : [];
              const lastMessage = conversationMessages[conversationMessages.length - 1];
              const previewText = lastMessage?.content || "まだメッセージがありません";

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={`w-full text-left rounded-xl border px-3 py-3 transition-all duration-200 ${
                    isActive
                      ? "bg-[#1F1F26] border-[#614BFF] shadow-[0_0_0_1px_rgba(97,75,255,0.15)]"
                      : "bg-[#15151C] border-[#262630] hover:bg-[#1B1B24] hover:border-[#3A3A46]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare
                          size={14}
                          className={`flex-shrink-0 ${
                            isActive ? "text-[#A99BFF]" : "text-[#8F7BFF]"
                          }`}
                        />
                        <p
                          className={`text-sm font-poppins font-medium truncate ${
                            isActive ? "text-white" : "text-[#F4F4F5]"
                          }`}
                        >
                          {conversation.title}
                        </p>
                      </div>

                      <p className="mt-2 text-xs text-[#8B8B90] line-clamp-2 break-words leading-5">
                        {previewText}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-[#67676D]">
                          {formatConversationUpdatedAt(conversation.updatedAt)}
                        </p>

                        <p className="text-[11px] text-[#67676D]">
                          {conversationMessages.length}件
                        </p>
                      </div>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conversation.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteConversation(conversation.id);
                        }
                      }}
                      className="flex items-center justify-center rounded-md p-1 text-[#8B8B90] hover:bg-[#262630] hover:text-white transition-all duration-200"
                    >
                      <Trash2 size={14} />
                    </div>
                  </div>
                </button>
              );
            })}

  {filteredConversations.length === 0 && (
    <div className="px-4 py-8 text-center border border-dashed border-[#353538] rounded-xl bg-[#15151C]">
      <p className="text-sm font-poppins text-[#B4B4B8]">
        {searchText ? "該当する会話がありません" : "会話がまだありません"}
      </p>
      <p className="mt-2 text-xs text-[#67676D]">
        {searchText
          ? "別のキーワードで検索してください"
          : "新しい会話を作成するとここに表示されます"}
      </p>
    </div>
  )}
</div>
        </div>
      </div>

      {/* メイン */}
      <div className="flex flex-col flex-1 min-w-0">
        {!isOnline && (
          <div className="bg-[#FF5656] text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-poppins">
            <WifiOff size={16} />
            <span>オフラインです。インターネット接続を確認してください。</span>
          </div>
        )}

        {/* ヘッダー */}
        <div className="bg-[#1B1B1E] px-4 md:px-6 py-3 md:py-4 flex items-center justify-between border-b border-[#262630] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#353538] bg-[#1F1F26] text-white hover:bg-[#2A2A36] transition-all duration-200"
              aria-label="サイドバー切り替え"
            >
              {isSidebarOpen ? <X size={18} /> : <PanelLeft size={18} />}
            </button>

            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-[#614BFF] to-[#8360FF] rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 md:w-5 md:h-5 bg-white rounded-sm"></div>
            </div>

            <div className="min-w-0">
              <h1 className="font-poppins font-semibold text-white text-base md:text-lg truncate">
                {activeConversation?.title || "AIチャット"}
              </h1>
              <p className="text-xs text-[#8B8B90] truncate">
                {messages.length > 0
                  ? `${messages.length}件のメッセージ`
                  : "新しい会話を始めましょう"}
              </p>
            </div>
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
              onClick={handleCreateNewConversation}
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
                        const quickMessage = suggestion + "をお願いします";
                        setInputText(quickMessage);
                        if (uploadError) {
                          setUploadError("");
                        }
                        handleSendMessage(quickMessage);
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

                {message.role === "assistant" && message.content && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(message.content, idx)}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-poppins text-[#B4B4B8] hover:bg-[#1F1F26] hover:text-white transition-all duration-200"
                    >
                      {copiedMessageIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                      {copiedMessageIndex === idx ? "コピー済み" : "コピー"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(idx)}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-poppins text-[#8B8B90] hover:bg-[#1F1F26] hover:text-white transition-all duration-200"
                    >
                      <Trash2 size={12} />
                      削除
                    </button>
                  </div>
                )}

                {message.role === "user" && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(idx)}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-poppins text-[#8B8B90] hover:bg-[#1F1F26] hover:text-white transition-all duration-200"
                    >
                      <Trash2 size={12} />
                      削除
                    </button>
                  </div>
                )}

                {message.stopped && (
                  <div className="mt-3">
                    <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-[#3A3A46] bg-[#181821] px-3 py-2 shadow-sm">
                      <span className="text-xs font-poppins text-[#F3B37A]">
                        回答を停止しました
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRetryStopped(idx)}
                        disabled={isStreaming}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-poppins font-medium transition-all duration-200 ${
                          isStreaming
                            ? "bg-[#2A2A36] text-[#67676D] cursor-not-allowed opacity-40"
                            : "bg-[#614BFF] text-white hover:bg-[#553DE8] active:bg-[#4B35CC]"
                        }`}
                      >
                        <RotateCcw size={12} />
                        再送
                      </button>

                      <button
                        type="button"
                        onClick={() => handleContinueGeneration(idx)}
                        disabled={isStreaming}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-poppins font-medium transition-all duration-200 ${
                          isStreaming
                            ? "bg-[#2A2A36] text-[#67676D] cursor-not-allowed opacity-40"
                            : "bg-[#1F3A5F] text-[#D9ECFF] hover:bg-[#2A4B78] active:bg-[#18314F]"
                        }`}
                      >
                        <Sparkles size={12} />
                        続きを生成
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

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

        <div className="bg-[#1D1D25] px-4 md:px-6 py-4 border-t border-[#262630] flex-shrink-0">
          <div className="max-w-4xl mx-auto">
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
                  if (isComposing || e.nativeEvent.isComposing) return;
                  if (e.key === "Enter" && e.shiftKey) return;

                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 text-xs text-[#8B8B90]">
                  <span className={charCount > MAX_CHARS * 0.9 ? "text-[#FF5656]" : ""}>
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
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-poppins font-semibold text-sm transition-all duration-200 ${
                          canSend
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

        @media (max-width: 768px) {
          button {
            min-height: 44px;
          }
        }
      `}</style>
    </div>
  );
}
