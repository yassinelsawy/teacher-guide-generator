/* ── DOM refs ─────────────────────────────────────────────────────── */
const fileInput     = document.getElementById('file-input');
const fileLabel     = document.getElementById('file-label');
const fileChip      = document.getElementById('file-chip');
const fileChipName  = document.getElementById('file-chip-name');
const fileChipSize  = document.getElementById('file-chip-size');
const dropzone      = document.getElementById('dropzone');
const generateBtn   = document.getElementById('generate-btn');
const generateBtnTitle = document.getElementById('generate-btn-title');
const spinner       = document.getElementById('spinner');
const spinnerMsg    = document.getElementById('spinner-msg');
const errorBox      = document.getElementById('error-box');
const successSection = document.getElementById('success-toast');
const successTitle  = document.getElementById('success-title');
const openEditorBtn = document.getElementById('open-editor-btn');
const importGuideBtn = document.getElementById('import-guide-btn');
const importGuideInput = document.getElementById('import-guide-input');
const sessionTimeInput = document.getElementById('session-time');
const timeChips = Array.from(document.querySelectorAll('.time-chip'));

/* ── State ────────────────────────────────────────────────────────── */
let currentToken = null;
const MIN_SESSION_MINUTES = 10;
const MAX_SESSION_MINUTES = 240;
const DEFAULT_SESSION_MINUTES = 45;
const GUIDE_STORAGE_KEY = 'teacherGuideData';
const DEFAULT_GENERATE_LABEL = generateBtn?.dataset?.defaultLabel || 'Generate';
const LOADING_GENERATE_LABEL = 'Generating...';

function getUploadApiBaseUrl() {
  const base = document.body?.dataset?.uploadApiBaseUrl || '';
  return base.replace(/\/$/, '');
}

function getGenerateEndpointUrl() {
  const base = getUploadApiBaseUrl();
  const target = `${base}/generate`;

  try {
    return new URL(target, window.location.origin).toString();
  } catch {
    return target;
  }
}

/* ── Client-side PDF text extraction ─────────────────────────────────
 * Extracting in the browser (instead of uploading the raw PDF) keeps the
 * request body tiny, avoiding host-level body-size limits (e.g. Vercel's
 * serverless 4.5MB cap) regardless of PDF file size. */
async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
    if (text) pages.push(`--- Page ${pageNum} ---\n${text}`);
  }

  return pages.join('\n');
}

/* ── Session length ───────────────────────────────────────────────── */
// Returns the chosen session length in minutes, clamped to a sane range.
function getSessionMinutes() {
  const raw = Number(sessionTimeInput?.value);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SESSION_MINUTES;
  return Math.min(MAX_SESSION_MINUTES, Math.max(MIN_SESSION_MINUTES, Math.round(raw)));
}

// Highlights the preset chip that matches the current custom value (if any).
function syncTimeChips() {
  const value = Number(sessionTimeInput?.value);
  timeChips.forEach((chip) => {
    chip.classList.toggle('is-active', Number(chip.dataset.minutes) === value);
  });
}

if (sessionTimeInput && timeChips.length) {
  timeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      sessionTimeInput.value = chip.dataset.minutes;
      syncTimeChips();
    });
  });
  sessionTimeInput.addEventListener('input', syncTimeChips);
  // Clamp only when the user leaves the field, so mid-typing isn't fought.
  sessionTimeInput.addEventListener('blur', () => {
    if (sessionTimeInput.value !== '') sessionTimeInput.value = String(getSessionMinutes());
    syncTimeChips();
  });
  // Match the highlighted chip to the field's actual value on load (covers
  // browser form-state restoration that can override the default markup).
  syncTimeChips();
}

/* ── File selection ───────────────────────────────────────────────── */
function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function setSelectedFile(file) {
  if (!file) {
    fileLabel.textContent = '';
    if (fileChip) fileChip.hidden = true;
    return;
  }

  fileLabel.textContent = file.name;
  if (fileChipName) fileChipName.textContent = file.name;
  if (fileChipSize) fileChipSize.textContent = formatFileSize(file.size);
  if (fileChip) fileChip.hidden = false;
}

fileInput.addEventListener('change', () => {
  setSelectedFile(fileInput.files?.[0] || null);
});

dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    setSelectedFile(e.dataTransfer.files[0]);
  }
});

/* ── Spinner ──────────────────────────────────────────────────────── */
const msgs = [
  'Reading PDF file...',
  'Extracting text...',
  'Sending to Gemini AI...',
  'Generating Teacher Guide...',
  'Almost done...'
];
let msgTimer;

