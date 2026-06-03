<template>
  <div class="sessions-list-panel">
    <div v-if="loading" class="text-center q-pa-xl">
      <q-spinner size="32px" />
    </div>

    <q-banner v-else-if="error" class="bg-negative text-white q-mb-md">
      Failed to load sessions: {{ error.message }}
    </q-banner>

    <div v-else-if="sessions.length" class="session-list">
      <div
        v-for="s in sessions"
        :key="s.id"
        class="session-row"
        @click="open(s.id)"
      >
        <div class="session-num">{{ s.number }}</div>
        <div class="session-info">
          <div class="session-title">{{ s.title || ('Session ' + s.number) }}</div>
          <div v-if="s.row_summary" class="session-summary">{{ s.row_summary }}</div>
        </div>
        <div class="session-chevron">&rsaquo;</div>
      </div>
    </div>

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

.session-list {
  display: flex;
  flex-direction: column;
}

.session-row {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.12s ease;
}
.session-row:first-child { border-top: 1px solid var(--border); }
.session-row:hover { background: rgba(201, 169, 97, 0.04); }

.session-num {
  font-size: 2rem;
  color: var(--gold-dim);
  min-width: 28px;
  text-align: center;
  line-height: 1.2;
  flex-shrink: 0;
  padding-top: 2px;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 1.1rem;
  color: var(--gold);
  font-weight: 500;
  line-height: 1.3;
  margin-bottom: 4px;
}

.session-summary {
  font-size: 0.88rem;
  color: var(--text-dim);
  font-style: italic;
  line-height: 1.55;
}

.session-chevron {
  font-size: 1.5rem;
  color: var(--gold-dim);
  flex-shrink: 0;
  line-height: 1.2;
  padding-top: 4px;
  opacity: 0.6;
}
.session-row:hover .session-chevron { opacity: 1; color: var(--gold); }

.empty {
  color: var(--text-dim);
  font-style: italic;
  text-align: center;
  padding: 32px;
  font-size: 13px;
}
</style>
