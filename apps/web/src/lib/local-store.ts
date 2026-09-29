import type { ProfileContext, StoredMessage } from "@/lib/api";

const STORAGE_KEY = "loveyourboyfriend:conversation:v1";

export type LocalConversation = {
  id: string;
  profile: ProfileContext;
  messages: StoredMessage[];
};

export function emptyProfile(): ProfileContext {
  return { current_mood: null, emotional_need: null, mood_updated_at: null };
}

export function readConversation(): LocalConversation {
  if (typeof window === "undefined") {
    return { id: "", profile: emptyProfile(), messages: [] };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as LocalConversation;
  } catch {
    // A corrupt local cache should never prevent a new conversation.
  }
  return { id: crypto.randomUUID(), profile: emptyProfile(), messages: [] };
}

export function writeConversation(value: LocalConversation) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}
