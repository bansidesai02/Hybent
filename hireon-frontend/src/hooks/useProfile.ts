/**
 * useProfile — React Query hook for GET/PUT /v1/users/me
 * Works for ALL authenticated roles: recruiter, interviewer, admin.
 *
 * FIX: Query key includes the logged-in user's ID so each user gets their own
 * isolated cache entry. Without this, a stale cache from a previously logged-in
 * user (e.g. Carol Interviewer) would show up on the next user's profile page.
 *
 * On successful update it also syncs the Zustand auth store so the
 * navbar/header reflects the new name/avatar instantly.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi, type ProfileUpdatePayload } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { User } from '@/types'

export function useProfileQueryKey(userId?: string) {
  return ['profile', 'me', userId ?? 'anonymous'] as const
}

export function useProfile() {
  const queryClient = useQueryClient()
  const { user: authUser, setUser } = useAuthStore()

  // Include user ID in query key — each user gets their own isolated cache
  const queryKey = useProfileQueryKey(authUser?.id)

  // ── GET profile ────────────────────────────────────────────────────────────
  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useQuery<User>({
    queryKey,
    queryFn: async () => {
      const { data } = await profileApi.getMe()
      return data as User
    },
    staleTime: 0,           // Always re-fetch on mount — prevents cross-user stale data
    gcTime: 10 * 60 * 1000, // Keep in garbage-collection cache for 10 min
    retry: 1,
    enabled: !!authUser?.id, // Only run when a user is actually logged in
  })

  // ── PUT profile (name / avatar_url) ────────────────────────────────────────
  const updateMutation = useMutation<User, Error, ProfileUpdatePayload>({
    mutationFn: async (payload) => {
      const { data } = await profileApi.updateMe(payload)
      return data as User
    },
    onSuccess: (updatedUser) => {
      // Keep React Query cache fresh with user-scoped key
      queryClient.setQueryData(queryKey, updatedUser)
      // Sync Zustand store so header/avatar update instantly without reload
      setUser(updatedUser)
      toast.success('Profile updated successfully!')
    },
    onError: () => {
      toast.error('Failed to update profile. Please try again.')
    },
  })

  // ── POST avatar upload ─────────────────────────────────────────────────────
  const avatarMutation = useMutation<User, Error, File>({
    mutationFn: async (file) => {
      const { data } = await profileApi.uploadAvatar(file)
      return data as User
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(queryKey, updatedUser)
      setUser(updatedUser)
      toast.success('Avatar updated!')
    },
    onError: () => {
      toast.error('Failed to upload avatar. Only JPG, PNG, WEBP under 5 MB are allowed.')
    },
  })

  return {
    /** The live profile data from API (always fresh for the logged-in user) */
    profile,
    isLoading,
    isError,
    refetch,

    /** updateProfile({ full_name?, avatar_url? }) */
    updateProfile: updateMutation.mutate,
    isUpdating: updateMutation.isPending,

    /** uploadAvatar(File) */
    uploadAvatar: avatarMutation.mutate,
    isUploadingAvatar: avatarMutation.isPending,
  }
}
