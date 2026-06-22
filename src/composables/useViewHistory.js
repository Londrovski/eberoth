// Global cross-view navigation history.
//
// Records snapshots of the whole app view (route + open entity card +
// active notes doc) so a single "Back" control can step through them,
// even across the home/map ↔ notes pages. Module-level state = one
// shared stack for the whole app.
import { ref, computed } from 'vue';

const stack = ref([]);
const restoring = ref(false);
const MAX = 50;

export function useViewHistory() {
  return {
    stack,
    restoring,
    canGoBack: computed(() => stack.value.length > 0),
    push(snap) {
      if (!snap) return;
      stack.value.push(snap);
      if (stack.value.length > MAX) stack.value.shift();
    },
    pop() { return stack.value.pop() || null; },
    clear() { stack.value = []; }
  };
}
