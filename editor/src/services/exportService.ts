// Frontend-only export helpers for Teacher Guide outputs.
import { guideToExportJSON, guideToHTML, type TeacherGuide } from '@/types'

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

export function exportGuideAsHTML(guide: TeacherGuide) {
  const contentHTML = guideToHTML(guide)
  const safeTitle = (guide.lessonInfo.lessonName || 'Teacher Guide').replace(/[<>]/g, '')

  const htmlDocument = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
body{
  font-family: Arial, sans-serif;
  max-width: 900px;
  margin: auto;
  padding: 40px;
  line-height: 1.6;
  color: #111827;
}

h1,h2,h3{
  color:#056fec;
}

ul,ol{
  padding-left:20px;
}
</style>
</head>
<body>
<h1>Teacher Guide</h1>
${contentHTML}
</body>
</html>`

  const blob = new Blob([htmlDocument], { type: 'text/html' })
  const suggestedName = `${sanitizeFileName(guide.lessonInfo.lessonName || 'Teacher Guide')}.html`
  void saveOrDownload(blob, suggestedName, 'HTML file', { 'text/html': ['.html'] })
}
