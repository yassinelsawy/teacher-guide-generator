import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { GlossaryEntry } from '@/types'

interface Props {
  entries: GlossaryEntry[]
  onChange: (entries: GlossaryEntry[]) => void
  readOnly?: boolean
}

export function GlossarySection({ entries, onChange, readOnly = false }: Props) {
  const update = <K extends keyof GlossaryEntry>(i: number, key: K, value: GlossaryEntry[K]) => {
    const n = [...entries]; n[i] = { ...n[i], [key]: value }; onChange(n)
  }
  const add    = ()    => onChange([...entries, { id: crypto.randomUUID(), concept: '', definition: '' }])
  const remove = (i: number) => onChange(entries.filter((_, j) => j !== i))

  if (readOnly) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b"><th className="py-2 pr-6 text-left font-medium text-muted-foreground w-52">Concept</th><th className="py-2 text-left font-medium text-muted-foreground">Definition</th></tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="py-2 pr-6 font-medium">{e.concept || '—'}</td>
                <td className="py-2">{e.definition || '—'}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-muted-foreground">No entries.</td></tr>}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="pb-2 pr-3 text-left text-xs uppercase tracking-wide font-medium text-muted-foreground w-56">Concept</th>
              <th className="pb-2 pr-3 text-left text-xs uppercase tracking-wide font-medium text-muted-foreground">Definition</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="py-1.5 pr-3"><Input value={e.concept} onChange={ev => update(i, 'concept', ev.target.value)} placeholder="Concept" className="h-8 text-sm" /></td>
                <td className="py-1.5 pr-3"><Input value={e.definition} onChange={ev => update(i, 'definition', ev.target.value)} placeholder="Definition" className="h-8 text-sm" /></td>
                <td className="py-1.5">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={entries.length <= 1} className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1.5 h-4 w-4" /> Add Entry
      </Button>
    </div>
  )
}
