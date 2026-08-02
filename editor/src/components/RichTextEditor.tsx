import { useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { ImageWithDelete } from '@/components/tiptap/ImageWithDelete'
import {
  Bold,
  ImageDown,
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
import { ImageEditDialog } from '@/components/ImageEditDialog'
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
  const [pendingImage, setPendingImage] = useState<{ src: string; fileName: string } | null>(null)

  const editor: Editor | null = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder }),
      ImageWithDelete.configure({ allowBase64: true }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      handleKeyDown(_view, event): boolean {
        if (event.key !== 'Tab') return false
        if (!editor?.isActive('listItem')) return false
        event.preventDefault()
        return event.shiftKey
          ? editor.chain().focus().liftListItem('listItem').run()
          : editor.chain().focus().sinkListItem('listItem').run()
      },
    },
  })

  if (!editor) return null

  const insertImageByUrl = () => {
    const raw = window.prompt('Paste image URL')
    const src = raw?.trim()
    if (!src) return
    editor.chain().focus().setImage({ src }).run()
  }

  // Turns the current selection into a link (or edits/removes an existing one).
  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const input = window.prompt('Enter link URL', previousUrl ?? 'https://')
    if (input === null) return // cancelled
    const url = input.trim()
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    // Default to https:// when the user omits a scheme (but leave mailto/tel/anchors alone).
    const href = /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : `https://${url}`
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
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
      setPendingImage({ src: reader.result, fileName: file.name })
    }
    reader.readAsDataURL(file)
  }

  const applyPendingImage = (dataUrl: string, fileName: string, width: number | null, height: number | null) => {
    editor
      .chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: dataUrl, alt: fileName, width, height } })
      .run()
    setPendingImage(null)
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
          {btn(editor.isActive('link'), setLink, 'Insert link', <Link2 className="h-4 w-4" />)}
          <div className="h-8 w-px bg-border mx-1" />
          {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', <List className="h-4 w-4" />)}
          {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Ordered list', <ListOrdered className="h-4 w-4" />)}
          <div className="h-8 w-px bg-border mx-1" />
          {btn(false, openImagePicker, 'Upload image', <ImagePlus className="h-4 w-4" />)}
          {btn(false, insertImageByUrl, 'Insert image by URL', <ImageDown className="h-4 w-4" />)}
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
      {pendingImage && (
        <ImageEditDialog
          src={pendingImage.src}
          fileName={pendingImage.fileName}
          onCancel={() => setPendingImage(null)}
          onApply={applyPendingImage}
        />
      )}
    </div>
  )
}
