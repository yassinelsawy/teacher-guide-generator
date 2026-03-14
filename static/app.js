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

/* ── State ────────────────────────────────────────────────────────── */
let currentToken = null;

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