function startSpinner() {
  let i = 0;
  spinner.classList.add('active');
  spinnerMsg.textContent = msgs[0];
  if (generateBtnTitle) generateBtnTitle.textContent = LOADING_GENERATE_LABEL;
  generateBtn.setAttribute('aria-busy', 'true');
  if (importGuideBtn) importGuideBtn.disabled = true;
  msgTimer = setInterval(() => {
    i = (i + 1) % msgs.length;
    spinnerMsg.textContent = msgs[i];
  }, 3000);
}

function stopSpinner() {
  clearInterval(msgTimer);
  spinner.classList.remove('active');
  if (generateBtnTitle) generateBtnTitle.textContent = DEFAULT_GENERATE_LABEL;
  generateBtn.setAttribute('aria-busy', 'false');
  if (importGuideBtn) importGuideBtn.disabled = false;
}

/* ── Error helper ─────────────────────────────────────────────────── */
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('show');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.remove('show');
}

function isObject(value) {
  return typeof value === 'object' && value !== null;
}

function normalizeGuide(raw) {
  if (!isObject(raw) || !isObject(raw.lessonInfo)) return null;

  const toStringArray = (value) =>
    Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];

  // Preparation and Bonus Activities are rich-text HTML in the current editor
  // schema, but used to be plain-text arrays. Accept either so older exports
  // (and parsers that still emit arrays) don't get silently stripped of links
  // and formatting.
  const asRichTextHtml = (value) => {
    if (typeof value === 'string') return value;
    const items = toStringArray(value);
    return items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : '';
  };

  const outlineOverview = Array.isArray(raw.outlineOverview)
    ? raw.outlineOverview
        .filter(isObject)
        .map((row) => ({
          id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
          type: typeof row.type === 'string' ? row.type : '',
          sectionName: typeof row.sectionName === 'string' ? row.sectionName : '',
          pedagogy: typeof row.pedagogy === 'string' ? row.pedagogy : '',
          durationMinutes: Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0,
        }))
    : [];

  const lessonProcedure = Array.isArray(raw.lessonProcedure)
    ? raw.lessonProcedure
        .filter(isObject)
        .map((act) => ({
          id: typeof act.id === 'string' ? act.id : crypto.randomUUID(),
          activityType: typeof act.activityType === 'string' ? act.activityType : 'Explore',
          activityTitle: typeof act.activityTitle === 'string' ? act.activityTitle : '',
          duration: Number.isFinite(act.duration) ? act.duration : 10,
          instructions: typeof act.instructions === 'string' ? act.instructions : '',
        }))
    : [];

  const glossary = Array.isArray(raw.glossary)
    ? raw.glossary
        .filter(isObject)
        .map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
          concept: typeof entry.concept === 'string' ? entry.concept : '',
          definition: typeof entry.definition === 'string' ? entry.definition : '',
        }))
    : [];

  return {
    lessonInfo: {
      lessonName: typeof raw.lessonInfo.lessonName === 'string' ? raw.lessonInfo.lessonName : '',
      gradeLevel: typeof raw.lessonInfo.gradeLevel === 'string' ? raw.lessonInfo.gradeLevel : '',
      moduleLink: typeof raw.lessonInfo.moduleLink === 'string' ? raw.lessonInfo.moduleLink : '',
      slidesLink: typeof raw.lessonInfo.slidesLink === 'string' ? raw.lessonInfo.slidesLink : '',
      productionState: typeof raw.lessonInfo.productionState === 'string' ? raw.lessonInfo.productionState : 'Draft',
    },
    overview: typeof raw.overview === 'string' ? raw.overview : '',
    learningOutcomes: toStringArray(raw.learningOutcomes),
    preparation: asRichTextHtml(raw.preparation),
    outlineOverview,
    lessonProcedure,
    glossary,
    bonusActivities: asRichTextHtml(raw.bonusActivities),
  };
}

function getText(element) {
  return element?.textContent?.trim() || '';
}

