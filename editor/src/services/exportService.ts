// Frontend-only export helpers for Teacher Guide outputs.
import {
  guideToExportJSON,
  CUSTOM_SECTION_TYPE_LABELS,
  type Activity,
  type CustomSection,
  type OutlineRow,
  type TeacherGuide,
} from '@/types'

interface FileSystemWritableStream {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}
interface SaveFileHandle {
  createWritable(): Promise<FileSystemWritableStream>
}
interface SaveFilePickerOptions {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
}
declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFileHandle>
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '').trim() || 'Teacher Guide'
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// Lets the user pick a save location and file name when the browser supports
// the File System Access API; otherwise falls back to a standard download
// (still using a lesson-name-derived filename instead of a fixed one).
async function saveOrDownload(blob: Blob, suggestedName: string, description: string, accept: Record<string, string[]>) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Fall through to the download fallback for any other error (e.g. unsupported in this context).
    }
  }
  triggerDownload(blob, suggestedName)
}

export function exportGuideAsJSON(guide: TeacherGuide) {
  const data = guideToExportJSON(guide)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const suggestedName = `${sanitizeFileName(guide.lessonInfo.lessonName || 'Teacher Guide')}.json`
  void saveOrDownload(blob, suggestedName, 'JSON file', { 'application/json': ['.json'] })
}

// ─── Interactive HTML export ──────────────────────────────────────────────
// Produces a standalone document whose sections collapse/expand exactly like
// the editor. Native <details>/<summary> handle the interactivity, so the file
// works offline with no scripts.

// Escapes plain-text fields. Rich-text fields (Tiptap HTML) are inserted as-is.
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Activity-type pill colors, mirroring ActivityCard's TYPE_COLOR palette.
const ACTIVITY_PILL: Record<string, string> = {
  Recap:          'background:#f3e8ff;color:#6b21a8;border-color:#e9d5ff',
  'Task Review':  'background:#ffedd5;color:#9a3412;border-color:#fed7aa',
  Explore:        'background:#dbeafe;color:#1e40af;border-color:#bfdbfe',
  Make:           'background:#dcfce7;color:#166534;border-color:#bbf7d0',
  Evaluate:       'background:#fef9c3;color:#854d0e;border-color:#fef08a',
  Share:          'background:#fce7f3;color:#9d174d;border-color:#fbcfe8',
  'Task at Home': 'background:#ccfbf1;color:#115e59;border-color:#99f6e4',
}

function badgeHTML(badge?: string | number): string {
  if (badge === undefined || badge === '' || badge === 0) return ''
  return `<span class="badge">${esc(badge)}</span>`
}

// A top-level collapsible card, open by default like the editor sections.
function card(title: string, body: string, badge?: string | number, open = true): string {
  if (!body.trim()) return ''
  return `<details class="card"${open ? ' open' : ''}>
  <summary class="card-summary"><span class="chevron"></span><span class="card-title">${esc(title)}</span>${badgeHTML(badge)}</summary>
  <div class="card-body">${body}</div>
</details>`
}

function listHTML(items: string[], ordered = false): string {
  const clean = items.filter(Boolean)
  if (!clean.length) return ''
  const tag = ordered ? 'ol' : 'ul'
  return `<${tag}>${clean.map((i) => `<li>${esc(i)}</li>`).join('')}</${tag}>`
}

function outlineTableHTML(rows: OutlineRow[]): string {
  if (!rows.length) return ''
  const total = rows.reduce((s, r) => s + (Number(r.durationMinutes) || 0), 0)
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(r.sectionName) || '—'}</td><td>${esc(r.pedagogy) || '—'}</td><td>${
          r.durationMinutes ? `${esc(r.durationMinutes)} min` : '—'
        }</td></tr>`,
    )
    .join('')
  return `<table class="outline">
  <thead><tr><th>Section Name</th><th>Pedagogy</th><th>Duration</th></tr></thead>
  <tbody>${body}</tbody>
  <tfoot><tr><td colspan="2">Total</td><td>${total} min</td></tr></tfoot>
