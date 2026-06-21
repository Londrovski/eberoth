// Fetch entities + the cross-cutting visibility/body/tag rows.
// RLS handles per-viewer filtering when the JWT belongs to a real player.
// For DM under View-As, the client filter mirrors what the player would see.

import { supabase } from 'boot/supabase';

export async function fetchAll(effectiveBucket) {
  const [entRes, visRes, bodiesRes, tagsRes, factsRes] = await Promise.all([
    supabase.from('entities').select('*').order('sort_order'),
    supabase.from('entity_visibility').select('entity_id, viewer'),
    supabase.from('entity_player_body').select('entity_id, viewer, body'),
    supabase.from('entity_player_tag').select('entity_id, viewer'),
    supabase.from('entity_facts').select('*').order('sort_order')
  ]);

  if (entRes.error) throw entRes.error;

  const visMap = {};
  (visRes.data || []).forEach(v => {
    (visMap[v.entity_id] = visMap[v.entity_id] || new Set()).add(v.viewer);
  });

  const bodyMap = {};
  (bodiesRes.data || []).forEach(b => {
    (bodyMap[b.entity_id] = bodyMap[b.entity_id] || {})[b.viewer] = b.body;
  });

  const tagMap = {};
  (tagsRes.data || []).forEach(t => {
    (tagMap[t.entity_id] = tagMap[t.entity_id] || new Set()).add(t.viewer);
  });

  const factsMap = {};
  (factsRes.data || []).forEach(f => {
    (factsMap[f.entity_id] = factsMap[f.entity_id] || []).push(f.fact);
  });

  return (entRes.data || []).map(e => ({
    id:           e.id,
    kind:         e.kind,
    name:         e.name,
    short_name:   e.short_name,
    sub:          e.sub,
    image:        e.image,
    sigil:        e.sigil,
    sort_order:   e.sort_order,
    shared_body:  e.shared_body,
    auth_bucket:  e.auth_bucket,
    display_name: e.display_name,
    is_dead:      e.is_dead || false,
    facts:        factsMap[e.id] || [],
    viewerBody:   effectiveBucket ? (bodyMap[e.id]?.[effectiveBucket] || null) : null,
    tagged:       effectiveBucket ? (tagMap[e.id]?.has(effectiveBucket) || false) : false,
    tagged_viewers: tagMap[e.id] || new Set(),
    visible_to:   visMap[e.id] || new Set()
  }));
}