function normalizeHeading(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function navigateToEditor() {
  const editorUrl = currentToken ? `/editor?token=${encodeURIComponent(currentToken)}` : '/editor'
  try {
    window.location.replace(editorUrl)
  } catch {
    window.location.href = editorUrl
  }
}

function extractListItems(nodes) {
  const items = [];

  nodes.forEach((node) => {
    const listItems = Array.from(node.querySelectorAll('li'));
    if (listItems.length > 0) {
      listItems.forEach((li) => {
        const text = getText(li);
        if (text) items.push(text);
      });
      return;
    }

    const text = getText(node);
    if (text) items.push(text);
  });

  return items;
}

function extractHTML(nodes) {
  return nodes.map((node) => node.outerHTML).join('\n').trim();
}

// Splits `root`'s direct children into sections keyed by heading text.
// Accepts h1 or h2 as section-level headings: the tool's own legacy export
// used h2, but Notion's HTML export uses h1 for every top-level heading. h3 is
// deliberately excluded — both formats use it for activity headings *within*
// a Lesson Procedure section, so treating it as a section boundary here would
// fracture that section instead of leaving those headings as its content.
// `excludeNode` lets the caller skip the node already identified as the
// document title so it isn't mistaken for an (empty) section boundary.
function getSectionsByHeading(root, excludeNode) {
  const sections = new Map();
  let currentHeading = '';

  Array.from(root.children).forEach((child) => {
    const tagName = child.tagName?.toLowerCase();
    if (/^h[12]$/.test(tagName || '') && child !== excludeNode) {
      currentHeading = normalizeHeading(getText(child));
      if (!sections.has(currentHeading)) {
        sections.set(currentHeading, []);
      }
      return;
    }

    if (!currentHeading) return;
    sections.get(currentHeading).push(child);
  });

  return sections;
}

function mapHeading(sections, aliases) {
  for (const alias of aliases) {
    const match = sections.get(normalizeHeading(alias));
    if (match) return match;
  }
  return [];
}

// Notion renders a Glossary as a two-column table (Concept | Definition)
// rather than a bulleted list. Skips a header row if its first cell literally
// reads "Concept".
function parseGlossaryTable(table) {
  const rows = Array.from(table.querySelectorAll('tr'));
  const entries = [];

  rows.forEach((tr, index) => {
    const cells = Array.from(tr.querySelectorAll('td, th'));
    if (cells.length < 2) return;

    const concept = getText(cells[0]);
    const definition = getText(cells[1]);
    if (index === 0 && normalizeHeading(concept) === 'concept') return;
    if (!concept && !definition) return;

    entries.push({ id: crypto.randomUUID(), concept, definition });
  });

  return entries;
}

function parseGlossary(nodes) {
  const tableNode = nodes.find((node) => node.tagName?.toLowerCase() === 'table');
  if (tableNode) return parseGlossaryTable(tableNode);

  const entries = [];

  nodes.forEach((node) => {
    const listItems = Array.from(node.querySelectorAll('li'));
    if (listItems.length > 0) {
      listItems.forEach((li) => {
        const label = li.querySelector('strong, b');
        const wholeText = getText(li);
        if (!wholeText) return;

        if (label) {
          const concept = getText(label).replace(/:\s*$/, '');
          const definition = wholeText.replace(getText(label), '').replace(/^[:\-\s]+/, '').trim();
          entries.push({
            id: crypto.randomUUID(),
            concept,
            definition,
          });
          return;
        }

        const [conceptPart, ...definitionParts] = wholeText.split(':');
        entries.push({
          id: crypto.randomUUID(),
          concept: (conceptPart || '').trim(),
          definition: definitionParts.join(':').trim(),
        });
      });
      return;
    }

    const text = getText(node);
    if (!text) return;

    const [conceptPart, ...definitionParts] = text.split(':');
    entries.push({
      id: crypto.randomUUID(),
      concept: (conceptPart || '').trim(),
      definition: definitionParts.join(':').trim(),
    });
  });

  return entries.filter((entry) => entry.concept || entry.definition);
}

function getActivityType(title) {
  const normalized = normalizeHeading(title);
  if (normalized === 'initiate') return 'Recap';
  if (normalized === 'learn' || normalized === 'explore') return 'Explore';
  if (normalized === 'make' || normalized === 'create') return 'Make';
  if (normalized === 'share' || normalized === 'present') return 'Share';
  if (normalized === 'review') return 'Task Review';
  if (normalized === 'evaluate') return 'Evaluate';
  return 'Explore';
}

const ACTIVITY_TYPES = ['Recap', 'Task Review', 'Explore', 'Make', 'Evaluate', 'Share', 'Task at Home'];
const ACTIVITY_TYPE_TOKEN = /\[(Recap|Task Review|Explore|Make|Evaluate|Share|Task at Home)\]/g;

// Maps the pedagogy-stage word Notion authors use as a leading "(Word) Title"
// prefix to this tool's activity type. Deliberately narrower than
// getActivityType()'s fuzzy fallback: only a recognized stage word is stripped
// from the title, so an unrelated leading parenthetical (e.g. "(Optional) ...")
// is left alone.
const STAGE_WORD_TO_TYPE = {
  initiate: 'Recap',
  recap: 'Recap',
  review: 'Task Review',
  'task review': 'Task Review',
  learn: 'Explore',
  explore: 'Explore',
  make: 'Make',
  create: 'Make',
  evaluate: 'Evaluate',
  share: 'Share',
  present: 'Share',
  'task at home': 'Task at Home',
};

// Split an activity heading back into its title/type/duration. Handles two
// formats: this tool's own exported "Title · [Type] · N min · Slides: X", and
// Notion's "(Type) Title (N Minutes)" convention.
function parseActivityHeader(rawTitle) {
  let text = String(rawTitle || '').trim();

  let activityType = '';
  const leadingParenMatch = text.match(/^\(([^)]+)\)\s*/);
  if (leadingParenMatch) {
    const stageKey = normalizeHeading(leadingParenMatch[1]);
    if (STAGE_WORD_TO_TYPE[stageKey]) {
      activityType = STAGE_WORD_TO_TYPE[stageKey];
      text = text.slice(leadingParenMatch[0].length);
    }
  }

  if (!activityType) {
    const typeMatch = text.match(/\[(Recap|Task Review|Explore|Make|Evaluate|Share|Task at Home)\]/);
    if (typeMatch) activityType = typeMatch[1];
  }

  let duration = 0;
  const parenDurMatch = text.match(/\(\s*(\d+)\s*(?:minutes?|mins?)\s*\)/i);
  if (parenDurMatch) {
    duration = Number(parenDurMatch[1]);
  } else {
    const durMatch = text.match(/\b(\d+)\s*(?:minutes?|mins?)\b/i);
    if (durMatch) duration = Number(durMatch[1]);
  }

  const activityTitle = text
    .replace(ACTIVITY_TYPE_TOKEN, ' ')
    .replace(/\(\s*\d+\s*(?:minutes?|mins?)\s*\)/gi, ' ')
    .replace(/\b\d+\s*(?:minutes?|mins?)\b/gi, ' ')
    // Strip any legacy "Slides: X" fragment left in older exported headings.
    .replace(/Slides?:\s*[^·]*/gi, ' ')
    .replace(/\s*·\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·:()–-]+|[\s·:()–-]+$/g, '')
    .trim();

  return { activityTitle, activityType, duration };
}

