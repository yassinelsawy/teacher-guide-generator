import { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Undo,
  Redo,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing…',
  readOnly = false,
  className,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder }),
      Image.configure({ allowBase64: true }),
    ],
    content,
    editable: !readOnly,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
  })

  if (!editor) return null

  const insertImageByUrl = () => {
    const raw = window.prompt('Paste image URL')
    const src = raw?.trim()
    if (!src) return
    editor.chain().focus().setImage({ src }).run()
  }

  const openImagePicker = () => {
    fileInputRef.current?.click()
  }

  const onImageFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      editor.chain().focus().setImage({ src: reader.result, alt: file.name }).run()
    }
    reader.readAsDataURL(file)
  }

  const btn = (active: boolean, onClick: () => void, title: string, icon: React.ReactNode) => (
    <Button
      key={title}
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', active && 'bg-accent')}
      onClick={onClick}
      title={title}
    >
      {icon}
    </Button>
  )

  return (
    <div className={cn('tiptap-wrapper', className)}>
      {!readOnly && (
        <div className="tiptap-toolbar">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload image"
            onChange={onImageFileSelected}
          />
          {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', <Bold className="h-4 w-4" />)}
          {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', <Italic className="h-4 w-4" />)}
          {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline', <UnderlineIcon className="h-4 w-4" />)}
          <div className="h-8 w-px bg-border mx-1" />
          {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', <List className="h-4 w-4" />)}
          {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Ordered list', <ListOrdered className="h-4 w-4" />)}
          <div className="h-8 w-px bg-border mx-1" />
          {btn(false, openImagePicker, 'Upload image', <ImagePlus className="h-4 w-4" />)}
          {btn(false, insertImageByUrl, 'Insert image by URL', <Link2 className="h-4 w-4" />)}
          <div className="h-8 w-px bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="tiptap-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
