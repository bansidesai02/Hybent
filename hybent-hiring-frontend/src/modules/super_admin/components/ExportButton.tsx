import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Download } from 'lucide-react'

import api from '@/api/axios'
import { Button } from '@/components/hb'

/** Downloads /v1/super-admin/exports/<kind> as a CSV file (the export is audited). */
export default function ExportButton({ kind }: { kind: 'clients' | 'users' | 'payments' }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const { data } = await api.get<Blob>(`/v1/super-admin/exports/${kind}`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `hybent-${kind}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="ghost" icon={<Download size={14} />} loading={busy} onClick={download}>
      Export CSV
    </Button>
  )
}
