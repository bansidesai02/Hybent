import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import { Building2, Camera, Mail, ShieldCheck } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { organizationsApi } from '@/api/organizations'
import { authApi, profileApi } from '@/api/auth'
import getCroppedImg from '@/utils/cropImage'
import type { Organization } from '@/types'
import { EmailAccountsSection } from '@/modules/recruiter/components/EmailAccountsSection'
import { PersonalMailboxCard } from '@/modules/recruiter/components/PersonalMailboxCard'
import {
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  Dialog,
  IconTile,
  Input,
  Label,
  PageHeader,
} from '@/components/hb'

/**
 * Company and account settings.
 *
 * Rebuilt on the design system. Three things here were broken rather than just
 * off-brand: the logo target was a `<div onClick>` with a hidden file input, so
 * it could not be reached or fired from a keyboard; the crop modal was a
 * hand-rolled `fixed inset-0` overlay with no focus trap, no Escape and an
 * unlabelled `✕` button, and is now `Dialog`; and the zoom slider carried
 * `aria-labelledby="Zoom"` pointing at an id that does not exist, so it was
 * announced with no name at all.
 *
 * The role chip no longer switches between violet and emerald on `isAdmin` —
 * the role it already spells out is the information, and the colour was
 * duplicating it in a palette that means nothing.
 */
