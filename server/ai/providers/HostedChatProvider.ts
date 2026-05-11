import type { AiGenerationInput, AiGenerationResult } from '../types';

export class HostedChatProvider {
  readonly name = 'hosted-chat';
  readonly mode = 'online' as const;

  async generate(input: AiGenerationInput): Promise<AiGenerationResult> {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'CONFIG_ERROR: AI_API_KEY is required for hosted-chat provider'
      );
    }

    const baseUrl = (
      process.env.AI_BASE_URL ?? 'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    const model = process.env.AI_MODEL ?? 'gpt-4o-mini';

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: input.prompt }],
          temperature: 0.2,
          max_tokens: 500
        })
      });
    } catch {
      throw new Error('PROVIDER_ERROR: hosted-chat request failed');
    }

    if (!response.ok) {
      throw new Error(
        `PROVIDER_ERROR: hosted-chat returned ${response.status}`
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error('PROVIDER_ERROR: hosted-chat returned invalid JSON');
    }

    const rawText =
      (data as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content ?? '';

    return { rawText, provider: 'hosted-chat', mode: 'online' };
  }
}
