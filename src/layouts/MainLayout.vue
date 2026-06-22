<template>
  <q-layout view="hHh lpR fFf" class="app-shell">
    <div
      class="bg-color-layer"
      :style="{ background: bg.bgColor || '#000000' }"
      aria-hidden="true"
    ></div>
    <div
      v-if="bg.mode !== 'none'"
      class="bg-image-layer"
      :class="'mode-' + bg.mode"
      :style="bgImageStyle"
      aria-hidden="true"
    ></div>

    <!-- View-as tint: faint blue wash over the whole viewport -->
    <transition name="tint-fade">
      <div v-if="auth.isViewingAs" class="view-as-tint" aria-hidden="true"></div>
    </transition>

    <TopBar />
    <q-page-container class="page-container" :style="zoomStyle">
      <router-view />
    </q-page-container>
    <DetailPanel />
    <SessionDetailPanel />
    <DmHighlightBanner />
  </q-layout>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import TopBar from 'components/topbar/TopBar.vue';
import DetailPanel from 'components/detail/DetailPanel.vue';
import SessionDetailPanel from 'components/notes/SessionDetailPanel.vue';
import DmHighlightBanner from 'components/banner/DmHighlightBanner.vue';
import { useDmHighlightStore } from 'src/stores/dm-highlight';
import { useEntitiesStore } from 'src/stores/entities';
import { useAppSettingsStore } from 'src/stores/app-settings';
import { useAuthStore } from 'src/stores/auth';
import { useUserPrefsStore } from 'src/stores/user-prefs';
import { useAppNav } from 'src/composables/useAppNav';
import { track } from 'src/composables/useUsageTracker';

const dmHighlight = useDmHighlightStore();
const entities    = useEntitiesStore();
const appSettings = useAppSettingsStore();
const auth        = useAuthStore();
const userPrefs   = useUserPrefsStore();
const route       = useRoute();

// Record cross-view navigation history (route + entity overlay + notes doc)
// so the Notes "Back" button can step back through previous views.
const nav = useAppNav();
let prevSnap = nav.snapshot();
watch(() => nav.keyOf(nav.snapshot()), () => {
  const cur = nav.snapshot();
  if (!nav.history.restoring.value) nav.history.push(prevSnap);
  prevSnap = cur;
});

const TOPBAR_H = 64;

const HORIZON_URL = 'https://raw.githubusercontent.com/Londrovski/eberoth/main/images/The%20Descending%20Horizon.png';
const LOGO_URL    = 'https://raw.githubusercontent.com/Londrovski/eberoth/main/images/eberoth%20logo.png';

const bg = computed(() => appSettings.siteBackground);

const bgImageStyle = computed(() => {
  const opacity = Math.max(0, Math.min(1, bg.value.opacity ?? 0.35));
  const yOffset = `calc(50% + ${TOPBAR_H / 2}px)`;
  if (bg.value.mode === 'horizon') {
    return {
      backgroundImage: `url("${HORIZON_URL}")`,
      backgroundSize: 'cover',
      backgroundPosition: `center ${yOffset}`,
      backgroundRepeat: 'no-repeat',
      opacity: String(opacity)
    };
  }
  if (bg.value.mode === 'logo') {
    const pct = Math.round((bg.value.size ?? 0.8) * 100);
    return {
      backgroundImage: `url("${LOGO_URL}")`,
      backgroundSize: `min(${pct}vw, calc(${pct}vh - ${(TOPBAR_H * pct) / 100}px))`,
      backgroundPosition: `center ${yOffset}`,
      backgroundRepeat: 'no-repeat',
      opacity: String(opacity)
    };
  }
  return {};
});

// The Notes page scales itself (text + panel) from userZoom via a CSS var,
// so it opts out of the global page zoom to avoid double-scaling.
const zoomStyle = computed(() =>
  route.name === 'notes' ? {} : { zoom: String(userPrefs.userZoom || 1) }
);

watch(() => auth.user?.email, () => { userPrefs.load(); });

watch(() => route.name, (name) => {
  if (!name) return;
  track('page_view', name, { path: route.path });
}, { immediate: true });

onMounted(async () => {
  await Promise.all([
    entities.load(),
    appSettings.load(),
    dmHighlight.load(),
    userPrefs.load()
  ]);
  entities.subscribeRealtime();
  appSettings.subscribeRealtime();
  dmHighlight.subscribeRealtime();
});
</script>

<style scoped>
.app-shell {
  background: transparent;
  color: var(--text);
}

.bg-color-layer,
.bg-image-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
.bg-color-layer { z-index: 0; }
.bg-image-layer { z-index: 0; }

.view-as-tint {
  position: fixed;
  inset: 0;
  background: rgba(40, 100, 200, 0.07);
  pointer-events: none;
  z-index: 1;
}
.tint-fade-enter-active,
.tint-fade-leave-active { transition: opacity 0.3s ease; }
.tint-fade-enter-from,
.tint-fade-leave-to { opacity: 0; }

.page-container {
  position: relative;
  z-index: 1;
}
:deep(.q-page) {
  background: transparent !important;
}
:deep(.q-page-container) {
  background: transparent;
}
</style>
