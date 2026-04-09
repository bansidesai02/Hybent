import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { organizationsApi } from '@/api/organizations'
import { authApi, profileApi } from '@/api/auth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { clsx } from 'clsx'
import Cropper from 'react-easy-crop'
import getCroppedImg from '@/utils/cropImage'
import type { Organization } from '@/types'

export default function RecruiterSettingsPage() {
  const { user, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── States ──────────────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [isPasswordChanging, setIsPasswordChanging] = useState(false)
  
  // Cropper specific state
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [isCropping, setIsCropping] = useState(false)

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const { data: organization, isLoading: orgLoading } = useQuery({
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

  const onCropComplete = (_: any, croppedAreaPixels: any) => {
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20 pt-4">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
            Manage your {isAdmin ? 'company' : 'account'} preferences and security settings.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full">
          <span className={clsx("w-2 h-2 rounded-full animate-pulse", isAdmin ? "bg-violet-500" : "bg-emerald-500")}></span>
          Role: {user?.role || 'User'}
        </div>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-4xl mx-auto space-y-8"
      >
        {/* Admin Section: Company Details */}
        {isAdmin && (
          <motion.div variants={itemVariants} className="bg-white dark:bg-[#0f111a] rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-none overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">Company Details</h3>
                <p className="text-[11px] text-gray-400 font-bold mt-0.5">MANAGE YOUR ORGANIZATION ASSETS</p>
              </div>
              <span className="text-2xl">🏢</span>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Logo Upload */}
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="relative group">
                  <div 
                    onClick={onLogoClick}
                    className="w-24 h-24 rounded-3xl bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-[#6c47ff] group-hover:shadow-lg"
                  >
                    {organization?.logo_url ? (
                      <img src={organization.logo_url} alt="logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <span className="text-2xl opacity-40 group-hover:scale-110 transition-transform">📸</span>
                    )}
                    
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-white text-[10px] font-black uppercase tracking-widest">Update</span>
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
                
                <div className="flex-1 space-y-4 w-full">
                  <div>
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Organization Name</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="flex-1 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-[#6c47ff]/20 outline-none transition-all"
                        placeholder="Acme Inc."
                      />
                      <button 
                        onClick={handleUpdateOrg}
                        className="bg-[#6c47ff] text-white px-6 rounded-2xl text-xs font-black shadow-lg shadow-violet-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-[1px] transition-all disabled:opacity-50"
                        disabled={updateOrgMutation.isPending || !orgName || orgName === organization?.name}
                      >
                        {updateOrgMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Common Section: Account Security */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-[#0f111a] rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-none overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">Account Security</h3>
              <p className="text-[11px] text-gray-400 font-bold mt-0.5">PROTECT YOUR ACCOUNT ACCESS</p>
            </div>
            <span className="text-2xl">🔒</span>
          </div>

          <div className="p-8 space-y-10">
            {/* Recovery Email */}
            <div>
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Recovery Email Address</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative group">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg opacity-40 group-focus-within:opacity-100 transition-opacity">📧</span>
                  <input 
                    type="email" 
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl pl-12 pr-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-[#6c47ff]/20 outline-none transition-all"
                    placeholder="backup@email.com"
                  />
                </div>
                <button 
                  onClick={handleUpdateRecoveryEmail}
                  disabled={updateProfileMutation.isPending || !recoveryEmail || recoveryEmail === user?.recovery_email}
                  className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-6 py-4 rounded-2xl text-xs font-black hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
                >
                  {updateProfileMutation.isPending ? 'Updating...' : 'Update Email'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 font-medium mt-3 px-1">Used for password recovery and critical security alerts.</p>
            </div>

            <div className="h-px bg-gray-50 dark:bg-gray-800" />

            {/* Password Change */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-black text-gray-900 dark:text-white">Change Password</h4>
                <button 
                  onClick={() => setIsPasswordChanging(!isPasswordChanging)}
                  className="text-[11px] font-black text-[#6c47ff] uppercase tracking-wider"
                >
                  {isPasswordChanging ? 'Cancel' : 'Edit'}
                </button>
              </div>

              <AnimatePresence>
                {isPasswordChanging && (
                  <motion.form 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    onSubmit={handlePasswordSubmit}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="grid sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Current Password</label>
                        <input 
                          type="password"
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:border-[#6c47ff] transition-colors"
                        />
                      </div>
                      <div />
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">New Password</label>
                        <input 
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:border-[#6c47ff] transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Confirm New Password</label>
                        <input 
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:border-[#6c47ff] transition-colors"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button 
                        type="submit"
                        className="bg-[#6c47ff] text-white px-8 py-3.5 rounded-2xl text-[11px] font-black shadow-lg shadow-violet-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all"
                        disabled={changePasswordMutation.isPending}
                      >
                        {changePasswordMutation.isPending ? 'UPDATING...' : 'UPDATE PASSWORD'}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
        <div className="h-20" />
      </motion.div>

      {/* ── Cropper Modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCropping && tempImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelCrop}
              className="absolute inset-0 bg-[#02040a]/90 backdrop-blur-md" 
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#0f111a] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[80vh] sm:h-[600px]"
            >
              <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">Adjust Logo</h3>
                  <p className="text-[11px] text-gray-400 font-bold mt-0.5">CROP AND POSITION YOUR IMAGE</p>
                </div>
                <button 
                  onClick={handleCancelCrop}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="relative flex-1 bg-gray-950">
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
              </div>

              <div className="px-8 py-8 border-t border-gray-100 dark:border-gray-800 space-y-6 shrink-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    <span>Zoom Level</span>
                    <span>{Math.round(zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#6c47ff]"
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handleCancelCrop}
                    className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-all border border-gray-100 dark:border-gray-800"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleApplyCrop}
                    disabled={uploadLogoMutation.isPending}
                    className="flex-[2] bg-[#6c47ff] text-white px-8 py-4 rounded-2xl text-xs font-black shadow-xl shadow-violet-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-[1px] transition-all disabled:opacity-50"
                  >
                    {uploadLogoMutation.isPending ? 'Uploading...' : 'Apply Image'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
