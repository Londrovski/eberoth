<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <q-page class="row items-center justify-center landing-page">
        <div class="landing-card">
          <div class="landing-rule" />
          <img class="landing-logo" :src="LOGO" alt="Eberoth" />
          <h1 class="landing-eberoth">Eberoth</h1>
          <div class="landing-compendium">The Compendium</div>
          <div class="landing-rule" />

          <p class="landing-tag">Enter your passphrase.</p>
          <q-form @submit.prevent="onSubmit">
            <input
              v-model="passphrase"
              type="text"
              class="landing-input"
              :class="{ shake: !!error }"
              placeholder="Passphrase"
              maxlength="30"
              autocomplete="off"
              spellcheck="false"
              autofocus
              @input="onInput"
            />
            <div class="landing-actions">
              <button type="submit" :disabled="!passphrase.trim() || loading">
                {{ loading ? '…' : 'Enter' }}
              </button>
            </div>
          </q-form>

          <div class="landing-error">{{ error || ' ' }}</div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth';

const LOGO = 'https://raw.githubusercontent.com/Londrovski/eberoth/main/images/eberoth%20logo.png';

const router = useRouter();
const auth = useAuthStore();
const passphrase = ref('');
const error = ref(null);
const loading = ref(false);

function onInput(e) {
  const upper = String(e.target.value || '').toUpperCase();
  if (upper !== passphrase.value) passphrase.value = upper;
}

async function onSubmit() {
  error.value = null;
  loading.value = true;
  const result = await auth.signInWithPassphrase(passphrase.value);
  loading.value = false;
  if (result?.error) {
    error.value = result.error.message || 'Unable to sign in';
    return;
  }
  router.push({ name: 'home' });
}
</script>

<style scoped>
.landing-page {
  background-color: var(--bg);
  background-image:
    linear-gradient(180deg, rgba(11,9,5,0.55) 0%, rgba(11,9,5,0.85) 100%),
    url('https://raw.githubusercontent.com/Londrovski/eberoth/main/images/The%20Descending%20Horizon.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.landing-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 40px 48px 32px;
  width: min(460px, 92vw);
  text-align: center;
  box-shadow: 0 12px 40px rgba(0,0,0,0.75);
}
.landing-rule {
  height: 1px;
  background: var(--gold-dim);
  opacity: 0.5;
  margin: 0 auto;
  width: 80%;
}
.landing-logo {
  display: block;
  width: 160px;
  height: 160px;
  object-fit: contain;
  margin: 28px auto 6px;
  filter: drop-shadow(0 0 24px rgba(201,169,97,0.55));
}
.landing-eberoth {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-weight: 700;
  font-size: 56px;
  color: var(--gold);
  letter-spacing: 0.05em;
  line-height: 1;
  padding: 6px 0 10px;
  text-shadow:
    0 0 30px rgba(201,169,97,0.7),
    0 0 60px rgba(201,169,97,0.35),
    0 2px 12px rgba(0,0,0,1);
  margin: 0;
}
.landing-compendium {
  font-size: 13px;
  color: var(--gold-dim);
  padding-bottom: 18px;
}
.landing-tag {
  color: var(--text-dim);
  font-style: italic;
  margin-top: 22px;
  margin-bottom: 14px;
  font-size: 14px;
}
.landing-input {
  width: 100%;
  background: var(--bg-panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 10px 12px;
  border-radius: 3px;
  font-family: inherit;
  font-size: 16px;
  letter-spacing: 3px;
  text-align: center;
  text-transform: uppercase;
  outline: none;
}
.landing-input:focus { border-color: var(--gold-dim); }
.landing-input.shake { animation: shake 0.35s ease; border-color: var(--red); }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-6px); }
  40%      { transform: translateX(6px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(4px); }
}
.landing-actions { margin-top: 16px; }
.landing-actions button {
  width: 100%;
  background: var(--gold-dim);
  border: 1px solid var(--gold-dim);
  color: var(--bg);
  padding: 9px 0;
  font-size: 13px;
  cursor: pointer;
  border-radius: 3px;
}
.landing-actions button:hover:not(:disabled) {
  background: var(--gold);
  border-color: var(--gold);
}
.landing-actions button:disabled { opacity: 0.5; cursor: default; }
.landing-error {
  color: var(--red);
  font-size: 13px;
  margin-top: 12px;
  min-height: 18px;
  font-style: italic;
}
</style>
