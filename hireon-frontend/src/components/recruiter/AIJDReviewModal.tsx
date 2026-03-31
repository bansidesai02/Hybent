import React, { useState } from 'react'
import { aiApi } from '@/api/ai'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'

interface JDData {
  title: string
  location: string
  experience: string
  key_responsibilities: string[]
  required_qualifications_skills: string[]
  good_to_have: string[]
  description: string
}

interface AIJDReviewModalProps {
  open: boolean
  onClose: () => void
  data: JDData | null
  onApply: (approvedData: JDData) => void
}

export function AIJDReviewModal({ open, onClose, data: initialData, onApply }: AIJDReviewModalProps) {
  // Use local state for editing
  const [data, setData] = useState<JDData>(initialData || {
    title: '',
    location: '',
    experience: '',
    key_responsibilities: [],
    required_qualifications_skills: [],
    good_to_have: [],
    description: ''
  })

  // Sync state if initialData changes (when generation completes)
  const [lastInitialData, setLastInitialData] = useState<JDData | null>(null)
  if (initialData !== lastInitialData) {
    setData(initialData || {
      title: '',
      location: '',
      experience: '',
      key_responsibilities: [],
      required_qualifications_skills: [],
      good_to_have: [],
      description: ''
    })
    setLastInitialData(initialData)
  }

  const [isExporting, setIsExporting] = useState(false)

  const handleFieldChange = (field: keyof JDData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const handleListChange = (field: 'key_responsibilities' | 'required_qualifications_skills' | 'good_to_have', index: number, value: string) => {
    const newList = [...data[field]]
    newList[index] = value
    setData(prev => ({ ...prev, [field]: newList }))
  }

  const addListItem = (field: 'key_responsibilities' | 'required_qualifications_skills' | 'good_to_have') => {
    setData(prev => ({ ...prev, [field]: [...prev[field], ''] }))
  }

  const removeListItem = (field: 'key_responsibilities' | 'required_qualifications_skills' | 'good_to_have', index: number) => {
    setData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }))
  }

  const handleExportPDF = async () => {
    try {
      setIsExporting(true)
      const res = await aiApi.exportJDPDF(data)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `JD_${data.title.replace(/\s+/g, '_')}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('JD PDF exported successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to export PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleApprove = () => {
    onApply(data)
    toast.success('JD details applied to form!')
  }

  return (
    <Modal open={open} onClose={onClose} title="Review AI Generated JD" size="xl">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-xs">
            Review and refine the AI output before applying it to your job opening.
          </p>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-3 py-1.5 bg-white border border-violet-200 text-violet-600 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-violet-50 transition-colors disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : '📄 Export PDF'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Editor Section */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-4">Core Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Job Position</label>
                  <input 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none transition-all font-semibold text-sm"
                    value={data.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Location</label>
                    <input 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm"
                      value={data.location}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Experience</label>
                    <input 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none transition-all font-bold text-sm"
                      value={data.experience}
                      placeholder="e.g. 3+ Years"
                      onChange={(e) => handleFieldChange('experience', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Job Description</label>
                  <textarea 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none transition-all min-h-[100px] text-sm"
                    value={data.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Key Responsibilities</h3>
                <button 
                  type="button"
                  onClick={() => addListItem('key_responsibilities')}
                  className="text-[10px] font-bold text-violet-600 hover:underline"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-2">
                {data.key_responsibilities.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input 
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      value={item}
                      onChange={(e) => handleListChange('key_responsibilities', i, e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => removeListItem('key_responsibilities', i)}
                      className="text-slate-300 hover:text-rose-500 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Sections */}
          <div className="space-y-6">
            <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Qualifications</h3>
                <button 
                  type="button"
                  onClick={() => addListItem('required_qualifications_skills')}
                  className="text-xs font-bold text-violet-600"
                >
                  +
                </button>
              </div>
              <div className="space-y-1.5">
                {data.required_qualifications_skills.map((item, i) => (
                  <div key={i} className="flex gap-1 group">
                    <input 
                      className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-[11px]"
                      value={item}
                      onChange={(e) => handleListChange('required_qualifications_skills', i, e.target.value)}
                    />
                    <button type="button" onClick={() => removeListItem('required_qualifications_skills', i)} className="opacity-0 group-hover:opacity-100 text-rose-500">×</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Good to have</h3>
                <button 
                  type="button"
                  onClick={() => addListItem('good_to_have')}
                  className="text-xs font-bold text-violet-600"
                >
                  +
                </button>
              </div>
              <div className="space-y-1.5">
                {data.good_to_have.map((item, i) => (
                  <div key={i} className="flex gap-1 group">
                    <input 
                      className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-[11px]"
                      value={item}
                      onChange={(e) => handleListChange('good_to_have', i, e.target.value)}
                    />
                    <button type="button" onClick={() => removeListItem('good_to_have', i)} className="opacity-0 group-hover:opacity-100 text-rose-500">×</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleApprove}
                className="w-full py-3 bg-violet-600 text-white rounded-xl font-black text-sm shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all"
              >
                Approve & Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
