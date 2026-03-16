/* ── DOM refs ─────────────────────────────────────────────────────── */
const fileInput     = document.getElementById('file-input');
const fileLabel     = document.getElementById('file-label');
const dropzone      = document.getElementById('dropzone');
const generateBtn   = document.getElementById('generate-btn');
const spinner       = document.getElementById('spinner');
const spinnerMsg    = document.getElementById('spinner-msg');
const errorBox      = document.getElementById('error-box');
const successSection = document.getElementById('success-section');
const successTitle  = document.getElementById('success-title');
const openEditorBtn = document.getElementById('open-editor-btn');
const importGuideBtn = document.getElementById('import-guide-btn');
const importGuideInput = document.getElementById('import-guide-input');

/* ── State ────────────────────────────────────────────────────────── */
let currentToken = null;
const GUIDE_STORAGE_KEY = 'teacherGuideData';

/* ── File selection ───────────────────────────────────────────────── */
fileInput.addEventListener('change', () => {
  fileLabel.textContent = fileInput.files[0]?.name || '';
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
    fileLabel.textContent = e.dataTransfer.files[0].name;
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
  msgTimer = setInterval(() => {
    i = (i + 1) % msgs.length;
    spinnerMsg.textContent = msgs[i];
  }, 3000);
}

function stopSpinner() {
  clearInterval(msgTimer);
  spinner.classList.remove('active');
}

/* ── Error helper ─────────────────────────────────────────────────── */
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('show');
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
    publishingGuide: toStringArray(raw.publishingGuide),
    glossary,
    bonusActivities: toStringArray(raw.bonusActivities),
  };
}

/* ── Open editor helper ───────────────────────────────────────────── */
function openEditor() {
  if (!currentToken) return;
  const editorUrl = `/editor?token=${encodeURIComponent(currentToken)}`;
  window.open(editorUrl, '_blank');
}

/* ── Generate ─────────────────────────────────────────────────────── */
generateBtn.addEventListener('click', async () => {
  errorBox.classList.remove('show');
  successSection.classList.remove('show');

  if (!fileInput.files[0]) {
    showError('Please select a .pdf file first.');
    return;
  }

  const fd = new FormData();
  fd.append('file', fileInput.files[0]);

  generateBtn.disabled = true;
  startSpinner();

  try {
    const res  = await fetch('/upload', { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok || data.error) {
      showError(data.error || 'Unknown server error.');
      return;
    }

    currentToken = data.token;
    if (data.guide && currentToken) {
      sessionStorage.setItem(`pending-guide:${currentToken}`, JSON.stringify(data.guide));
      localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(data.guide));
    }

    // Show success card
    successTitle.textContent = `"${data.file_name.replace(/_/g, ' ')}" generated!`;
    successSection.classList.add('show');

    // Auto-open the editor after a short delay
    setTimeout(openEditor, 800);

  } catch (err) {
    showError('Network error: ' + err.message);
  } finally {
    stopSpinner();
    generateBtn.disabled = false;
  }
});

/* ── Manual "Open in Editor" button ──────────────────────────────── */
if (openEditorBtn) {
  openEditorBtn.addEventListener('click', openEditor);
}

/* ── Import guide from index page ────────────────────────────────── */
if (importGuideBtn && importGuideInput) {
  importGuideBtn.addEventListener('click', () => {
    errorBox.classList.remove('show');
    importGuideInput.click();
  });

  importGuideInput.addEventListener('change', () => {
    const file = importGuideInput.files?.[0];
    if (!file) return;

    if (file.type && file.type !== 'application/json') {
      showError('Please select a valid .json file.');
      importGuideInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const raw = JSON.parse(text);
        const guide = normalizeGuide(raw);
        if (!guide) throw new Error('Invalid guide format');

        localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(guide));
        window.open('/editor', '_blank');
      } catch {
        showError('Invalid JSON file. Please import a Teacher Guide export.');
      } finally {
        importGuideInput.value = '';
      }
    };

    reader.onerror = () => {
      showError('Failed to read JSON file. Please try again.');
      importGuideInput.value = '';
    };

    reader.readAsText(file);
  });
}
