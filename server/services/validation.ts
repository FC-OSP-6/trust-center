/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> shared admin-write validation helpers

  - normalizes and validates create/update inputs before db writes
  - keeps validation out of resolvers so service boundaries stay clean
  - provides readable VALIDATION_ERROR messages for GraphiQL verification
  - supports partial-update semantics without letting empty updates through
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

// ---------- input contracts ----------

export type CreateControlInput = {
  controlKey: string;
  title: string;
  description: string;
  section: string;
  category: string;
  subcategory?: string | null;
  tags?: string[] | null;
  sourceUrl?: string | null;
};

export type UpdateControlInput = {
  controlKey?: string | null;
  title?: string | null;
  description?: string | null;
  section?: string | null;
  category?: string | null;
  subcategory?: string | null;
  tags?: string[] | null;
  sourceUrl?: string | null;
};

export type CreateFaqInput = {
  faqKey: string;
  question: string;
  answer: string;
  section: string;
  category: string;
  subcategory?: string | null;
  tags?: string[] | null;
};

export type UpdateFaqInput = {
  faqKey?: string | null;
  question?: string | null;
  answer?: string | null;
  section?: string | null;
  category?: string | null;
  subcategory?: string | null;
  tags?: string[] | null;
};

// ---------- normalized write shapes ----------

export type NormalizedControlWrite = {
  controlKey: string;
  title: string;
  description: string;
  section: string;
  category: string;
  subcategory: string | null;
  tags: string[] | null;
  sourceUrl: string | null;
};

export type NormalizedControlPatch = Partial<NormalizedControlWrite>;

export type NormalizedFaqWrite = {
  faqKey: string;
  question: string;
  answer: string;
  section: string;
  category: string;
  subcategory: string | null;
  tags: string[] | null;
};

export type NormalizedFaqPatch = Partial<NormalizedFaqWrite>;

// ---------- constants ----------

const MAX_KEY_LENGTH = 160; // natural keys should stay readable and url/log friendly
const MAX_SHORT_TEXT_LENGTH = 200; // title/question/category/section/subcategory style fields
const MAX_LONG_TEXT_LENGTH = 12_000; // generous for descriptions/answers while keeping abuse bounded
const MAX_URL_LENGTH = 2_048; // conventional safe url upper bound for this prototype
const MAX_TAG_COUNT = 25; // enough for demo/admin use without encouraging noisy tagging
const MAX_TAG_LENGTH = 50; // tags should stay short and filter-friendly

// ---------- small helpers ----------

function validationError(message: string): never {
  throw new Error(`VALIDATION_ERROR: ${message}`); // stable prefix makes GraphQL verification clearer
}

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key); // required for partial-update detection
}

function normalizeRequiredString(
  value: unknown,
  fieldName: string,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    validationError(`${fieldName} must be a string`);
  }

  const normalized = value.trim().replace(/\s+/g, ' '); // trim + collapse internal whitespace
  if (normalized === '') {
    validationError(`${fieldName} is required`);
  }

  if (normalized.length > maxLength) {
    validationError(`${fieldName} must be at most ${maxLength} characters`);
  }

  return normalized; // canonical required text field
}

function normalizeOptionalNonEmptyString(
  value: unknown,
  fieldName: string,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    validationError(`${fieldName} must be a string`);
  }

  const normalized = value.trim().replace(/\s+/g, ' '); // trim + collapse internal whitespace
  if (normalized === '') {
    validationError(`${fieldName} cannot be blank`);
  }

  if (normalized.length > maxLength) {
    validationError(`${fieldName} must be at most ${maxLength} characters`);
  }

  return normalized; // canonical optional-but-present text field
}

function normalizeNullableString(
  value: unknown,
  fieldName: string,
  maxLength: number
): string | null {
  if (value == null) return null; // explicit null clears the field

  if (typeof value !== 'string') {
    validationError(`${fieldName} must be a string or null`);
  }

  const normalized = value.trim().replace(/\s+/g, ' '); // trim + collapse internal whitespace
  if (normalized === '') return null; // blank string behaves like clearing the field

  if (normalized.length > maxLength) {
    validationError(`${fieldName} must be at most ${maxLength} characters`);
  }

  return normalized; // canonical nullable field
}

