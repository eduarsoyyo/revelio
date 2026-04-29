import { useEffect, useRef, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/data/supabase'
import { logger } from '@/lib/logger'

/**
 * Supabase Broadcast channel for real-time collaboration (retros).
 * Mirrors the v1 useRealtime hook interface.
 */
export function useRealtime<T = unknown>(
  channelName: string,
  event: string,
  onMessage: (payload: T) => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const channel = supabase.channel(channelName)

    channel.on('broadcast', { event }, ({ payload }) => {
      onMessage(payload as T)
    })

    channel.subscribe((status) => {
      logger.info(`Realtime [${channelName}]:`, status)
    })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [channelName, event, onMessage])

  const broadcast = useCallback(
    (payload: T) => {
      channelRef.current?.send({ type: 'broadcast', event, payload })
    },
    [event],
  )

  return { broadcast }
}
