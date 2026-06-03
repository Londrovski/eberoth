<!-- SessionsListPanel — sessions list scoped to the current viewer.
     When DM is viewing-as a player, fetchAll() RLS filters sessions
     to those visible to that player automatically via effectiveBucket.
     No changes needed here beyond ensuring the list reloads on viewingAs change. -->
<template>
  <div class="sessions-list-panel">
    <q-banner v-if="error" class="bg-negative text-white q-mb-md">
      Failed to load sessions: {{ error.message }}
    </q-banner>

    <div v-if="loading" class="text-center q-pa-xl">
      <q-spinner size="32px" />
    </div>

    <q-list separator v-else-if="sessions.length">
      <q-item
        v-for="s in sessions"
        :key="s.id"
        clickable
        @click="open(s.id)"
      >
        <q-item-section avatar>
          <div class="session-number">{{ s.number }}</div>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ s.title || ('Session ' + s.number) }}</q-item-label>
          <q-item-label caption v-if="s.row_summary || s.date">
            {{ s.row_summary || s.date }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="chevron_right" />
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-center text-grey-7 q-pa-xl">No sessions yet.</div>
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

// Reload when DM switches which player they're viewing as.
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
  color: #6b4f2e;
  min-width: 40px;
  text-align: center;
}
</style>
