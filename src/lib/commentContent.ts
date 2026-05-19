import type {
  StudentAttendance,
  CommentByArea,
  CommentAreaDef,
  CourseProcess,
} from '@/types/classes';

// ─── Plain text helpers ───────────────────────────────────────────────────────

export function stripCommentHtml(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Extract text preserving paragraph / textarea line breaks. */
export function extractTextFromHtml(html: string): string {
  if (!html) return '';

  // 1. Visible textareas
  const textareaRegex = /<textarea(?![^>]*aria-hidden="true")[^>]*>([\s\S]*?)<\/textarea>/gi;
  const textareas: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = textareaRegex.exec(html)) !== null) {
    const text = m[1].trim();
    if (text) textareas.push(text);
  }
  if (textareas.length > 0) return textareas.join('\n');

  // 2. Quill / block HTML fallback
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getStudentAttendanceCommentContent(
  attendance: Pick<StudentAttendance, 'comment' | 'commentByAreas'> | null | undefined
): string {
  const areaContents = (attendance?.commentByAreas || [])
    .map(area => extractTextFromHtml(area?.content || ''))
    .filter(Boolean);
  const mainComment = extractTextFromHtml(attendance?.comment || '');
  return (areaContents.length > 0 ? areaContents.join('\n') : mainComment).trim();
}

// ─── Structured comment parsing ───────────────────────────────────────────────

export type TemplateMatch = 'exact' | 'modified' | 'custom';

export interface ParsedCriterion {
  name?: string;   // e.g. "[ĐNL] Kiến thức học viên tự học"
  score?: number;  // 1–5 from selected radio button
  text?: string;   // textarea content
  templateMatch?: TemplateMatch; // exact = copy nguyên sample, modified = sửa lại, custom = tự viết
}

export interface ParsedArea {
  name?: string;        // category from bold span: "KIẾN THỨC", "KỸ NĂNG", …
  sectionTitle?: string;// from <h4>: "Competency Score", "Other Comments", …
  criteria: ParsedCriterion[];
  generalText?: string; // Quill editor or plain text (no structured criteria)
}

const TEMPLATE_MATCH_EXCLUDED_LABELS = [
  'KHẢO SÁT ĐÁNH GIÁ CHẤT LƯỢNG DỊCH VỤ - DÀNH CHO PHỤ HUYNH',
];

