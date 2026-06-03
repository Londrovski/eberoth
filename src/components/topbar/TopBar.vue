<template>
  <q-header bordered class="eb-topbar" :class="{ 'eb-topbar--viewing-as': viewer.isViewingAs }">
    <q-toolbar class="q-px-md eb-toolbar">

      <!-- Brand -->
      <span class="eberoth">Eberoth</span>

      <!-- Desktop spacer -->
      <q-space class="gt-xs" />

      <!-- Desktop nav tabs -->
      <q-tabs dense no-caps inline-label align="center" class="eb-tabs gt-xs">
        <q-route-tab :to="{ name: 'home' }"  label="Home" />
        <q-route-tab :to="{ name: 'notes' }" label="Notes" />
        <q-route-tab v-if="viewer.isDM" :to="{ name: 'admin-usage' }" label="Admin" />
      </q-tabs>

      <!-- Desktop spacer -->
      <q-space class="gt-xs" />

      <!-- Desktop right-hand controls -->
      <div class="row items-center q-gutter-sm gt-xs">
        <q-btn v-if="zoomUrl" flat dense no-caps icon="videocam" label="Zoom"
          class="ext-btn zoom-btn" :href="zoomUrl" target="_blank" rel="noopener" />
        <q-btn v-if="dndbeyondUrl" flat dense no-caps icon="casino" label="D&D Beyond"
          class="ext-btn dnd-btn" :href="dndbeyondUrl" target="_blank" rel="noopener" />
        <template v-if="viewer.isDM">
          <RealtimeDot />
          <DmToolsMenu />
          <ViewAsSelect />
          <transition name="label-fade">
            <span v-if="viewer.isViewingAs" class="viewing-as-label">
              👁 <strong>{{ viewingAsLabel }}</strong>
              <button class="viewing-as-exit" @click="exitViewAs">Exit</button>
            </span>
          </transition>
        </template>
        <UserZoomControl class="user-zoom-control" />
        <q-chip dense outline class="role-chip">{{ roleLabel }}</q-chip>
        <q-btn flat dense no-caps icon="logout" label="Log out"
          class="logout-btn" :disable="signingOut" @click="onSignOut" />
      </div>

      <!-- Mobile toolbar -->
      <div class="mob-nav lt-sm">
        <router-link :to="{ name: 'home' }" custom v-slot="{ isExactActive, navigate }">
          <button class="mob-nav-btn" :class="{ active: isExactActive }" @click="navigate" aria-label="Home">
            <q-icon name="home" size="16px" />
            <span>Home</span>
          </button>
        </router-link>
        <router-link :to="{ name: 'notes' }" custom v-slot="{ isExactActive, navigate }">
          <button class="mob-nav-btn" :class="{ active: isExactActive }" @click="navigate" aria-label="Notes">
            <q-icon name="menu_book" size="16px" />
            <span>Notes</span>
          </button>
        </router-link>
        <transition name="label-fade">
          <span v-if="viewer.isDM && viewer.isViewingAs" class="viewing-as-label mob-viewing-as">
            👁 <strong>{{ viewingAsLabel }}</strong>
            <button class="viewing-as-exit" @click="exitViewAs">Exit</button>
          </span>
        </transition>
        <RealtimeDot v-if="viewer.isDM" class="mob-realtime" />
        <q-btn v-if="viewer.isDM" flat dense round icon="settings" size="sm" class="mobile-dm-btn" aria-label="DM controls" @click="dmPanelOpen = true" />
        <q-btn flat dense round icon="menu" size="sm" class="mobile-menu-btn" aria-label="More options" @click="drawerOpen = true" />
      </div>

    </q-toolbar>
  </q-header>

  <!-- Mobile side drawer (right) -->
  <q-drawer v-model="drawerOpen" side="right" overlay behavior="mobile" class="eb-drawer">
    <div class="drawer-header q-pa-md row items-center">
      <q-btn flat dense round icon="close" @click="drawerOpen = false" style="color:var(--text-dim)" />
      <q-space />
      <span class="eberoth drawer-title">Eberoth</span>
    </div>
    <q-separator style="background:var(--border)" />
    <q-list v-if="viewer.isDM">
      <q-item clickable v-ripple :to="{ name: 'admin-usage' }" class="drawer-item" @click="drawerOpen = false">
        <q-item-section avatar><q-icon name="admin_panel_settings" /></q-item-section>
        <q-item-section>Admin</q-item-section>
      </q-item>
    </q-list>
    <q-separator v-if="viewer.isDM" style="background:var(--border); margin: 4px 0" />
    <div class="q-pa-sm ext-links" v-if="zoomUrl || dndbeyondUrl">
      <a v-if="zoomUrl"       :href="zoomUrl"     target="_blank" rel="noopener" class="drawer-ext-btn zoom-btn"><q-icon name="videocam" size="15px" /><span>Zoom</span></a>
      <a v-if="dndbeyondUrl" :href="dndbeyondUrl" target="_blank" rel="noopener" class="drawer-ext-btn dnd-btn"><q-icon name="casino"   size="15px" /><span>D&amp;D Beyond</span></a>
    </div>
    <q-separator v-if="zoomUrl || dndbeyondUrl" style="background:var(--border); margin: 4px 0" />
    <div v-if="viewer.isDM" class="q-pa-sm">
      <div class="drawer-section-label">View as</div>
      <ViewAsSelect />
    </div>
    <q-separator v-if="viewer.isDM" style="background:var(--border); margin: 4px 0" />
    <div class="q-pa-md row items-center justify-between">
      <q-chip dense outline class="role-chip">{{ roleLabel }}</q-chip>
      <q-btn flat dense no-caps icon="logout" label="Log out" class="logout-btn" :disable="signingOut" @click="onSignOut" />
    </div>
  </q-drawer>

  <!-- Mobile DM controls panel (right) -->
  <q-drawer v-if="viewer.isDM" v-model="dmPanelOpen" side="right" overlay behavior="mobile" class="eb-drawer eb-dm-panel">
    <div class="drawer-header q-pa-md row items-center">
      <q-btn flat dense round icon="close" @click="dmPanelOpen = false" style="color:var(--text-dim)" />
      <q-space />
      <span class="dm-panel-title">DM Controls</span>
    </div>
    <q-separator style="background:var(--border)" />
    <div class="q-pa-md">
      <DmToolsMobile />
    </div>
  </q-drawer>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth';
