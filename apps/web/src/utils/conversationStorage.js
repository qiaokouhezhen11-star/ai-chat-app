export const CONVERSATIONS_STORAGE_KEY = "ai_chat_conversations_v1";
export const ACTIVE_CONVERSATION_ID_STORAGE_KEY = "ai_chat_active_conversation_id_v1";
export const MODEL_STORAGE_KEY = "ai_chat_selected_model_v1";

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createConversation() {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: "新しいチャット",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function loadConversations() {
    try {
      const saved = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      if (!saved) return [];
  
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
  
      return parsed.map((conversation) => ({
        id:
          typeof conversation?.id === "string" && conversation.id
            ? conversation.id
            : createId(),
        title:
          typeof conversation?.title === "string" && conversation.title
            ? conversation.title
            : "新しいチャット",
        createdAt:
          typeof conversation?.createdAt === "string"
            ? conversation.createdAt
            : new Date().toISOString(),
        updatedAt:
          typeof conversation?.updatedAt === "string"
            ? conversation.updatedAt
            : new Date().toISOString(),
        messages: Array.isArray(conversation?.messages)
          ? conversation.messages
          : [],
      }));
    } catch {
      return [];
    }
  }

export function saveConversations(conversations) {
  try {
    localStorage.setItem(
      CONVERSATIONS_STORAGE_KEY,
      JSON.stringify(conversations)
    );
  } catch (error) {
    console.error("会話履歴の保存に失敗しました:", error);
  }
}

export function loadActiveConversationId() {
  try {
    return localStorage.getItem(ACTIVE_CONVERSATION_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveConversationId(conversationId) {
  try {
    if (!conversationId) return;
    localStorage.setItem(ACTIVE_CONVERSATION_ID_STORAGE_KEY, conversationId);
  } catch (error) {
    console.error("選択中の会話ID保存に失敗しました:", error);
  }
}

export function removeActiveConversationId() {
  try {
    localStorage.removeItem(ACTIVE_CONVERSATION_ID_STORAGE_KEY);
  } catch (error) {
    console.error("選択中の会話ID削除に失敗しました:", error);
  }
}