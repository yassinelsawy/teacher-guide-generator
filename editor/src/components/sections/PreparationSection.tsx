import { RichTextEditor } from '@/components/RichTextEditor'

interface Props {
  content: string
  onChange: (html: string) => void
  readOnly?: boolean
}

export function PreparationSection({ content, onChange, readOnly = false }: Props) {
  if (readOnly) {
    return content
      ? <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: content }} />
      : <p className="text-sm text-muted-foreground">No preparation steps.</p>
  }

  return (
    <RichTextEditor
      content={content}
      onChange={onChange}
      placeholder="List what teachers need to prepare before the session…"
    />
  )
}
