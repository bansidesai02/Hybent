import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { ArrowLeft, UserPlus, LogOut, Crown, Shield, Trash2, Loader2 } from 'lucide-react'
import { Avatar, Button } from '@/components/hb'
import { chatApi, type ChatGroupDetail, type ChatGroupMember } from '@/api/messages'
import { useAuthStore } from '@/store/authStore'
import { MemberPicker } from './MemberPicker'

interface GroupMembersSheetProps {
  open: boolean
  onClose: () => void
  group: ChatGroupDetail
  onChanged: (group: ChatGroupDetail) => void
  onLeft: () => void
}

const errorDetail = (err: any, fallback: string) =>
  err?.response?.data?.detail || err?.response?.data?.message || fallback

function RoleChip({ role }: { role: ChatGroupMember['role'] }) {
  if (role === 'member') return null
  const owner = role === 'owner'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-hb-micro font-bold uppercase ${
        owner ? 'bg-hb-warning/15 text-hb-warning' : 'bg-hb-blue/10 text-hb-blue'
      }`}
    >
      {owner ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
      {role}
    </span>
  )
}

/** Slides over the chat panel: member list, add people, remove, leave. */
export function GroupMembersSheet({ open, onClose, group, onChanged, onLeft }: GroupMembersSheetProps) {
  const me = useAuthStore((s) => s.user)
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = async () => onChanged((await chatApi.getGroup(group.id)).data)

  const addMembers = async () => {
    if (!picked.length) return
    setBusy('add')
    try {
      const res = await chatApi.addMembers(group.id, picked)
      onChanged(res.data)
      toast.success(`${picked.length} member${picked.length > 1 ? 's' : ''} added`)
      setPicked([])
      setAdding(false)
    } catch (err) {
      toast.error(errorDetail(err, "Couldn't add members."))
    } finally {
      setBusy(null)
    }
  }

  const removeMember = async (m: ChatGroupMember) => {
    const isSelf = m.user_id === me?.id
    const ok = window.confirm(isSelf ? `Leave "${group.name}"?` : `Remove ${m.full_name} from "${group.name}"?`)
    if (!ok) return
    setBusy(m.user_id)
    try {
      await chatApi.removeMember(group.id, m.user_id)
      if (isSelf) {
        toast.success('You left the group')
        onLeft()
        return
      }
      await refresh()
      toast.success(`${m.full_name} removed`)
    } catch (err) {
      toast.error(errorDetail(err, "Couldn't update the group."))
    } finally {
      setBusy(null)
    }
  }

  const toggleAdmin = async (m: ChatGroupMember) => {
    setBusy(m.user_id)
    try {
      await chatApi.setMemberRole(group.id, m.user_id, m.role === 'admin' ? 'member' : 'admin')
      await refresh()
    } catch (err) {
      toast.error(errorDetail(err, "Couldn't change the role."))
    } finally {
      setBusy(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 260 }}
          className="absolute inset-0 z-20 flex flex-col bg-hb-surface"
          role="dialog"
          aria-label="Group members"
        >
          <div className="flex items-center gap-2 border-b border-hb-border bg-hb-surface-2 px-3 py-3 sm:px-4 sm:py-4">
            <button
              onClick={() => (adding ? setAdding(false) : onClose())}
              className="rounded-full p-2 text-hb-dim transition-colors hover:bg-hb-surface hover:text-hb-text"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-hb-body font-semibold text-hb-text">{adding ? 'Add people' : group.name}</h3>
              <p className="font-mono text-hb-micro font-bold uppercase text-hb-muted">
                {adding ? `${picked.length} selected` : `${group.member_count} members`}
              </p>
            </div>
          </div>

          {adding ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <MemberPicker selected={picked} onChange={setPicked} excludeIds={group.members.map((m) => m.user_id)} />
              </div>
              <div className="flex gap-2 border-t border-hb-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
                <Button variant="ghost" className="flex-1" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={addMembers} disabled={!picked.length} loading={busy === 'add'}>
                  Add {picked.length || ''}
                </Button>
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {group.description && (
                <p className="border-b border-hb-border px-4 py-3 text-hb-sm text-hb-muted sm:px-5">{group.description}</p>
              )}

              {group.can_add_members && !group.is_archived && (
                <button
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-3 border-b border-hb-border px-4 py-3 text-left text-hb-sm font-semibold text-hb-blue transition-colors hover:bg-hb-surface-2 sm:px-5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-hb-blue/10">
                    <UserPlus className="h-4 w-4" />
                  </span>
                  Add people
                </button>
              )}

              <ul className="divide-y divide-hb-border">
                {group.members.map((m) => {
                  const isSelf = m.user_id === me?.id
                  const canRemove = !isSelf && group.can_manage && m.role !== 'owner'
                  return (
                    <li key={m.user_id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <Avatar name={m.full_name} src={m.avatar_url || ''} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-hb-sm font-semibold text-hb-text">
                            {m.full_name}
                            {isSelf && <span className="font-normal text-hb-dim"> (you)</span>}
                          </span>
                          <RoleChip role={m.role} />
                        </div>
                        <p className="truncate text-hb-xs capitalize text-hb-muted">{m.user_role.replace('_', ' ')}</p>
                      </div>
                      {busy === m.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-hb-dim" />
                      ) : (
                        <div className="flex shrink-0 items-center gap-0.5">
                          {group.can_manage && !isSelf && m.role !== 'owner' && (
                            <button
                              onClick={() => toggleAdmin(m)}
                              className="rounded-full p-2 text-hb-dim transition-colors hover:bg-hb-surface-2 hover:text-hb-blue"
                              title={m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                              aria-label={m.role === 'admin' ? `Remove admin from ${m.full_name}` : `Make ${m.full_name} admin`}
                            >
                              <Shield className="h-4 w-4" />
                            </button>
                          )}
                          {canRemove && (
                            <button
                              onClick={() => removeMember(m)}
                              className="rounded-full p-2 text-hb-dim transition-colors hover:bg-hb-error/10 hover:text-hb-error"
                              title="Remove from group"
                              aria-label={`Remove ${m.full_name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>

              {group.my_role !== 'none' && me && (
                <button
                  onClick={() => {
                    const self = group.members.find((m) => m.user_id === me.id)
                    if (self) removeMember(self)
                  }}
                  className="flex w-full items-center gap-3 border-t border-hb-border px-4 py-3.5 text-left text-hb-sm font-semibold text-hb-error transition-colors hover:bg-hb-error/5 sm:px-5"
                >
                  <LogOut className="h-4 w-4" />
                  Leave group
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
