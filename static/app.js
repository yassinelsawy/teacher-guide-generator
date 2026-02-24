/* ── DOM refs ─────────────────────────────────────────────────────── */
const fileInput     = document.getElementById('file-input');
const fileLabel     = document.getElementById('file-label');
const dropzone      = document.getElementById('dropzone');
const generateBtn   = document.getElementById('generate-btn');
const demoBtn       = document.getElementById('demo-btn');
const spinner       = document.getElementById('spinner');
const spinnerMsg    = document.getElementById('spinner-msg');
const errorBox      = document.getElementById('error-box');
const editorSection = document.getElementById('editor-section');
const guideTitle    = document.getElementById('guide-title');

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
  'Extracting slide text...',
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

/* ── Demo ────────────────────────────────────────────────────────── */
demoBtn.addEventListener('click', async () => {
  errorBox.classList.remove('show');
  demoBtn.disabled = true;
  startSpinner();
  try {
    const res  = await fetch('/demo');
    const data = await res.json();
    populateEditor(data.guide, data.file_name);
  } catch (err) {
    showError('Demo failed: ' + err.message);
  } finally {
    stopSpinner();
    demoBtn.disabled = false;
  }
});

/* ── Generate ─────────────────────────────────────────────────────── */
generateBtn.addEventListener('click', async () => {
  errorBox.classList.remove('show');

  if (!fileInput.files[0]) {
    showError('Please select a .pptx file first.');
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

    populateEditor(data.guide, data.file_name);

  } catch (err) {
    showError('Network error: ' + err.message);
  } finally {
    stopSpinner();
    generateBtn.disabled = false;
  }
});

/* ── Populate editor ──────────────────────────────────────────────── */
function populateEditor(g, fileName) {
  guideTitle.textContent = 'Teacher Guide — ' + fileName;

  document.getElementById('f-overview').value    = g.session_overview          || '';
  document.getElementById('f-preparation').value = g.preparation               || '';
  document.getElementById('f-initiate').value    = g.lesson_procedure?.initiate || '';
  document.getElementById('f-learn').value       = g.lesson_procedure?.learn    || '';
  document.getElementById('f-make').value        = g.lesson_procedure?.make     || '';
  document.getElementById('f-share').value       = g.lesson_procedure?.share    || '';
  document.getElementById('f-bonus').value       = g.bonus_activities           || '';

  // Objectives
  const ol = document.getElementById('objectives-list');
  ol.innerHTML = '';
  (g.learning_objectives || []).forEach(obj => addObjective(obj));

  // Glossary
  const gr = document.getElementById('glossary-rows');
  gr.innerHTML = '';
  (g.glossary || []).forEach(row => addGlossaryRow(row.term, row.definition));

  editorSection.classList.add('show');
  editorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Objectives ───────────────────────────────────────────────────── */
function addObjective(text) {
  const ol = document.getElementById('objectives-list');
  const li = document.createElement('li');
  li.innerHTML = `
    <input type="text" value="${escHtml(text)}" placeholder="Learning objective..." />
    <button class="del-btn" title="Remove" onclick="this.closest('li').remove()">&times;</button>`;
  ol.appendChild(li);
}

/* ── Glossary ─────────────────────────────────────────────────────── */
function addGlossaryRow(term, def) {
  const container = document.getElementById('glossary-rows');
  const div = document.createElement('div');
  div.className = 'glossary-row';
  div.innerHTML = `
    <input type="text" value="${escHtml(term)}" placeholder="Term" />
    <input type="text" value="${escHtml(def)}"  placeholder="Definition" />
    <button class="del-btn" title="Remove" onclick="this.closest('.glossary-row').remove()">&times;</button>`;
  container.appendChild(div);
}

/* ── Download ─────────────────────────────────────────────────────── */
function downloadGuide() {
  const title = guideTitle.textContent;

  const objectives = [...document.querySelectorAll('#objectives-list li input')]
    .map((inp, i) => `  ${i + 1}. ${inp.value}`)
    .join('\n');

  const glossary = [...document.querySelectorAll('#glossary-rows .glossary-row')]
    .map(row => {
      const inputs = row.querySelectorAll('input');
      return `  ${inputs[0].value}: ${inputs[1].value}`;
    })
    .join('\n');

  const sep = (n = 40) => '-'.repeat(n);

  const content = [
    title,
    '='.repeat(title.length),
    '',
    'SESSION OVERVIEW',
    sep(),
    document.getElementById('f-overview').value,
    '',
    'LEARNING OBJECTIVES',
    sep(),
    objectives,
    '',
    'PREPARATION',
    sep(),
    document.getElementById('f-preparation').value,
    '',
    'LESSON PROCEDURE',
    sep(),
    'Initiate:',
    document.getElementById('f-initiate').value,
    '',
    'Learn:',
    document.getElementById('f-learn').value,
    '',
    'Make:',
    document.getElementById('f-make').value,
    '',
    'Share:',
    document.getElementById('f-share').value,
    '',
    'GLOSSARY',
    sep(),
    glossary,
    '',
    'BONUS ACTIVITIES',
    sep(),
    document.getElementById('f-bonus').value,
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = title.replace(/[^a-z0-9]/gi, '_') + '.txt';
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Utilities ────────────────────────────────────────────────────── */
function showError(msg) {
  errorBox.textContent = '⚠️ ' + msg;
  errorBox.classList.add('show');
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
