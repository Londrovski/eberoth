<template>
  <div class="member-card" :class="[visClass, { 'is-glow': glow, dead: entity.is_dead }]" :style="desktopStyle" @click="open">
    <div class="img-wrap">
      <EntityAvatar :entity="entity" fill />
      <div class="badge" v-if="otherCount > 0" :title="otherFactionsTitle">+{{ otherCount }}</div>
      <ReorderArrows
        v-if="viewer.isDM"
        :disable-up="isFirst"
        :disable-down="isLast"
        :vertical="false"
        class="arrows-overlay"
        @up="$emit('move-up')"
        @down="$emit('move-down')"
      />
    </div>
    <div class="footer">
      <div class="name">{{ entity.short_name || entity.name }}</div>
      <div class="role" v-if="role">{{ role }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import EntityAvatar from 'components/shared/EntityAvatar.vue';
import ReorderArrows from 'components/shared/ReorderArrows.vue';
import { useAppSettingsStore } from 'src/stores/app-settings';
import { useEntitiesStore } from 'src/stores/entities';
import { useViewer } from 'src/composables/useViewer';
import { useEntityDetail } from 'src/composables/useEntityDetail';
import { useGlow } from 'src/composables/useGlow';
import { useVisibilityIndicator } from 'src/composables/useVisibilityIndicator';

const props = defineProps({
  entity:    { type: Object, required: true },
  role:      { type: String, default: '' },
  factionId: { type: String, required: true },
  isFirst:   { type: Boolean, default: false },
  isLast:    { type: Boolean, default: false }
});
defineEmits(['move-up', 'move-down']);

const layout   = useAppSettingsStore();
const entities = useEntitiesStore();
const viewer   = useViewer();
const detail   = useEntityDetail();
const glow     = useGlow(props.entity.id);
const visClass = useVisibilityIndicator(props.entity.id);

const W = 180;
const FOOTER = 44;

// Desktop sizing only — overridden entirely by CSS on mobile.
const desktopStyle = computed(() => {
  const w = W * layout.cardScale;
  const imgH = w * 4 / 3;
  return {
    '--scale':     layout.cardScale,
    '--img-h':     Math.round(imgH) + 'px',
    '--footer-h':  Math.round(FOOTER * layout.cardScale) + 'px',
    '--desktop-w': Math.round(w) + 'px',
    '--desktop-h': Math.round(imgH + FOOTER * layout.cardScale) + 'px'
  };
});

const otherFactions = computed(() =>
  entities.factionsOfEntity(props.entity.id).filter(f => f.id !== props.factionId)
);
const otherCount = computed(() => otherFactions.value.length);
const otherFactionsTitle = computed(() =>
  'Also in: ' + otherFactions.value.map(f => f.name).join(', ')
);

function open() { detail.open(props.entity.id); }
</script>

<style scoped>
.member-card {
  position: relative;
  display: block;
  background: var(--bg-card);
  border: var(--line-thickness) solid var(--line-color);
  border-radius: calc(4px * var(--scale, 1));
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s ease, transform 0.18s ease, box-shadow 0.2s ease;
  width:  var(--desktop-w, 180px);
  height: var(--desktop-h, 284px);
}
.member-card:hover {
  border-color: var(--gold-dim);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0,0,0,0.4);
}
.member-card.vis-restricted {
  background: rgba(74,107,145,0.10);
  border-color: var(--blue);
  box-shadow: 0 0 calc(6px * var(--scale, 1)) rgba(74,107,145,0.3);
}
.member-card.vis-dm-only {
  background: rgba(139,58,58,0.12);
  border-color: var(--red);
  box-shadow: 0 0 calc(6px * var(--scale, 1)) rgba(139,58,58,0.3);
}
.member-card.is-glow {
  background: rgba(201,169,97,0.10);
  border-color: var(--gold);
  box-shadow: 0 0 calc(10px * var(--scale, 1)) rgba(201,169,97,0.45);
}

.img-wrap {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: var(--img-h, 240px);
  background: var(--bg);
  overflow: hidden;
}
.img-wrap :deep(.entity-avatar) {
  width: 100%; height: 100%;
  aspect-ratio: auto;
  border: none; border-radius: 0;
}
.img-wrap :deep(img) { opacity: 0.9; transition: opacity 0.2s, transform 0.3s; }
.member-card:hover .img-wrap :deep(img) { opacity: 1; transform: scale(1.04); }

.badge {
  position: absolute; top: 4px; left: 4px;
  font-size: calc(0.65rem * var(--scale, 1));
  color: var(--gold);
  padding: 2px calc(6px * var(--scale, 1));
  background: rgba(11,9,5,0.75);
  border: 1px solid var(--gold-dim);
  border-radius: calc(4px * var(--scale, 1));
  z-index: 1;
}
.arrows-overlay {
  position: absolute; top: 4px; right: 4px;
  background: rgba(11,9,5,0.6);
  border-radius: 3px;
  z-index: 1;
}

.footer {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  min-height: var(--footer-h, 44px);
  background: var(--bg-panel);
  border-top: var(--line-thickness) solid var(--line-color);
  padding: calc(6px * var(--scale, 1)) calc(10px * var(--scale, 1));
  text-align: center;
  display: flex; flex-direction: column; justify-content: center;
}
.member-card.is-glow .footer        { background: #3a2f17; border-top-color: var(--gold-dim); }
.member-card.vis-restricted .footer { background: #1f2c3a; border-top-color: var(--blue); }
.member-card.vis-dm-only .footer    { background: #3a1f1f; border-top-color: var(--red); }

.name { font-size: var(--body-card-size); color: var(--gold); letter-spacing: 0.02em; line-height: 1.2; }
.role { font-size: calc(var(--body-card-size) - 3px); color: var(--text-dim); font-style: italic; line-height: 1.3; margin-top: 2px; }

/* ── Mobile ── same pattern as PartyCard: CSS takes over from JS ──────────── */
@media (max-width: 600px) {
  .member-card {
    width: calc(
      (100% - (var(--mobile-faction-cols, 3) - 1) * var(--mobile-card-spacing, 6px))
      / var(--mobile-faction-cols, 3)
    ) !important;
    height: auto !important;
    flex-shrink: 0;
  }
  .img-wrap {
    position: relative !important;
    height: 0 !important;
    padding-bottom: var(--mobile-card-ratio, 133%) !important;
  }
  .img-wrap :deep(.entity-avatar) {
    position: absolute !important;
    inset: 0 !important;
  }
  .footer {
    position: relative !important;
    min-height: unset !important;
    padding: 5px 6px !important;
  }
  .name { font-size: 11px !important; }
  .role { font-size: 10px !important; }
}

.member-card.dead { border-color: #9c2323; box-shadow: 0 0 calc(8px * var(--scale, 1)) rgba(156, 35, 35, 0.45); }
.member-card.dead .footer { border-top-color: #9c2323; }
.member-card.dead .name { color: #cf5a52; }
</style>
