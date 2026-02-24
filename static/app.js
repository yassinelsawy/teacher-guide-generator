/* ── DOM refs ─────────────────────────────────────────────────────── */
const fileInput     = document.getElementById('file-input');
const fileLabel     = document.getElementById('file-label');
const dropzone      = document.getElementById('dropzone');
const generateBtn   = document.getElementById('generate-btn');
const demoBtn       = document.getElementById('demo-btn');
const pdfBtn        = document.getElementById('pdf-btn');
const spinner       = document.getElementById('spinner');
const spinnerMsg    = document.getElementById('spinner-msg');
const errorBox      = document.getElementById('error-box');
const editorSection = document.getElementById('editor-section');
const guideTitle    = document.getElementById('guide-title');

/* ── Quill setup ──────────────────────────────────────────────────── */
const quill = new Quill('#quill-editor', {
  theme: 'snow',
  modules: {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ color: [] }, { background: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        ['link', 'image'],
        ['clean']
      ],
      handlers: {
        image: imagePickerHandler
      }
    }
  }
});

/* ── Custom image handler — opens file picker, embeds as base64 ───── */
function imagePickerHandler() {
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'image/png, image/jpeg, image/gif, image/webp');
  input.click();

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, 'image', e.target.result);
      quill.setSelection(range.index + 1);
    };
    reader.readAsDataURL(file);
  });
}

/* Keep track of current file name for PDF export */
let currentFileName = 'teacher_guide';

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

/* ── Populate Quill editor ────────────────────────────────────────── */
function populateEditor(html, fileName) {
  currentFileName = fileName || 'teacher_guide';
  guideTitle.textContent = 'Teacher Guide — ' + currentFileName;

  quill.clipboard.dangerouslyPasteHTML(html);

  editorSection.classList.add('show');
  editorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Error helper ─────────────────────────────────────────────────── */
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('show');
}

/* ── Demo ────────────────────────────────────────────────────────── */
demoBtn.addEventListener('click', async () => {
  errorBox.classList.remove('show');
  demoBtn.disabled = true;
  startSpinner();
  try {
    const res  = await fetch('/demo');
    const data = await res.json();
    populateEditor(data.html, data.file_name);
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

    populateEditor(data.html, data.file_name);

  } catch (err) {
    showError('Network error: ' + err.message);
  } finally {
    stopSpinner();
    generateBtn.disabled = false;
  }
});

/* ── Export PDF ───────────────────────────────────────────────────── */
pdfBtn.addEventListener('click', async () => {
  const html = quill.root.innerHTML;

  pdfBtn.disabled = true;
  pdfBtn.textContent = 'Generating PDF...';

  try {
    const res = await fetch('/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, file_name: currentFileName })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'PDF generation failed.' }));
      showError(err.error || 'PDF generation failed.');
      return;
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = currentFileName + '.pdf';
    a.click();
    URL.revokeObjectURL(url);

  } catch (err) {
    showError('PDF export failed: ' + err.message);
  } finally {
    pdfBtn.disabled = false;
    pdfBtn.innerHTML = '&#128462; Export PDF';
  }
});
