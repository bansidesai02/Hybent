import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { MessageSquare, Plus, Users } from 'lucide-react'

import { adminApi } from '@/api/admin'
import type { User } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { useMessageStore } from '@/store/messageStore'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
} from '@/components/hb'

/**
 * The admin's view of everyone inside the organisation.
 *
 * Rebuilt on the design system in phase 9. Three things beyond appearance:
 *
 * - `RoleBadge` and its three-hex `ROLE_STYLE` map were defined at the top of
 *   the file and never rendered, so a page called "Team" showed no roles at
 *   all — you could not tell an admin from an interviewer. The role is now on
 *   every row, as a `Badge`.
 * - The row hover wrote `element.style.borderColor` from two mouse handlers,
 *   which is the hover state `Card variant="interactive"` already provides and
 *   which never fired for keyboard users.
 * - The "Message" button drew its chat bubble as a hand-written inline `<svg>`
 *   path while the rest of the product uses lucide.
 */

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  recruiter: 'HR / Recruiter',
  interviewer: 'Interviewer',
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'recruiter', label: 'HR / Recruiter' },
  { value: 'interviewer', label: 'Interviewer' },
]

// ─── Invite dialog ────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  full_name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  role: z.string().min(1, 'Role required'),
  password: z.string().min(8, 'Min 8 characters'),
})
type InviteForm = z.infer<typeof inviteSchema>

function InviteDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
  })
  const mutation = useMutation({
    mutationFn: (data: InviteForm) => adminApi.inviteUser(data),
    onSuccess,
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title="Invite a team member"
      description="They will be able to sign in with the temporary password you set here."
      size="sm"
      footer={
        <>
          <Button variant="quiet" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            form="invite-member"
            loading={isSubmitting || mutation.isPending}
          >
            Send invite
          </Button>
        </>
      }
    >
      <form
        id="invite-member"
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-hb-4"
      >
        <Input
          label="Full name"
          placeholder="Jane Smith"
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <Input
          label="Email"
          type="email"
          placeholder="jane@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <Select
              label="Role"
              placeholder="Select role"
              options={ROLES}
              error={errors.role?.message}
              {...field}
            />
          )}
        />
        <Input
          label="Temporary password"
          type="password"
          placeholder="Min 8 characters"
          error={errors.password?.message}
          {...register('password')}
        />
        {mutation.isError && (
          <p role="alert" className="text-hb-sm text-hb-error">
            Failed to invite user. The email may already be registered.
          </p>
        )}
      </form>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeamManagementPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const [showInvite, setShowInvite] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const openChat = useMessageStore(s => s.openChat)

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => adminApi.listUsers().then((r) => r.data),
  })

  const teamMembers = (users ?? []).filter(u => u.role !== 'candidate')

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminApi.updateUser(id, { is_active }),
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(is_active ? 'User activated' : 'User deactivated')
      setToggleTarget(null)
    },
    onError: () => toast.error('Failed to update user status'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted permanently')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete user'),
  })

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Admin"
        title="Team"
        description="Everyone inside your organisation — admins, HR recruiters and interviewers."
        actions={
          currentUser?.role === 'admin' ? (
            <Button icon={<Plus size={15} />} onClick={() => setShowInvite(true)}>
              Invite member
            </Button>
          ) : undefined
        }
      />

      <Card padding="loose">
        <CardHeader
          title="Members"
          subtitle="Admins, HR recruiters and interviewers."
          action={!isLoading ? <Badge tone="info">{teamMembers.length}</Badge> : undefined}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[74px] w-full" rounded="md" />
            ))}
          </div>
        ) : teamMembers.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No members yet"
            description="Invite someone to get started."
            action={
              currentUser?.role === 'admin'
                ? { label: 'Invite member', onClick: () => setShowInvite(true) }
                : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {teamMembers.map((member, i) => {
              const isSelf = currentUser?.id === member.id
              const canManage = currentUser?.role === 'admin' && !isSelf

              return (
                <motion.li
                  key={member.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card
                    variant="interactive"
                    padding="compact"
                    className="flex flex-col items-start gap-hb-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex w-full min-w-0 flex-1 items-center gap-3.5">
                      <span className="relative shrink-0">
                        <Avatar name={member.full_name} src={member.avatar_url} size="md" />
                        <span
                          title={member.is_active ? 'Active' : 'Deactivated'}
                          className={`absolute -bottom-px -right-px h-3 w-3 rounded-full border-2 border-hb-surface ${
                            member.is_active ? 'bg-hb-success' : 'bg-hb-dim'
                          }`}
                        >
                          <span className="sr-only">
                            {member.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </span>
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-hb-sm font-semibold text-hb-text">
                            {member.full_name}
                          </p>
                          {isSelf && <Badge tone="brand">You</Badge>}
                          <Badge>{ROLE_LABEL[member.role] ?? member.role}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-hb-xs text-hb-muted">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center justify-end gap-2 pl-[54px] sm:w-auto sm:pl-0">
                      {!isSelf && member.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<MessageSquare size={14} />}
                          onClick={() =>
                            openChat({
                              id: member.id,
                              full_name: member.full_name,
                              avatar_url: member.avatar_url,
                            })
                          }
                        >
                          Message
                        </Button>
                      )}

                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant={member.is_active ? 'danger' : 'ghost'}
                            onClick={() => setToggleTarget(member)}
                          >
                            {member.is_active ? 'Deactivate' : 'Activate'}
                          </Button>

                          {/* Deletion is permanent, so it is only offered once
                              the softer step — deactivation — has been taken. */}
                          {!member.is_active && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setDeleteTarget(member)}
                            >
                              Delete
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                </motion.li>
              )
            })}
          </ul>
        )}
      </Card>

      {showInvite && (
        <InviteDialog
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setShowInvite(false)
            toast.success('Invitation sent successfully')
          }}
        />
      )}

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() =>
          toggleTarget &&
          toggleActiveMutation.mutate({ id: toggleTarget.id, is_active: !toggleTarget.is_active })
        }
        title={toggleTarget?.is_active ? 'Deactivate user' : 'Activate user'}
        description={
          toggleTarget?.is_active
            ? `Deactivate ${toggleTarget?.full_name}? They will no longer be able to log in.`
            : `Reactivate ${toggleTarget?.full_name}? They will regain access to the platform.`
        }
        confirmLabel={toggleTarget?.is_active ? 'Deactivate' : 'Activate'}
        destructive={toggleTarget?.is_active}
        loading={toggleActiveMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete user"
        description={`Permanently delete ${deleteTarget?.full_name}? This cannot be undone.`}
        confirmLabel="Delete permanently"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