function normalizeOptionalUrl(value: unknown): string | null {
  if (value == null) return null; // explicit null clears sourceUrl

  if (typeof value !== 'string') {
    validationError('sourceUrl must be a string or null');
  }

  const normalized = value.trim(); // urls should not get internal whitespace collapsing
  if (normalized === '') return null; // blank string behaves like clearing the field

  if (normalized.length > MAX_URL_LENGTH) {
    validationError(`sourceUrl must be at most ${MAX_URL_LENGTH} characters`);
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized); // use WHATWG URL parsing for a minimal sanity check
  } catch {
    validationError('sourceUrl must be a valid absolute URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    validationError('sourceUrl must use http or https');
  }

  return normalized; // keep the original normalized string for db writes
}

function normalizeTags(value: unknown): string[] | null {
  if (value == null) return null; // null/undefined means no tags

  if (!Array.isArray(value)) {
    validationError('tags must be an array of strings');
  }

  const seen = new Set<string>(); // dedupe tags case-insensitively while preserving first normalized form
  const out: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      validationError('tags must contain only strings');
    }

    const normalized = item.trim().replace(/\s+/g, ' '); // trim + collapse whitespace for stable tags
    if (normalized === '') {
      validationError('tags cannot contain blank values');
    }

    if (normalized.length > MAX_TAG_LENGTH) {
      validationError(`each tag must be at most ${MAX_TAG_LENGTH} characters`);
    }

    const dedupeKey = normalized.toLowerCase(); // case-insensitive dedupe for tag identity
    if (seen.has(dedupeKey)) continue; // skip duplicates without failing the mutation

    seen.add(dedupeKey);
    out.push(normalized);
  }

  if (out.length > MAX_TAG_COUNT) {
    validationError(`tags must contain at most ${MAX_TAG_COUNT} values`);
  }

  return out.length > 0 ? out : null; // empty tag arrays collapse to null for cleaner writes
}

function assertNonEmptyUpdate(
  input: Record<string, unknown>,
  allowedFields: string[]
): void {
  const hasAtLeastOneField = allowedFields.some(field => hasOwn(input, field)); // update inputs must actually change something
  if (!hasAtLeastOneField) {
    validationError('update input must include at least one field');
  }
}

export function normalizeId(id: unknown): string {
  if (typeof id !== 'string') {
    validationError('id must be a string');
  }

  const normalized = id.trim(); // ids should not get whitespace collapse beyond trimming
  if (normalized === '') {
    validationError('id is required');
  }

  return normalized; // service/db layer can treat id as present and non-blank
}

// ---------- controls validation ----------

export function validateCreateControlInput(
  input: CreateControlInput
): NormalizedControlWrite {
  return {
    controlKey: normalizeRequiredString(
      input.controlKey,
      'controlKey',
      MAX_KEY_LENGTH
    ),
    title: normalizeRequiredString(input.title, 'title', MAX_SHORT_TEXT_LENGTH),
    description: normalizeRequiredString(
      input.description,
      'description',
      MAX_LONG_TEXT_LENGTH
    ),
    section: normalizeRequiredString(
      input.section,
      'section',
      MAX_SHORT_TEXT_LENGTH
    ),
    category: normalizeRequiredString(
      input.category,
      'category',
      MAX_SHORT_TEXT_LENGTH
    ),
    subcategory: normalizeNullableString(
      input.subcategory,
      'subcategory',
      MAX_SHORT_TEXT_LENGTH
    ),
    tags: normalizeTags(input.tags),
    sourceUrl: normalizeOptionalUrl(input.sourceUrl)
  };
}

