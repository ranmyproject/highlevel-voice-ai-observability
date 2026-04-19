<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const locationId = ref<string>("");

onMounted(() => {
  const locId = (route.query.location_id || route.query.locationId) as string | undefined;
  if (locId) {
    locationId.value = locId;
    localStorage.setItem("ghl_location_id", locId);
  }
});
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
        Observability Copilot has been installed successfully.
      </p>
      <p class="mt-1 text-sm leading-6 text-slate-500">
        We did not auto-redirect because the app may be installed on a specific sub-account/location.
      </p>

      <!-- How to find it card -->
      <div class="mt-8 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">How to access it</p>
        <ol class="space-y-3">
          <li class="flex items-start gap-3">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
            <span class="text-sm leading-5 text-slate-600">Open the correct <strong class="text-slate-800">sub-account/location</strong> in GoHighLevel where you installed this app.</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
            <span class="text-sm leading-5 text-slate-600">Go to <strong class="text-slate-800">AI Agents → Voice AI</strong> and open the agent you want to monitor.</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
            <span class="text-sm leading-5 text-slate-600">Open the <strong class="text-slate-800">Observability</strong> tab to view insights and recommendations.</span>
          </li>
        </ol>

        <div v-if="locationId" class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Detected Location ID</p>
          <p class="mt-1 break-all font-mono text-xs text-slate-700">{{ locationId }}</p>
        </div>
      </div>

    </div>
  </div>
</template>
