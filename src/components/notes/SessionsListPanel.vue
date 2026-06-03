<template>
  <div class="sessions-list-panel">
    <q-banner v-if="error" class="bg-negative text-white q-mb-md">
      Failed to load sessions: {{ error.message }}
    </q-banner>

    <div v-if="loading" class="text-center q-pa-xl">
      <q-spinner size="32px" />
    </div>

    <q-list separator v-else-if="sessions.length" class="session-list">
      <q-item
        v-for="s in sessions"
        :key="s.id"
        clickable
        v-ripple
        class="session-item"
        @click="open(s.id)"
      >
        <q-item-section avatar>
          <div class="session-number">{{ s.number }}</div>
        </q-item-section>
        <q-item-section>
          <q-item-label class="session-title">{{ s.title || ('Session ' + s.number) }}</q-item-label>
          <q-item-label caption class="session-caption" v-if="s.row_summary || s.date">
            {{ s.row_summary || s.date }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="chevron_right" class="session-chevron" />
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="empty">No sessions yet.</div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import * as sessionsApi from 'src/api/sessions';
import { useEntityDetail } from 'src/composables/useEntityDetail';
import { useAuthStore } from 'src/stores/auth';

const auth = useAuthStore();
const sessions = ref([]);
const loading  = ref(true);
const error    = ref(null);
const detail   = useEntityDetail();

async function load() {
  loading.value = true;
  error.value = null;
  try {
    sessions.value = await sessionsApi.fetchAll();
  } catch (e) {
    error.value = e;
  } finally {
    loading.value = false;
  }
}

watch(() => auth.viewingAs, load);
onMounted(load);

function open(sessionId) {
  detail.open(sessionId);
}
</script>

<style scoped>
.sessions-list-panel { padding: 0; }

.session-number {
  font-size: 1.4rem;
  color: var(--gold-dim);
  min-width: 40px;
  text-align: center;
  opacity: 0.7;
}

.session-list :deep(.q-separator) {
  background: var(--border);
}

.session-item {
  background: transparent !important;
  min-height: 56px;
  padding: 10px 16px;
}
.session-item:hover {
  background: rgba(201, 169, 97, 0.04) !important;
}

.session-title {
  color: var(--gold) !important;
  font-size: 1rem !important;
  font-weight: 500 !important;
  line-height: 1.3 !important;
}

.session-caption {
  color: var(--text-dim) !important;
  font-style: italic !important;
  font-size: 0.82rem !important;
  line-height: 1.5 !important;
  opacity: 1 !important;
}

.session-chevron {
  color: var(--gold-dim) !important;
  opacity: 0.6;
}
.session-item:hover .session-chevron {
  opacity: 1;
}

.empty {
  color: var(--text-dim);
  font-style: italic;
  text-align: center;
  padding: 32px;
  font-size: 13px;
}
</style>
