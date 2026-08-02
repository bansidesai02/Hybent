import { useState } from 'react'
import { FileDown, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { aiApi } from '@/api/ai'
import { Button, Card, CardHeader, Dialog, Input, Textarea } from '@/components/hb'

interface JDData {
  title: string
  location: string
  experience: string
  key_responsibilities: string[]
  required_qualifications_skills: string[]
  good_to_have: string[]
  description: string
}

type ListField = 'key_responsibilities' | 'required_qualifications_skills' | 'good_to_have'

const blankJD = (): JDData => ({
  title: '',
  location: '',
  experience: '',
  key_responsibilities: [],
  required_qualifications_skills: [],
  good_to_have: [],
  description: '',
})

interface AIJDReviewModalProps {
  open: boolean
  onClose: () => void
  data: JDData | null
  onApply: (approvedData: JDData) => void
}

/**
 * One card per list: add, edit in place, remove. The three lists differ only in
 * what they contain, so they get one appearance — the sidebar lists are not a
 * quieter variant of the responsibilities list.
 */
function EditableList({
  title,
  itemNoun,
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  title: string
  /** Singular, lowercase — used to name each row for assistive tech. */
  itemNoun: string
  items: string[]
  onAdd: () => void
  onChange: (index: number, value: string) => void
  onRemove: (index: number) => void
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <Button
            variant="quiet"
            size="sm"
            icon={<Plus size={14} />}
            aria-label={`Add ${itemNoun}`}
            onClick={onAdd}
          >
            Add
          </Button>
        }
      />
      {items.length === 0 ? (
        <p className="text-hb-sm text-hb-muted">Nothing added yet.</p>
      ) : (
        <ul className="space-y-hb-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-hb-2">
              <Input
                aria-label={`${itemNoun} ${i + 1}`}
                fieldClassName="flex-1 min-w-0"
                value={item}
                onChange={(e) => onChange(i, e.target.value)}
              />
              <Button
                variant="quiet"
                size="sm"
                className="shrink-0 w-8 px-0"
                aria-label={`Remove ${itemNoun} ${i + 1}`}
                icon={<X size={15} />}
                onClick={() => onRemove(i)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function AIJDReviewModal({ open, onClose, data: initialData, onApply }: AIJDReviewModalProps) {
  // Use local state for editing
  const [data, setData] = useState<JDData>(initialData || blankJD())

  // Sync state if initialData changes (when generation completes)
  const [lastInitialData, setLastInitialData] = useState<JDData | null>(null)
  if (initialData !== lastInitialData) {
    setData(initialData || blankJD())
    setLastInitialData(initialData)
  }

  const [isExporting, setIsExporting] = useState(false)

  const handleFieldChange = (field: keyof JDData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const handleListChange = (field: ListField, index: number, value: string) => {
    const newList = [...data[field]]
    newList[index] = value
    setData(prev => ({ ...prev, [field]: newList }))
  }

  const addListItem = (field: ListField) => {
    setData(prev => ({ ...prev, [field]: [...prev[field], ''] }))
  }

  const removeListItem = (field: ListField, index: number) => {
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
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title="Review AI Generated JD"
      description="Review and refine the AI output before applying it to your job opening."
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={<FileDown size={15} />}
            loading={isExporting}
            onClick={handleExportPDF}
          >
            {isExporting ? 'Exporting…' : 'Export PDF'}
          </Button>
          <Button size="sm" onClick={handleApprove}>
            Approve &amp; Apply
          </Button>
        </>
      }
    >
      <div className="grid gap-hb-6 md:grid-cols-3 pb-hb-2">
        <div className="md:col-span-2 space-y-hb-6">
          <Card>
            <CardHeader title="Core Information" />
            <div className="space-y-hb-4">
              <Input
                label="Job Position"
                value={data.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
              />

              <div className="grid gap-hb-4 sm:grid-cols-2">
                <Input
                  label="Location"
                  value={data.location}
                  onChange={(e) => handleFieldChange('location', e.target.value)}
                />
                <Input
                  label="Experience"
                  placeholder="e.g. 3+ Years"
                  value={data.experience}
                  onChange={(e) => handleFieldChange('experience', e.target.value)}
                />
              </div>

              <Textarea
                label="Job Description"
                value={data.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
              />
            </div>
          </Card>

          <EditableList
            title="Key Responsibilities"
            itemNoun="responsibility"
            items={data.key_responsibilities}
            onAdd={() => addListItem('key_responsibilities')}
            onChange={(i, value) => handleListChange('key_responsibilities', i, value)}
            onRemove={(i) => removeListItem('key_responsibilities', i)}
          />
        </div>

        <div className="space-y-hb-6">
          <EditableList
            title="Qualifications"
            itemNoun="qualification"
            items={data.required_qualifications_skills}
            onAdd={() => addListItem('required_qualifications_skills')}
            onChange={(i, value) => handleListChange('required_qualifications_skills', i, value)}
            onRemove={(i) => removeListItem('required_qualifications_skills', i)}
          />

          <EditableList
            title="Good to have"
            itemNoun="good-to-have skill"
            items={data.good_to_have}
            onAdd={() => addListItem('good_to_have')}
            onChange={(i, value) => handleListChange('good_to_have', i, value)}
            onRemove={(i) => removeListItem('good_to_have', i)}
          />
        </div>
      </div>
    </Dialog>
  )
}
