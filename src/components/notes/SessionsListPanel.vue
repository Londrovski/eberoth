<template>
  <div class="sessions-list-panel">
    <q-banner v-if="error" class="bg-negative text-white q-mb-md">
      Failed to load sessions: {{ error.message }}
    </q-banner>

    <div v-if="loading" class="text-center q-pa-xl">
      <q-spinner size="32px" />
    </div>

    <div v-else-if="sessions.length" class="session-list">
      <template v-for="(s, i) in sessions" :key="s.id">
        <div v-if="showDivider(i)" class="timeline-divider">
          <span class="timeline-divider-label">The Campaign</span>
        </div>
        <div class="session-card" @click="open(s)">
          <div class="session-number">
            <q-icon v-if="s.kind === 'origin'" name="auto_awesome" size="18px" />
            <q-icon v-else-if="s.kind === 'flashback'" name="history" size="18px" />
            <template v-else>{{ s.number }}</template>
          </div>
          <div class="session-info">
            <div class="session-title">{{ s.title || ('Session ' + s.number) }}</div>
            <div v-if="s.row_summary" class="session-caption">{{ s.row_summary }}</div>
          </div>
          <q-icon name="chevron_right" class="session-chevron" />
        </div>
      </template>
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

// A prequel is anything sorted ahead of Session 1 (origins/flashbacks use
// negative numbers). The divider is drawn once, before the first real
// timeline session that follows a prequel.
function showDivider(i) {
  if (i === 0) return false;
  const cur = sessions.value[i];
  const prev = sessions.value[i - 1];
  return cur && prev && Number(cur.number) >= 1 && Number(prev.number) < 1;
}

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
  display: flex;
  align-items: center;
  justify-content: center;
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

/* Divider between prequel (origin/flashback) entries and the live timeline */
.timeline-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 60%;
  margin: 16px auto 8px;
}
.timeline-divider::before,
.timeline-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--gold-dim);
  opacity: 0.4;
}
.timeline-divider-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--gold-dim);
  white-space: nowrap;
}

.empty {
  color: var(--text-dim);
  font-style: italic;
  text-align: center;
  padding: 32px;
  font-size: 13px;
}
</style>
