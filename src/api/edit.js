// Save a full edit-form snapshot to Supabase in one batch.
// Not a SQL transaction (Supabase REST doesn't expose multi-table
// transactions cleanly), but ordered so a partial failure leaves
// the entity itself intact and bails on the cross-tables.

import { supabase } from 'boot/supabase';
import * as visibilityApi from 'src/api/visibility';
import * as membershipsApi from 'src/api/memberships';
import * as personalsApi   from 'src/api/personals';

export async function saveEntity(payload) {
  const id = payload.id;
  if (!id) throw new Error('saveEntity: missing id');

  // 1. Entity row itself.
  const { error: entErr } = await supabase
    .from('entities')
    .update({
      name:        payload.identity.name,
      sub:         payload.identity.sub || null,
      image:       payload.identity.image || null,
      shared_body: payload.sharedBody || null,
      is_dead:     !!payload.is_dead
    })
    .eq('id', id);
  if (entErr) throw entErr;

  // 2. Visibility set (full replacement).
  await visibilityApi.setVisibility(id, payload.visibility || []);

  // 3. Tags set (full replacement).
  await visibilityApi.setTags(id, payload.tags || []);

  // 4. Per-viewer bodies — upsert each, delete empties.
  for (const [viewer, body] of Object.entries(payload.bodies || {})) {
    await visibilityApi.setPlayerBody(id, viewer, body);
  }

  // 5. Personal-to — single row, or none.
  await supabase.from('entity_personal_to').delete().eq('entity_id', id);
  if (payload.personalTo && payload.personalTo.player_id) {
    await personalsApi.upsert({
      entity_id:    id,
      player_id:    payload.personalTo.player_id,
      relationship: payload.personalTo.relationship || null,
      sort_order:   0
    });
  }

  // 6. Memberships — full replacement.
  await supabase.from('entity_memberships').delete().eq('entity_id', id);
  for (const m of (payload.memberships || [])) {
    await membershipsApi.upsert({
      entity_id:  id,
      faction_id: m.faction_id,
      role:       m.role || null,
      sort_order: m.sort_order || 0
    });
  }

  // 7. Facts — full replacement.
  await supabase.from('entity_facts').delete().eq('entity_id', id);
  if (payload.facts && payload.facts.length) {
    const rows = payload.facts.map((fact, i) => ({
      entity_id: id, fact, sort_order: i
    }));
    const { error: factsErr } = await supabase.from('entity_facts').insert(rows);
    if (factsErr) throw factsErr;
  }
}

// Soft-delete: collapse visibility to just DM. Reversible by editing
// visibility back. Doesn't actually remove the row.
export async function softDeleteEntity(entityId) {
  await visibilityApi.setVisibility(entityId, ['dm']);
}
