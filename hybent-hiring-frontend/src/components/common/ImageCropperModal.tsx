import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Loader2 } from 'lucide-react'
import getCroppedImg from '@/utils/cropImage'
import { useAsyncAction } from '@/hooks/useAsyncAction'

interface ImageCropperModalProps {
  image: string | null
  onCropComplete: (croppedFile: File) => void
  onCancel: () => void
}

export default function ImageCropperModal({ image, onCropComplete, onCancel }: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop)
  }

  const onZoomChange = (zoom: number) => {
    setZoom(zoom)
  }

  const onRotationChange = (rotation: number) => {
    setRotation(rotation)
  }

  const onCropAreaChange = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  // `onCropComplete` triggers the caller's upload mutation, so a fast
  // double-click on "Apply & Save" could fire it twice before this component
  // unmounts — guarded with the shared async-action hook.
  const [handleSave, isSaving] = useAsyncAction(async () => {
    try {
      if (!image) return
      const croppedBlob = await getCroppedImg(image, croppedAreaPixels, rotation)
      if (croppedBlob) {
        const file = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' })
        onCropComplete(file)
      }
    } catch (e) {
      console.error(e)
    }
  })

  const zoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3))
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.2, 1))
  const rotateClockwise = () => setRotation(prev => (prev + 90) % 360)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-hb-surface rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-hb-border flex justify-between items-center">
          <h3 className="text-xl font-bold text-hb-text">Adjust Your Photo</h3>
          <button
            onClick={onCancel}
            className="text-hb-dim hover:text-hb-text transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="relative h-[400px] bg-gray-900 w-full">
          <Cropper
            image={image || undefined}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            onCropChange={onCropChange}
            onCropComplete={onCropAreaChange}
            onZoomChange={onZoomChange}
            onRotationChange={onRotationChange}
          />
        </div>

        <div className="p-6 space-y-6 bg-hb-surface">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-hb-muted w-12">Zoom</label>
              <button onClick={zoomOut} className="p-2 hover:bg-hb-surface-2 rounded-lg text-hb-muted">➖</button>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => onZoomChange(Number(e.target.value))}
                className="flex-1 h-2 bg-hb-border-strong rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <button onClick={zoomIn} className="p-2 hover:bg-hb-surface-2 rounded-lg text-hb-muted">➕</button>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={rotateClockwise}
                className="flex items-center gap-2 px-4 py-2 border border-hb-border rounded-xl text-hb-muted font-semibold hover:bg-hb-surface-2 transition-all"
              >
                <span>Rotate ⟳</span>
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-hb-border text-hb-muted font-semibold rounded-xl hover:bg-hb-surface-2 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 inline-flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" aria-hidden />}
              Apply & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
