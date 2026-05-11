import type { AiGenerationInput, AiGenerationResult } from '../types';

export class OllamaProvider {
  readonly name = 'ollama';
  readonly mode = 'offline' as const;

  async generate(input: AiGenerationInput): Promise<AiGenerationResult> {
    const baseUrl = (
      process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    ).replace(/\/$/, '');
    const model = process.env.OLLAMA_MODEL ?? 'llama3';

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [{ role: 'user', content: input.prompt }]
        })
      });
    } catch {
      throw new Error('PROVIDER_ERROR: ollama request failed');
    }

    if (!response.ok) {
      throw new Error(`PROVIDER_ERROR: ollama returned ${response.status}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error('PROVIDER_ERROR: ollama returned invalid JSON');
    }

    const rawText =
      (data as { message?: { content?: string } })?.message?.content ?? '';

    return { rawText, provider: 'ollama', mode: 'offline' };
  }
}
