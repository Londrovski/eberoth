// Per-user notes attached to entities or sessions.
// One row per (user_email, entity_id). HTML body.
//
// Schema: user_notes (user_email text, entity_id text, html text, updated_at)
// RLS: read/write own rows; DM can read and write any row.
//
// fetch(entityId, emailOverride?) — pass a player email to read their note.
// save(entityId, html, emailOverride?) — pass a player email to write their note.

import { supabase } from 'boot/supabase';

export async function fetch(entityId, emailOverride) {
  const email = emailOverride || await _ownEmail();
  if (!email) return '';
  const { data, error } = await supabase
    .from('user_notes')
    .select('html')
    .eq('user_email', email)
    .eq('entity_id', String(entityId))
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[notes] fetch failed', error);
    return '';
  }
  return (data && data.html) || '';
}

export async function save(entityId, html, emailOverride) {
  const email = emailOverride || await _ownEmail();
  if (!email) return;
  const { error } = await supabase.from('user_notes').upsert({
    user_email: email,
    entity_id:  String(entityId),
    html,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_email,entity_id' });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[notes] save failed', error);
  }
}

async function _ownEmail() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? user.email : null;
}