export default function RecruiterSettingsPage() {
  const { user, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const zoomId = useId()
  const passwordPanelId = useId()

  // ── States ──────────────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [isPasswordChanging, setIsPasswordChanging] = useState(false)

  // Cropper specific state
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isCropping, setIsCropping] = useState(false)

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const { data: organization } = useQuery({
    queryKey: ['organization', 'me'],
    queryFn: () => organizationsApi.getMe().then(res => res.data),
    enabled: !!isAdmin,
  })

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name)
    }
  }, [organization])

  useEffect(() => {
    if (user?.recovery_email) {
      setRecoveryEmail(user.recovery_email)
    }
  }, [user])

  // ── Mutations ───────────────────────────────────────────────────────────────
  const updateOrgMutation = useMutation({
    mutationFn: (data: Partial<Organization>) => organizationsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
      toast.success('Company details updated')
    },
    onError: () => toast.error('Failed to update company details'),
  })

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => organizationsApi.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'me'] })
      toast.success('Logo updated successfully')
    },
    onError: () => toast.error('Failed to upload logo'),
  })

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setIsPasswordChanging(false)
    },
    onError: () => toast.error('Failed to change password. Check your current password.'),
  })

  /* `recovery_email` is not on `ProfileUpdatePayload`, so this stays loosely
     typed until the API type catches up. */
  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => profileApi.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
      toast.success('Profile updated successfully')
    },
    onError: () => toast.error('Failed to update profile'),
  })

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleUpdateOrg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) return
    updateOrgMutation.mutate({ name: orgName })
  }

  const onLogoClick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setTempImage(reader.result as string)
        setIsCropping(true)
      })
      reader.readAsDataURL(file)
    }
  }

  const onCropComplete = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const handleApplyCrop = async () => {
    if (!tempImage || !croppedAreaPixels) return

    try {
      const croppedImageBlob = await getCroppedImg(tempImage, croppedAreaPixels)
      if (croppedImageBlob) {
        const file = new File([croppedImageBlob], 'cropped-logo.jpg', { type: 'image/jpeg' })
        uploadLogoMutation.mutate(file)
        setIsCropping(false)
        setTempImage(null)
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to crop image')
    }
  }

  const handleCancelCrop = () => {
    setIsCropping(false)
    setTempImage(null)
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    changePasswordMutation.mutate()
  }

  const handleUpdateRecoveryEmail = () => {
    updateProfileMutation.mutate({ recovery_email: recoveryEmail })
  }

  return (
    <div className="mx-auto max-w-3xl pb-hb-10">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description={`Manage your ${isAdmin ? 'company' : 'account'} preferences and security settings.`}
        actions={<Badge tone="neutral">Role: {user?.role || 'User'}</Badge>}
      />

      <div className="space-y-hb-6">
        {/* Admin Section: Company Details */}
        {isAdmin && (
          <Card as="section">
            <CardHeader
              title="Company details"
              subtitle="Manage your organization's name and logo."
              icon={
                <IconTile size="sm">
                  <Building2 />
                </IconTile>
              }
            />

            <div className="flex flex-col items-start gap-hb-6 sm:flex-row">
              {/* Logo Upload */}
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={onLogoClick}
                  aria-label={organization?.logo_url ? 'Change company logo' : 'Upload company logo'}
                  className="group relative grid h-24 w-24 place-items-center overflow-hidden rounded-hb-md border border-dashed border-hb-border-strong bg-hb-surface-2 transition-colors duration-hb ease-hb hover:border-hb-blue/60 focus-visible:outline-none focus-visible:shadow-hb-ring"
                >
                  {organization?.logo_url ? (
                    <img src={organization.logo_url} alt="" className="h-full w-full object-contain p-2" />
                  ) : (
                    <Camera className="h-7 w-7 text-hb-dim" aria-hidden />
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-0 grid place-items-center bg-hb-surface/85 font-mono text-hb-label uppercase text-hb-text opacity-0 transition-opacity duration-hb ease-hb group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    Update
                  </span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
              </div>

              <div className="flex w-full flex-1 flex-col gap-hb-3 sm:flex-row sm:items-end">
                <Input
                  label="Organization name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Inc."
                  fieldClassName="w-full flex-1"
                />
                <Button
                  onClick={handleUpdateOrg}
                  loading={updateOrgMutation.isPending}
                  disabled={!orgName || orgName === organization?.name}
                >
                  Save
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Organization's shared mailboxes — visible to everyone, manageable by
            admins only (the component gates connect/disconnect/etc itself). */}
        <EmailAccountsSection />

        {/* A recruiter's own single mailbox — this page only ever renders for
            exactly 'admin' or 'recruiter' (route-guarded), so !isAdmin here
            unambiguously means recruiter. */}
        {!isAdmin && <PersonalMailboxCard />}

        {/* Common Section: Account Security */}
        <Card as="section">
          <CardHeader
            title="Account security"
            subtitle="Protect your account access."
            icon={
              <IconTile size="sm">
                <ShieldCheck />
              </IconTile>
            }
          />

          {/* Recovery Email */}
          <div className="flex flex-col gap-hb-3 sm:flex-row sm:items-end">
            <Input
              type="email"
              label="Recovery email address"
              description="Used for password recovery and critical security alerts."
              leadingIcon={<Mail size={15} />}
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="backup@email.com"
              fieldClassName="w-full flex-1"
            />
            <Button
              variant="ghost"
              onClick={handleUpdateRecoveryEmail}
              loading={updateProfileMutation.isPending}
              disabled={!recoveryEmail || recoveryEmail === user?.recovery_email}
            >
              Update email
            </Button>
          </div>

          <CardDivider />

          {/* Password Change */}
          <div>
            <div className="flex items-center justify-between gap-hb-4">
              <h4 className="font-display text-hb-h3 text-hb-text">Change password</h4>
              <Button
                variant="quiet"
                size="sm"
                aria-expanded={isPasswordChanging}
                /* Only pointed at the panel while it exists — a dangling
                   `aria-controls` is the same defect as the old dangling
                   `aria-labelledby` on the zoom slider. */
                aria-controls={isPasswordChanging ? passwordPanelId : undefined}
                onClick={() => setIsPasswordChanging(!isPasswordChanging)}
              >
                {isPasswordChanging ? 'Cancel' : 'Edit'}
              </Button>
            </div>

            {isPasswordChanging && (
              <form id={passwordPanelId} onSubmit={handlePasswordSubmit} className="mt-hb-5 space-y-hb-5">
                {/* `col-start-1` puts the new/confirm pair on their own row without
                    the empty grid cell the old markup used as a spacer. */}
                <div className="grid gap-hb-4 sm:grid-cols-2">
                  <Input
                    type="password"
                    label="Current password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <Input
                    type="password"
                    label="New password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    fieldClassName="sm:col-start-1"
                  />
                  <Input
                    type="password"
                    label="Confirm new password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" loading={changePasswordMutation.isPending}>
                    Update password
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>
      </div>

      {/* ── Cropper Dialog ─────────────────────────────────────────────────────── */}
      <Dialog
        open={isCropping && !!tempImage}
        onClose={handleCancelCrop}
        title="Adjust logo"
        description="Crop and position your image."
        size="md"
        footer={
          <>
            <Button variant="quiet" onClick={handleCancelCrop}>
              Cancel
            </Button>
            <Button onClick={handleApplyCrop} loading={uploadLogoMutation.isPending}>
              Apply image
            </Button>
          </>
        }
      >
        <div className="space-y-hb-5">
          <div className="relative h-[320px] overflow-hidden rounded-hb-md border border-hb-border bg-hb-surface-2">
            {tempImage && (
              <Cropper
                image={tempImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                cropShape="round"
                showGrid={false}
              />
            )}
          </div>

          <div className="space-y-hb-2">
            <div className="flex items-center justify-between gap-hb-3">
              <Label htmlFor={zoomId}>Zoom level</Label>
              <span className="font-mono text-hb-micro text-hb-muted">{Math.round(zoom * 100)}%</span>
            </div>
            <input
              id={zoomId}
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              /* The readout beside the label is a percentage while the raw
                 value is 1–3, so without this a screen reader announces "2.1"
                 against a visible "210%". */
              aria-valuetext={`${Math.round(zoom * 100)}%`}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full cursor-pointer accent-hb-blue"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
