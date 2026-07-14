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

function getUploadEndpointUrl() {
  const base = getUploadApiBaseUrl();
  const target = `${base}/upload`;

  try {
    return new URL(target, window.location.origin).toString();
  } catch {
    return target;
  }
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
  'Uploading file...',
  'Extracting PDF text...',
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

  const outlineOverview = Array.isArray(raw.outlineOverview)
    ? raw.outlineOverview
        .filter(isObject)
        .map((row) => ({
          id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
          type: typeof row.type === 'string' ? row.type : '',
          sectionName: typeof row.sectionName === 'string' ? row.sectionName : '',
          pedagogy: typeof row.pedagogy === 'string' ? row.pedagogy : '',
          durationMinutes: Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0,
          slideNumbers: typeof row.slideNumbers === 'string' ? row.slideNumbers : '',
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
          slideNumbers: typeof act.slideNumbers === 'string' ? act.slideNumbers : '',
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
    preparation: toStringArray(raw.preparation),
    outlineOverview,
    lessonProcedure,
    glossary,
    bonusActivities: toStringArray(raw.bonusActivities),
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

function getSectionsByH2(doc) {
  const sections = new Map();
  let currentHeading = '';

  Array.from(doc.body.children).forEach((child) => {
    const tagName = child.tagName?.toLowerCase();
    if (tagName === 'h2') {
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

function parseGlossary(nodes) {
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

// Split an exported activity heading ("Title · [Type] · N min · Slides: X") back
// into its parts. Without this, re-importing an exported guide folds the type
// and duration into the title, and each round-trip compounds the pollution.
function parseActivityHeader(rawTitle) {
  let text = String(rawTitle || '');

  let activityType = '';
  const typeMatch = text.match(/\[(Recap|Task Review|Explore|Make|Evaluate|Share|Task at Home)\]/);
  if (typeMatch) activityType = typeMatch[1];

  let duration = 0;
  const durMatch = text.match(/\b(\d+)\s*min\b/i);
  if (durMatch) duration = Number(durMatch[1]);

  let slideNumbers = '';
  const slideMatch = text.match(/Slides?:\s*([^·]+)/i);
  if (slideMatch) slideNumbers = slideMatch[1].trim();

  const activityTitle = text
    .replace(ACTIVITY_TYPE_TOKEN, ' ')
    .replace(/\b\d+\s*min\b/gi, ' ')
    .replace(/Slides?:\s*[^·]*/gi, ' ')
    .replace(/\s*·\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·:–-]+|[\s·:–-]+$/g, '')
    .trim();

  return { activityTitle, activityType, duration, slideNumbers };
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
      slideNumbers: parsed.slideNumbers,
      instructions,
    });
  };

  nodes.forEach((node) => {
    if (node.tagName?.toLowerCase() === 'h3') {
      flush();
      current = {
        title: getText(node),
        content: [],
      };
      return;
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
    const slideNumbers = getText(node.querySelector('.badge-out')).replace(/^\s*slides?\s*/i, '').trim();
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
      slideNumbers,
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
      slideNumbers: '',
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
      guide.preparation = extractListItems([body]);
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
      guide.bonusActivities = extractListItems([body]);
      matched = true;
    }
  });

  return matched ? guide : null;
}

function parseGuideFromHTML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  if (doc.querySelector('parsererror')) {
    return null;
  }

  const h1Nodes = Array.from(doc.querySelectorAll('h1'));
  const lessonTitleNode = h1Nodes[1] || h1Nodes[0];
  const lessonTitle = getText(lessonTitleNode);
  if (!lessonTitle) {
    return null;
  }

  // New interactive (collapsible) export uses <details class="card"> instead of
  // <h2>/<h3> headings — parse that first, falling back to the legacy flat format.
  if (doc.querySelector('details.card')) {
    const interactive = parseInteractiveGuide(doc, lessonTitle);
    if (interactive) return interactive;
  }

  const sections = getSectionsByH2(doc);
  const overviewNodes = mapHeading(sections, ['Session Overview']);
  const learningOutcomeNodes = mapHeading(sections, ['Learning Outcomes']);
  const preparationNodes = mapHeading(sections, ['Preparation']);
  const lessonProcedureNodes = mapHeading(sections, ['Lesson Procedure']);
  const glossaryNodes = mapHeading(sections, ['Glossary']);
  const bonusNodes = mapHeading(sections, ['Bonus Activities']);

  const hasMappedSection =
    overviewNodes.length ||
    learningOutcomeNodes.length ||
    preparationNodes.length ||
    lessonProcedureNodes.length ||
    glossaryNodes.length ||
    bonusNodes.length;

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
    preparation: [''],
    outlineOverview: [],
    lessonProcedure: [],
    glossary: [],
    bonusActivities: [],
  };

  if (overviewNodes.length > 0) {
    guide.overview = extractHTML(overviewNodes);
  }

  if (learningOutcomeNodes.length > 0) {
    guide.learningOutcomes = extractListItems(learningOutcomeNodes);
  }

  if (preparationNodes.length > 0) {
    guide.preparation = extractListItems(preparationNodes);
  }

  if (lessonProcedureNodes.length > 0) {
    guide.lessonProcedure = parseLessonProcedure(lessonProcedureNodes);
  }

  if (glossaryNodes.length > 0) {
    guide.glossary = parseGlossary(glossaryNodes);
  }

  if (bonusNodes.length > 0) {
    guide.bonusActivities = extractListItems(bonusNodes);
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

  if (!fileInput.files[0]) {
    showError('Please select a .pdf file first.');
    return;
  }

  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  fd.append('session_minutes', String(getSessionMinutes()));

  generateBtn.disabled = true;
  startSpinner();

  try {
    const uploadEndpoint = getUploadEndpointUrl();
    const res = await fetch(uploadEndpoint, { method: 'POST', body: fd });
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
