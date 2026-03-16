// Shared top toolbar for guide status and export controls.
import { Download, Eye, EyeOff, RotateCcw, BookOpen, Save, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface EditorToolbarProps {
  lessonName: string
  gradeLevel: string
  productionState: string
  preview: boolean
  printMode: boolean
  resetStep: 0 | 1
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onTogglePreview: () => void
  onExportJSON: () => void
  onExportHTML: () => void
  onExportPDF: () => void
  onReset: () => void
}

export function EditorToolbar({
  lessonName,
  gradeLevel,
  productionState,
  preview,
  printMode,
  resetStep,
  saveStatus,
  onTogglePreview,
  onExportJSON,
  onExportHTML,
  onExportPDF,
  onReset,
}: EditorToolbarProps) {
  const saveBadge = saveStatus === 'saving' ? (
    <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse"><Save className="h-3 w-3" />Saving…</span>
  ) : saveStatus === 'saved' ? (
    <span className="flex items-center gap-1 text-xs text-green-600"><Save className="h-3 w-3" />Saved locally</span>
  ) : saveStatus === 'error' ? (
    <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />Save error</span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Save className="h-3 w-3" />Saved locally</span>
  )

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <BookOpen className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold leading-none truncate">
            {lessonName || 'Untitled Lesson'}
          </h1>
          {gradeLevel && (
            <p className="text-xs text-muted-foreground mt-0.5">{gradeLevel}</p>
          )}
        </div>

        {saveBadge}

        {productionState && (
          <Badge
            variant="outline"
            className={
              productionState === 'Published' ? 'border-green-300 text-green-700' :
              productionState === 'In Review' ? 'border-blue-300 text-blue-700' :
              productionState === 'Archived'  ? 'border-gray-300 text-gray-500' :
              'border-yellow-300 text-yellow-700'
            }
          >
            {productionState}
          </Badge>
        )}

        <Button type="button" variant="ghost" size="sm" onClick={onTogglePreview}>
          {preview ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
          {preview ? 'Edit' : 'Preview'}
        </Button>

        <Button type="button" variant="outline" size="sm" onClick={onExportJSON}>
          <Download className="mr-1.5 h-4 w-4" /> Export JSON
        </Button>

        <Button type="button" variant="outline" size="sm" onClick={onExportHTML}>
          <Download className="mr-1.5 h-4 w-4" /> Export HTML
        </Button>

        <Button type="button" variant="outline" size="sm" onClick={onExportPDF} disabled={printMode}>
          <Download className="mr-1.5 h-4 w-4" /> {printMode ? 'Preparing…' : 'Export PDF'}
        </Button>

        <Button
          type="button"
          variant={resetStep === 1 ? 'destructive' : 'ghost'}
          size="sm"
          onClick={onReset}
          title={resetStep === 0 ? 'Reset guide' : 'Click again to confirm reset'}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" />
          {resetStep === 1 ? 'Confirm reset' : 'Reset'}
        </Button>
      </div>
    </header>
  )
}