// Returns the heading text for a node that starts a new activity: either a
// raw <h1-4> (this tool's own export) or a Notion toggle block
// (<details><summary><h3>...) whose summary wraps a heading. Returns null for
// anything else, including plain (non-heading) toggles used for asides.
function getHeadingText(node) {
  const tag = node.tagName?.toLowerCase();
  if (/^h[1-4]$/.test(tag || '')) return getText(node);

  if (tag === 'details') {
    const summary = node.querySelector(':scope > summary');
    const heading = summary?.querySelector('h1, h2, h3, h4');
    if (heading) return getText(heading);
  }

  return null;
}

// A Notion toggle's body lives in a `.indented` div alongside <summary>;
// anything else (a plain <details> with no such wrapper) just uses its
// non-summary children directly.
function getDetailsContent(node) {
  const container = node.querySelector(':scope > div.indented');
  if (container) return Array.from(container.children);
  return Array.from(node.children).filter((child) => child.tagName?.toLowerCase() !== 'summary');
}

function parseLessonProcedure(nodes) {
  const activities = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const instructions = extractHTML(current.content);
    if (!current.title && !instructions) return;

    const parsed = parseActivityHeader(current.title);
    activities.push({
      id: crypto.randomUUID(),
      activityType: parsed.activityType || getActivityType(parsed.activityTitle),
      activityTitle: parsed.activityTitle || 'Learn',
      duration: parsed.duration || 10,
      instructions,
    });
  };

  nodes.forEach((node) => {
    const tagName = node.tagName?.toLowerCase();
    const isRawHeading = /^h[1-4]$/.test(tagName || '');

    if (isRawHeading) {
      flush();
      current = { title: getText(node), content: [] };
      return;
    }

    // Notion wraps each activity in a collapsible toggle instead of a bare
    // heading, so a plain tagName check misses it entirely.
    if (tagName === 'details') {
      const headingText = getHeadingText(node);
      if (headingText !== null) {
        flush();
        current = { title: headingText, content: getDetailsContent(node) };
        return;
      }
    }

    if (!current) {
      current = {
        title: 'Learn',
        content: [],
      };
    }

    current.content.push(node);
  });

  flush();
  return activities;
}

