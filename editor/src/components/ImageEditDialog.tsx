import { useEffect, useRef, useState } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ImageEditDialogProps {
  src: string
  fileName: string
  onCancel: () => void
  onApply: (dataUrl: string, fileName: string) => void
}

function fullCrop(): Crop {
  return centerCrop(makeAspectCrop({ unit: '%', width: 100 }, 1, 1, 1), 100, 100)
}

function getCroppedDataUrl(image: HTMLImageElement, crop: PixelCrop, outWidth: number, outHeight: number): string {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  canvas.width = Math.max(1, Math.round(outWidth))
  canvas.height = Math.max(1, Math.round(outHeight))
  const ctx = canvas.getContext('2d')
  if (!ctx) return image.src
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas.toDataURL('image/png')
}

export function ImageEditDialog({ src, fileName, onCancel, onApply }: ImageEditDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [lockAspect, setLockAspect] = useState(true)
  const [width, setWidth] = useState<number>(0)
  const [height, setHeight] = useState<number>(0)
  const aspectRatio = useRef(1)

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const initial = fullCrop()
    setCrop(initial)
    const pixelCrop: PixelCrop = {
      unit: 'px',
      x: 0,
      y: 0,
      width: img.width,
      height: img.height,
    }
    setCompletedCrop(pixelCrop)
    aspectRatio.current = img.naturalWidth / img.naturalHeight
    setWidth(Math.round(img.naturalWidth))
    setHeight(Math.round(img.naturalHeight))
  }

  useEffect(() => {
    if (!completedCrop || !imgRef.current) return
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width
    const cropNaturalWidth = Math.round(completedCrop.width * scaleX)
    const cropNaturalHeight = Math.round(completedCrop.height * (imgRef.current.naturalHeight / imgRef.current.height))
    aspectRatio.current = cropNaturalWidth / cropNaturalHeight
    setWidth(cropNaturalWidth)
    setHeight(cropNaturalHeight)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedCrop])

  const onWidthChange = (value: number) => {
    setWidth(value)
    if (lockAspect && aspectRatio.current > 0) {
      setHeight(Math.round(value / aspectRatio.current))
    }
  }

  const onHeightChange = (value: number) => {
    setHeight(value)
    if (lockAspect && aspectRatio.current > 0) {
      setWidth(Math.round(value * aspectRatio.current))
    }
  }

  const handleApply = () => {
    if (!imgRef.current || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      onApply(src, fileName)
      return
    }
    const dataUrl = getCroppedDataUrl(imgRef.current, completedCrop, width, height)
    onApply(dataUrl, fileName)
  }

  const handleInsertOriginal = () => {
    onApply(src, fileName)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-background shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Adjust image</h2>
          <span className="truncate text-xs text-muted-foreground">{fileName}</span>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="flex justify-center bg-muted/30 p-2">
            <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={c => setCompletedCrop(c)}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img ref={imgRef} src={src} onLoad={onImageLoad} style={{ maxHeight: '50vh' }} />
            </ReactCrop>
          </div>

          <div className="mt-4 flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="img-width">Width (px)</Label>
              <Input
                id="img-width"
                type="number"
                min={1}
                value={width}
                onChange={e => onWidthChange(Number(e.target.value) || 0)}
                className="w-28"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="img-height">Height (px)</Label>
              <Input
                id="img-height"
                type="number"
                min={1}
                value={height}
                onChange={e => onHeightChange(Number(e.target.value) || 0)}
                className="w-28"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={lockAspect} onChange={e => setLockAspect(e.target.checked)} />
              Lock aspect ratio
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={handleInsertOriginal}>
            Insert original
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleApply}>
              Apply &amp; insert
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
