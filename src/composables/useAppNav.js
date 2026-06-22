// App-wide navigation snapshot/restore, backing the Notes "Back" button.
//
// snapshot()  — capture the current view (route + entity overlay + notes doc)
// restore(s)  — reapply a snapshot (route, overlay, notes doc)
// goBack()    — pop the last snapshot and restore it
//
// MainLayout records history by watching the snapshot key; restore() sets
// the `restoring` flag so those programmatic changes aren't re-recorded.
import { useRouter } from 'vue-router';
import { useEntityDetail } from 'src/composables/useEntityDetail';
import { useSessionDetail } from 'src/composables/useSessionDetail';
import { useNotesStore } from 'src/stores/notes';
import { useViewHistory } from 'src/composables/useViewHistory';

export function useAppNav() {
  const router  = useRouter();
  const entity  = useEntityDetail();
  const session = useSessionDetail();
  const notes   = useNotesStore();
  const hist    = useViewHistory();

  function snapshot() {
    return {
      route: router.currentRoute.value.name || null,
      entityId: entity.isOpen.value ? entity.currentEntityId.value : null,
      notesKind: notes.activeKind,
      notesId: notes.activeId,
      notesSessionId: notes.activeSessionId
    };
  }

  function keyOf(s) {
    return [s.route, s.entityId, s.notesKind, s.notesId, s.notesSessionId].join('|');
  }

  async function restore(s) {
    if (!s) return;
    hist.restoring.value = true;
    try {
      session.close();
      if (s.route && router.currentRoute.value.name !== s.route) {
        await router.push({ name: s.route });
      }
      // Only drive the notes doc when the target view is the notes page.
      if (s.route === 'notes') {
        if (s.notesKind === 'session' && s.notesSessionId) notes.setActiveSession(s.notesSessionId);
        else if (s.notesKind === 'note' && s.notesId) notes.setActive(s.notesId);
      }
      if (s.entityId) entity.open(s.entityId, 'back');
      else entity.close();
    } finally {
      // Let the reactive changes from restore settle before recording resumes.
      setTimeout(() => { hist.restoring.value = false; }, 40);
    }
  }

  function goBack() { restore(hist.pop()); }

  return { snapshot, keyOf, restore, goBack, canGoBack: hist.canGoBack, history: hist };
}
