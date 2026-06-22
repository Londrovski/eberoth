<template>
  <div v-if="viewer.isDM && sessionId" class="vis-control">
    <span class="vis-label">Visible to</span>
    <q-checkbox
      dense size="sm"
      :model-value="everyone"
      label="Everyone"
      @update:model-value="v => toggle('*', v)"
    />
    <q-checkbox
      v-for="p in players"
      :key="p.bucket"
      dense size="sm"
      :model-value="everyone || viewers.includes(p.bucket)"
      :disable="everyone"
      :label="p.characterName"
      @update:model-value="v => toggle(p.bucket, v)"
    />
    <span class="vis-status" :class="{ on: state === 'Saved' }">{{ state }}</span>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useViewer } from 'src/composables/useViewer';
import { allPlayers } from 'src/config/players';
import * as sessionsApi from 'src/api/sessions';

const props = defineProps({ sessionId: { type: [String, Number], default: null } });

const viewer  = useViewer();
const players = computed(() => allPlayers().filter(p => p.bucket !== 'dm'));
const viewers = ref([]);
const state   = ref('');

const everyone = computed(() => viewers.value.includes('*'));

async function load() {
  if (!viewer.isDM || !props.sessionId) return;
  try { viewers.value = await sessionsApi.fetchVisibility(String(props.sessionId)); }
  catch { viewers.value = []; }
}
watch(() => props.sessionId, load, { immediate: true });

async function toggle(bucket, checked) {
  const set = new Set(viewers.value);
  if (bucket === '*') {
    set.clear();
    if (checked) set.add('*');
  } else {
    set.delete('*');
    if (checked) set.add(bucket); else set.delete(bucket);
  }
  viewers.value = [...set];
  await save();
}

async function save() {
  state.value = 'Saving…';
  try {
    await sessionsApi.setVisibility(String(props.sessionId), viewers.value.filter(v => v !== 'dm'));
    state.value = 'Saved';
    setTimeout(() => { if (state.value === 'Saved') state.value = ''; }, 1600);
  } catch (e) {
    state.value = 'Error';
  }
}
</script>

<style scoped>
.vis-control {
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px 14px;
  padding: 8px 12px; margin-bottom: 16px;
  border: 1px dashed var(--gold-dim); border-radius: 6px;
  background: rgba(201,169,97,0.06);
  font-size: 0.85em;
}
.vis-label {
  text-transform: uppercase; letter-spacing: 0.08em;
  font-size: 0.7em; color: var(--gold-dim); font-weight: 600;
}
.vis-status { margin-left: auto; font-size: 0.72em; color: var(--text-dim); min-width: 52px; text-align: right; }
.vis-status.on { color: var(--gold); }
</style>
