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
}

export interface Activity {
  id: string
  activityType: string
  activityTitle: string
  duration: number
  instructions: string  // HTML from Tiptap
}

export interface GlossaryEntry {
  id: string
  concept: string
  definition: string
}

export const SECTION_TYPES = [
  { value: 'lessonInfo', label: 'Lesson Info' },
  { value: 'overview', label: 'Overview' },
  { value: 'learningOutcomes', label: 'Learning Outcomes' },
  { value: 'preparation', label: 'Preparation' },
  { value: 'outlineOverview', label: 'Outline Overview' },
  { value: 'lessonProcedure', label: 'Lesson Procedure' },
  { value: 'glossary', label: 'Glossary' },
  { value: 'bonusActivities', label: 'Bonus Activities' },
] as const

export type SectionType = (typeof SECTION_TYPES)[number]['value']

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  lessonInfo: 'Lesson Info',
  overview: 'Overview',
  learningOutcomes: 'Learning Outcomes',
  preparation: 'Preparation',
  outlineOverview: 'Outline Overview',
  lessonProcedure: 'Lesson Procedure',
  glossary: 'Glossary',
  bonusActivities: 'Bonus Activities',
}

// A guide section: one instance of a section type. The guide is just an
// ordered list of these, so any type can be duplicated and reordered freely.
export interface GuideSection {
  id: string
  sectionType: SectionType
  title: string
  lessonInfo: LessonInfo
  overview: string
  learningOutcomes: string[]
  preparation: string       // HTML from Tiptap
  outlineOverview: OutlineRow[]
  lessonProcedure: Activity[]
  glossary: GlossaryEntry[]
  bonusActivities: string    // HTML from Tiptap
}

export interface TeacherGuide {
  sections: GuideSection[]
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGuideSection(sectionType: SectionType): GuideSection {
  return {
    id: crypto.randomUUID(),
    sectionType,
    title: SECTION_TYPE_LABELS[sectionType],
    lessonInfo: {
      lessonName: '',
      gradeLevel: '',
      moduleLink: '',
      slidesLink: '',
      productionState: 'Draft',
    },
    overview: '',
    learningOutcomes: [''],
    preparation: '',
    outlineOverview: [],
    lessonProcedure: [],
    glossary: [{ id: crypto.randomUUID(), concept: '', definition: '' }],
    bonusActivities: '',
  }
}

export function createDefaultGuide(): TeacherGuide {
  const outlineOverview = createGuideSection('outlineOverview')
  outlineOverview.outlineOverview = [
    { id: crypto.randomUUID(), type: '', sectionName: '', pedagogy: '', durationMinutes: 0 },
  ]

  const lessonProcedure = createGuideSection('lessonProcedure')
  lessonProcedure.lessonProcedure = [
    { id: crypto.randomUUID(), activityType: 'Explore', activityTitle: '', duration: 10, instructions: '' },
  ]

  return {
    sections: [
      createGuideSection('lessonInfo'),
      createGuideSection('overview'),
      createGuideSection('learningOutcomes'),
      createGuideSection('preparation'),
      outlineOverview,
      lessonProcedure,
      createGuideSection('glossary'),
      createGuideSection('bonusActivities'),
    ],
  }
}

// ─── JSON export helper (strips internal ids) ─────────────────────────────────

export function guideToExportJSON(guide: TeacherGuide) {
  return {
    sections: guide.sections.map((section) => {
      const base = { sectionType: section.sectionType, title: section.title }
      switch (section.sectionType) {
        case 'lessonInfo':
          return { ...base, lessonInfo: section.lessonInfo }
        case 'overview':
          return { ...base, overview: section.overview }
        case 'learningOutcomes':
          return { ...base, learningOutcomes: section.learningOutcomes.filter(Boolean) }
        case 'preparation':
          return { ...base, preparation: section.preparation }
        case 'outlineOverview':
          return { ...base, outlineOverview: section.outlineOverview.map(({ id: _id, ...rest }) => rest) }
        case 'lessonProcedure':
          return { ...base, lessonProcedure: section.lessonProcedure.map(({ id: _id, ...rest }) => rest) }
        case 'glossary':
          return { ...base, glossary: section.glossary.map(({ id: _id, ...rest }) => rest) }
        case 'bonusActivities':
          return { ...base, bonusActivities: section.bonusActivities }
        default:
          return base
      }
    }),
  }
}
