// Normalizes loaded guide payloads into a safe TeacherGuide shape.
import {
  SECTION_TYPES,
  SECTION_TYPE_LABELS,
  type Activity,
  type GlossaryEntry,
  type GuideSection,
  type OutlineRow,
  type SectionType,
  type TeacherGuide,
} from '@/types'
import { isRecord } from '@/utils/objectUtils'

const SECTION_TYPE_VALUES: readonly string[] = SECTION_TYPES.map((t) => t.value)

function isSectionType(value: string): value is SectionType {
  return SECTION_TYPE_VALUES.includes(value)
}

const ACTIVITY_META_MARKER = /\[(Recap|Task Review|Explore|Make|Evaluate|Share|Task at Home)\]|\d+\s*min/i

// Heals activity titles that absorbed the type/duration/slides from an exported
// heading ("Title · [Explore] · 20 min"). Runs only when those markers are
// present so legitimate titles are left untouched.
function cleanActivityTitle(title: string): string {
  if (!ACTIVITY_META_MARKER.test(title)) return title
  return title
    .replace(/\[(Recap|Task Review|Explore|Make|Evaluate|Share|Task at Home)\]/g, ' ')
    .replace(/\b\d+\s*min\b/gi, ' ')
    .replace(/Slides?:\s*[^·]*/gi, ' ')
    .replace(/\s*·\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·:–-]+|[\s·:–-]+$/g, '')
    .trim()
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

// Preparation and Bonus Activities used to be plain-text arrays; they're now
// single rich-text HTML strings. Upgrade guides saved before that change
// instead of dropping them.
function asRichTextHtml(value: unknown): string {
  if (typeof value === 'string') return value
  const items = asStringArray(value)
  return items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : ''
}

function normalizeLessonInfo(value: unknown) {
  if (!isRecord(value)) return null
  return {
    lessonName: typeof value.lessonName === 'string' ? value.lessonName : '',
    gradeLevel: typeof value.gradeLevel === 'string' ? value.gradeLevel : '',
    moduleLink: typeof value.moduleLink === 'string' ? value.moduleLink : '',
    slidesLink: typeof value.slidesLink === 'string' ? value.slidesLink : '',
    productionState: typeof value.productionState === 'string' ? value.productionState : 'Draft',
  }
}

function normalizeOutline(value: unknown): OutlineRow[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((row) => ({
    id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
    type: typeof row.type === 'string' ? row.type : '',
    sectionName: typeof row.sectionName === 'string' ? row.sectionName : '',
    pedagogy: typeof row.pedagogy === 'string' ? row.pedagogy : '',
    durationMinutes:
      typeof row.durationMinutes === 'number' && Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0,
  }))
}

function normalizeActivity(value: unknown): Activity {
  if (!isRecord(value)) {
    return { id: crypto.randomUUID(), activityType: 'Explore', activityTitle: '', duration: 10, instructions: '' }
  }
  return {
    id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
    activityType: typeof value.activityType === 'string' ? value.activityType : 'Explore',
    activityTitle: typeof value.activityTitle === 'string' ? cleanActivityTitle(value.activityTitle) : '',
    duration: typeof value.duration === 'number' && Number.isFinite(value.duration) ? value.duration : 10,
    instructions: typeof value.instructions === 'string' ? value.instructions : '',
  }
}

// Accepts the current flat shape (a plain array of activities) or, for
// guides briefly saved with the now-removed "named subsections" layout, a
// list of { activities: [...] } groups — flattened back into one plain list.
function normalizeProcedure(value: unknown): Activity[] {
  if (!Array.isArray(value) || value.length === 0) return []

  const looksLikeSubsections = isRecord(value[0]) && Array.isArray((value[0] as Record<string, unknown>).activities)
  if (looksLikeSubsections) {
    return value
      .filter(isRecord)
      .flatMap((sub) => (Array.isArray(sub.activities) ? sub.activities.map(normalizeActivity) : []))
  }

  return value.map(normalizeActivity)
}

