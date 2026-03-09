import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { OutlineRow } from '@/types'

type Col = { key: keyof Omit<OutlineRow, 'id'>; label: string; placeholder: string; numeric?: boolean }

const COLS: Col[] = [
  { key: 'type',            label: 'Type',          placeholder: 'e.g. Main Activity' },
  { key: 'sectionName',     label: 'Section Name',  placeholder: 'e.g. Variables' },
  { key: 'pedagogy',        label: 'Pedagogy',      placeholder: 'e.g. Discussion' },
  { key: 'durationMinutes', label: 'Duration (min)', placeholder: '10', numeric: true },
  { key: 'slideNumbers',    label: 'Slides',        placeholder: '1–5' },
]

interface Props {
  rows: OutlineRow[]
  onChange: (rows: OutlineRow[]) => void
  readOnly?: boolean
}

export function OutlineOverviewSection({ rows, onChange, readOnly = false }: Props) {
  const update = <K extends keyof OutlineRow>(i: number, key: K, value: OutlineRow[K]) => {
    const n = [...rows]; n[i] = { ...n[i], [key]: value }; onChange(n)
  }
  const add = () => onChange([...rows, { id: crypto.randomUUID(), type: '', sectionName: '', pedagogy: '', durationMinutes: 0, slideNumbers: '' }])
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i))

  const total = rows.reduce((s, r) => s + (Number(r.durationMinutes) || 0), 0)

  if (readOnly) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b">{COLS.map(c => <th key={c.key} className="py-2 pr-4 text-left font-medium text-muted-foreground">{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b last:border-0">
                {COLS.map(c => <td key={c.key} className="py-2 pr-4">{String(row[c.key]) || '—'}</td>)}
              </tr>
            ))}
            <tr className="border-t">
              <td colSpan={3} className="pt-2 text-right pr-4 text-xs text-muted-foreground">Total</td>
              <td className="pt-2 pr-4 font-medium">{total} min</td>
              <td />
            </tr>
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
              {COLS.map(c => <th key={c.key} className="pb-2 pr-3 text-left text-xs uppercase tracking-wide font-medium text-muted-foreground">{c.label}</th>)}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="border-b last:border-0">
                {COLS.map(c => (
                  <td key={c.key} className="py-1.5 pr-3">
                    <Input
                      value={String(row[c.key])}
                      type={c.numeric ? 'number' : 'text'}
                      onChange={e => update(i, c.key, c.numeric ? (Number(e.target.value) as OutlineRow[typeof c.key]) : (e.target.value as OutlineRow[typeof c.key]))}
                      placeholder={c.placeholder}
                      className="h-8 text-sm"
                    />
                  </td>
                ))}
                <td className="py-1.5">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={rows.length <= 1} className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-2 pr-3 text-right text-xs text-muted-foreground">Total</td>
              <td className="pt-2 pr-3 font-medium">{total} min</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1.5 h-4 w-4" /> Add Row
      </Button>
    </div>
  )
}
