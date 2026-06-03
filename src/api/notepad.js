// Multi-tab personal notepad.
// Single jsonb row per user_email in user_notepad.
// Shape: { tabs: [{id, label, html, position}], activeId }
//
// fetchNotepad(emailOverride?) — pass a player email to read their notepad.
// saveNotepad(state, emailOverride?) — pass a player email to write their notepad.
import { supabase } from 'boot/supabase';

const DEFAULT_STATE = () => ({
  tabs: [
    { id: 'campaign', label: 'Campaign',   html: '', position: 0 },
    { id: 'pcs',      label: 'PCs',        html: '', position: 1 },
    { id: 'plot',     label: 'Plot ideas', html: '', position: 2 }
  ],
  activeId: 'campaign'
});

export async function fetchNotepad(emailOverride) {
  const email = emailOverride || await _ownEmail();
  if (!email) return DEFAULT_STATE();
  const { data, error } = await supabase
    .from('user_notepad')
    .select('notepad')
    .eq('user_email', email)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[notepad] fetch failed', error);
    return DEFAULT_STATE();
  }
  return normalise(data && data.notepad);
}

export async function saveNotepad(state, emailOverride) {
  const email = emailOverride || await _ownEmail();
  if (!email) return;
  const { error } = await supabase
    .from('user_notepad')
    .upsert({
      user_email: email,
      notepad: state,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_email' });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[notepad] save failed', error);
  }
}

async function _ownEmail() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? user.email : null;
}

function normalise(blob) {
  if (!blob || typeof blob !== 'object') return DEFAULT_STATE();
  const tabsRaw = Array.isArray(blob.tabs) ? blob.tabs : [];
  if (!tabsRaw.length) return DEFAULT_STATE();
  const tabs = tabsRaw
    .map((t, i) => ({
      id:       String(t.id || ('tab_' + i)),
      label:    String(t.label || 'Untitled'),
      html:     String(t.html || ''),
      position: typeof t.position === 'number' ? t.position : i
    }))
    .sort((a, b) => a.position - b.position);
  const ids = new Set(tabs.map(t => t.id));
  const activeId = ids.has(blob.activeId) ? blob.activeId : tabs[0].id;
  return { tabs, activeId };
}

export function newTab(label) {
  return {
    id:       'tab_' + Math.random().toString(36).slice(2, 10),
    label:    label || 'New tab',
    html:     '',
    position: Date.now()
  };
}
