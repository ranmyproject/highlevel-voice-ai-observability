<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { AUTH_TOKEN_KEY } from "../services/httpClient";
import { observabilityApi } from "../services/observabilityApi";

const route = useRoute();

const locationId = ref<string>("");
const countdown = ref(5);
const redirectUrl = ref("https://app.gohighlevel.com/v2/ai-agents/voice-ai");

onMounted(() => {
  const locId = (route.query.location_id || route.query.locationId) as string | undefined;
  if (locId) {
    locationId.value = locId;
    localStorage.setItem("ghl_location_id", locId);
    redirectUrl.value = `https://app.gohighlevel.com/v2/location/${locId}/ai-agents/voice-ai`;

    observabilityApi.verifyLocation(locId)
      .then((result) => {
        localStorage.setItem(AUTH_TOKEN_KEY, result.token);
      })
      .catch(() => {
        // Best effort. Redirect can still happen; the app shell will retry later if needed.
      });
  }

  // Countdown then redirect
  const timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(timer);
      window.location.href = redirectUrl.value;
    }
  }, 1000);
});

function goNow() {
  window.location.href = redirectUrl.value;
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4">
    <div class="w-full max-w-md text-center">

      <!-- Animated check circle -->
      <div class="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 shadow-lg shadow-emerald-100 ring-4 ring-emerald-50">
        <svg class="h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <!-- Brand mark -->
      <div class="mb-6 flex items-center justify-center gap-2">
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
          <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <span class="text-sm font-semibold text-slate-600">Observability Copilot</span>
      </div>

      <h1 class="text-2xl font-bold tracking-tight text-slate-900">
        You're all set! 🎉
      </h1>
      <p class="mt-3 text-base leading-7 text-slate-500">
        Observability Copilot has been installed successfully and is now active on your account.
      </p>

      <!-- How to find it card -->
      <div class="mt-8 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">How to access it</p>
        <ol class="space-y-3">
          <li class="flex items-start gap-3">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
            <span class="text-sm leading-5 text-slate-600">Go to <strong class="text-slate-800">AI Agents → Voice AI</strong> in your GHL sidebar</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
            <span class="text-sm leading-5 text-slate-600">Open any <strong class="text-slate-800">Voice AI Agent</strong> you want to monitor</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
            <span class="text-sm leading-5 text-slate-600">Click the <strong class="text-slate-800">Observability</strong> tab to see analytics, KPIs, and AI recommendations</span>
          </li>
        </ol>
      </div>

      <!-- Redirect notice -->
      <div class="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400">
        <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Redirecting to your agents in {{ countdown }}s…
      </div>

      <!-- Manual redirect button -->
      <button
        class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98]"
        @click="goNow"
      >
        Go to Voice AI Agents now
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>

    </div>
  </div>
</template>
