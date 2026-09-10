import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { FontSize } from '@/components/tiptap/FontSize'
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
  Palette,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageEditDialog } from '@/components/ImageEditDialog'
import { cn } from '@/lib/utils'

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px']

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
  const colorInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingImage, setPendingImage] = useState<{ src: string; fileName: string } | null>(null)

  const editor: Editor | null = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      FontSize,
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

  const currentColor = (editor?.getAttributes('textStyle').color as string | undefined) ?? '#000000'

  // The native color picker fires its 'input' event continuously while the
  // user drags inside it. Running setColor() on every one of those ticks
  // re-serializes the whole document and pushes a new undo/autosave state on
  // every pixel of the drag, which is what made the picker feel laggy. Commit
  // the color only once, when the picker is closed ('change'), and sync the
  // swatch imperatively (below) instead of via a controlled `value` prop.
  useEffect(() => {
    const el = colorInputRef.current
    if (!el || !editor) return
    const commitColor = (event: Event) => {
      editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()
    }
    el.addEventListener('change', commitColor)
    return () => el.removeEventListener('change', commitColor)
  }, [editor])

  useEffect(() => {
    if (colorInputRef.current) colorInputRef.current.value = currentColor
  }, [currentColor])

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

  const onFontSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    if (value === 'default') {
      editor.chain().focus().unsetFontSize().run()
    } else {
      editor.chain().focus().setFontSize(value).run()
    }
  }

  const clearTextColor = () => {
    editor.chain().focus().unsetColor().run()
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

  const currentFontSize = (editor.getAttributes('textStyle').fontSize as string | undefined) ?? 'default'

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
          <select
            value={currentFontSize}
            onChange={onFontSizeChange}
            title="Font size"
            className="h-8 rounded-md border border-input bg-background px-1 text-xs"
          >
            <option value="default">Default</option>
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size.replace('px', '')}
              </option>
            ))}
          </select>
          <div className="relative h-8 w-8">
            <input
              ref={colorInputRef}
              type="color"
              defaultValue={currentColor}
              aria-label="Text color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div
              className="pointer-events-none flex h-8 w-8 items-center justify-center rounded-md"
              title="Text color"
            >
              <Palette className="h-4 w-4" style={{ color: currentColor }} />
            </div>
          </div>
          {btn(false, clearTextColor, 'Clear text color', <span className="text-xs">A✕</span>)}
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
