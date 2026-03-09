import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  steps: string[]
  onChange: (steps: string[]) => void
  readOnly?: boolean
}

export function PublishingGuideSection({ steps, onChange, readOnly = false }: Props) {
  const update = (i: number, v: string) => { const n = [...steps]; n[i] = v; onChange(n) }
  const add    = ()    => onChange([...steps, ''])
  const remove = (i: number) => onChange(steps.filter((_, j) => j !== i))

  if (readOnly) {
    const filled = steps.filter(Boolean)
    return filled.length
      ? <ol className="list-decimal pl-5 space-y-1">{filled.map((s, i) => <li key={i} className="text-sm">{s}</li>)}</ol>
      : <p className="text-sm text-muted-foreground">No steps defined.</p>
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm w-6 text-right shrink-0">{i + 1}.</span>
          <Input value={step} onChange={e => update(i, e.target.value)} placeholder={`Step ${i + 1}`} className="flex-1" />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={steps.length <= 1} className="h-9 w-9 text-destructive hover:text-destructive shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="mt-1">
        <Plus className="mr-1.5 h-4 w-4" /> Add Step
      </Button>
    </div>
  )
}