// ── Import: interactive (collapsible) export format ──────────────────
// The interactive HTML export renders each section as <details class="card">
// with a <span class="card-title"> label (and activities as <details
// class="activity">) instead of <h2>/<h3> headings, so it needs its own parser.
// Strips the leading "N. " numbering from a card title before matching.
function cardKey(title) {
  return normalizeHeading(String(title || '').replace(/^\s*\d+\.\s*/, ''));
}

function parseInteractiveActivities(body) {
  const activities = [];
  body.querySelectorAll('details.activity').forEach((node) => {
    const type = getText(node.querySelector('.pill'));
    const title = getText(node.querySelector('.act-title'));
    const durMatch = getText(node.querySelector('.badge-sec')).match(/(\d+)/);
    const bodyEl = node.querySelector('.activity-body');
    let instructions = bodyEl ? bodyEl.innerHTML.trim() : '';
    // Drop the "No instructions." placeholder the export inserts for empty activities.
    if (bodyEl && /^\s*no instructions\.?\s*$/i.test(getText(bodyEl))) instructions = '';
    if (!title && !instructions && !type) return;
    activities.push({
      id: crypto.randomUUID(),
      activityType: ACTIVITY_TYPES.includes(type) ? type : getActivityType(title),
      activityTitle: title || 'Learn',
      duration: durMatch ? Number(durMatch[1]) : 10,
      instructions,
    });
  });
  return activities;
}

function parseInteractiveOutline(body) {
  const rows = [];
  body.querySelectorAll('table.outline tbody tr').forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('td')).map((td) => getText(td));
    if (cells.length < 3) return;
    const sectionName = cells[0] === '—' ? '' : cells[0];
    const pedagogy = cells[1] === '—' ? '' : cells[1];
    const durMatch = cells[2].match(/(\d+)/);
    if (!sectionName && !pedagogy && !durMatch) return;
    rows.push({
      id: crypto.randomUUID(),
      type: '',
      sectionName,
      pedagogy,
      durationMinutes: durMatch ? Number(durMatch[1]) : 0,
    });
  });
  return rows;
}

// Reads <dt>/<dd> pairs from the first <dl> matching selector inside body.
function parseInteractiveDefList(body, selector) {
  const dl = body.querySelector(selector);
  const pairs = [];
  if (!dl) return pairs;
  const children = Array.from(dl.children);
  for (let i = 0; i < children.length; i++) {
    if (children[i].tagName?.toLowerCase() !== 'dt') continue;
    const next = children[i + 1];
    pairs.push({
      term: getText(children[i]),
      def: next && next.tagName?.toLowerCase() === 'dd' ? getText(next) : '',
    });
  }
  return pairs;
}

function parseInteractiveGuide(doc, lessonTitle) {
  const cards = Array.from(doc.querySelectorAll('details.card'));
  if (cards.length === 0) return null;

  const guide = {
    lessonInfo: { lessonName: lessonTitle, gradeLevel: '', moduleLink: '', slidesLink: '', productionState: 'Draft' },
    overview: '',
    learningOutcomes: [''],
    preparation: [''],
    outlineOverview: [],
    lessonProcedure: [],
    glossary: [],
    bonusActivities: [],
  };

  let matched = false;

  cards.forEach((card) => {
    const key = cardKey(getText(card.querySelector('.card-title')));
    const body = card.querySelector('.card-body');
    if (!body) return;

    if (key === 'lesson info') {
      parseInteractiveDefList(body, 'dl.info').forEach(({ term, def }) => {
        const t = normalizeHeading(term);
        if (t === 'grade') guide.lessonInfo.gradeLevel = def;
        else if (t === 'status') guide.lessonInfo.productionState = def || 'Draft';
        else if (t === 'module') guide.lessonInfo.moduleLink = def;
        else if (t === 'slides') guide.lessonInfo.slidesLink = def;
        else if (t === 'lesson' && !guide.lessonInfo.lessonName) guide.lessonInfo.lessonName = def;
      });
      matched = true;
    } else if (key.startsWith('overview')) {
      guide.overview = body.innerHTML.trim();
      matched = true;
    } else if (key === 'learning outcomes') {
      guide.learningOutcomes = extractListItems([body]);
      matched = true;
    } else if (key === 'preparation') {
      guide.preparation = body.innerHTML.trim();
      matched = true;
    } else if (key === 'outline overview') {
      guide.outlineOverview = parseInteractiveOutline(body);
      matched = true;
    } else if (key === 'lesson procedure') {
      guide.lessonProcedure = parseInteractiveActivities(body);
      matched = true;
    } else if (key === 'glossary') {
      guide.glossary = parseInteractiveDefList(body, 'dl.glossary')
        .map(({ term, def }) => ({ id: crypto.randomUUID(), concept: term, definition: def }))
        .filter((e) => e.concept || e.definition);
      matched = true;
    } else if (key === 'bonus activities') {
      guide.bonusActivities = body.innerHTML.trim();
      matched = true;
    }
  });

  return matched ? guide : null;
}

