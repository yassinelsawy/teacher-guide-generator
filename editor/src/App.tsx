// Main editor container: loads guide state, coordinates section editors, and triggers exports.
import { useState, useEffect } from 'react'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { GuideSectionsSection } from '@/components/sections/GuideSectionsSection'
import { useAutoSave, loadSaved }  from '@/hooks/useAutoSave'
import { useUndoableState }        from '@/hooks/useUndoableState'
import { normalizeGuide } from '@/editor/guideNormalization'
import { exportGuideAsHTML } from '@/services/exportService'
import { createDefaultGuide, type GuideSection, type TeacherGuide } from '@/types'

const API_BASE = import.meta.env.DEV ? '/api' : ''
const PENDING_GUIDE_KEY_PREFIX = 'pending-guide:'
const GUIDE_STORAGE_KEY = 'teacherGuideData'

function initGuide(): TeacherGuide {
  const saved = loadSaved<TeacherGuide>()
  if (saved) {
    const parsed = normalizeGuide(saved)
    if (parsed) return parsed
  }
  return createDefaultGuide()
}

export default function App() {
  const { value: guide, set: setGuide, undo: undoGuide, canUndo } = useUndoableState<TeacherGuide>(initGuide)
  const [preview, setPreview]   = useState(false)
  const [resetStep, setResetStep] = useState<0 | 1>(0)
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
      if (parsed) {
        setGuide(parsed)
        localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(parsed))
      }
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

  // ── Section list updater ──────────────────────────────────────────
  const setSections = (sections: GuideSection[]) => setGuide(g => ({ ...g, sections }))

  const lessonInfo = guide.sections.find((s) => s.sectionType === 'lessonInfo')?.lessonInfo

  // ── Export standalone HTML ───────────────────────────────────────
  const exportHTML = () => {
    exportGuideAsHTML(guide)
  }

  const backToGenerator = () => {
    window.location.href = '/'
  }

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
        lessonName={lessonInfo?.lessonName ?? ''}
        gradeLevel={lessonInfo?.gradeLevel ?? ''}
        productionState={lessonInfo?.productionState ?? ''}
        preview={preview}
        resetStep={resetStep}
        saveStatus={status}
        canUndo={canUndo}
        onUndo={undoGuide}
        onTogglePreview={() => setPreview((p) => !p)}
        onBackToGenerator={backToGenerator}
        onExportHTML={exportHTML}
        onReset={handleReset}
      />

      {/* ── Main content ──────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-4">

        <GuideSectionsSection
          sections={guide.sections}
          onChange={setSections}
          readOnly={preview}
        />

      </main>

      <footer className="text-center py-8 text-xs text-muted-foreground">
        Teacher Guide Editor · autosaved to browser storage
      </footer>
    </div>
  )
}
