import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  BookOpen,
  ChevronsDown,
  ChevronsUp,
  ClipboardList,
  Copy,
  FileText,
  GripVertical,
  Info,
  ListChecks,
  ListOrdered,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { LessonInfoSection } from '@/components/sections/LessonInfoSection'
import { OverviewSection } from '@/components/sections/OverviewSection'
import { LearningOutcomesSection } from '@/components/sections/LearningOutcomesSection'
import { PreparationSection } from '@/components/sections/PreparationSection'
import { OutlineOverviewSection } from '@/components/sections/OutlineOverviewSection'
import { LessonProcedureSection } from '@/components/sections/LessonProcedureSection'
import { GlossarySection } from '@/components/sections/GlossarySection'
import { BonusActivitiesSection } from '@/components/sections/BonusActivitiesSection'
import { cn } from '@/lib/utils'
import {
  SECTION_TYPES,
  SECTION_TYPE_LABELS,
  createGuideSection,
  type GuideSection,
  type SectionType,
} from '@/types'

interface Props {
  sections: GuideSection[]
  onChange: (sections: GuideSection[]) => void
  readOnly?: boolean
  forceOpen?: boolean
}

function labelForType(sectionType: SectionType) {
  return SECTION_TYPE_LABELS[sectionType] || 'Section'
}

function isHtmlEmpty(html: string): boolean {
  return !html || !html.replace(/<[^>]+>/g, '').trim()
}

function isSectionEmpty(section: GuideSection): boolean {
  switch (section.sectionType) {
    case 'lessonInfo': {
      const { lessonName, gradeLevel, moduleLink, slidesLink } = section.lessonInfo
      return ![lessonName, gradeLevel, moduleLink, slidesLink].some((value) => value.trim())
    }
    case 'overview':
      return isHtmlEmpty(section.overview)
    case 'learningOutcomes':
      return section.learningOutcomes.every((item) => !item.trim())
    case 'preparation':
      return isHtmlEmpty(section.preparation)
    case 'outlineOverview':
      return section.outlineOverview.length === 0
    case 'lessonProcedure':
      return section.lessonProcedure.every((sub) => sub.activities.length === 0)
    case 'glossary':
      return section.glossary.every((entry) => !entry.concept.trim() && !entry.definition.trim())
    case 'bonusActivities':
      return isHtmlEmpty(section.bonusActivities)
    default:
      return true
  }
}

function SectionBody({
  section,
  readOnly,
  onChange,
}: {
  section: GuideSection
  readOnly: boolean
  onChange: (updated: GuideSection) => void
}) {
  switch (section.sectionType) {
    case 'lessonInfo':
      return <LessonInfoSection data={section.lessonInfo} onChange={(lessonInfo) => onChange({ ...section, lessonInfo })} readOnly={readOnly} />
    case 'overview':
      return <OverviewSection content={section.overview} onChange={(overview) => onChange({ ...section, overview })} readOnly={readOnly} />
    case 'learningOutcomes':
      return <LearningOutcomesSection items={section.learningOutcomes} onChange={(learningOutcomes) => onChange({ ...section, learningOutcomes })} readOnly={readOnly} />
    case 'preparation':
      return <PreparationSection content={section.preparation} onChange={(preparation) => onChange({ ...section, preparation })} readOnly={readOnly} />
    case 'outlineOverview':
      return <OutlineOverviewSection rows={section.outlineOverview} onChange={(outlineOverview) => onChange({ ...section, outlineOverview })} readOnly={readOnly} />
    case 'lessonProcedure':
      return <LessonProcedureSection subsections={section.lessonProcedure} onChange={(lessonProcedure) => onChange({ ...section, lessonProcedure })} readOnly={readOnly} />
    case 'glossary':
      return <GlossarySection entries={section.glossary} onChange={(glossary) => onChange({ ...section, glossary })} readOnly={readOnly} />
    case 'bonusActivities':
      return <BonusActivitiesSection content={section.bonusActivities} onChange={(bonusActivities) => onChange({ ...section, bonusActivities })} readOnly={readOnly} />
    default:
      return null
  }
}

// Floating "ghost" shown under the cursor while a section is being dragged
// (via DragOverlay), decoupled from the sortable list so it isn't clipped or
// reflowed by neighboring cards.
function SectionDragPreview({ section, index }: { section: GuideSection; index: number }) {
  const displayTitle = section.title.trim() || labelForType(section.sectionType)
  return (
    <div className="rotate-1 cursor-grabbing rounded-xl border bg-card shadow-2xl ring-2 ring-primary/30">
      <div className="flex items-center gap-3 px-6 py-4">
        <GripVertical className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{index + 1}. {displayTitle}</span>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {labelForType(section.sectionType)}
        </span>
      </div>
    </div>
  )
}

