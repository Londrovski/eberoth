<template>
  <div class="sessions-list-panel">
    <q-banner v-if="error" class="bg-negative text-white q-mb-md">
      Failed to load sessions: {{ error.message }}
    </q-banner>

    <div v-if="loading" class="text-center q-pa-xl">
      <q-spinner size="32px" />
    </div>

    <div v-else-if="sessions.length" class="session-list">
      <div
        v-for="s in sessions"
        :key="s.id"
        class="session-card"
        @click="open(s)"
      >
        <div class="session-number">{{ s.number }}</div>
        <div class="session-info">
          <div class="session-title">{{ s.title || ('Session ' + s.number) }}</div>
          <div v-if="s.row_summary" class="session-caption">{{ s.row_summary }}</div>
        </div>
        <q-icon name="chevron_right" class="session-chevron" />
      </div>
    </div>

    <div v-else class="empty">No sessions yet.</div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import * as sessionsApi from 'src/api/sessions';
import { useSessionDetail } from 'src/composables/useSessionDetail';
import { useAuthStore } from 'src/stores/auth';

const auth          = useAuthStore();
const sessionDetail = useSessionDetail();
const sessions      = ref([]);
const loading       = ref(true);
const error         = ref(null);

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

function open(session) {
  sessionDetail.open(session, 'sessions-list');
}
</script>

<style scoped>
.sessions-list-panel { padding: 8px 0; }

.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px;
}

.session-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 14px;
  background: var(--bg-panel-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.session-card:hover {
  border-color: var(--gold-dim);
  background: rgba(201, 169, 97, 0.04);
}

.session-number {
  font-size: 1.4rem;
  color: var(--gold-dim);
  min-width: 28px;
  text-align: center;
  line-height: 1.3;
  flex-shrink: 0;
  opacity: 0.6;
  padding-top: 1px;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 1rem;
  color: var(--gold);
  font-weight: 500;
  line-height: 1.3;
  margin-bottom: 3px;
}

.session-caption {
  font-size: 0.82rem;
  color: var(--text-dim);
  font-style: italic;
  line-height: 1.5;
}

.session-chevron {
  color: var(--gold-dim);
  flex-shrink: 0;
  opacity: 0.5;
  margin-top: 2px;
}
.session-card:hover .session-chevron { opacity: 0.9; }

.empty {
  color: var(--text-dim);
  font-style: italic;
  text-align: center;
  padding: 32px;
  font-size: 13px;
}
</style>