function normalizeGlossary(value: unknown): GlossaryEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((entry) => ({
    id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
    concept: typeof entry.concept === 'string' ? entry.concept : '',
    definition: typeof entry.definition === 'string' ? entry.definition : '',
  }))
}

// Reads the fields relevant to `sectionType` off a loosely-typed record,
// falling back to that type's defaults for anything missing or malformed.
// Used both for legacy flat guide payloads (each "section" is really just the
// whole guide object) and for individual entries already shaped as sections.
function normalizeSectionContent(raw: Record<string, unknown>, sectionType: SectionType) {
  const lessonInfo = normalizeLessonInfo(raw.lessonInfo)
  return {
    lessonInfo: lessonInfo ?? {
      lessonName: '',
      gradeLevel: '',
      moduleLink: '',
      slidesLink: '',
      productionState: 'Draft',
    },
    overview: typeof raw.overview === 'string' ? raw.overview : '',
    learningOutcomes: raw.learningOutcomes !== undefined ? asStringArray(raw.learningOutcomes) : [''],
    preparation: raw.preparation !== undefined ? asRichTextHtml(raw.preparation) : '',
    outlineOverview: normalizeOutline(raw.outlineOverview),
    lessonProcedure: normalizeProcedure(raw.lessonProcedure),
    glossary: raw.glossary !== undefined ? normalizeGlossary(raw.glossary) : [{ id: crypto.randomUUID(), concept: '', definition: '' }],
    bonusActivities: raw.bonusActivities !== undefined ? asRichTextHtml(raw.bonusActivities) : '',
    sectionType,
  }
}

function buildSection(raw: Record<string, unknown>, sectionType: SectionType, fallbackTitle: string, idOverride?: string): GuideSection {
  const content = normalizeSectionContent(raw, sectionType)
  return {
    id: idOverride ?? (typeof raw.id === 'string' ? raw.id : crypto.randomUUID()),
    sectionType,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : fallbackTitle,
    lessonInfo: content.lessonInfo,
    overview: content.overview,
    learningOutcomes: content.learningOutcomes,
    preparation: content.preparation,
    outlineOverview: content.outlineOverview,
    lessonProcedure: content.lessonProcedure,
    glossary: content.glossary,
    bonusActivities: content.bonusActivities,
  }
}

const LEGACY_MAIN_SECTION_TYPES: SectionType[] = [
  'lessonInfo',
  'overview',
  'learningOutcomes',
  'preparation',
  'outlineOverview',
  'lessonProcedure',
  'glossary',
  'bonusActivities',
]

export function normalizeGuide(input: unknown): TeacherGuide | null {
  if (!isRecord(input)) return null

  // Current shape: the guide is already an ordered list of sections.
  if (Array.isArray(input.sections)) {
    const sections = input.sections
      .filter(isRecord)
      .map((raw) => {
        const rawType = typeof raw.sectionType === 'string' ? raw.sectionType : ''
        const sectionType = isSectionType(rawType) ? rawType : 'overview'
        return buildSection(raw, sectionType, SECTION_TYPE_LABELS[sectionType])
      })
    return { sections }
  }

  // Legacy shape: fixed top-level fields, optionally with a `customSections`
  // array holding extra (repeatable) blocks. Convert both into one flat,
  // ordered list of sections.
  if (!isRecord(input.lessonInfo)) return null

  const mainSections = LEGACY_MAIN_SECTION_TYPES.map((sectionType) =>
    buildSection(input, sectionType, SECTION_TYPE_LABELS[sectionType]),
  )

  const extraSections = Array.isArray(input.customSections)
    ? input.customSections
        .filter(isRecord)
        .filter((section) => isSectionType(typeof section.sectionType === 'string' ? section.sectionType : ''))
        .map((section) => {
          const sectionType = section.sectionType as SectionType
          return buildSection(section, sectionType, SECTION_TYPE_LABELS[sectionType])
        })
    : []

  return { sections: [...mainSections, ...extraSections] }
}
