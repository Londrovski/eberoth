// Personal notes — a nested folder/note tree.
// Stored as ONE jsonb blob per user_email in user_notepad.notepad.
//
// v2 shape:
//   { version: 2,
//     nodes: [ { id, type:'folder'|'note', parentId, label, position, html, collapsed } ],
//     activeId }
//
// - Folders nest arbitrarily via parentId (null = top level).
// - Notes carry `html` (TipTap output).
// - Migrates non-destructively from the v1 { tabs:[...], activeId } shape:
//   every tab becomes a top-level note; empty default tabs are dropped.
//
// fetchNotepad(emailOverride?)  — pass a player email to read their tree.
// saveNotepad(state, emailOverride?) — pass a player email to write it.
import { supabase } from 'boot/supabase';

export function uid(prefix = 'n') {
  return (
    prefix + '_' +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}

export function noteNode(o = {}) {
  return {
    id: o.id || uid('note'),
    type: 'note',
    parentId: o.parentId ?? null,
    label: o.label || 'Untitled',
    html: o.html || '',
    position: typeof o.position === 'number' ? o.position : 0,
    collapsed: false
  };
}

export function folderNode(o = {}) {
  return {
    id: o.id || uid('fld'),
    type: 'folder',
    parentId: o.parentId ?? null,
    label: o.label || 'New folder',
    html: '',
    position: typeof o.position === 'number' ? o.position : 0,
    collapsed: !!o.collapsed
  };
}

// A brand-new user gets a single auto "Active Threads" page.
export function defaultState() {
  const threads = noteNode({ label: 'Active Threads', position: 0 });
  return { version: 2, nodes: [threads], activeId: threads.id };
}

// ---- tree helpers (pure) ----

export function childrenOf(nodes, parentId) {
  return nodes
    .filter(n => (n.parentId ?? null) === (parentId ?? null))
    .sort((a, b) => a.position - b.position);
}

export function isDescendant(nodes, nodeId, maybeAncestorId) {
  // true if maybeAncestorId is nodeId itself or an ancestor of nodeId
  let cur = nodes.find(n => n.id === nodeId);
  while (cur) {
    if (cur.id === maybeAncestorId) return true;
    cur = cur.parentId ? nodes.find(n => n.id === cur.parentId) : null;
  }
  return false;
}

export function subtreeIds(nodes, rootId) {
  const out = [rootId];
  const stack = [rootId];
  while (stack.length) {
    const pid = stack.pop();
    nodes.forEach(n => {
      if ((n.parentId ?? null) === pid) { out.push(n.id); stack.push(n.id); }
    });
  }
  return out;
}

export function nextPosition(nodes, parentId) {
  const sibs = childrenOf(nodes, parentId);
  return sibs.length ? sibs[sibs.length - 1].position + 1 : 0;
}

// ---- persistence ----

function isEmptyHtml(h) {
  return !String(h || '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

const DEFAULT_TAB_LABELS = new Set(['Campaign', 'PCs', 'Plot ideas']);

function migrateV1(blob) {
  const tabs = (Array.isArray(blob.tabs) ? blob.tabs.slice() : [])
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const nodes = [];
  const threads = noteNode({ label: 'Active Threads', position: 0 });
  nodes.push(threads);

  const idMap = {};
  let pos = 1;
  tabs.forEach(t => {
    // Drop the empty stock tabs; keep anything the player actually wrote.
    if (DEFAULT_TAB_LABELS.has(t.label) && isEmptyHtml(t.html)) return;
    const nid = 'mig_' + (t.id || uid('t'));
    idMap[t.id] = nid;
    nodes.push(noteNode({
      id: nid,
      label: String(t.label || 'Untitled'),
      html: String(t.html || ''),
      position: pos++
    }));
  });

  const activeId = idMap[blob.activeId] || threads.id;
  return { version: 2, nodes, activeId };
}

function normalise(blob) {
  if (!blob || typeof blob !== 'object') return defaultState();
  if (Array.isArray(blob.tabs) && !Array.isArray(blob.nodes)) return migrateV1(blob);
  if (!Array.isArray(blob.nodes) || !blob.nodes.length) return defaultState();

  const nodes = blob.nodes.map((n, i) => ({
    id: String(n.id || uid('n')),
    type: n.type === 'folder' ? 'folder' : 'note',
    parentId: n.parentId == null ? null : String(n.parentId),
    label: String(n.label || 'Untitled'),
    html: n.type === 'folder' ? '' : String(n.html || ''),
    position: typeof n.position === 'number' ? n.position : i,
    collapsed: !!n.collapsed
  }));

  // Heal orphans (parent missing) by lifting to top level.
  const ids = new Set(nodes.map(n => n.id));
  nodes.forEach(n => { if (n.parentId && !ids.has(n.parentId)) n.parentId = null; });

  const activeId = ids.has(blob.activeId) ? blob.activeId : (nodes[0] && nodes[0].id) || null;
  return { version: 2, nodes, activeId };
}

export async function fetchNotepad(emailOverride) {
  const email = emailOverride || await _ownEmail();
  if (!email) return defaultState();
  const { data, error } = await supabase
    .from('user_notepad')
    .select('notepad')
    .eq('user_email', email)
    .maybeSingle();
  if (error) {
    console.warn('[notepad] fetch failed', error);
    return defaultState();
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
      notepad: { version: 2, nodes: state.nodes, activeId: state.activeId },
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_email' });
  if (error) console.warn('[notepad] save failed', error);
}

async function _ownEmail() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? user.email : null;
}
