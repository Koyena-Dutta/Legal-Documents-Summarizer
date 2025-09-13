export type ChatMode = 'document' | 'general';
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function getUserSessionId(): string {
  try {
    const key = 'userSessionId';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function buildChatPayload(
  history: ChatMessage[],
  chunks: string[],
  mode: ChatMode
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    messages: history.map(m => ({ role: m.role, content: m.content })),
    chunks: mode === 'general' ? [] : chunks,
    mode,
  };
  if (mode === 'general') {
    payload.generalKey = getUserSessionId();
  }
  return payload;
}
