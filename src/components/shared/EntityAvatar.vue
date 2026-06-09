<template>
  <div class="entity-avatar" :class="{ fill }" :style="style">
    <img v-if="src" :src="src" :alt="alt" @error="onError" />
    <span v-else class="missing">?</span>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  entity: { type: Object, required: true },
  size:   { type: Number, default: 44 },
  fill:   { type: Boolean, default: false }
});

const IMAGE_BASE = 'https://raw.githubusercontent.com/Londrovski/eberoth/main/images/';

function resolveUrl(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return s;
  return IMAGE_BASE + encodeURIComponent(s);
}

const errored = ref(false);
const src = computed(() => {
  if (errored.value) return null;
  return resolveUrl(props.entity.sigil || props.entity.image);
});
const alt = computed(() => props.entity.name || '');
const style = computed(() => {
  if (props.fill) {
    return { fontSize: '3rem' };
  }
  return {
    width:  props.size + 'px',
    height: props.size + 'px',
    fontSize: Math.round(props.size * 0.55) + 'px'
  };
});

function onError() { errored.value = true; }
</script>

<style scoped>
.entity-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-panel-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}
.entity-avatar.fill {
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
}
.entity-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}
.missing {
  font-weight: 700;
  color: var(--gold);
  line-height: 1;
}
</style>
