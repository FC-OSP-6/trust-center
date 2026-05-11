import type { AiGenerationInput, AiGenerationResult, AiMode } from '../types';
import { HostedChatProvider } from './HostedChatProvider';
import { OllamaProvider } from './OllamaProvider';

export interface AiProvider {
  name: string;
  mode: 'online' | 'offline';
  generate(input: AiGenerationInput): Promise<AiGenerationResult>;
}

export { HostedChatProvider, OllamaProvider };

export function selectAiProvider(
  requestedMode?: AiMode,
  requestedProvider?: string
): AiProvider {
  // explicit args win; env vars second; defaults last
  const resolvedMode: AiMode =
    requestedMode ?? (process.env.AI_MODE === 'offline' ? 'offline' : 'online');

  const providerName: string =
    requestedProvider ??
    process.env.AI_PROVIDER ??
    (resolvedMode === 'offline' ? 'ollama' : 'hosted-chat');

  if (providerName === 'hosted-chat') return new HostedChatProvider();
  if (providerName === 'ollama') return new OllamaProvider();

  throw new Error(`CONFIG_ERROR: unknown AI provider "${providerName}"`);
}
