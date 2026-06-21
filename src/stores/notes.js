// Personal notes tree state. One jsonb blob per user, server-backed.
// Supports DM "view as" — when viewingAs is set, reads/writes that
// player's tree (mirrors the old notepad behaviour).
import { defineStore } from 'pinia';
import { useAuthStore } from 'src/stores/auth';
import {
  fetchNotepad, saveNotepad,
  noteNode, folderNode,
  childrenOf, isDescendant, subtreeIds, nextPosition
} from 'src/api/notepad';
import * as sessionsApi from 'src/api/sessions';

export const useNotesStore = defineStore('notesTree', {
  state: () => ({
    nodes: [],
    activeId: null,
    loading: false,
    saving: false,
    lastSavedAt: null,
    loadedFor: null,
    sessions: [],
    _saveTimer: null
  }),

  getters: {
    rootNodes: (s) => childrenOf(s.nodes, null),
    activeNode: (s) => s.nodes.find(n => n.id === s.activeId) || null,
    childrenById: (s) => (parentId) => childrenOf(s.nodes, parentId)
  },

  actions: {
    _targetEmail() {
      const auth = useAuthStore();
      if (auth.isViewingAs && auth.viewingAs) return auth.viewingAs + '@compendium.local';
      return auth.user?.email || null;
    },

    async load() {
      const email = this._targetEmail();
      this.loading = true;
      try {
        const state = await fetchNotepad(this._overrideEmail());
        this.nodes = state.nodes;
        this.activeId = state.activeId;
        this.loadedFor = email;
      } finally {
        this.loading = false;
      }
      if (!this.sessions.length) {
        try { this.sessions = await sessionsApi.fetchAll(); } catch { this.sessions = []; }
      }
    },

    _overrideEmail() {
      const auth = useAuthStore();
      return auth.isViewingAs && auth.viewingAs
        ? auth.viewingAs + '@compendium.local'
        : null;
    },

    _scheduleSave() {
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.flush(), 1000);
    },

    async flush() {
      if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
      const auth = useAuthStore();
      if (!auth.user) return;
      this.saving = true;
      try {
        await saveNotepad({ nodes: this.nodes, activeId: this.activeId }, this._overrideEmail());
        this.lastSavedAt = new Date();
      } finally {
        this.saving = false;
      }
    },

    setActive(id) {
      const n = this.nodes.find(x => x.id === id);
      if (!n) return;
      if (n.type === 'folder') { this.toggleCollapse(id); return; }
      this.activeId = id;
      this._scheduleSave();
    },

    createNote(parentId = null) {
      const n = noteNode({ parentId, label: 'New note', position: nextPosition(this.nodes, parentId) });
      this.nodes.push(n);
      if (parentId) this._expand(parentId);
      this.activeId = n.id;
      this._scheduleSave();
      return n.id;
    },

    createFolder(parentId = null) {
      const n = folderNode({ parentId, label: 'New folder', position: nextPosition(this.nodes, parentId) });
      this.nodes.push(n);
      if (parentId) this._expand(parentId);
      this._scheduleSave();
      return n.id;
    },

    rename(id, label) {
      const n = this.nodes.find(x => x.id === id);
      if (!n) return;
      n.label = String(label || '').trim() || (n.type === 'folder' ? 'New folder' : 'Untitled');
      this._scheduleSave();
    },

    remove(id) {
      const ids = new Set(subtreeIds(this.nodes, id));
      this.nodes = this.nodes.filter(n => !ids.has(n.id));
      if (ids.has(this.activeId)) {
        const firstNote = this.nodes.find(n => n.type === 'note');
        this.activeId = firstNote ? firstNote.id : null;
      }
      this._scheduleSave();
    },

    setNoteHtml(id, html) {
      const n = this.nodes.find(x => x.id === id);
      if (!n || n.type !== 'note') return;
      if (n.html === html) return;
      n.html = html;
      this._scheduleSave();
    },

    toggleCollapse(id) {
      const n = this.nodes.find(x => x.id === id);
      if (n && n.type === 'folder') { n.collapsed = !n.collapsed; this._scheduleSave(); }
    },

    _expand(id) {
      const n = this.nodes.find(x => x.id === id);
      if (n && n.type === 'folder') n.collapsed = false;
    },

    // Move `id` under `newParentId` (null = top level). Guards against
    // dropping a folder into its own descendant. `beforeId` optional —
    // drop just before that sibling; otherwise append.
    move(id, newParentId, beforeId = null) {
      if (id === newParentId) return;
      const node = this.nodes.find(n => n.id === id);
      if (!node) return;
      // Can't move a node into itself or any of its descendants.
      if (newParentId && isDescendant(this.nodes, newParentId, id)) return;

      node.parentId = newParentId ?? null;
      // Reindex siblings, inserting node before `beforeId` if given.
      const sibs = childrenOf(this.nodes, newParentId).filter(n => n.id !== id);
      const ordered = [];
      let inserted = false;
      sibs.forEach(s => {
        if (beforeId && s.id === beforeId) { ordered.push(node); inserted = true; }
        ordered.push(s);
      });
      if (!inserted) ordered.push(node);
      ordered.forEach((n, i) => { n.position = i; });
      if (newParentId) this._expand(newParentId);
      this._scheduleSave();
    }
  }
});