function SortableSectionCard({
  section,
  index,
  onChange,
  onRemove,
  onDuplicate,
  onMoveToTop,
  onMoveToBottom,
  isFirst = false,
  isLast = false,
  readOnly = false,
  forceOpen = false,
  isDragging = false,
  autoFocus = false,
  onAutoFocused,
  scrollTo = false,
  onScrolledTo,
}: {
  section: GuideSection
  index: number
  onChange: (updated: GuideSection) => void
  onRemove: () => void
  onDuplicate: () => void
  onMoveToTop: () => void
  onMoveToBottom: () => void
  isFirst?: boolean
  isLast?: boolean
  readOnly?: boolean
  forceOpen?: boolean
  isDragging?: boolean
  autoFocus?: boolean
  onAutoFocused?: () => void
  scrollTo?: boolean
  onScrolledTo?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sortableDragging } = useSortable({ id: section.id })
  const cardRef = useRef<HTMLDivElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateType = (nextType: SectionType) => {
    if (nextType === section.sectionType) return
    if (!isSectionEmpty(section)) {
      const confirmed = window.confirm('Changing the section type will clear the content currently in this section. Continue?')
      if (!confirmed) return
    }
    const next = createGuideSection(nextType)
    onChange({
      ...next,
      id: section.id,
      title: section.title?.trim() || next.title,
    })
  }

  const handleDeleteClick = () => {
    if (!deleteArmed) {
      setDeleteArmed(true)
      deleteTimeoutRef.current = setTimeout(() => setDeleteArmed(false), 4000)
      return
    }
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    onRemove()
  }

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!autoFocus) return
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const id = setTimeout(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }, 250)
    onAutoFocused?.()
    return () => clearTimeout(id)
    // Intentionally run once on mount — this only ever fires for a section right after it is created or duplicated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follows a section after "move to top"/"move to bottom" jumps it far from
  // where the user was looking, without stealing focus like autoFocus does.
  useEffect(() => {
    if (!scrollTo) return
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    onScrolledTo?.()
  }, [scrollTo, onScrolledTo])

  const displayTitle = section.title.trim() || labelForType(section.sectionType)

  useEffect(() => {
    if (!cardRef.current) return

    const transformValue = transform ? CSS.Transform.toString(transform) : ''
    if (transformValue) {
      cardRef.current.style.transform = transformValue
    } else {
      cardRef.current.style.removeProperty('transform')
    }
    cardRef.current.style.transition = transition || ''
    cardRef.current.style.willChange = 'transform'
  }, [transform, transition])

  const headerContent = readOnly ? null : (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-end">
      <div className="space-y-1.5 min-w-0">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Section Type</Label>
        <Select value={section.sectionType} onValueChange={(value) => updateType(value as SectionType)}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTION_TYPES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 min-w-0">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Section Name</Label>
        <Input
          ref={titleInputRef}
          value={section.title}
          onChange={(event) => onChange({ ...section, title: event.target.value })}
          placeholder="Enter section name"
          className="h-9 w-full"
        />
      </div>

      <div className="col-span-full flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-1 lg:pb-[2px]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(event) => {
            event.stopPropagation()
            onDuplicate()
          }}
          className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
          title="Duplicate section"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={deleteArmed ? 'destructive' : 'ghost'}
          size={deleteArmed ? 'sm' : 'icon'}
          onClick={(event) => {
            event.stopPropagation()
            handleDeleteClick()
          }}
          className={cn('shrink-0', deleteArmed ? 'h-10 gap-1.5 px-3' : 'h-10 w-10 text-destructive hover:text-destructive')}
          title={deleteArmed ? 'Click again to confirm delete' : 'Delete section'}
        >
          <Trash2 className="h-4 w-4" />
          {deleteArmed && <span className="text-xs font-medium">Confirm?</span>}
        </Button>
      </div>
    </div>
  )

  const leadingContent = !readOnly ? (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isFirst}
        onClick={(event) => {
          event.stopPropagation()
          onMoveToTop()
        }}
        className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
        title="Move to top"
      >
        <ChevronsUp className="h-4 w-4" />
      </Button>

      <button
        {...attributes}
        {...listeners}
        className="drag-handle inline-flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-md border text-muted-foreground hover:text-foreground hover:bg-accent active:cursor-grabbing touch-none select-none"
        aria-label="Drag to reorder"
        type="button"
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isLast}
        onClick={(event) => {
          event.stopPropagation()
          onMoveToBottom()
        }}
        className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
        title="Move to bottom"
      >
        <ChevronsDown className="h-4 w-4" />
      </Button>
    </div>
  ) : null

  return (
    <div
      ref={(element) => {
        cardRef.current = element
        setNodeRef(element)
      }}
      className={cn(
        'rounded-xl border bg-card shadow-sm will-change-transform transition-opacity duration-200 ease-out',
        (isDragging || sortableDragging) && 'opacity-40',
      )}
    >
      <CollapsibleSection
        title={`${index + 1}. ${displayTitle}`}
        badge={labelForType(section.sectionType)}
        defaultOpen={!readOnly || autoFocus}
        leadingContent={leadingContent}
        headerContent={headerContent}
        forceOpen={forceOpen}
      >
        <SectionBody section={section} readOnly={readOnly} onChange={onChange} />
      </CollapsibleSection>
    </div>
  )
}

