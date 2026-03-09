import { RichTextEditor } from '@/components/RichTextEditor'

interface Props {
  content: string
  onChange: (html: string) => void
  readOnly?: boolean
}

export function OverviewSection({ content, onChange, readOnly = false }: Props) {
  if (readOnly) {
    return content
      ? <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: content }} />
      : <p className="text-sm text-muted-foreground">No overview yet.</p>
  }

  return (
    <RichTextEditor
      content={content}
      onChange={onChange}
      placeholder="Describe the lesson scenario and context…"
    />
  )
}
