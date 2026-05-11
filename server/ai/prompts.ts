import type { KbSource } from './kb';

export function buildSystemPrompt(): string {
  return `You are the CyQu Trust Center Assistant. Answer security and compliance questions using ONLY the provided Trust Center context.

Rules:
- Use only information from the provided context entries
- Do not invent controls, policies, FAQs, or claims not present in the context
- Return ONLY valid JSON — no markdown, no prose outside the JSON object
- Set fallbackUsed to true if the context does not contain sufficient information to answer
- Only cite source IDs that directly support your answer; citations must match the provided id and kind exactly

Return exactly this JSON shape (no other text):
{
  "answer": "string",
  "citations": [
    {
      "id": "string",
      "label": "string",
      "kind": "control or faq",
      "category": "string or null"
    }
  ],
  "fallbackUsed": false
}`;
}

export function buildUserPrompt(sources: KbSource[], question: string): string {
  const contextLines = sources
    .map(s => {
      const kindLabel = s.kind === 'control' ? 'Control' : 'FAQ';
      return `[id: ${s.id}] [kind: ${s.kind}] [category: ${s.category ?? 'N/A'}]\n${kindLabel} — ${s.label}\n${s.content}`;
    })
    .join('\n\n');

  return `Context:\n${contextLines}\n\nQuestion: ${question}`;
}