import { useViewer } from 'src/composables/useViewer';
import { useAppSettingsStore } from 'src/stores/app-settings';
import { useEntitiesStore } from 'src/stores/entities';
import { characterFromBucket } from 'src/config/players';
import ViewAsSelect    from 'components/topbar/ViewAsSelect.vue';
import DmToolsMenu     from 'components/topbar/DmToolsMenu.vue';
import DmToolsMobile   from 'components/topbar/DmToolsMobile.vue';
import UserZoomControl from 'components/topbar/UserZoomControl.vue';
import RealtimeDot     from 'components/topbar/RealtimeDot.vue';

const router      = useRouter();
const auth        = useAuthStore();
const entities    = useEntitiesStore();
const viewer      = useViewer();
const appSettings = useAppSettingsStore();
const signingOut  = ref(false);
const drawerOpen  = ref(false);
const dmPanelOpen = ref(false);

const roleLabel = computed(() => {
  if (!auth.actualBucket) return '-';
  if (auth.isViewingAs) return 'DM > ' + (characterFromBucket(auth.viewingAs) || auth.viewingAs);
  return characterFromBucket(auth.actualBucket) || auth.actualBucket;
});

const viewingAsLabel = computed(() => {
  const b = auth.viewingAs;
  if (!b) return '';
  return characterFromBucket(b) || (b.charAt(0).toUpperCase() + b.slice(1));
});

const zoomUrl      = computed(() => appSettings.externalZoomUrl || '');
const dndbeyondUrl = computed(() => appSettings.dndbeyondUrlFor(
  auth.isViewingAs ? auth.viewingAs : auth.actualBucket
));

function exitViewAs() {
  auth.setViewingAs(null);
  entities.load();
}

async function onSignOut() {
  if (signingOut.value) return;
  signingOut.value = true;
  auth.viewingAs = null; auth.actualBucket = null; auth.user = null;
  router.replace({ name: 'landing' });
  auth.signOut().catch(() => {});
}
</script>

<style scoped>
.eb-topbar {
  background: var(--bg-panel);
  color: var(--text);
  border-bottom: 1px solid var(--border);
  transition: background 0.3s ease, border-color 0.3s ease;
}
.eb-topbar--viewing-as {
  background: rgba(30, 50, 90, 0.75) !important;
  border-bottom-color: rgba(80, 120, 200, 0.25) !important;
}

.eb-toolbar { min-height: 64px; }

.eberoth {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-weight: 700; font-size: 34px;
  color: var(--gold); letter-spacing: 0.05em; line-height: 1;
  text-shadow: 0 0 14px rgba(201,169,97,0.55), 0 0 26px rgba(201,169,97,0.25);
  flex-shrink: 0;
}

