import { handleSupabaseError } from '@/lib/errors'
import type { Retro } from '@/types'
import { supabase } from './supabase'

export async function fetchRetro(sala: string): Promise<Retro | null> {
  const { data, error } = await supabase
    .from('retros')
    .select('*')
    .eq('sala', sala)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) handleSupabaseError(error)
  return data
}

export async function saveRetro(retro: Retro): Promise<void> {
  // Rule #9: auto-save loads DB first, prefers richer data
  const { data: current } = await supabase
    .from('retros')
    .select('data, updated_at')
    .eq('id', retro.id)
    .single()

  const serverData = current?.data as Retro['data'] | undefined
  const merged = mergeRetroData(serverData, retro.data)

  const { error } = await supabase
    .from('retros')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('id', retro.id)
  if (error) handleSupabaseError(error)
}

/**
 * Merge strategy: prefer the version with more content.
 * Simple heuristic — will be refined in later phases.
 */
function mergeRetroData(
  server: Retro['data'] | undefined,
  local: Retro['data'],
): Retro['data'] {
  if (!server) return local
  const serverSize = JSON.stringify(server).length
  const localSize = JSON.stringify(local).length
  return localSize >= serverSize ? local : server
}
