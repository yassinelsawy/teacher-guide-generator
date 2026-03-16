// Normalizes loaded guide payloads into a safe TeacherGuide shape.
import type { TeacherGuide } from '@/types'
import { isRecord } from '@/utils/objectUtils'

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
          activityTitle: typeof act.activityTitle === 'string' ? act.activityTitle : '',
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
  }
}
