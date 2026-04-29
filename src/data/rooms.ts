import { handleSupabaseError } from '@/lib/errors'
import type { Room } from '@/types'
import { supabase } from './supabase'

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase.from('rooms').select('*').order('name')
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function createRoom(room: Omit<Room, 'metadata'> & { metadata?: Record<string, unknown> }): Promise<void> {
  const { error } = await supabase.from('rooms').insert(room)
  if (error) handleSupabaseError(error)
}

export async function deleteRoom(slug: string): Promise<void> {
  const { error } = await supabase.from('rooms').delete().eq('slug', slug)
  if (error) handleSupabaseError(error)
}
