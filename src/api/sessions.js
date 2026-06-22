// Sessions API — list + full detail (parts/blocks/testimonies/summary/per-viewer body).
import { supabase } from 'boot/supabase';

export async function fetchAll() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('number');
  if (error) throw error;
  return data || [];
}

export async function fetchFull(sessionId) {
  // RLS handles per-viewer filtering at every layer.
  const [partsRes, summaryRes, bodyRes] = await Promise.all([
    supabase.from('session_parts')
      .select('*')
      .eq('session_id', sessionId)
      .order('sort_order'),
    supabase.from('session_summary_lines')
      .select('*')
      .eq('session_id', sessionId)
      .order('sort_order'),
    supabase.from('session_player_body')
      .select('body')
      .eq('session_id', sessionId)
      .maybeSingle()
  ]);
  if (partsRes.error)   throw partsRes.error;
  if (summaryRes.error) throw summaryRes.error;
  // bodyRes can be null with no error when no row.

  const parts = partsRes.data || [];
  const partIds = parts.map(p => p.id);

  let blocks = [];
  let testimonies = [];

  if (partIds.length) {
    const blocksRes = await supabase.from('session_blocks')
      .select('*')
      .in('part_id', partIds)
      .order('sort_order');
    if (blocksRes.error) throw blocksRes.error;
    blocks = blocksRes.data || [];

    const blockIds = blocks.map(b => b.id);
    if (blockIds.length) {
      const tRes = await supabase.from('session_testimonies')
        .select('*')
        .in('block_id', blockIds)
        .order('sort_order');
      if (tRes.error) throw tRes.error;
      testimonies = tRes.data || [];
    }
  }

  const blocksByPart = {};
  blocks.forEach(b => {
    if (!blocksByPart[b.part_id]) blocksByPart[b.part_id] = [];
    blocksByPart[b.part_id].push(b);
  });

  const testByBlock = {};
  testimonies.forEach(t => {
    if (!testByBlock[t.block_id]) testByBlock[t.block_id] = [];
    testByBlock[t.block_id].push(t);
  });

  const stitchedParts = parts.map(p => ({
    ...p,
    blocks: (blocksByPart[p.id] || []).map(b => ({
      ...b,
      testimonies: testByBlock[b.id] || []
    }))
  }));

  return {
    summary: summaryRes.data || [],
    parts:   stitchedParts,
    body:    bodyRes.data && bodyRes.data.body ? bodyRes.data.body : null
  };
}

// ── DM-only: per-session visibility (mirrors entity_visibility editing) ──
// session_visibility rows: { session_id, viewer } where viewer is one of
// '*' (everyone), a player bucket, or 'dm'. RLS lets the DM write these.
export async function fetchVisibility(sessionId) {
  const { data, error } = await supabase
    .from('session_visibility')
    .select('viewer')
    .eq('session_id', sessionId);
  if (error) throw error;
  return (data || []).map(r => r.viewer);
}

export async function setVisibility(sessionId, viewers) {
  await supabase.from('session_visibility').delete().eq('session_id', sessionId);
  // DM always retains access; keep the dm row implicit.
  const rows = Array.from(new Set([...(viewers || []), 'dm']))
    .map(v => ({ session_id: sessionId, viewer: v }));
  const { error } = await supabase.from('session_visibility').insert(rows);
  if (error) throw error;
}
