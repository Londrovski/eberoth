// DM-only edits to published session (Campaign History) content.
// RLS on these tables is is_dm()/dm-jwt for ALL commands, so the DM
// can write directly from the client. Used by SessionReadView's edit mode.
import { supabase } from 'boot/supabase';

export async function updateBlockText(id, text) {
  const { error } = await supabase
    .from('session_blocks')
    .update({ text })
    .eq('id', id);
  if (error) throw error;
}

export async function updateBlockType(id, type) {
  const { error } = await supabase
    .from('session_blocks')
    .update({ type })
    .eq('id', id);
  if (error) throw error;
}

export async function updateSummaryLine(id, line) {
  const { error } = await supabase
    .from('session_summary_lines')
    .update({ line })
    .eq('id', id);
  if (error) throw error;
}
