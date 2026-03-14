import { useState, useEffect } from 'react'
import { Download, Eye, EyeOff, RotateCcw, BookOpen, Save, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CollapsibleSection } from '@/components/CollapsibleSection'
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
import { createDefaultGuide, guideToExportJSON, type TeacherGuide } from '@/types'

const STORAGE_KEY_CHECKED = '__tge_loaded'
const API_BASE = import.meta.env.DEV ? '/api' : ''

function initGuide(): TeacherGuide {
  // If starting with a ?token param, show a blank guide — the token fetch will overwrite it
  if (new URLSearchParams(window.location.search).has('token')) {
    return createDefaultGuide()
  }
  if (!sessionStorage.getItem(STORAGE_KEY_CHECKED)) {
    sessionStorage.setItem(STORAGE_KEY_CHECKED, '1')
    const saved = loadSaved<TeacherGuide>()
    if (saved) return saved
  }
  return createDefaultGuide()
}

export default function App() {
  const [guide, setGuide] = useState<TeacherGuide>(initGuide)
  const [preview, setPreview]   = useState(false)
  const [resetStep, setResetStep] = useState<0 | 1>(0)
  const [printMode, setPrintMode] = useState(false)
  const [isImporting, setIsImporting] = useState(
    () => new URLSearchParams(window.location.search).has('token')
  )

  const { status } = useAutoSave(guide)

  // ── Fetch guide from backend by token (cross-origin safe) ────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return
    fetch(`${API_BASE}/guide/${token}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: TeacherGuide) => {
        setGuide(data)
        localStorage.setItem('teacher-guide-v1', JSON.stringify(data))
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
    const data     = guideToExportJSON(guide)
    const filename = (guide.lessonInfo.lessonName.trim() || 'teacher-guide')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.json'
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
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

  // ── Autosave badge ──────────────────────────────────────────────
  const saveBadge = status === 'saving' ? (
    <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse"><Save className="h-3 w-3" />Saving…</span>
  ) : status === 'saved' ? (
    <span className="flex items-center gap-1 text-xs text-green-600"><Save className="h-3 w-3" />Saved</span>
  ) : status === 'error' ? (
    <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />Save error</span>
  ) : null

  if (isImporting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground animate-pulse text-sm">Loading guide from generator…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <BookOpen className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold leading-none truncate">
              {guide.lessonInfo.lessonName || 'Untitled Lesson'}
            </h1>
            {guide.lessonInfo.gradeLevel && (
              <p className="text-xs text-muted-foreground mt-0.5">{guide.lessonInfo.gradeLevel}</p>
            )}
          </div>

          {saveBadge}

          {guide.lessonInfo.productionState && (
            <Badge
              variant="outline"
              className={
                guide.lessonInfo.productionState === 'Published' ? 'border-green-300 text-green-700' :
                guide.lessonInfo.productionState === 'In Review' ? 'border-blue-300 text-blue-700' :
                guide.lessonInfo.productionState === 'Archived'  ? 'border-gray-300 text-gray-500' :
                'border-yellow-300 text-yellow-700'
              }
            >
              {guide.lessonInfo.productionState}
            </Badge>
          )}

          <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(p => !p)}>
            {preview ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
            {preview ? 'Edit' : 'Preview'}
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={exportJSON}>
            <Download className="mr-1.5 h-4 w-4" /> Export JSON
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={exportPDF} disabled={printMode}>
            <Download className="mr-1.5 h-4 w-4" /> {printMode ? 'Preparing…' : 'Export PDF'}
          </Button>

          <Button
            type="button"
            variant={resetStep === 1 ? 'destructive' : 'ghost'}
            size="sm"
            onClick={handleReset}
            title={resetStep === 0 ? 'Reset guide' : 'Click again to confirm reset'}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            {resetStep === 1 ? 'Confirm reset' : 'Reset'}
          </Button>
        </div>
      </header>

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
