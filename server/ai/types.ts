export type AiMode = 'online' | 'offline';

export type AiProviderName = 'hosted-chat' | 'ollama';

export type AiCitation = {
  id: string;
  label: string;
  kind: 'control' | 'faq';
  category?: string;
};

export type AiGenerationInput = {
  question: string;
  prompt: string;
  requestedMode: AiMode;
  requestedProvider?: string;
};

export type AiGenerationResult = {
  rawText: string;
  provider: string;
  mode: AiMode;
};

export type AiFinalResult = {
  answer: string;
  citations: AiCitation[];
  provider: string;
  mode: AiMode;
  status: 'success' | 'fallback' | 'error';
  error?: string | null;
  fallbackUsed: boolean;
};