// ── Import: Notion / flat heading export ──────────────────────────────
// Alias lists a section's heading text is matched against, case-insensitively.
// Notion's own vocabulary ("Learning Objectives", "Glossaries") differs from
// this tool's ("Learning Outcomes", "Glossary"), so both need to resolve to
// the same guide field.
const OVERVIEW_ALIASES = ['Session Overview', 'Overview', 'Description'];
const LEARNING_OUTCOME_ALIASES = ['Learning Outcomes', 'Learning Objectives', 'Objectives'];
const PREPARATION_ALIASES = ['Preparation', 'Materials', 'Materials Needed', 'Prerequisites'];
// Notion exports commonly add an "Extra Resources" section with no equivalent
// field in this tool; folding it into Preparation keeps the links instead of
// silently dropping them.
const EXTRA_RESOURCE_ALIASES = ['Extra Resources', 'Resources', 'Additional Resources'];
const LESSON_PROCEDURE_ALIASES = ['Lesson Procedure', 'Procedure', 'Session Procedure', 'Lesson Plan'];
const GLOSSARY_ALIASES = ['Glossary', 'Glossaries', 'Key Terms', 'Vocabulary'];
const BONUS_ALIASES = ['Bonus Activities', 'Bonus Activity', 'Extension Activities', 'Bonus'];

// Detects a table shaped like Notion's outline summary (Type / Section name /
// Estimated time, in any order) and reads it into outline rows. Column order
// is resolved from the header text rather than assumed, since Notion doesn't
// label this table with a heading the way it does everything else.
function parseOutlineTable(table) {
  const theadCells = Array.from(table.querySelectorAll('thead th, thead td'));
  let headers;
  let bodyRows;

  if (theadCells.length > 0) {
    headers = theadCells.map((cell) => normalizeHeading(getText(cell)));
    bodyRows = Array.from(table.querySelectorAll('tbody tr'));
  } else {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (!rows.length) return null;
    headers = Array.from(rows[0].querySelectorAll('th, td')).map((cell) => normalizeHeading(getText(cell)));
    bodyRows = rows.slice(1);
  }

  const typeIdx = headers.findIndex((h) => /type/.test(h));
  const timeIdx = headers.findIndex((h) => /time|duration|minute/.test(h));
  const nameIdx = headers.findIndex((h) => /section|activity|name/.test(h));
  if (typeIdx === -1 || timeIdx === -1) return null;

  const rows = [];
  bodyRows.forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('th, td')).map((cell) => getText(cell));
    if (!cells.length) return;

    const type = cells[typeIdx] || '';
    const sectionName = nameIdx >= 0 ? cells[nameIdx] || '' : '';
    const durationMatch = (cells[timeIdx] || '').match(/(\d+)/);
    if (!type && !sectionName && !durationMatch) return;

    rows.push({
      id: crypto.randomUUID(),
      type,
      sectionName,
      pedagogy: '',
      durationMinutes: durationMatch ? Number(durationMatch[1]) : 0,
    });
  });

  return rows.length ? rows : null;
}

// The outline table isn't under a heading this tool recognizes, so it's found
// by shape rather than by section — the first matching table anywhere in the
// document wins.
function parseOutlineOverviewTables(root) {
  const tables = Array.from(root.querySelectorAll('table'));
  for (const table of tables) {
    const rows = parseOutlineTable(table);
    if (rows) return rows;
  }
  return [];
}

