import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRODUCTION_STATES, type LessonInfo } from '@/types'

interface Props {
  data: LessonInfo
  onChange: (data: LessonInfo) => void
  readOnly?: boolean
}

export function LessonInfoSection({ data, onChange, readOnly = false }: Props) {
  const set = <K extends keyof LessonInfo>(key: K, value: LessonInfo[K]) =>
    onChange({ ...data, [key]: value })

  const stateColor: Record<string, string> = {
    Draft: 'bg-yellow-100 text-yellow-800',
    'In Review': 'bg-blue-100 text-blue-800',
    Published: 'bg-green-100 text-green-800',
    Archived: 'bg-gray-100 text-gray-700',
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Lesson Name */}
      <div className="space-y-1.5">
        <Label htmlFor="lessonName">Lesson Name</Label>
        {readOnly
          ? <p className="text-sm">{data.lessonName || '—'}</p>
          : <Input id="lessonName" value={data.lessonName} onChange={e => set('lessonName', e.target.value)} placeholder="e.g. Introduction to Variables" />}
      </div>

      {/* Grade Level */}
      <div className="space-y-1.5">
        <Label htmlFor="gradeLevel">Grade Level</Label>
        {readOnly
          ? <p className="text-sm">{data.gradeLevel || '—'}</p>
          : <Input id="gradeLevel" value={data.gradeLevel} onChange={e => set('gradeLevel', e.target.value)} placeholder="e.g. Grade 5" />}
      </div>

      {/* Module Link */}
      <div className="space-y-1.5">
        <Label htmlFor="moduleLink">Module Link</Label>
        {readOnly
          ? data.moduleLink
            ? <a href={data.moduleLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">{data.moduleLink}</a>
            : <p className="text-sm text-muted-foreground">—</p>
          : <Input id="moduleLink" type="url" value={data.moduleLink} onChange={e => set('moduleLink', e.target.value)} placeholder="https://…" />}
      </div>

      {/* Slides Link */}
      <div className="space-y-1.5">
        <Label htmlFor="slidesLink">Slides Link</Label>
        {readOnly
          ? data.slidesLink
            ? <a href={data.slidesLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">{data.slidesLink}</a>
            : <p className="text-sm text-muted-foreground">—</p>
          : <Input id="slidesLink" type="url" value={data.slidesLink} onChange={e => set('slidesLink', e.target.value)} placeholder="https://…" />}
      </div>

      {/* Production State */}
      <div className="space-y-1.5">
        <Label>Production State</Label>
        {readOnly
          ? <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${stateColor[data.productionState] ?? 'bg-gray-100 text-gray-700'}`}>{data.productionState || '—'}</span>
          : (
            <Select value={data.productionState} onValueChange={v => set('productionState', v)}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                {PRODUCTION_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
      </div>
    </div>
  )
}
