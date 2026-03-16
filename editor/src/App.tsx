// Main editor container: loads guide state, coordinates section editors, and triggers exports.
import { useState, useEffect } from 'react'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { LessonInfoSection }       from '@/components/sections/LessonInfoSection'
import { OverviewSection }         from '@/components/sections/OverviewSection'
import { LearningOutcomesSection } from '@/components/sections/LearningOutcomesSection'
import { PreparationSection }      from '@/components/sections/PreparationSection'
import { OutlineOverviewSection }  from '@/components/sections/OutlineOverviewSection'
import { LessonProcedureSection }  from '@/components/sections/LessonProcedureSection'
import { PublishingGuideSection }  from '@/components/sections/PublishingGuideSection'
import { GlossarySection }         from '@/components/sections/GlossarySection'
import { BonusActivitiesSection }  from '@/components/sections/BonusActivitiesSection'
import { useAutoSave, loadSaved }  from '@/hooks/useAutoSave'
import { normalizeGuide } from '@/editor/guideNormalization'
import { exportGuideAsHTML, exportGuideAsJSON } from '@/services/exportService'
import { createDefaultGuide, type TeacherGuide } from '@/types'

const API_BASE = import.meta.env.DEV ? '/api' : ''
const PENDING_GUIDE_KEY_PREFIX = 'pending-guide:'
const GUIDE_STORAGE_KEY = 'teacherGuideData'

function initGuide(): TeacherGuide {
  const saved = loadSaved<TeacherGuide>()
  if (saved) return saved
  return createDefaultGuide()
}