export function validateUpdateControlInput(
  input: UpdateControlInput
): NormalizedControlPatch {
  const raw = input as Record<string, unknown>;
  const allowedFields = [
    'controlKey',
    'title',
    'description',
    'section',
    'category',
    'subcategory',
    'tags',
    'sourceUrl'
  ];

  assertNonEmptyUpdate(raw, allowedFields); // reject empty update payloads before db work

  const patch: NormalizedControlPatch = {};

  if (hasOwn(raw, 'controlKey')) {
    patch.controlKey = normalizeOptionalNonEmptyString(
      raw.controlKey,
      'controlKey',
      MAX_KEY_LENGTH
    );
  }

  if (hasOwn(raw, 'title')) {
    patch.title = normalizeOptionalNonEmptyString(
      raw.title,
      'title',
      MAX_SHORT_TEXT_LENGTH
    );
  }

  if (hasOwn(raw, 'description')) {
    patch.description = normalizeOptionalNonEmptyString(
      raw.description,
      'description',
      MAX_LONG_TEXT_LENGTH
    );
  }

  if (hasOwn(raw, 'section')) {
    patch.section = normalizeOptionalNonEmptyString(
      raw.section,
      'section',
      MAX_SHORT_TEXT_LENGTH
    );
  }

  if (hasOwn(raw, 'category')) {
    patch.category = normalizeOptionalNonEmptyString(
      raw.category,
      'category',
      MAX_SHORT_TEXT_LENGTH
    );
  }

  if (hasOwn(raw, 'subcategory')) {
    patch.subcategory = normalizeNullableString(
      raw.subcategory,
      'subcategory',
      MAX_SHORT_TEXT_LENGTH
    );
  }

  if (hasOwn(raw, 'tags')) {
    patch.tags = normalizeTags(raw.tags);
  }

  if (hasOwn(raw, 'sourceUrl')) {
    patch.sourceUrl = normalizeOptionalUrl(raw.sourceUrl);
  }

  return patch; // patch only contains fields the caller actually provided
}

// ---------- faqs validation ----------

export function validateCreateFaqInput(
  input: CreateFaqInput
): NormalizedFaqWrite {
  return {
    faqKey: normalizeRequiredString(input.faqKey, 'faqKey', MAX_KEY_LENGTH),
    question: normalizeRequiredString(
      input.question,
      'question',
      MAX_LONG_TEXT_LENGTH
    ),
    answer: normalizeRequiredString(
      input.answer,
      'answer',
      MAX_LONG_TEXT_LENGTH
    ),
    section: normalizeRequiredString(
      input.section,
      'section',
      MAX_SHORT_TEXT_LENGTH
    ),
    category: normalizeRequiredString(
      input.category,
      'category',
      MAX_SHORT_TEXT_LENGTH
    ),
    subcategory: normalizeNullableString(
      input.subcategory,
      'subcategory',
      MAX_SHORT_TEXT_LENGTH
    ),
    tags: normalizeTags(input.tags)
  };
}

export function validateUpdateFaqInput(
  input: UpdateFaqInput
): NormalizedFaqPatch {
  const raw = input as Record<string, unknown>;
  const allowedFields = [
    'faqKey',
    'question',
    'answer',
    'section',
    'category',
    'subcategory',
    'tags'
  ];

  assertNonEmptyUpdate(raw, allowedFields); // reject empty update payloads before db work

  const patch: NormalizedFaqPatch = {};

  if (hasOwn(raw, 'faqKey')) {
    patch.faqKey = normalizeOptionalNonEmptyString(
      raw.faqKey,
      'faqKey',
      MAX_KEY_LENGTH
    );
  }

  if (hasOwn(raw, 'question')) {
    patch.question = normalizeOptionalNonEmptyString(
      raw.question,
      'question',
      MAX_LONG_TEXT_LENGTH
    );
  }

  if (hasOwn(raw, 'answer')) {
    patch.answer = normalizeOptionalNonEmptyString(
      raw.answer,
      'answer',
      MAX_LONG_TEXT_LENGTH
    );
  }

  if (hasOwn(raw, 'section')) {
    patch.section = normalizeOptionalNonEmptyString(
      raw.section,
      'section',
      MAX_SHORT_TEXT_LENGTH
    );
  }

  if (hasOwn(raw, 'category')) {
    patch.category = normalizeOptionalNonEmptyString(
      raw.category,
      'category',
      MAX_SHORT_TEXT_LENGTH
    );
  }

  if (hasOwn(raw, 'subcategory')) {
    patch.subcategory = normalizeNullableString(
      raw.subcategory,
      'subcategory',
      MAX_SHORT_TEXT_LENGTH
    );
  }

  if (hasOwn(raw, 'tags')) {
    patch.tags = normalizeTags(raw.tags);
  }

  return patch; // patch only contains fields the caller actually provided
}
