// Frontend-only export helpers for Teacher Guide outputs.
import { guideToExportJSON, guideToHTML, type TeacherGuide } from '@/types'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function exportGuideAsJSON(guide: TeacherGuide) {
  const data = guideToExportJSON(guide)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(blob, 'teacher-guide.json')
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
  triggerDownload(blob, 'teacher-guide.html')
}
