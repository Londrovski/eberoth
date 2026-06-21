<template>
  <div class="session-read">
    <div v-if="loading" class="state"><q-spinner size="26px" color="warning" /></div>
    <div v-else-if="error" class="state err">Couldn't load this session.</div>

    <div v-else class="surface">
      <div v-if="full.body" class="player-body">
        <div class="player-body-label">For you</div>
        <div class="player-body-text">{{ full.body }}</div>
      </div>

      <div v-if="full.summary.length" class="summary-block">
        <div class="block-label">Summary</div>
        <ul class="summary-list">
          <li v-for="line in full.summary" :key="line.id">{{ line.line }}</li>
        </ul>
      </div>

      <div v-for="part in full.parts" :key="part.id" class="part-block">
        <div class="part-label">{{ part.label }}</div>
        <div v-for="b in part.blocks" :key="b.id" class="block">
          <p v-if="b.type === 'para' && b.text" class="block-para">{{ b.text }}</p>
          <div v-else-if="b.type === 'highlight' && b.text" class="block-highlight">{{ b.text }}</div>
          <div v-else-if="b.type === 'takeaway' && b.text" class="block-takeaway">
            <q-icon name="auto_awesome" size="15px" class="q-mr-xs" /><span>{{ b.text }}</span>
          </div>
          <div v-else-if="b.type === 'testimonies'" class="block-testimonies">
            <p v-if="b.text" class="block-para">{{ b.text }}</p>
            <div v-for="t in b.testimonies" :key="t.id" class="testimony">
              <span class="testimony-name">{{ t.name }}:</span>
              <span class="testimony-text">{{ t.text }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!full.summary.length && !full.parts.length && !full.body" class="state">No content yet.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import * as sessionsApi from 'src/api/sessions';

const props = defineProps({ session: { type: Object, required: true } });

const loading = ref(true);
const error = ref(false);
const full = ref({ summary: [], parts: [], body: null });

async function load(id) {
  loading.value = true; error.value = false;
  try { full.value = await sessionsApi.fetchFull(id); }
  catch { error.value = true; }
  finally { loading.value = false; }
}

watch(() => props.session && props.session.id, (id) => { if (id) load(id); }, { immediate: true });
</script>

<style scoped>
.session-read { height: 100%; overflow-y: auto; }
.surface { max-width: 860px; padding: 22px 26px 70px; color: var(--text); font-size: 16px; line-height: 1.7; }
.state { padding: 40px; text-align: center; color: var(--text-dim); font-style: italic; }
.state.err { color: var(--red); }

.player-body { border-left: 3px solid var(--gold-dim); background: rgba(201,169,97,0.08); padding: 10px 14px; border-radius: 4px; margin-bottom: 18px; }
.player-body-label { font-size: 0.78rem; color: var(--gold-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; }
.player-body-text { font-size: 1rem; line-height: 1.6; }

.block-label, .part-label { font-size: 0.95rem; color: var(--gold); text-transform: uppercase; letter-spacing: 0.05em; margin: 18px 0 8px; font-weight: 600; }

.summary-list { margin: 0; padding-left: 20px; }
.summary-list li { margin-bottom: 6px; }

.block { margin-bottom: 10px; }
.block-para { margin: 0 0 8px 0; }
.block-highlight { background: rgba(201,169,97,0.12); border-left: 3px solid var(--gold-dim); padding: 8px 12px; font-style: italic; margin-bottom: 8px; border-radius: 0 4px 4px 0; }
.block-takeaway { background: rgba(201,169,97,0.10); padding: 8px 12px; border-radius: 4px; margin-bottom: 6px; display: flex; align-items: center; color: var(--gold-bright); }
.block-testimonies { margin-bottom: 8px; }
.testimony { background: var(--bg-panel-2); padding: 8px 12px; margin-bottom: 5px; border-radius: 4px; font-size: 0.95rem; line-height: 1.5; }
.testimony-name { font-weight: 600; color: var(--gold); margin-right: 6px; }
</style>