const SECTION_TYPE_ICONS: Record<SectionType, LucideIcon> = {
  lessonInfo: Info,
  overview: FileText,
  learningOutcomes: Target,
  preparation: ClipboardList,
  outlineOverview: ListOrdered,
  lessonProcedure: ListChecks,
  glossary: BookOpen,
  bonusActivities: Sparkles,
}

// Fixed bottom-right button that opens a menu of section types to append —
// keeps "add a section" reachable from anywhere on a long guide without
// competing for space with the sticky top toolbar.
function FloatingAddSectionMenu({ onAdd }: { onAdd: (sectionType: SectionType) => void }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
      {open && (
        <div
          role="menu"
          aria-label="Add section"
          className="w-64 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
        >
          <div className="border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Add Section
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {SECTION_TYPES.map((option) => {
              const Icon = SECTION_TYPE_ICONS[option.value]
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onAdd(option.value)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Button
        type="button"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close add section menu' : 'Add section'}
        aria-expanded={open}
        className="h-14 w-14 rounded-full shadow-xl transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>
    </div>
  )
}

export function GuideSectionsSection({ sections, onChange, readOnly = false, forceOpen = false }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null)
  const [scrollToSectionId, setScrollToSectionId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const addSection = (sectionType: SectionType) => {
    const section = createGuideSection(sectionType)
    onChange([...sections, section])
    setFocusSectionId(section.id)
  }

  const updateSection = (id: string, updated: GuideSection) => {
    onChange(sections.map((section) => (section.id === id ? updated : section)))
  }

  const removeSection = (id: string) => onChange(sections.filter((section) => section.id !== id))

  const duplicateSection = (id: string) => {
    const index = sections.findIndex((section) => section.id === id)
    if (index < 0) return
    const clone: GuideSection = { ...structuredClone(sections[index]), id: crypto.randomUUID() }
    clone.title = clone.title.trim() ? `${clone.title.trim()} (Copy)` : clone.title
    const next = [...sections]
    next.splice(index + 1, 0, clone)
    onChange(next)
    setFocusSectionId(clone.id)
  }

  const moveSectionToTop = (id: string) => {
    const index = sections.findIndex((section) => section.id === id)
    if (index <= 0) return
    const next = [...sections]
    const [item] = next.splice(index, 1)
    next.unshift(item)
    onChange(next)
    setScrollToSectionId(id)
  }

  const moveSectionToBottom = (id: string) => {
    const index = sections.findIndex((section) => section.id === id)
    if (index < 0 || index === sections.length - 1) return
    const next = [...sections]
    const [item] = next.splice(index, 1)
    next.push(item)
    onChange(next)
    setScrollToSectionId(id)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (over && active.id !== over.id) {
      const from = sections.findIndex((section) => section.id === active.id)
      const to = sections.findIndex((section) => section.id === over.id)
      if (from >= 0 && to >= 0) {
        onChange(arrayMove(sections, from, to))
      }
    }
  }

  const activeIndex = activeId ? sections.findIndex((section) => section.id === activeId) : -1
  const activeSection = activeIndex >= 0 ? sections[activeIndex] : null

  return (
    <div className="space-y-4">
      {sections.length === 0 ? (
        <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground bg-muted/20">
          No sections yet. Use the + button in the bottom-right corner to add one.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={(event) => setActiveId(String(event.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <SortableSectionCard
                  key={section.id}
                  section={section}
                  index={index}
                  onChange={(updated) => updateSection(section.id, updated)}
                  onRemove={() => removeSection(section.id)}
                  onDuplicate={() => duplicateSection(section.id)}
                  onMoveToTop={() => moveSectionToTop(section.id)}
                  onMoveToBottom={() => moveSectionToBottom(section.id)}
                  isFirst={index === 0}
                  isLast={index === sections.length - 1}
                  readOnly={readOnly}
                  forceOpen={forceOpen}
                  isDragging={activeId === section.id}
                  autoFocus={focusSectionId === section.id}
                  onAutoFocused={() => setFocusSectionId(null)}
                  scrollTo={scrollToSectionId === section.id}
                  onScrolledTo={() => setScrollToSectionId(null)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeSection ? <SectionDragPreview section={activeSection} index={activeIndex} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {!readOnly && <FloatingAddSectionMenu onAdd={addSection} />}
    </div>
  )
}
