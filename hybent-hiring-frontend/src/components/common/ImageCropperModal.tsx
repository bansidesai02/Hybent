import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import getCroppedImg from '@/utils/cropImage'

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

  const handleSave = async () => {
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
  }

  const zoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3))
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.2, 1))
  const rotateClockwise = () => setRotation(prev => (prev + 90) % 360)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">Adjust Your Photo</h3>
          <button 
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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

        <div className="p-6 space-y-6 bg-white">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-gray-600 w-12">Zoom</label>
              <button onClick={zoomOut} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">➖</button>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => onZoomChange(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <button onClick={zoomIn} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">➕</button>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button 
                onClick={rotateClockwise}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 font-semibold hover:bg-gray-50 transition-all"
              >
                <span>Rotate ⟳</span>
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              Apply & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
