import { handleSupabaseError } from '@/lib/errors'
import type { Tag } from '@/types'
import { supabase } from './supabase'

export async function fetchTags(sala: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('sala', sala)
    .order('name')
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function createTag(tag: Omit<Tag, 'id'>): Promise<void> {
  const { error } = await supabase.from('tags').insert(tag)
  if (error) handleSupabaseError(error)
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) handleSupabaseError(error)
}