.eb-tabs :deep(.q-tab)            { color: var(--section-heading-color); font-size: var(--section-heading-size); letter-spacing: var(--section-heading-spacing); text-transform: uppercase; }
.eb-tabs :deep(.q-tab--active)    { color: var(--gold); }
.eb-tabs :deep(.q-tab__indicator) { background: var(--gold) !important; }

.ext-btn  { font-size: 13px; letter-spacing: 0.04em; padding: 6px 12px; border-radius: 4px; border: 1px solid transparent; }
.zoom-btn { color: #cfe1ff; background: #1f3a6b; border-color: #3a5da3; }
.zoom-btn:hover { background: #2a4f8e; border-color: #4d76c1; color: #fff; }
.dnd-btn  { color: #ffd6d0; background: #6b2222; border-color: #a33a3a; }
.dnd-btn:hover  { background: #8a2a2a; border-color: #c34d4d; color: #fff; }

.role-chip  { color: var(--gold-dim); border-color: var(--gold-dim); font-size: 0.85rem; padding: 2px 12px; }
.logout-btn { color: var(--gold-dim); font-size: 0.85rem; letter-spacing: 0.04em; padding: 6px 10px; }
.logout-btn:hover { color: var(--gold); }

.viewing-as-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(180, 205, 255, 0.8);
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.viewing-as-label strong { color: rgba(210, 225, 255, 0.95); font-weight: 600; }
.viewing-as-exit {
  background: transparent;
  border: 1px solid rgba(120, 160, 230, 0.3);
  color: rgba(180, 205, 255, 0.75);
  border-radius: 3px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.4px;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.viewing-as-exit:hover {
  background: rgba(80, 120, 200, 0.15);
  border-color: rgba(120, 160, 230, 0.6);
  color: rgba(220, 235, 255, 0.95);
}
.label-fade-enter-active,
.label-fade-leave-active { transition: opacity 0.25s ease; }
.label-fade-enter-from,
.label-fade-leave-to { opacity: 0; }

@media (max-width: 600px) {
  .eb-toolbar { min-height: 52px; padding: 0 8px; gap: 6px; }
  .eberoth    { font-size: 18px; letter-spacing: 0.03em; }
}

.mob-nav {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  gap: 2px;
  margin-left: 6px;
  min-width: 0;
}
.mob-viewing-as {
  font-size: 11px;
  margin-left: 4px;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
}

.mob-nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-dim);
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 12px;
  letter-spacing: 0.04em;
  cursor: pointer;
  border-radius: 2px 2px 0 0;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.mob-nav-btn:hover  { color: var(--gold); }
.mob-nav-btn.active { color: var(--gold); border-bottom-color: var(--gold); }
.mob-nav-btn :deep(.q-icon) { color: inherit; }

.mob-realtime { margin-left: auto; }
.mob-nav-btn + .mobile-dm-btn,
.mob-nav-btn + .mobile-menu-btn { margin-left: auto; }
.mob-realtime + .mobile-dm-btn,
.mobile-dm-btn + .mobile-menu-btn { margin-left: 0; }

.mobile-menu-btn { color: var(--gold); }
.mobile-dm-btn   { color: var(--gold-dim); }
.mobile-dm-btn:hover { color: var(--gold); }

.eb-drawer {
  background: var(--bg-panel) !important;
  border-left: 1px solid var(--border) !important;
}
.drawer-header { border-bottom: 1px solid var(--border); min-height: 52px; }
.drawer-title  { font-family: 'Cinzel Decorative', 'Cinzel', serif; font-weight: 700; font-size: 18px; color: var(--gold); letter-spacing: 0.05em; }
.drawer-item   { color: var(--text) !important; min-height: 48px; }
.drawer-item :deep(.q-icon) { color: var(--gold-dim); }
.drawer-item.q-router-link--active { color: var(--gold) !important; border-right: 3px solid var(--gold); }
.drawer-section-label { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }

.ext-links { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.drawer-ext-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 12px; border-radius: 4px; border: 1px solid transparent;
  font-size: 13px; letter-spacing: 0.04em;
  text-decoration: none; font-family: inherit; cursor: pointer;
}
.drawer-ext-btn.zoom-btn { color: #cfe1ff; background: #1f3a6b; border-color: #3a5da3; }
.drawer-ext-btn.dnd-btn  { color: #ffd6d0; background: #6b2222; border-color: #a33a3a; }

.eb-dm-panel { border-left: 1px solid var(--gold-dim) !important; }
.dm-panel-title { font-size: 13px; font-weight: 600; color: var(--gold); letter-spacing: 0.06em; text-transform: uppercase; }
</style>
