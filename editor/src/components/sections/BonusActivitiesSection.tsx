import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  items: string[]
  onChange: (items: string[]) => void
  readOnly?: boolean
}

export function BonusActivitiesSection({ items, onChange, readOnly = false }: Props) {
  const update = (i: number, v: string) => { const n = [...items]; n[i] = v; onChange(n) }
  const add    = ()    => onChange([...items, ''])
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i))

  if (readOnly) {
    const filled = items.filter(Boolean)
    return filled.length
      ? <ul className="list-disc pl-5 space-y-1">{filled.map((x, i) => <li key={i} className="text-sm">{x}</li>)}</ul>
      : <p className="text-sm text-muted-foreground">No bonus activities defined.</p>
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground mb-2">Optional — add activities for early finishers.</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground w-4 shrink-0">•</span>
          <Input value={item} onChange={e => update(i, e.target.value)} placeholder={`Bonus activity ${i + 1}`} className="flex-1" />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} className="h-9 w-9 text-destructive hover:text-destructive shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="mt-1">
        <Plus className="mr-1.5 h-4 w-4" /> Add Bonus Activity
      </Button>
    </div>
  )
}
