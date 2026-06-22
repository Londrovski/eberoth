// Auth store. Tracks who is signed in (passcode → bucket).
// Also tracks viewing-as (DM previewing another player).
//
// Buckets: dm | baker | butcher | charlie | guest | null
//
// Mapping inherited from the original static site (03-auth.js):
//   MAREN   → baker    (Kalvorn)
//   SYLVIA  → butcher  (Azrael)
//   TEACHER → charlie  (Dirk)
//   THOREBE → dm
// Email = '<bucket>@compendium.local', password = the passcode.
// normalisePasscode strips non-letters and uppercases the input.
//
// effectiveBucket() returns viewingAs if set, otherwise actual.
// All visibility-aware reads should key off effectiveBucket.
//
// Source of truth: Supabase session. We subscribe to onAuthStateChange
// so the store stays in sync — if the session expires or is signed
// out, actualBucket falls back to null automatically.

import { defineStore } from 'pinia';
import { supabase } from 'boot/supabase';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    actualBucket: null,
    viewingAs: null,
    hydrated: false
  }),
  getters: {
    isDM:         (s) => s.actualBucket === 'dm',
    isViewingAs:  (s) => s.isDM && s.viewingAs && s.viewingAs !== 'dm',
    effectiveBucket: (s) => s.isViewingAs ? s.viewingAs : s.actualBucket
  },
  actions: {
    async hydrate() {
      const { data } = await supabase.auth.getSession();
      this._applySession(data?.session);
      if (!this.hydrated) {
        supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT') {
            this._clearSession();
          } else if (session) {
            this._applySession(session);
          }
        });
        this.hydrated = true;
      }
    },
    _applySession(session) {
      if (session && session.user) {
        this.user = session.user;
        this.actualBucket = bucketFromEmail(session.user.email);
      } else {
        this._clearSession();
      }
    },
    _clearSession() {
      this.user = null;
      this.actualBucket = null;
      this.viewingAs = null;
    },
    async signInWithPassphrase(rawPassphrase) {
      const passcode = normalisePasscode(rawPassphrase);
      const bucket = PASSCODES[passcode];
      if (!bucket) return { error: new Error('Unknown passphrase') };
      const email = bucket + '@compendium.local';
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: passcode
      });
      if (error) return { error };
      this._applySession(data.session);
      return { user: data.user };
    },
    async signOut() {
      await supabase.auth.signOut();
      this._clearSession();
    },
    setViewingAs(bucket) {
      if (!this.isDM) return;
      this.viewingAs = (bucket === 'dm' || !bucket) ? null : bucket;
    }
  }
});

// passcode → bucket. Matches the original site's PASSCODES.
const PASSCODES = {
  'MAREN':   'baker',
  'SYLVIA':  'butcher',
  'TEACHER': 'charlie',
  'THOREBE': 'dm'
};

function normalisePasscode(s) {
  return String(s || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
}

function bucketFromEmail(email) {
  if (!email) return null;
  // Email format is '<bucket>@compendium.local'.
  const local = String(email).split('@')[0];
  // Valid buckets we recognise.
  if (['dm', 'baker', 'butcher', 'charlie'].indexOf(local) >= 0) return local;
  return null;
}
