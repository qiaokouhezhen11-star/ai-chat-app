export function generateConversationTitle(text = "", fallback = "新しいチャット") {
    const normalized = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  
    if (!normalized) return fallback;
  
    const maxLength = 24;
    if (normalized.length <= maxLength) {
      return normalized;
    }
  
    return `${normalized.slice(0, maxLength)}...`;
  }