import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarDays, Camera, FileText, Loader2, Save } from 'lucide-react'

import { portalApi } from '@/api/portal'
import { useAuthStore } from '@/store/authStore'
import ImageCropperModal from '@/components/common/ImageCropperModal'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Dropzone,
  Input,
  Meter,
  PageHeader,
  Skeleton,
  TagInput,
  Textarea,
} from '@/components/hb'

/**
 * The candidate's own profile: identity, compensation, availability, résumé,
 * skills.
 *
 * Rebuilt on the design system in phase 7. Beyond appearance:
 *
 * - Every validation failure and outcome was a `window.alert`/`window.confirm`
 *   (five of them). Toasts and a `ConfirmDialog` now.
 * - The résumé drop target was a hand-rolled `.upload-zone` div with a click
 *   handler — not focusable, not announced. It is the design system's
 *   `Dropzone`, which is a real button.
 * - Skills were a chip row with an inline `<input className="skill-tag add">`;
 *   they are `TagInput`.
 * - The form still submits via `FormData` over uncontrolled inputs — that
 *   behaviour is kept, since it works and touching every field's state model
 *   is not a redesign concern.
 */

function completionPercent(data: any): number {
  const fields = [
    !!data.full_name,
    !!data.phone,
    !!data.location,
    !!data.linkedin_url,
    !!data.github_url,
    !!data.summary,
    data.skills?.length > 0,
    !!data.resume_url || !!data.resume_storage_path,
    !!data.experience_years,
    !!data.current_ctc,
    !!data.availability_status,
  ]
  return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}

