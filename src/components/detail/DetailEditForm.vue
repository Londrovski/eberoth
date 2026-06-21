<template>
  <div class="edit-form q-pa-md">
    <div v-if="loading" class="text-center q-pa-xl">
      <q-spinner size="32px" />
    </div>

    <template v-else>
      <EditIdentity v-model="identity" />
      <EditSharedBody v-model="sharedBody" />
      <EditVisibility v-model="visibility" v-model:dead="isDead" />
      <EditTags v-model="tags" />
      <EditPlayerBodies v-model="bodies" />
      <EditPersonalTo v-model="personalTo" :players="players" />
      <EditMemberships v-model="memberships" :factions="factions" />
      <EditFacts v-model="facts" />

      <div class="row q-mt-lg q-gutter-sm">
        <q-btn color="primary" label="Save" :loading="saving" @click="onSave" />
        <q-btn flat label="Cancel" @click="$emit('cancel')" />
        <q-space />
        <q-btn
          flat
          color="negative"
          icon="visibility_off"
          label="Hide from players"
          :title="'Sets visibility to DM-only. Reversible by editing visibility.'"
          @click="onSoftDelete"
        />
      </div>

      <div v-if="error" class="text-negative q-mt-sm">{{ error }}</div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useEntitiesStore } from 'src/stores/entities';
import * as fullBodiesApi from 'src/api/full-bodies';
import * as editApi from 'src/api/edit';

import EditIdentity     from 'components/detail/edit/EditIdentity.vue';
import EditSharedBody   from 'components/detail/edit/EditSharedBody.vue';
import EditVisibility   from 'components/detail/edit/EditVisibility.vue';
import EditTags         from 'components/detail/edit/EditTags.vue';
import EditPlayerBodies from 'components/detail/edit/EditPlayerBodies.vue';
import EditPersonalTo   from 'components/detail/edit/EditPersonalTo.vue';
import EditMemberships  from 'components/detail/edit/EditMemberships.vue';
import EditFacts        from 'components/detail/edit/EditFacts.vue';

const props = defineProps({
  entity: { type: Object, required: true }
});
const emit = defineEmits(['cancel', 'saved']);

const entities = useEntitiesStore();
const $q = useQuasar();

const loading = ref(true);
const saving  = ref(false);
const error   = ref(null);

const identity   = ref({ name: '', sub: '', image: '' });
const sharedBody = ref('');
const visibility = ref([]);
const isDead     = ref(false);
const tags       = ref([]);
const bodies     = ref({ dm: '', baker: '', butcher: '', charlie: '' });
const personalTo = ref(null);
const memberships = ref([]);
const facts      = ref([]);

const players  = computed(() => entities.players);
const factions = computed(() => entities.factions);

onMounted(async () => {
  const e = props.entity;
  identity.value = {
    name:  e.name  || '',
    sub:   e.sub   || '',
    image: e.image || ''
  };
  sharedBody.value = e.shared_body || '';
  isDead.value     = !!e.is_dead;
  facts.value      = Array.isArray(e.facts) ? [...e.facts] : [];

  memberships.value = entities.memberships
    .filter(m => m.entity_id === e.id)
    .map(m => ({ faction_id: m.faction_id, role: m.role || '', sort_order: m.sort_order || 0 }));

  const pt = entities.personals.find(p => p.entity_id === e.id);
  personalTo.value = pt
    ? { player_id: pt.player_id, relationship: pt.relationship || '' }
    : null;

  const [vis, tg, bds] = await Promise.all([
    fullBodiesApi.fetchVisibilityFor(e.id),
    fullBodiesApi.fetchTagsFor(e.id),
    fullBodiesApi.fetchAllBodiesFor(e.id)
  ]);
  visibility.value = [...vis];
  tags.value       = [...tg];
  bodies.value     = {
    dm:      bds.dm      || '',
    baker:   bds.baker   || '',
    butcher: bds.butcher || '',
    charlie: bds.charlie || ''
  };

  loading.value = false;
});

async function onSave() {
  saving.value = true;
  error.value = null;
  try {
    await editApi.saveEntity({
      id: props.entity.id,
      identity:    identity.value,
      sharedBody:  sharedBody.value,
      visibility:  visibility.value,
      is_dead:     isDead.value,
      tags:        tags.value,
      bodies:      bodies.value,
      personalTo:  personalTo.value,
      memberships: memberships.value,
      facts:       facts.value
    });
    await entities.load();
    $q.notify({ type: 'positive', message: 'Saved.' });
    emit('saved');
  } catch (e) {
    error.value = e.message || String(e);
    $q.notify({ type: 'negative', message: 'Save failed: ' + error.value });
  } finally {
    saving.value = false;
  }
}

async function onSoftDelete() {
  $q.dialog({
    title: 'Hide from players?',
    message: 'This sets visibility to DM-only. Players will no longer see this entity. Reversible by editing visibility later.',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await editApi.softDeleteEntity(props.entity.id);
      await entities.load();
      $q.notify({ type: 'positive', message: 'Hidden from players.' });
      emit('saved');
    } catch (e) {
      $q.notify({ type: 'negative', message: 'Failed: ' + (e.message || String(e)) });
    }
  });
}
</script>
