// Normalizes loaded guide payloads into a safe TeacherGuide shape.
import { createCustomSection, type TeacherGuide, type CustomSectionType, CUSTOM_SECTION_TYPE_LABELS } from '@/types'
import { isRecord } from '@/utils/objectUtils'

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

export function normalizeGuide(input: unknown): TeacherGuide | null {
  if (!isRecord(input) || !isRecord(input.lessonInfo)) return null

  const lessonInfo = {
    lessonName: typeof input.lessonInfo.lessonName === 'string' ? input.lessonInfo.lessonName : '',
    gradeLevel: typeof input.lessonInfo.gradeLevel === 'string' ? input.lessonInfo.gradeLevel : '',
    moduleLink: typeof input.lessonInfo.moduleLink === 'string' ? input.lessonInfo.moduleLink : '',
    slidesLink: typeof input.lessonInfo.slidesLink === 'string' ? input.lessonInfo.slidesLink : '',
    productionState: typeof input.lessonInfo.productionState === 'string' ? input.lessonInfo.productionState : 'Draft',
  }

  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

  const outlineOverview = Array.isArray(input.outlineOverview)
    ? input.outlineOverview
        .filter(isRecord)
        .map((row) => ({
          id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
          type: typeof row.type === 'string' ? row.type : '',
          sectionName: typeof row.sectionName === 'string' ? row.sectionName : '',
          pedagogy: typeof row.pedagogy === 'string' ? row.pedagogy : '',
          durationMinutes:
            typeof row.durationMinutes === 'number' && Number.isFinite(row.durationMinutes)
              ? row.durationMinutes
              : 0,
          slideNumbers: typeof row.slideNumbers === 'string' ? row.slideNumbers : '',
        }))
    : []

  const lessonProcedure = Array.isArray(input.lessonProcedure)
    ? input.lessonProcedure
        .filter(isRecord)
        .map((act) => ({
          id: typeof act.id === 'string' ? act.id : crypto.randomUUID(),
          activityType: typeof act.activityType === 'string' ? act.activityType : 'Explore',
          activityTitle: typeof act.activityTitle === 'string' ? cleanActivityTitle(act.activityTitle) : '',
          duration: typeof act.duration === 'number' && Number.isFinite(act.duration) ? act.duration : 10,
          slideNumbers: typeof act.slideNumbers === 'string' ? act.slideNumbers : '',
          instructions: typeof act.instructions === 'string' ? act.instructions : '',
        }))
    : []

  const glossary = Array.isArray(input.glossary)
    ? input.glossary
        .filter(isRecord)
        .map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
          concept: typeof entry.concept === 'string' ? entry.concept : '',
          definition: typeof entry.definition === 'string' ? entry.definition : '',
        }))
    : []

  const customSections = Array.isArray(input.customSections)
    ? input.customSections
        .filter(isRecord)
        .map((section) => {
          const rawType = typeof section.sectionType === 'string' ? section.sectionType : 'text'
          const sectionType = Object.prototype.hasOwnProperty.call(CUSTOM_SECTION_TYPE_LABELS, rawType)
            ? (rawType as CustomSectionType)
            : 'text'
          const normalized = createCustomSection(sectionType)

          return {
            ...normalized,
            id: typeof section.id === 'string' ? section.id : crypto.randomUUID(),
            title: typeof section.title === 'string' && section.title.trim() ? section.title : normalized.title,
            lessonInfo: isRecord(section.lessonInfo)
              ? {
                  lessonName: typeof section.lessonInfo.lessonName === 'string' ? section.lessonInfo.lessonName : '',
                  gradeLevel: typeof section.lessonInfo.gradeLevel === 'string' ? section.lessonInfo.gradeLevel : '',
                  moduleLink: typeof section.lessonInfo.moduleLink === 'string' ? section.lessonInfo.moduleLink : '',
                  slidesLink: typeof section.lessonInfo.slidesLink === 'string' ? section.lessonInfo.slidesLink : '',
                  productionState: typeof section.lessonInfo.productionState === 'string' ? section.lessonInfo.productionState : 'Draft',
                }
              : normalized.lessonInfo,
            overview: typeof section.overview === 'string' ? section.overview : (typeof section.content === 'string' ? section.content : normalized.overview),
            learningOutcomes: Array.isArray(section.learningOutcomes) ? section.learningOutcomes.filter((value): value is string => typeof value === 'string') : normalized.learningOutcomes,
            preparation: Array.isArray(section.preparation) ? section.preparation.filter((value): value is string => typeof value === 'string') : normalized.preparation,
            outlineOverview: Array.isArray(section.outlineOverview)
              ? section.outlineOverview.filter(isRecord).map((row) => ({
                  id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
                  type: typeof row.type === 'string' ? row.type : '',
                  sectionName: typeof row.sectionName === 'string' ? row.sectionName : '',
                  pedagogy: typeof row.pedagogy === 'string' ? row.pedagogy : '',
                  durationMinutes: typeof row.durationMinutes === 'number' && Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0,
                  slideNumbers: typeof row.slideNumbers === 'string' ? row.slideNumbers : '',
                }))
              : normalized.outlineOverview,
            lessonProcedure: Array.isArray(section.lessonProcedure)
              ? section.lessonProcedure.filter(isRecord).map((act) => ({
                  id: typeof act.id === 'string' ? act.id : crypto.randomUUID(),
                  activityType: typeof act.activityType === 'string' ? act.activityType : 'Explore',
                  activityTitle: typeof act.activityTitle === 'string' ? cleanActivityTitle(act.activityTitle) : '',
                  duration: typeof act.duration === 'number' && Number.isFinite(act.duration) ? act.duration : 10,
                  slideNumbers: typeof act.slideNumbers === 'string' ? act.slideNumbers : '',
                  instructions: typeof act.instructions === 'string' ? act.instructions : '',
                }))
              : normalized.lessonProcedure,
            publishingGuide: Array.isArray(section.publishingGuide) ? section.publishingGuide.filter((value): value is string => typeof value === 'string') : normalized.publishingGuide,
            glossary: Array.isArray(section.glossary)
              ? section.glossary.filter(isRecord).map((entry) => ({
                  id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
                  concept: typeof entry.concept === 'string' ? entry.concept : '',
                  definition: typeof entry.definition === 'string' ? entry.definition : '',
                }))
              : normalized.glossary,
            bonusActivities: Array.isArray(section.bonusActivities) ? section.bonusActivities.filter((value): value is string => typeof value === 'string') : normalized.bonusActivities,
            text: typeof section.text === 'string' ? section.text : (typeof section.content === 'string' ? section.content : normalized.text),
          }
        })
    : []

  return {
    lessonInfo,
    overview: typeof input.overview === 'string' ? input.overview : '',
    learningOutcomes: asStringArray(input.learningOutcomes),
    preparation: asStringArray(input.preparation),
    outlineOverview,
    lessonProcedure,
    publishingGuide: asStringArray(input.publishingGuide),
    glossary,
    bonusActivities: asStringArray(input.bonusActivities),
    customSections,
  }
}