// Maps a Notion "Production State" property value onto this tool's fixed set
// of states (the editor renders it in a <select>, so anything else would show
// as unselected).
function normalizeProductionState(raw) {
  const value = normalizeHeading(raw);
  if (/publish|done|complete|live/.test(value)) return 'Published';
  if (/review|progress|active/.test(value)) return 'In Review';
  if (/archiv/.test(value)) return 'Archived';
  return 'Draft';
}

// Reads lesson metadata out of Notion's page-properties table (Grade, Slides
// Link, Module Link, Production State/Status). Absent in this tool's own
// exports, so a missing table is not an error.
function parseNotionProperties(doc) {
  const table = doc.querySelector('table.properties');
  if (!table) return null;

  const info = {};
  Array.from(table.querySelectorAll('tr')).forEach((tr) => {
    const th = tr.querySelector('th');
    const td = tr.querySelector('td');
    if (!th || !td) return;

    const label = normalizeHeading(getText(th));
    const link = td.querySelector('a');
    const value = link ? link.getAttribute('href') || getText(link) : getText(td);
    if (!value) return;

    if (/grade/.test(label)) info.gradeLevel = value;
    else if (/module/.test(label)) info.moduleLink = value;
    else if (/slide/.test(label)) info.slidesLink = value;
    else if (/status|production/.test(label)) info.productionState = normalizeProductionState(value);
  });

  return Object.keys(info).length ? info : null;
}

function parseGuideFromHTML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  if (doc.querySelector('parsererror')) {
    return null;
  }

  // New interactive (collapsible) export uses <details class="card"> instead of
  // <h2>/<h3> headings — parse that first, falling back to the flat formats below.
  if (doc.querySelector('details.card')) {
    const h1Nodes = Array.from(doc.querySelectorAll('h1'));
    const lessonTitleNode = h1Nodes[1] || h1Nodes[0];
    const lessonTitle = getText(lessonTitleNode);
    if (lessonTitle) {
      const interactive = parseInteractiveGuide(doc, lessonTitle);
      if (interactive) return interactive;
    }
  }

  // Notion wraps its content in <article class="page"><div class="page-body">,
  // with the real title in a <header class="page-title"> outside it — unlike
  // this tool's own flat exports, whose h1 title sits among the body's direct
  // children. Prefer .page-title when present so the walk below starts from
  // the right root and doesn't mistake the title for a section heading.
  const pageTitleNode = doc.querySelector('.page-title');
  const contentRoot = doc.querySelector('.page-body') || doc.body;

  let lessonTitle;
  let excludeFromSections = null;
  if (pageTitleNode) {
    lessonTitle = getText(pageTitleNode);
  } else {
    const h1Nodes = Array.from(doc.querySelectorAll('h1'));
    const lessonTitleNode = h1Nodes[1] || h1Nodes[0];
    lessonTitle = getText(lessonTitleNode);
    excludeFromSections = lessonTitleNode || null;
  }
  if (!lessonTitle) {
    return null;
  }

  const sections = getSectionsByHeading(contentRoot, excludeFromSections);
  const overviewNodes = mapHeading(sections, OVERVIEW_ALIASES);
  const learningOutcomeNodes = mapHeading(sections, LEARNING_OUTCOME_ALIASES);
  const preparationNodes = mapHeading(sections, PREPARATION_ALIASES).concat(
    mapHeading(sections, EXTRA_RESOURCE_ALIASES),
  );
  const lessonProcedureNodes = mapHeading(sections, LESSON_PROCEDURE_ALIASES);
  const glossaryNodes = mapHeading(sections, GLOSSARY_ALIASES);
  const bonusNodes = mapHeading(sections, BONUS_ALIASES);
  const outlineOverview = parseOutlineOverviewTables(contentRoot);
  const notionInfo = parseNotionProperties(doc);

  const hasMappedSection =
    overviewNodes.length ||
    learningOutcomeNodes.length ||
    preparationNodes.length ||
    lessonProcedureNodes.length ||
    glossaryNodes.length ||
    bonusNodes.length ||
    outlineOverview.length;

  if (!hasMappedSection) {
    return null;
  }

  const guide = {
    lessonInfo: {
      lessonName: lessonTitle,
      gradeLevel: '',
      moduleLink: '',
      slidesLink: '',
      productionState: 'Draft',
    },
    overview: '',
    learningOutcomes: [''],
    preparation: '',
    outlineOverview: [],
    lessonProcedure: [],
    glossary: [],
    bonusActivities: '',
  };

  if (notionInfo) {
    Object.assign(guide.lessonInfo, notionInfo);
  }

  if (overviewNodes.length > 0) {
    guide.overview = extractHTML(overviewNodes);
  }

  if (learningOutcomeNodes.length > 0) {
    guide.learningOutcomes = extractListItems(learningOutcomeNodes);
  }

  if (preparationNodes.length > 0) {
    // Rich HTML (not a plain-text list) so links and formatting survive.
    guide.preparation = extractHTML(preparationNodes);
  }

  if (outlineOverview.length > 0) {
    guide.outlineOverview = outlineOverview;
  }

  if (lessonProcedureNodes.length > 0) {
    guide.lessonProcedure = parseLessonProcedure(lessonProcedureNodes);
  }

  if (glossaryNodes.length > 0) {
    guide.glossary = parseGlossary(glossaryNodes);
  }

  if (bonusNodes.length > 0) {
    guide.bonusActivities = extractHTML(bonusNodes);
  }

  return guide;
}

