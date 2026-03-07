/* ── DOM refs ─────────────────────────────────────────────────────── */
const driveLinkInput = document.getElementById('drive-link-input');
const generateBtn   = document.getElementById('generate-btn');
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

/* ── Spinner ──────────────────────────────────────────────────────── */
const msgs = [
  'Sending link to Gemini AI...',
  'Gemini is reading the presentation...',
  'Generating Teacher Guide...',
  'Structuring content...',
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

/* ── Generate ─────────────────────────────────────────────────────── */
generateBtn.addEventListener('click', async () => {
  errorBox.classList.remove('show');

  const link = driveLinkInput.value.trim();
  if (!link) {
    showError('Please paste a Google Drive link first.');
    return;
  }
  if (!link.includes('docs.google.com/presentation')) {
    showError('That does not look like a Google Slides link.');
    return;
  }

  generateBtn.disabled = true;
  startSpinner();

  try {
    const res  = await fetch('/generate-from-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slides_link: link }),
    });
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
      const err = await res.json().catch(() => ({ error: `PDF generation failed (HTTP ${res.status}).` }));
      showError(err.error || `PDF generation failed (HTTP ${res.status}).`);
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
