// Shared Teacher Guide domain models and serialization helpers.
// ─── Activity types ───────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  'Recap',
  'Task Review',
  'Explore',
  'Make',
  'Evaluate',
  'Share',
  'Task at Home',
] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]

// ─── Production state ─────────────────────────────────────────────────────────

export const PRODUCTION_STATES = ['Draft', 'In Review', 'Published', 'Archived'] as const
export type ProductionState = (typeof PRODUCTION_STATES)[number]

// ─── Data interfaces ──────────────────────────────────────────────────────────

export interface LessonInfo {
  lessonName: string
  gradeLevel: string
  moduleLink: string
  slidesLink: string
  productionState: string
}

export interface OutlineRow {
  id: string
  type: string
  sectionName: string
  pedagogy: string
  durationMinutes: number
  slideNumbers: string
}

export interface Activity {
  id: string
  activityType: string
  activityTitle: string
  duration: number
  slideNumbers: string
  instructions: string  // HTML from Tiptap
}

export interface GlossaryEntry {
  id: string
  concept: string
  definition: string
}

export interface TeacherGuide {
  lessonInfo: LessonInfo
  overview: string           // HTML
  learningOutcomes: string[]
  preparation: string[]
  outlineOverview: OutlineRow[]
  lessonProcedure: Activity[]
  publishingGuide: string[]
  glossary: GlossaryEntry[]
  bonusActivities: string[]
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createDefaultGuide(): TeacherGuide {
  return {
    lessonInfo: {
      lessonName: '',
      gradeLevel: '',
      moduleLink: '',
      slidesLink: '',
      productionState: 'Draft',
    },
    overview: '',
    learningOutcomes: [''],
    preparation: [''],
    outlineOverview: [
      {
        id: crypto.randomUUID(),
        type: '',
        sectionName: '',
        pedagogy: '',
        durationMinutes: 0,
        slideNumbers: '',
      },
    ],
    lessonProcedure: [
      {
        id: crypto.randomUUID(),
        activityType: 'Explore',
        activityTitle: '',
        duration: 10,
        slideNumbers: '',
        instructions: '',
      },
    ],
    publishingGuide: [''],
    glossary: [{ id: crypto.randomUUID(), concept: '', definition: '' }],
    bonusActivities: [],
  }
}

// ─── JSON export helper (strips internal ids) ─────────────────────────────────

export function guideToExportJSON(guide: TeacherGuide) {
  return {
    lessonInfo: guide.lessonInfo,
    overview: guide.overview,
    learningOutcomes: guide.learningOutcomes.filter(Boolean),
    preparation: guide.preparation.filter(Boolean),
    outlineOverview: guide.outlineOverview.map(({ id: _id, ...rest }) => rest),
    lessonProcedure: guide.lessonProcedure.map(({ id: _id, ...rest }) => rest),
    publishingGuide: guide.publishingGuide.filter(Boolean),
    glossary: guide.glossary.map(({ id: _id, ...rest }) => rest),
    bonusActivities: guide.bonusActivities.filter(Boolean),
  }
}

// ─── HTML export helper (for PDF generation via backend) ─────────────────────

export function guideToHTML(guide: TeacherGuide): string {
  const parts: string[] = []
  const tag = (t: string, s: string) => `<${t}>${s}</${t}>`

  if (guide.lessonInfo.lessonName) parts.push(tag('h1', guide.lessonInfo.lessonName))

  const meta = [
    guide.lessonInfo.gradeLevel && `Grade: ${guide.lessonInfo.gradeLevel}`,
    guide.lessonInfo.productionState && `Status: ${guide.lessonInfo.productionState}`,
  ].filter(Boolean).join(' · ')
  if (meta) parts.push(tag('p', meta))

  if (guide.overview) {
    parts.push(tag('h2', 'Session Overview'))
    parts.push(guide.overview)
  }

  const outcomes = guide.learningOutcomes.filter(Boolean)
  if (outcomes.length) {
    parts.push(tag('h2', 'Learning Outcomes'))
    parts.push(`<ul>${outcomes.map(o => tag('li', o)).join('')}</ul>`)
  }

  const prep = guide.preparation.filter(Boolean)
  if (prep.length) {
    parts.push(tag('h2', 'Preparation'))
    parts.push(`<ul>${prep.map(p => tag('li', p)).join('')}</ul>`)
  }

  if (guide.outlineOverview.length) {
    parts.push(tag('h2', 'Lesson Outline'))
    const rows = guide.outlineOverview
      .map(r => `<li><strong>${r.sectionName}</strong>${r.pedagogy ? ` – ${r.pedagogy}` : ''}${r.durationMinutes ? ` (${r.durationMinutes} min)` : ''}${r.slideNumbers ? ` · Slides: ${r.slideNumbers}` : ''}</li>`)
      .join('')
    parts.push(`<ul>${rows}</ul>`)
  }

  if (guide.lessonProcedure.length) {
    parts.push(tag('h2', 'Lesson Procedure'))
    guide.lessonProcedure.forEach(act => {
      const header = [
        act.activityTitle,
        `[${act.activityType}]`,
        act.duration ? `${act.duration} min` : '',
        act.slideNumbers ? `Slides: ${act.slideNumbers}` : '',
      ].filter(Boolean).join(' · ')
      parts.push(tag('h3', header))
      if (act.instructions) parts.push(act.instructions)
    })
  }

  const pub = guide.publishingGuide.filter(Boolean)
  if (pub.length) {
    parts.push(tag('h2', 'Publishing Guide'))
    parts.push(`<ol>${pub.map(s => tag('li', s)).join('')}</ol>`)
  }

  if (guide.glossary.length) {
    parts.push(tag('h2', 'Glossary'))
    parts.push(`<ul>${guide.glossary.map(g => `<li><strong>${g.concept}:</strong> ${g.definition}</li>`).join('')}</ul>`)
  }

  const bonus = guide.bonusActivities.filter(Boolean)
  if (bonus.length) {
    parts.push(tag('h2', 'Bonus Activities'))
    parts.push(`<ul>${bonus.map(b => tag('li', b)).join('')}</ul>`)
  }

  return parts.join('\n')
}