/* ── Open editor helper ───────────────────────────────────────────── */
function openEditor() {
  const editorUrl = currentToken ? `/editor?token=${encodeURIComponent(currentToken)}` : '/editor';
  window.location.href = editorUrl;
}

/* ── Generate ─────────────────────────────────────────────────────── */
generateBtn.addEventListener('click', async () => {
  clearError();
  if (successSection) successSection.classList.remove('show');

  const file = fileInput.files[0];
  if (!file) {
    showError('Please select a .pdf file first.');
    return;
  }

  generateBtn.disabled = true;
  startSpinner();

  try {
    let slideText;
    try {
      slideText = await extractTextFromPdf(file);
    } catch {
      showError('Failed to read the PDF file. It may be corrupted or password-protected.');
      return;
    }

    if (!slideText.trim()) {
      showError('No readable text found in the uploaded PDF.');
      return;
    }

    const payload = {
      file_name: file.name.replace(/\.pdf$/i, ''),
      slide_text: slideText,
      session_minutes: getSessionMinutes(),
    };

    const generateEndpoint = getGenerateEndpointUrl();
    const res = await fetch(generateEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const rawBody = await res.text();
    let data = {};

    if (rawBody) {
      try {
        data = JSON.parse(rawBody);
      } catch {
        if (!res.ok) {
          showError(`Server error (${res.status}). Received an invalid response.`);
          return;
        }

        throw new Error('Server returned an invalid response payload.');
      }
    }

    if (!res.ok || data.error) {
      showError(data.error || `Server error (${res.status}). Please try again.`);
      return;
    }

    currentToken = typeof data.token === 'string' && data.token.trim() ? data.token : null;
    if (data.guide && currentToken) {
      sessionStorage.setItem(`pending-guide:${currentToken}`, JSON.stringify(data.guide));
      localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(data.guide));
    }

    // Show success toast
    if (successTitle) {
      successTitle.textContent = `"${data.file_name.replace(/_/g, ' ')}" generated!`;
    }
    if (successSection) successSection.classList.add('show');

    // Auto-open the editor after a short delay
    setTimeout(() => {
      navigateToEditor();
    }, 1200);

  } catch (err) {
    showError('Network error: ' + err.message);
  } finally {
    stopSpinner();
    generateBtn.disabled = false;
  }
});

/* ── Import guide from index page ────────────────────────────────── */
if (importGuideBtn && importGuideInput) {
  importGuideBtn.addEventListener('click', () => {
    clearError();
    importGuideInput.click();
  });

  importGuideInput.addEventListener('change', () => {
    const file = importGuideInput.files?.[0];
    if (!file) return;

    if (file.type && file.type !== 'text/html') {
      showError('Invalid Teacher Guide HTML format');
      importGuideInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const guide = parseGuideFromHTML(text);
        const normalizedGuide = guide ? normalizeGuide(guide) : null;
        if (!normalizedGuide) throw new Error('Invalid guide format');

        localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(normalizedGuide));
        currentToken = null;
        window.location.href = '/editor';
      } catch {
        showError('Invalid Teacher Guide HTML format');
      } finally {
        importGuideInput.value = '';
      }
    };

    reader.onerror = () => {
      showError('Invalid Teacher Guide HTML format');
      importGuideInput.value = '';
    };

    reader.readAsText(file);
  });
}

if (openEditorBtn) {
  openEditorBtn.addEventListener('click', navigateToEditor)
}
