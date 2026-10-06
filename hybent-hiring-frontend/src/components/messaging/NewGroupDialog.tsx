import { useState } from 'react'
import toast from 'react-hot-toast'
import { Dialog, Button, Field, Input, Textarea } from '@/components/hb'
import { chatApi } from '@/api/messages'
import { useMessageStore } from '@/store/messageStore'
import { MemberPicker } from './MemberPicker'

export function NewGroupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setName('')
    setDescription('')
    setMemberIds([])
  }
  const close = () => {
    if (saving) return
    reset()
    onClose()
  }

  const canCreate = name.trim().length > 0 && memberIds.length > 0 && !saving

  const create = async () => {
    if (!canCreate) return
    setSaving(true)
    try {
      const res = await chatApi.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        member_ids: memberIds,
      })
      const store = useMessageStore.getState()
      store.upsertGroup(res.data)
      store.openGroup({ id: res.data.id, name: res.data.name })
      toast.success(`Group "${res.data.name}" created`)
      reset()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.message || "Couldn't create the group.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New group"
      description="Bring recruiters and admins together in one conversation. Only members can see it."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!canCreate} loading={saving}>
            Create group{memberIds.length ? ` (${memberIds.length + 1})` : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Group name"
          required
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Frontend hiring squad"
          autoFocus
        />
        <Textarea
          label="Description (optional)"
          value={description}
          maxLength={500}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this group for?"
        />
        <Field label="Members" description="Pick at least one teammate.">
          {() => <MemberPicker selected={memberIds} onChange={setMemberIds} />}
        </Field>
      </div>
    </Dialog>
  )
}