</table>`
}

// Each activity is itself collapsible, matching the editor's ActivityCard.
function activityHTML(activities: Activity[]): string {
  if (!activities.length) return ''
  return activities
    .map((act, i) => {
      const pillStyle = ACTIVITY_PILL[act.activityType] ?? 'background:#f3f4f6;color:#374151;border-color:#e5e7eb'
      const metas = [
        act.duration ? `<span class="badge-sec">${esc(act.duration)} min</span>` : '',
      ].join('')
      return `<details class="activity" open>
  <summary class="activity-summary"><span class="chevron"></span><span class="act-index">${i + 1}</span><span class="pill" style="${pillStyle}">${esc(
        act.activityType || 'Activity',
      )}</span><span class="act-title">${esc(act.activityTitle) || '<span class="muted">Untitled</span>'}</span>${metas}</summary>
  <div class="activity-body">${act.instructions || '<p class="muted">No instructions.</p>'}</div>
</details>`
    })
    .join('')
}

function lessonInfoHTML(info: TeacherGuide['lessonInfo']): string {
  const rows = [
    info.lessonName && ['Lesson', esc(info.lessonName)],
    info.gradeLevel && ['Grade', esc(info.gradeLevel)],
    info.productionState && ['Status', esc(info.productionState)],
    info.moduleLink && ['Module', `<a href="${esc(info.moduleLink)}">${esc(info.moduleLink)}</a>`],
    info.slidesLink && ['Slides', `<a href="${esc(info.slidesLink)}">${esc(info.slidesLink)}</a>`],
  ].filter(Boolean) as [string, string][]
  if (!rows.length) return ''
  return `<dl class="info">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`
}

function customSectionHTML(section: CustomSection): string {
  const title = section.title || CUSTOM_SECTION_TYPE_LABELS[section.sectionType] || 'Custom Section'
  let body = ''
  switch (section.sectionType) {
    case 'lessonInfo':      body = lessonInfoHTML(section.lessonInfo); break
    case 'overview':        body = section.overview || ''; break
    case 'learningOutcomes':body = listHTML(section.learningOutcomes); break
    case 'preparation':     body = listHTML(section.preparation); break
    case 'outlineOverview': body = outlineTableHTML(section.outlineOverview); break
    case 'lessonProcedure': body = activityHTML(section.lessonProcedure); break
    case 'glossary':
      body = section.glossary.filter((g) => g.concept || g.definition).length
        ? `<dl class="glossary">${section.glossary
            .filter((g) => g.concept || g.definition)
            .map((g) => `<dt>${esc(g.concept)}</dt><dd>${esc(g.definition)}</dd>`)
            .join('')}</dl>`
        : ''
      break
    case 'bonusActivities': body = listHTML(section.bonusActivities); break
    case 'text':
    default:                body = section.text || ''; break
  }
  return card(title, body)
}

function guideToInteractiveHTML(guide: TeacherGuide): string {
  const sections: string[] = []

  sections.push(card('1. Lesson Info', lessonInfoHTML(guide.lessonInfo)))
  sections.push(card('2. Overview (Lesson Scenario)', guide.overview || ''))
  sections.push(card('3. Learning Outcomes', listHTML(guide.learningOutcomes), guide.learningOutcomes.filter(Boolean).length))
  sections.push(card('4. Preparation', listHTML(guide.preparation), guide.preparation.filter(Boolean).length))
  sections.push(card('5. Outline Overview', outlineTableHTML(guide.outlineOverview), guide.outlineOverview.length))
  sections.push(card('6. Lesson Procedure', activityHTML(guide.lessonProcedure), guide.lessonProcedure.length))
  sections.push(
    card(
      '7. Glossary',
      guide.glossary.filter((g) => g.concept || g.definition).length
        ? `<dl class="glossary">${guide.glossary
            .filter((g) => g.concept || g.definition)
            .map((g) => `<dt>${esc(g.concept)}</dt><dd>${esc(g.definition)}</dd>`)
            .join('')}</dl>`
        : '',
      guide.glossary.length,
    ),
  )
  sections.push(card('8. Bonus Activities', listHTML(guide.bonusActivities), guide.bonusActivities.filter(Boolean).length || undefined))

  ;(guide.customSections || []).forEach((section) => sections.push(customSectionHTML(section)))

  return sections.filter(Boolean).join('\n')
}

const EXPORT_STYLES = `
:root{--primary:#056fec;--border:#e5e7eb;--muted:#6b7280;--card:#ffffff;--bg:#f8fafc;}
*{box-sizing:border-box;}
body{font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;max-width:960px;margin:0 auto;padding:32px 20px 64px;line-height:1.6;color:#111827;background:var(--bg);}
h1.doc-title{color:#000000;font-size:40px;font-weight:800;margin:0 0 8px;}
.doc-sub{color:var(--muted);margin:0 0 24px;font-size:14px;}
.card{border:1px solid var(--border);background:var(--card);border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.04);margin-bottom:16px;overflow:hidden;}
.card-summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:16px 24px;font-weight:600;font-size:16px;transition:background .15s;}
.card-summary::-webkit-details-marker{display:none;}
.card-summary:hover{background:rgba(5,111,236,.05);}
.card-title{flex:1;min-width:0;}
.card-body{border-top:1px solid var(--border);padding:20px 24px;}
.chevron{width:9px;height:9px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(-45deg);transition:transform .2s;flex:0 0 auto;}
details[open]>summary .chevron{transform:rotate(45deg);}
.badge{background:rgba(5,111,236,.1);color:var(--primary);border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;}
ul,ol{padding-left:22px;margin:0;}
li{margin:4px 0;}
a{color:var(--primary);}
table.outline{width:100%;border-collapse:collapse;font-size:14px;}
table.outline th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:0 12px 8px 0;border-bottom:1px solid var(--border);}
table.outline td{padding:8px 12px 8px 0;border-bottom:1px solid var(--border);}
table.outline tfoot td{border-bottom:none;padding-top:10px;font-weight:600;}
table.outline tfoot td:first-child{text-align:right;color:var(--muted);font-weight:400;font-size:12px;}
dl.info,dl.glossary{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:0;font-size:14px;}
dl.info dt,dl.glossary dt{font-weight:600;color:var(--muted);}
dl.info dd,dl.glossary dd{margin:0;}
.activity{border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;background:var(--card);}
.activity:last-child{margin-bottom:0;}
.activity-summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:12px 16px;flex-wrap:wrap;}
.activity-summary::-webkit-details-marker{display:none;}
.activity-summary:hover{background:rgba(0,0,0,.02);}
.act-index{font-family:ui-monospace,monospace;font-size:12px;color:var(--muted);width:18px;flex:0 0 auto;}
.pill{border:1px solid;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;flex:0 0 auto;}
.act-title{flex:1;min-width:80px;font-size:14px;font-weight:500;}
.badge-sec{background:#f1f5f9;color:#334155;border-radius:6px;padding:2px 8px;font-size:12px;flex:0 0 auto;}
.badge-out{background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:12px;flex:0 0 auto;}
.activity-body{border-top:1px solid var(--border);padding:16px;}
.muted{color:var(--muted);font-style:italic;}
.toolbar{display:flex;gap:8px;margin-bottom:20px;}
.toolbar button{font:inherit;font-size:13px;border:1px solid var(--border);background:var(--card);color:#374151;border-radius:8px;padding:6px 14px;cursor:pointer;}
.toolbar button:hover{background:rgba(5,111,236,.06);border-color:var(--primary);color:var(--primary);}
`

const EXPAND_SCRIPT = `
(function(){
  function setAll(open){document.querySelectorAll('details').forEach(function(d){d.open=open;});}
  var e=document.getElementById('expandAll');var c=document.getElementById('collapseAll');
  if(e)e.addEventListener('click',function(){setAll(true);});
  if(c)c.addEventListener('click',function(){setAll(false);});
})();
`

export function exportGuideAsHTML(guide: TeacherGuide) {
  const contentHTML = guideToInteractiveHTML(guide)
  const title = guide.lessonInfo.lessonName || 'Teacher Guide'
  const sub = [
    guide.lessonInfo.gradeLevel && `Grade: ${guide.lessonInfo.gradeLevel}`,
    guide.lessonInfo.productionState && `Status: ${guide.lessonInfo.productionState}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>${EXPORT_STYLES}</style>
</head>
<body>
<h1 class="doc-title">${esc(title)}</h1>
${sub ? `<p class="doc-sub">${esc(sub)}</p>` : ''}
<div class="toolbar"><button id="expandAll" type="button">Expand all</button><button id="collapseAll" type="button">Collapse all</button></div>
${contentHTML}
<script>${EXPAND_SCRIPT}</script>
</body>
</html>`

  const blob = new Blob([htmlDocument], { type: 'text/html' })
  const suggestedName = `${sanitizeFileName(guide.lessonInfo.lessonName || 'Teacher Guide')}.html`
  void saveOrDownload(blob, suggestedName, 'HTML file', { 'text/html': ['.html'] })
}
