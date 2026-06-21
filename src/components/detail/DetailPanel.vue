<template>
  <q-dialog
    v-model="open"
    position="right"
    :maximized="$q.screen.lt.sm"
    :seamless="false"
    transition-show="slide-left"
    transition-hide="slide-right"
  >
    <q-card class="detail-card column">
      <DetailHeader
        :entity="accessible ? entity : null"
        :editing="editing"
        @close="close"
        @edit="onEdit"
        @cancel-edit="onCancelEdit"
      />

      <q-scroll-area class="col">
        <DetailEditForm
          v-if="editing && entity && accessible"
          :entity="entity"
          @cancel="onCancelEdit"
          @saved="onSaved"
        />

        <div class="q-pa-md" v-else-if="entity && accessible">
          <DetailIdentity :entity="entity" />
          <DetailDmInfo v-if="viewer.isDM" :entity="entity" />
          <DetailMemberships :entity="entity" v-if="memberships.length" :memberships="memberships" />
          <DetailPersonalTo :entity="entity" v-if="personalTo" :personal-to="personalTo" />
          <DetailBody :entity="entity" />
          <DetailFacts :facts="entity.facts" v-if="entity.facts && entity.facts.length" />
          <DetailNotes :entity-id="entity.id" />
        </div>

        <div v-else-if="entities.loading" class="q-pa-xl text-center text-grey-7">
          <q-spinner size="32px" color="warning" />
        </div>

        <div v-else-if="isOpenRef" class="locked-state column items-center q-pa-xl text-center">
          <q-icon name="visibility_off" size="44px" class="locked-icon" />
          <div class="locked-title">{{ lockedQuip.title }}</div>
          <div class="locked-text">{{ lockedQuip.text }}</div>
        </div>
      </q-scroll-area>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useEntitiesStore } from 'src/stores/entities';
import { useAuthStore } from 'src/stores/auth';
import { useEntityDetail } from 'src/composables/useEntityDetail';
import { useViewer } from 'src/composables/useViewer';
import DetailHeader from 'components/detail/DetailHeader.vue';
import DetailIdentity from 'components/detail/DetailIdentity.vue';
import DetailDmInfo from 'components/detail/DetailDmInfo.vue';
import DetailMemberships from 'components/detail/DetailMemberships.vue';
import DetailPersonalTo from 'components/detail/DetailPersonalTo.vue';
import DetailBody from 'components/detail/DetailBody.vue';
import DetailFacts from 'components/detail/DetailFacts.vue';
import DetailNotes from 'components/detail/DetailNotes.vue';
import DetailEditForm from 'components/detail/DetailEditForm.vue';

const entities = useEntitiesStore();
const auth     = useAuthStore();
const detail   = useEntityDetail();
const viewer   = useViewer();

const isOpenRef = detail.isOpen;
const currentIdRef = detail.currentEntityId;

const editing = ref(false);

const open = computed({
  get: () => isOpenRef.value,
  set: (v) => { if (!v) close(); }
});

const entity = computed(() =>
  currentIdRef.value ? entities.byId[currentIdRef.value] : null
);

// Whether the current viewer is actually allowed to see this entity.
// Real players are RLS-filtered (hidden entities never reach byId), so
// a missing entity means "no access". When the DM is in View-As mode the
// entity is still in byId, so we re-check the viewed-as bucket here too —
// that lets the DM preview the locked state without a player login.
const accessible = computed(() => {
  const e = entity.value;
  if (!e) return false;
  if (!auth.isViewingAs) return true;
  const b = auth.viewingAs;
  return !!(e.visible_to && (e.visible_to.has(b) || e.visible_to.has('*')));
});

// A little flavour for the "you can't see this yet" state. Picked
// deterministically per entity id so it doesn't reshuffle on re-render.
const quips = [
  { title: 'Whoa there — a little too meta.', text: "This one hasn't been revealed to you yet. Play on, adventurer." },
  { title: 'Nice try, fourth wall.', text: "Your character doesn't know about this yet. Patience." },
  { title: 'The mists refuse to part.', text: 'This entry stays hidden until the story takes you there.' },
  { title: 'Spoilers!', text: "You're peeking past where the tale has led you. Come back later." },
  { title: 'DM-eyes-only, for now.', text: "Whatever this is, it isn't yours to read yet." }
];
const lockedQuip = computed(() => {
  const id = currentIdRef.value || '';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return quips[h % quips.length];
});

watch(currentIdRef, () => { editing.value = false; });

const memberships = computed(() => {
  if (!entity.value) return [];
  return entities.memberships
    .filter(m => m.entity_id === entity.value.id)
    .map(m => ({ faction: entities.byId[m.faction_id], role: m.role }))
    .filter(x => x.faction);
});

const personalTo = computed(() => {
  if (!entity.value) return null;
  const row = entities.personals.find(p => p.entity_id === entity.value.id);
  if (!row) return null;
  const player = entities.byId[row.player_id];
  if (!row) return null;
  return { player, relationship: row.relationship };
});

function close() {
  detail.close();
  editing.value = false;
}
function onEdit()       { editing.value = true; }
function onCancelEdit() { editing.value = false; }
function onSaved()      { editing.value = false; }
</script>

<style scoped>
.detail-card {
  width: 460px;
  max-width: 100vw;
  height: 100vh;
  background: var(--bg-panel);
  color: var(--text);
  border-left: 1px solid var(--border);
}
@media (max-width: 600px) {
  .detail-card { width: 100vw; }
}

.locked-state {
  gap: 12px;
  margin-top: 28px;
  color: var(--text-dim);
}
.locked-icon { color: var(--gold-dim); opacity: 0.85; }
.locked-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--gold);
}
.locked-text {
  font-size: 0.9rem;
  line-height: 1.5;
  max-width: 320px;
  color: var(--text-dim);
}
</style>
