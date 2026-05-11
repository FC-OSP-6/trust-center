import type { GraphQLContext } from '../graphql/context';
import type { AiFinalResult, AiMode, AiCitation } from './types';
import { normalizeQuestion, retrieveContext } from './kb';
import { buildSystemPrompt, buildUserPrompt } from './prompts';
import { selectAiProvider } from './providers';

export type AiAnswerArgs = {
  question: string;
  mode?: AiMode;
  provider?: string;
};

function buildFallback(mode: AiMode): AiFinalResult {
  return {
    answer:
      'I could not find relevant information in the Trust Center to answer your question.',
    citations: [],
    provider: 'none',
    mode,
    status: 'fallback',
    error: null,
    fallbackUsed: true
  };
}

function buildError(mode: AiMode, message: string): AiFinalResult {
  return {
    answer: '',
    citations: [],
    provider: 'none',
    mode,
    status: 'error',
    error: message,
    fallbackUsed: false
  };
}

function extractJson(raw: string): unknown {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  return JSON.parse(stripped);
}

export async function runAiAnswer(
  args: AiAnswerArgs,
  ctx: GraphQLContext
): Promise<AiFinalResult> {
  const resolvedMode: AiMode = args.mode ?? 'online';

  try {
    // 1. normalize question
    const normalizedQuestion = normalizeQuestion(args.question);

    // 2. retrieve context
    const retrieval = await retrieveContext(normalizedQuestion, ctx);

    // 3. no context → fallback without calling any provider
    if (retrieval.sources.length === 0) {
      return buildFallback(resolvedMode);
    }

    // 4. build prompt
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(retrieval.sources, normalizedQuestion);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // 5. select provider
    const aiProvider = selectAiProvider(resolvedMode, args.provider);

    // 6. call provider
    const generationResult = await aiProvider.generate({
      question: normalizedQuestion,
      prompt: fullPrompt,
      requestedMode: resolvedMode,
      ...(args.provider !== undefined
        ? { requestedProvider: args.provider }
        : {})
    });

    // 7. parse strict JSON
    let parsed: unknown;
    try {
      parsed = extractJson(generationResult.rawText);
    } catch {
      return buildFallback(resolvedMode);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return buildFallback(resolvedMode);
    }

    const data = parsed as Record<string, unknown>;

    if (typeof data.answer !== 'string') {
      return buildFallback(resolvedMode);
    }

    // provider signals insufficient context
    if (data.fallbackUsed === true) {
      return buildFallback(resolvedMode);
    }

    if (!data.answer.trim()) {
      return buildFallback(resolvedMode);
    }

    // 8. validate citations — must be subset of retrieved sources, id + kind must match
    const sourceMap = new Map(retrieval.sources.map(s => [s.id, s]));

    type RawCitation = { id?: unknown; kind?: unknown };
    const rawCitations = Array.isArray(data.citations)
      ? (data.citations as RawCitation[])
      : [];

    const validCitations: AiCitation[] = rawCitations
      .filter(
        (c): c is { id: string; kind: string } =>
          typeof c.id === 'string' &&
          typeof c.kind === 'string' &&
          sourceMap.has(c.id) &&
          sourceMap.get(c.id)!.kind === c.kind
      )
      .map(c => {
        const source = sourceMap.get(c.id)!;
        return {
          id: source.id,
          label: source.label,
          kind: source.kind,
          ...(source.category !== undefined
            ? { category: source.category }
            : {})
        };
      });

    // context existed but no valid citations remain → fallback
    if (validCitations.length === 0) {
      return buildFallback(resolvedMode);
    }

    // 9. success
    return {
      answer: data.answer,
      citations: validCitations,
      provider: generationResult.provider,
      mode: generationResult.mode,
      status: 'success',
      error: null,
      fallbackUsed: false
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    // strip any leaked bearer tokens from error messages before returning
    const safeMessage = raw.replace(/bearer\s+\S+/gi, 'Bearer [redacted]');
    return buildError(resolvedMode, safeMessage);
  }
}