function normalizeTemplateLabel(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTemplateMatchExcludedLabel(value: string | null | undefined): boolean {
  const normalized = normalizeTemplateLabel(value);
  return normalized.length > 0 && TEMPLATE_MATCH_EXCLUDED_LABELS
    .some(label => {
      const excludedLabel = normalizeTemplateLabel(label);
      return normalized === excludedLabel || normalized.includes(excludedLabel);
    });
}

function isTemplateMatchExcludedArea(
  entry: CommentAreaLookupEntry | undefined,
  groupTitle: string | null | undefined
): boolean {
  return isTemplateMatchExcludedLabel(entry?.area.name)
    || isTemplateMatchExcludedLabel(entry?.area.fieldName)
    || isTemplateMatchExcludedLabel(entry?.evaluationTitle)
    || isTemplateMatchExcludedLabel(groupTitle)
    || Boolean(entry?.area.translations?.some(t => isTemplateMatchExcludedLabel(t.value)));
}

// ─── CourseProcess-based structured parsing ──────────────────────────────────

export interface CommentAreaLookupEntry {
  area: CommentAreaDef;
  evaluationTitle?: string; // KIẾN THỨC / KỸ NĂNG / THÁI ĐỘ
}

export interface CommentAreaLookup {
  byId: Map<string, CommentAreaLookupEntry>;
  byNormalizedName: Map<string, CommentAreaLookupEntry>;
  all: CommentAreaLookupEntry[];
  get size(): number;
}

/** Strip prefix like `[COD]`, `[ĐNL]`, `[ART]` and normalize whitespace+case for name comparison. */
function normalizeName(name: string): string {
  return String(name || '')
    .replace(/^\s*\[[^\]]+\]\s*/i, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build multi-strategy lookup from courseProcess. Walks every nested commentArea source.
 *  Strategies:
 *    1. byId — exact commentAreaId match (best when IDs align)
 *    2. byNormalizedName — name match ignoring `[XXX]` prefix (handles courseProcess version drift)
 *    3. all — full list for content-vs-commentSamples fallback */
export function buildCommentAreaLookup(
  courseProcess: CourseProcess | null | undefined,
  commentAreas: CommentAreaDef[] = []
): CommentAreaLookup {
  const byId = new Map<string, CommentAreaLookupEntry>();
  const byNormalizedName = new Map<string, CommentAreaLookupEntry>();
  const all: CommentAreaLookupEntry[] = [];

  const add = (area: CommentAreaDef | undefined | null, evaluationTitle?: string) => {
    if (!area?.id) return;
    const entry: CommentAreaLookupEntry = { area, evaluationTitle };
    const existingById = byId.get(area.id);
    if (!existingById) {
      byId.set(area.id, entry);
    } else if ((!existingById.area.rates?.length && area.rates?.length) || (!existingById.area.fieldName && area.fieldName)) {
      byId.set(area.id, {
        area: {
          ...existingById.area,
          rates: existingById.area.rates?.length ? existingById.area.rates : area.rates,
          fieldName: existingById.area.fieldName || area.fieldName,
          translations: existingById.area.translations?.length ? existingById.area.translations : area.translations,
          slots: existingById.area.slots?.length ? existingById.area.slots : area.slots,
        },
        evaluationTitle: existingById.evaluationTitle || evaluationTitle,
      });
    }
    const nameKey = normalizeName(area.name || '');
    if (nameKey && !byNormalizedName.has(nameKey)) byNormalizedName.set(nameKey, entry);
    all.push(entry);
  };

  if (courseProcess) {
    courseProcess.defaultCommentAreas?.forEach(a => add(a));
    courseProcess.specificSessions?.forEach(s => s.commentAreas?.forEach(a => add(a)));
    courseProcess.finalSession?.finalEvaluations?.forEach(ev =>
      ev.commentAreas?.forEach(a => add(a, ev.title))
    );
    courseProcess.finalSession?.demoScore?.commentAreas?.forEach(a => add(a));
    courseProcess.checkpointSessions?.forEach(cs => {
      add(cs.checkpointCommentArea as CommentAreaDef | undefined);
      cs.otherComments?.forEach(a => add(a));
      cs.evaluations?.forEach(ev => ev.commentAreas?.forEach(a => add(a, ev.title)));
    });
  }

  commentAreas.forEach(a => add(a));

  return {
    byId,
    byNormalizedName,
    all,
    get size() { return byId.size; },
  };
}

/** Find the best matching CommentAreaLookupEntry for a given commentByArea,
 *  trying ID → normalized-name → content-vs-rate-sample in that order. */
function resolveCommentArea(
  cba: CommentByArea,
  lookup: CommentAreaLookup,
  textForFallback: string
): CommentAreaLookupEntry | undefined {
  // 1. Direct ID match
  if (cba.commentAreaId) {
    const hit = lookup.byId.get(cba.commentAreaId);
    if (hit) return hit;
  }

  // 2. Content fallback — only reliable when grade is known.
  // Find an area in courseProcess whose rate.value === grade has a sample matching content.
  if (textForFallback && typeof cba.grade === 'number') {
    for (const entry of lookup.all) {
      const samples = entry.area.rates?.find(r => r.value === cba.grade)?.commentSamples;
      if (!samples?.length) continue;
      if (detectTemplateMatch(textForFallback, samples) !== 'custom') return entry;
    }
  }

  return undefined;
}

/** Normalize text for comparison: strip markdown bullets, HTML tags, whitespace. */
function normalizeForCompare(s: string): string {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[​-‍﻿]/g, '')
    .replace(/^[\s\-•·]+/gm, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Detect whether teacher's content is an exact / modified / custom version of any sample. */
export function detectTemplateMatch(
  content: string,
  samples: string[] | undefined
): TemplateMatch {
  if (!samples?.length) return 'custom';
  const norm = normalizeForCompare(content);
  if (!norm) return 'custom';

  for (const sample of samples) {
    const sNorm = normalizeForCompare(sample);
    if (!sNorm) continue;
    if (norm === sNorm) return 'exact';
    // High overlap = teacher kept most of the sample
    if (sNorm.length > 20 && norm.includes(sNorm)) return 'modified';
    if (norm.length > 20 && sNorm.includes(norm)) return 'modified';
    // Token-based Jaccard for partial reuse
    const a = new Set(norm.split(' ').filter(t => t.length > 2));
    const b = new Set(sNorm.split(' ').filter(t => t.length > 2));
    if (a.size && b.size) {
      let inter = 0;
      a.forEach(t => { if (b.has(t)) inter++; });
      const jaccard = inter / (a.size + b.size - inter);
      if (jaccard >= 0.7) return 'modified';
    }
  }
  return 'custom';
}

/** Strip HTML to readable plain text (Quill-aware). */
function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Returns true when commentByAreas items carry the new structured fields
 *  (grade/commentAreaId/type) — meaning we should skip HTML parsing entirely. */
export function commentByAreasHasStructuredFields(
  commentByAreas: CommentByArea[] | undefined
): boolean {
  if (!commentByAreas?.length) return false;
  return commentByAreas.some(cba =>
    typeof cba.grade === 'number' || !!cba.commentAreaId || !!cba.type
  );
}

/** Build ParsedArea[] directly from commentByAreas + courseProcess lookup.
 *  Always renders when commentByAreas has structured fields, regardless of whether
 *  courseProcess matched. Groups by evaluation title when known, falls back to
 *  type-based grouping (RATE / CONTENT / CHECKPOINT) otherwise. */
export function parseCommentByAreasStructured(
  commentByAreas: CommentByArea[] | undefined,
  lookup: CommentAreaLookup
): ParsedArea[] {
  if (!commentByAreas?.length) return [];

  const byGroup = new Map<string, ParsedCriterion[]>(); // group title (or '__ungrouped__') → criteria
  const orderedGroups: string[] = [];
  const UNGROUPED = '__ungrouped__';

  const pushTo = (group: string, c: ParsedCriterion) => {
    if (!byGroup.has(group)) {
      byGroup.set(group, []);
      orderedGroups.push(group);
    }
    byGroup.get(group)!.push(c);
  };

  for (const cba of commentByAreas) {
    const text = htmlToPlainText(cba.content || '');
    if (!text && cba.grade == null) continue;

    // Resolve area via multi-strategy lookup (id → normalized name → content match)
    const def = resolveCommentArea(cba, lookup, text);
    // Also try normalized-name match if def is still missing and we have no name yet
    // (handled inside resolveCommentArea once we extract name; nothing else to do here)

    const name = def?.area.name || undefined;
    const groupTitle = cba.courseProcessFinalEvaluationTitle;
    const group = def?.evaluationTitle
      || groupTitle
      || UNGROUPED;

    const samples = def?.area.rates?.find(r => r.value === cba.grade)?.commentSamples
      ?.filter(sample => !isTemplateMatchExcludedLabel(sample));
    const templateMatch = text
      && !isTemplateMatchExcludedArea(def, groupTitle)
      && !isTemplateMatchExcludedLabel(text)
      ? detectTemplateMatch(text, samples)
      : undefined;

    pushTo(group, {
      name,
      score: typeof cba.grade === 'number' ? cba.grade : undefined,
      text: text || undefined,
      templateMatch,
    });
  }

  return orderedGroups.map(g => ({
    name: g === UNGROUPED ? undefined : g,
    criteria: byGroup.get(g)!,
  }));
}

/** Extract content of the Quill rich-text editor, preserving paragraph breaks. */
function extractQuillText(html: string): string {
  const editorMatch = html.match(/<div[^>]*class="[^"]*ql-editor[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/div>)/i);
  if (!editorMatch) return '';
  return editorMatch[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Find score from checked radio button.
 *  LMS pattern: <div style="text-align: center;">N</div> immediately before a Mui-checked span. */
function extractScore(html: string): number | undefined {
  // The label number (1-5) lives in a centered div right before the radio span that has Mui-checked.
  // We search for all (labelDiv, radioSpan) pairs and return the label of the checked one.
  const pairRegex = /<div[^>]*text-align:\s*center[^>]*>(\d+)<\/div>([\s\S]{0,300}?)(Mui-checked)/g;
  let lastScore: number | undefined;
  let pair: RegExpExecArray | null;
  while ((pair = pairRegex.exec(html)) !== null) {
    lastScore = parseInt(pair[1]);
  }
  return lastScore;
}

/** Remove noisy HTML elements (radio buttons, SVGs, textareas, inputs, fieldsets, score labels)
 *  leaving only the criterion name text. */
function extractCriterionName(html: string): string | undefined {
  const cleaned = html
    // MUI radio spans (contain SVGs and input)
    .replace(/<span[^>]*MuiRadio[^>]*>[\s\S]*?<\/span>/gi, '')
    // MUI checkbox spans
    .replace(/<span[^>]*MuiCheckbox[^>]*>[\s\S]*?<\/span>/gi, '')
    // All SVGs
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    // All textareas
    .replace(/<textarea[\s\S]*?<\/textarea>/gi, '')
    // Input elements
    .replace(/<input[^>]*>/gi, '')
    // Fieldset/legend (MUI OutlinedInput decoration)
    .replace(/<fieldset[\s\S]*?<\/fieldset>/gi, '')
    // Score label divs: <div style="text-align: center;">1</div>
    .replace(/<div[^>]*text-align:\s*center[^>]*>\s*\d+\s*<\/div>/gi, '')
    // Guideline / hint divs — any jss-class div that contains <p> tags (instructional grey text)
    .replace(/<div[^>]*class="[^"]*jss\d+[^"]*"[^>]*>(?:[\s\S]*?<p[\s\S]*?){2,}[\s\S]*?<\/div>/gi, '');

  const text = stripTags(cleaned).replace(/\s+/g, ' ').trim();
  // Ignore if it's only numbers, empty, or very long (probably grabbed everything)
  if (!text || text.length > 200 || /^\d[\d\s]*$/.test(text)) return undefined;
  return text;
}

/** Parse one criterion block (everything between two border-top dividers). */
function parseCriterionBlock(blockHtml: string): ParsedCriterion | null {
  // Visible textarea
  const textareaMatch = blockHtml.match(
    /<textarea(?![^>]*aria-hidden="true")[^>]*>([\s\S]*?)<\/textarea>/i
  );
  const text = textareaMatch ? textareaMatch[1].trim() : undefined;

  // Score
  const score = extractScore(blockHtml);

  // Criterion name: extract from block with noisy elements removed
  const name = extractCriterionName(blockHtml);

  if (!text && !name) return null;
  return { name, score, text: text || undefined };
}

/** Split an area's HTML into criterion blocks and parse each. */
function parseCriteriaFromHtml(html: string): ParsedCriterion[] {
  // Criterion blocks are separated by divs with border-top dashed style
  const blocks = html.split(/<div[^>]*border-top:\s*0\.25px\s*dashed\s*gray[^>]*>/gi);
  return blocks
    .map(parseCriterionBlock)
    .filter((c): c is ParsedCriterion => c !== null && (!!c.text || !!c.name));
}

/**
 * Parse `commentByAreas` HTML into structured areas with categories and criteria.
 * Does NOT hardcode any category or criterion names — everything is read from the HTML.
 */
export function parseCommentAreas(
  areasHtml: { content: string }[] | undefined
): ParsedArea[] {
  if (!areasHtml?.length) return [];

  const result: ParsedArea[] = [];

  for (const area of areasHtml) {
    const html = area.content || '';
    if (!html.trim()) continue;

    // Section title from <h4>
    const h4Match = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    const sectionTitle = h4Match ? stripTags(h4Match[1]) : undefined;

    // Quill editor general text
    const quillText = extractQuillText(html);

    // Find category names from bold-style spans
    // LMS stores area names as: <span style="font-weight: bold; font-size: 13px; ...">NAME</span>
    const boldSpanRegex = /<span[^>]*font-weight:\s*bold[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    const categoryBoundaries: { index: number; endIndex: number; name: string }[] = [];
    let bm: RegExpExecArray | null;
    while ((bm = boldSpanRegex.exec(html)) !== null) {
      const name = stripTags(bm[1]).trim();
      // Only keep short non-empty texts that look like category labels (not guidelines)
      if (name && name.length < 60) {
        categoryBoundaries.push({ index: bm.index, endIndex: bm.index + bm[0].length, name });
      }
    }

    if (categoryBoundaries.length > 0) {
      // Split HTML into per-category chunks
      for (let i = 0; i < categoryBoundaries.length; i++) {
        const start = categoryBoundaries[i].endIndex;
        const end = i < categoryBoundaries.length - 1
          ? categoryBoundaries[i + 1].index
          : html.length;
        const chunkHtml = html.slice(start, end);

        const criteria = parseCriteriaFromHtml(chunkHtml);
        if (criteria.length > 0) {
          result.push({ name: categoryBoundaries[i].name, sectionTitle, criteria });
        }
      }

      // If there's also Quill content in this entry, add it as a separate general text area
      if (quillText) {
        result.push({ sectionTitle, criteria: [], generalText: quillText });
      }
    } else if (quillText) {
      // No category structure — just general text (Quill editor)
      result.push({ sectionTitle, criteria: [], generalText: quillText });
    } else {
      // No bold-span categories and no Quill editor.
      // Each commentByAreas item may be a single criterion — parse it fully
      // so we get name + score + text (not just raw textarea text).
      const criteria = parseCriteriaFromHtml(html);
      if (criteria.length > 0) {
        result.push({ sectionTitle, criteria });
      } else {
        const plain = extractTextFromHtml(html);
        if (plain) result.push({ sectionTitle, criteria: [{ text: plain }] });
      }
    }
  }

  return result;
}