export default function PortalProfilePage() {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { user, setUser } = useAuthStore()
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [confirmRemovePhoto, setConfirmRemovePhoto] = useState(false)

  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['portal', 'profile'],
    queryFn: () => portalApi.profile().then((r: any) => r.data),
  })

  const [skills, setSkills] = useState<string[]>([])

  useEffect(() => {
    if (profile) setSkills(profile.skills || profile.tags || [])
  }, [profile])

  // ── Resume upload ──────────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: (file: File) => portalApi.uploadResume(file),
    onSuccess: () => {
      setUploadError(null)
      toast.success('Resume uploaded and parsed')
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
    },
    onError: (err: any) => {
      setUploadError(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          'Upload failed. Please try again.'
      )
    },
  })

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const avatarMutation = useMutation({
    mutationFn: (file: File) => portalApi.uploadAvatar(file),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
      // Also sync auth store so the topbar avatar updates instantly
      if (res?.data) setUser(res.data)
    },
    onError: () => toast.error('Failed to upload avatar. JPG, PNG or WEBP under 5 MB only.'),
  })

  const deleteAvatarMutation = useMutation({
    mutationFn: () => portalApi.deleteAvatar(),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
      if (res?.data) setUser(res.data)
      setConfirmRemovePhoto(false)
    },
  })

  const handleAvatarFile = (file: File | undefined) => {
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      toast.error('Only JPG, PNG, WEBP or GIF images are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large. Maximum size is 5 MB.')
      return
    }

    const reader = new FileReader()
    reader.addEventListener('load', () => setImageToCrop(reader.result as string))
    reader.readAsDataURL(file)
  }

  const saveMutation = useMutation({
    mutationFn: (data: any) => portalApi.updateProfile(data),
    onSuccess: () => {
      toast.success('Profile saved')
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
    },
    onError: (err: any) =>
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          'Failed to save profile. Please try again.'
      ),
  })

  const handleSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saveMutation.isPending) return
    const formData = new FormData(e.currentTarget)
    const data: Record<string, any> = Object.fromEntries(formData.entries())

    // Combine first and last name
    if (data.first_name || data.last_name) {
      data.full_name = `${data.first_name || ''} ${data.last_name || ''}`.trim()
      delete data.first_name
      delete data.last_name
    }

    data.tags = skills
    saveMutation.mutate(data)
  }

  const handleResumeFile = (file: File | undefined) => {
    if (!file || uploadMutation.isPending) return
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!allowed.includes(file.type)) {
      setUploadError('Only PDF, DOC, or DOCX files are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 5 MB.')
      return
    }
    setUploadError(null)
    uploadMutation.mutate(file)
  }

  async function openResume() {
    if (profile?.resume_storage_path) {
      try {
        const res = await portalApi.getResumeUrl()
        const data = (res.data as any)?.data ?? res.data
        if (data?.url) window.open(data.url, '_blank', 'noreferrer')
        else toast.error('Could not load the resume. Please try again.')
      } catch {
        toast.error('Could not load the resume. Please try again.')
      }
    } else if (profile?.resume_url) {
      window.open(profile.resume_url, '_blank', 'noreferrer')
    }
  }

  if (isLoading) {
    return (
      <div className="pb-hb-10">
        <Skeleton className="mb-hb-6 h-12 w-80" rounded="md" />
        <div className="grid gap-hb-5 lg:grid-cols-2">
          <Skeleton className="h-[560px] w-full" rounded="md" />
          <Skeleton className="h-[560px] w-full" rounded="md" />
        </div>
      </div>
    )
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'C'

  const pct = profile ? completionPercent(profile) : 0
  const isComplete = pct >= 80

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Candidate portal"
        title="My profile & resume"
        description="Keep your profile up to date to help interviewers understand you better."
      />

      <form onSubmit={handleSave} className="grid items-start gap-hb-5 lg:grid-cols-2">
        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <Card padding="loose">
          <CardHeader title="Profile" />

          <div className="mb-hb-5 flex items-start gap-4">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                title="Change photo"
                aria-label="Change profile photo"
                className="group relative grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-hb-grad font-display text-hb-h2 text-white focus-visible:outline-none focus-visible:shadow-hb-ring"
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-hb group-hover:opacity-100 group-focus-visible:opacity-100">
                  {avatarMutation.isPending ? (
                    <Loader2 size={22} className="animate-spin" aria-hidden />
                  ) : (
                    <Camera size={20} aria-hidden />
                  )}
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="quiet"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
              >
                Upload
              </Button>
            </div>

            <div className="min-w-0">
              <h3 className="font-display text-hb-h2 text-hb-text">
                {profile?.full_name || 'Candidate'}
              </h3>
              {profile?.current_title && (
                <p className="mt-0.5 text-hb-sm text-hb-muted">{profile.current_title}</p>
              )}
              {profile?.organization_name && (
                <p className="text-hb-xs font-semibold text-hb-muted">
                  {profile.organization_name}
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge tone={isComplete ? 'success' : 'warning'} dot>
                  {isComplete ? 'Profile complete' : 'Incomplete'} ({pct}%)
                </Badge>
                <Badge tone="brand" dot>Active</Badge>
                {user?.avatar_url && (
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    onClick={() => setConfirmRemovePhoto(true)}
                    disabled={deleteAvatarMutation.isPending}
                  >
                    Remove photo
                  </Button>
                )}
              </div>
              <Meter value={pct} size="xs" aria-label="Profile completion" className="mt-3 max-w-[220px]" />
            </div>
          </div>

          <div className="space-y-hb-4">
            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Input
                label="First name"
                name="first_name"
                defaultValue={profile?.full_name?.split(' ')[0] || ''}
                placeholder="First"
              />
              <Input
                label="Last name"
                name="last_name"
                defaultValue={profile?.full_name?.split(' ').slice(1).join(' ') || ''}
                placeholder="Last"
              />
            </div>

            <Input
              label="Email"
              name="email"
              type="email"
              defaultValue={profile?.email || ''}
              placeholder="Email address"
            />

            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Input
                label="Phone"
                name="phone"
                type="tel"
                defaultValue={profile?.phone || ''}
                placeholder="+1 555-0000"
              />
              <Input
                label="Location"
                name="location"
                defaultValue={profile?.location || ''}
                placeholder="City, country"
              />
            </div>

            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Input
                label="Experience"
                name="experience_years"
                defaultValue={profile?.experience_years != null ? `${profile.experience_years} Years` : ''}
                placeholder="e.g. 5 years"
              />
              <Input
                label="Notice period"
                name="notice_period_days"
                defaultValue={profile?.notice_period_days != null ? `${profile.notice_period_days} Days` : ''}
                placeholder="e.g. 30 days"
              />
            </div>

            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Input
                label="Current CTC"
                name="current_ctc"
                defaultValue={profile?.current_ctc || ''}
                placeholder="e.g. ₹22,00,000"
              />
              <Input
                label="Expected CTC"
                name="expected_ctc"
                defaultValue={profile?.expected_ctc || ''}
                placeholder="e.g. ₹32,00,000"
              />
            </div>

            <Input
              label="You can join within"
              name="availability_status"
              defaultValue={profile?.availability_status || ''}
              placeholder="e.g. 15 days"
            />

            <div className="border-t border-hb-border pt-hb-4">
              <p className="mb-3 flex items-center gap-2 font-mono text-hb-label uppercase text-hb-dim">
                <CalendarDays size={13} aria-hidden className="text-hb-cyan" />
                Interview availability
              </p>
              <div className="grid gap-hb-4 sm:grid-cols-2">
                <Input
                  label="Preferred interview date"
                  type="date"
                  name="interview_availability_days"
                  defaultValue={
                    Array.isArray(profile?.interview_availability_days)
                      ? profile?.interview_availability_days[0]
                      : profile?.interview_availability_days || ''
                  }
                />
                <Input
                  label="Preferred time slot"
                  type="time"
                  name="interview_time_slot"
                  defaultValue={profile?.interview_time_slot || ''}
                />
              </div>
            </div>

            <div className="flex justify-end border-t border-hb-border pt-hb-4">
              <Button
                type="submit"
                icon={<Save size={15} />}
                loading={saveMutation.isPending}
                disabled={saveMutation.isPending}
              >
                Save profile
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Side column ─────────────────────────────────────────────────── */}
        <div className="space-y-hb-5">
          <Card padding="loose">
            <CardHeader title="Bio & summary" />
            <Textarea
              name="summary"
              defaultValue={profile?.summary || ''}
              placeholder="Tell us about yourself…"
              rows={5}
            />
          </Card>

          <Card padding="loose">
            <CardHeader title="Links & social" />
            <div className="space-y-hb-4">
              <Input
                label="LinkedIn"
                name="linkedin_url"
                defaultValue={profile?.linkedin_url || ''}
                placeholder="linkedin.com/in/"
              />
              <Input
                label="GitHub"
                name="github_url"
                defaultValue={profile?.github_url || ''}
                placeholder="github.com/"
              />
              <Input
                label="Portfolio"
                name="portfolio_url"
                defaultValue={profile?.portfolio_url || ''}
                placeholder="https://"
              />
            </div>
          </Card>

          <Card padding="loose">
            <CardHeader title="Resume" action={<Badge tone="brand">Required</Badge>} />

            {(profile?.resume_storage_path || profile?.resume_url) && (
              <button
                type="button"
                onClick={openResume}
                className="mb-hb-4 flex w-full items-center gap-2.5 rounded-hb-md border border-hb-success/25 bg-hb-success/8 px-4 py-3 text-left text-hb-sm font-semibold text-hb-success transition-colors duration-hb hover:bg-hb-success/12 focus-visible:outline-none focus-visible:shadow-hb-ring"
              >
                <FileText size={15} aria-hidden className="shrink-0" />
                {profile?.resume_filename || 'View current résumé'}
              </button>
            )}

            {uploadError && (
              <p
                role="alert"
                className="mb-hb-4 rounded-hb-md border border-hb-error/25 bg-hb-error/8 px-3.5 py-2.5 text-hb-xs text-hb-error"
              >
                {uploadError}
              </p>
            )}

            <Dropzone
              onFiles={(files) => handleResumeFile(files[0])}
              accept=".pdf,.doc,.docx"
              title="Drop your résumé here"
              description="Parsed automatically to fill your profile."
              formats={['PDF', 'DOC', 'DOCX']}
              busy={uploadMutation.isPending}
              busyLabel="Uploading & parsing résumé…"
            />

            <div className="mt-hb-5">
              <TagInput
                label="Skills"
                value={skills}
                onChange={setSkills}
                placeholder="Add a skill and press Enter"
              />
            </div>
          </Card>
        </div>
      </form>

      <ConfirmDialog
        open={confirmRemovePhoto}
        onClose={() => setConfirmRemovePhoto(false)}
        onConfirm={() => {
          if (!deleteAvatarMutation.isPending) deleteAvatarMutation.mutate()
        }}
        title="Remove profile photo?"
        description="Your initials will be shown instead."
        confirmLabel="Remove photo"
        destructive
        loading={deleteAvatarMutation.isPending}
      />

      {imageToCrop && (
        <ImageCropperModal
          image={imageToCrop}
          onCropComplete={(croppedFile: File) => {
            if (avatarMutation.isPending) return
            avatarMutation.mutate(croppedFile)
            setImageToCrop(null)
          }}
          onCancel={() => setImageToCrop(null)}
        />
      )}
    </div>
  )
}
