import { useRef, useState } from 'react'
import Image from '@tiptap/extension-image'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { GripVertical, Pencil, X } from 'lucide-react'
import { ImageEditDialog } from '@/components/ImageEditDialog'

const MIN_IMAGE_WIDTH = 40

function ImageNodeView({ node, deleteNode, updateAttributes, selected, editor }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const img = imgRef.current
    if (!img) return

    const startX = event.clientX
    const startWidth = img.getBoundingClientRect().width
    const aspectRatio = img.naturalWidth / img.naturalHeight || 1

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(MIN_IMAGE_WIDTH, Math.round(startWidth + (moveEvent.clientX - startX)))
      updateAttributes({ width: newWidth, height: Math.round(newWidth / aspectRatio) })
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const imgStyle: React.CSSProperties = {}
  if (node.attrs.width) imgStyle.width = `${node.attrs.width}px`
  if (node.attrs.height) imgStyle.height = `${node.attrs.height}px`

  return (
    <NodeViewWrapper
      as="span"
      className={`tiptap-image-wrapper${selected ? ' is-selected' : ''}`}
      draggable={editor.isEditable}
      data-drag-handle={editor.isEditable ? '' : undefined}
      title={editor.isEditable ? 'Drag anywhere on the image to move it' : undefined}
    >
      {editor.isEditable && (
        <span className="tiptap-image-drag-badge" contentEditable={false}>
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}
      <img ref={imgRef} src={node.attrs.src} alt={node.attrs.alt ?? ''} title={node.attrs.title ?? ''} style={imgStyle} />
      {editor.isEditable && (
        <>
          <span className="tiptap-image-actions" contentEditable={false}>
            <button
              type="button"
              className="tiptap-image-btn"
              aria-label="Edit image"
              title="Edit image"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setIsEditing(true)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="tiptap-image-btn tiptap-image-btn--delete"
              aria-label="Delete image"
              title="Delete image"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                deleteNode()
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
          <span
            className="tiptap-image-resize-handle"
            contentEditable={false}
            title="Drag to resize"
            onMouseDown={startResize}
          />
        </>
      )}
      {isEditing && (
        <ImageEditDialog
          src={node.attrs.src}
          fileName={node.attrs.alt || 'image'}
          onCancel={() => setIsEditing(false)}
          onApply={(dataUrl, _fileName, width, height) => {
            updateAttributes({ src: dataUrl, width, height })
            setIsEditing(false)
          }}
        />
      )}
    </NodeViewWrapper>
  )
}

export const ImageWithDelete = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.style.width || element.getAttribute('width')
          return value ? parseInt(value, 10) || null : null
        },
        renderHTML: (attributes: { width?: number | null }) => {
          if (!attributes.width) return {}
          return { style: `width: ${attributes.width}px` }
        },
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.style.height || element.getAttribute('height')
          return value ? parseInt(value, 10) || null : null
        },
        renderHTML: (attributes: { height?: number | null }) => {
          if (!attributes.height) return {}
          return { style: `height: ${attributes.height}px` }
        },
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})