export default function App() {
  const [guide, setGuide] = useState<TeacherGuide>(initGuide)
  const [preview, setPreview]   = useState(false)
  const [resetStep, setResetStep] = useState<0 | 1>(0)
  const [printMode, setPrintMode] = useState(false)
  const [isImporting, setIsImporting] = useState(
    () => {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('token')
      if (!token) return false
      return !sessionStorage.getItem(`${PENDING_GUIDE_KEY_PREFIX}${token}`) && !loadSaved<TeacherGuide>()
    }
  )

  const { status } = useAutoSave(guide)

  // ── Fetch guide from backend by token (cross-origin safe) ────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return

    const pendingKey = `${PENDING_GUIDE_KEY_PREFIX}${token}`
    const pendingRaw = sessionStorage.getItem(pendingKey)

    // Keep token-based generation flow when a fresh pending guide exists.
    if (pendingRaw) {
      try {
        const pending = normalizeGuide(JSON.parse(pendingRaw))
        if (pending) {
          setGuide(pending)
          localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(pending))
        }
        sessionStorage.removeItem(pendingKey)
      } catch (error) {
        console.error(error)
      } finally {
        setIsImporting(false)
        window.history.replaceState({}, '', window.location.pathname)
      }
      return
    }

    const saved = loadSaved<TeacherGuide>()
    if (saved) {
      const parsed = normalizeGuide(saved)
      if (parsed) setGuide(parsed)
      setIsImporting(false)
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    fetch(`${API_BASE}/guide/${token}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: unknown) => {
        const parsed = normalizeGuide(data)
        if (!parsed) throw new Error('Invalid guide payload from backend')
        setGuide(parsed)
        localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(parsed))
      })
      .catch(console.error)
      .finally(() => {
        setIsImporting(false)
        window.history.replaceState({}, '', window.location.pathname)
      })
  }, [])

  // ── Partial updaters ────────────────────────────────────────────
  const set = <K extends keyof TeacherGuide>(key: K, value: TeacherGuide[K]) =>
    setGuide(g => ({ ...g, [key]: value }))

  // ── Export JSON ──────────────────────────────────────────────────
  const exportJSON = () => {
    exportGuideAsJSON(guide)
  }

  // ── Export standalone HTML ───────────────────────────────────────
  const exportHTML = () => {
    exportGuideAsHTML(guide)
  }

  // ── Print-based PDF export ──────────────────────────────────────
  useEffect(() => {
    if (!printMode) return
    // Allow React to render all sections open, then trigger browser print
    const id = setTimeout(() => {
      window.print()
      window.onafterprint = () => setPrintMode(false)
    }, 150)
    return () => clearTimeout(id)
  }, [printMode])

  const exportPDF = () => setPrintMode(true)

  // ── Reset (two-click guard) ─────────────────────────────────────
  const handleReset = () => {
    if (resetStep === 0) {
      setResetStep(1)
      setTimeout(() => setResetStep(0), 4000)
    } else {
      setGuide(createDefaultGuide())
      setResetStep(0)
    }
  }

  if (isImporting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground animate-pulse text-sm">Loading guide from generator…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <EditorToolbar
        lessonName={guide.lessonInfo.lessonName}
        gradeLevel={guide.lessonInfo.gradeLevel}
        productionState={guide.lessonInfo.productionState}
        preview={preview}
        printMode={printMode}
        resetStep={resetStep}
        saveStatus={status}
        onTogglePreview={() => setPreview((p) => !p)}
        onExportJSON={exportJSON}
        onExportHTML={exportHTML}
        onExportPDF={exportPDF}
        onReset={handleReset}
      />

      {/* ── Main content ──────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-4">

        <CollapsibleSection title="1. Lesson Info" forceOpen={printMode}>
          <LessonInfoSection data={guide.lessonInfo} onChange={v => set('lessonInfo', v)} readOnly={preview} />
        </CollapsibleSection>

        <CollapsibleSection title="2. Overview (Lesson Scenario)" forceOpen={printMode}>
          <OverviewSection content={guide.overview} onChange={v => set('overview', v)} readOnly={preview} />
        </CollapsibleSection>

        <CollapsibleSection title="3. Learning Outcomes" badge={guide.learningOutcomes.filter(Boolean).length} forceOpen={printMode}>
          <LearningOutcomesSection items={guide.learningOutcomes} onChange={v => set('learningOutcomes', v)} readOnly={preview} />
        </CollapsibleSection>

        <CollapsibleSection title="4. Preparation" badge={guide.preparation.filter(Boolean).length} forceOpen={printMode}>
          <PreparationSection items={guide.preparation} onChange={v => set('preparation', v)} readOnly={preview} />
        </CollapsibleSection>

        <CollapsibleSection title="5. Outline Overview" badge={guide.outlineOverview.length} forceOpen={printMode}>
          <OutlineOverviewSection rows={guide.outlineOverview} onChange={v => set('outlineOverview', v)} readOnly={preview} />
        </CollapsibleSection>

        <CollapsibleSection title="6. Lesson Procedure" badge={guide.lessonProcedure.length} forceOpen={printMode}>
          <LessonProcedureSection activities={guide.lessonProcedure} onChange={v => set('lessonProcedure', v)} readOnly={preview} />
        </CollapsibleSection>

        <CollapsibleSection title="7. Publishing Guide" badge={guide.publishingGuide.filter(Boolean).length} forceOpen={printMode}>
          <PublishingGuideSection steps={guide.publishingGuide} onChange={v => set('publishingGuide', v)} readOnly={preview} />
        </CollapsibleSection>

        <CollapsibleSection title="8. Glossary" badge={guide.glossary.length} forceOpen={printMode}>
          <GlossarySection entries={guide.glossary} onChange={v => set('glossary', v)} readOnly={preview} />
        </CollapsibleSection>

        <CollapsibleSection title="9. Bonus Activities" defaultOpen={false} badge={guide.bonusActivities.filter(Boolean).length || undefined} forceOpen={printMode}>
          <BonusActivitiesSection items={guide.bonusActivities} onChange={v => set('bonusActivities', v)} readOnly={preview} />
        </CollapsibleSection>

      </main>

      <footer className="text-center py-8 text-xs text-muted-foreground">
        Teacher Guide Editor · autosaved to browser storage
      </footer>
    </div>
  )
}
