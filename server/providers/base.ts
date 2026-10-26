export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  name: string;
  generateReply(
    systemInstruction: string,
    history: ChatMessage[],
    newMessage: string,
    timeoutSeconds: number
  ): Promise<string>;
  generateReplyStream?(
    systemInstruction: string,
    history: ChatMessage[],
    newMessage: string,
    timeoutSeconds: number
  ): AsyncGenerator<string, void, unknown>;
  checkHealth(): Promise<boolean>;
}
