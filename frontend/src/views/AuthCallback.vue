<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { env } from "../config/env";

const router = useRouter();
const route = useRoute();

const errorMessage = ref<string | null>(null);

onMounted(async () => {
  const code = route.query.code as string | undefined;

  if (!code) {
    errorMessage.value = "No authorization code was received. Please try installing the app again from GoHighLevel.";
    return;
  }

  try {
    const response = await fetch(`${env.apiBaseUrl}/oauth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { message?: string };
      errorMessage.value = body.message || `Authentication failed (${response.status}). Please try again.`;
      return;
    }

    const { locationId, token } = await response.json() as { locationId: string; token: string };

    if (!locationId || !token) {
      errorMessage.value = "Invalid response from server. Please try again.";
      return;
    }

    localStorage.setItem("ghl_location_id", locationId);
    localStorage.setItem("ghl_token", token);
    sessionStorage.setItem("ghl_first_sync", "true");
    router.replace("/");
  } catch {
    errorMessage.value = "Could not connect to the server. Please check your connection and try again.";
  }
});
</script>

<template>
  <!-- Error state -->
  <div v-if="errorMessage" class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div class="w-full max-w-md">
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="h-1.5 w-full bg-gradient-to-r from-red-500 to-rose-400" />
        <div class="px-8 py-10 text-center">
          <!-- Icon -->
          <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/50">
            <svg class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 class="mb-2 text-lg font-semibold text-slate-900">Authentication failed</h1>
          <p class="mx-auto max-w-xs text-sm leading-relaxed text-slate-500">{{ errorMessage }}</p>

          <div class="my-7 border-t border-slate-100" />

          <p class="text-xs text-slate-400">
            Try reinstalling the app from your GoHighLevel marketplace.
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Loading state -->
  <div v-else class="flex min-h-screen items-center justify-center bg-slate-50">
    <div class="flex flex-col items-center gap-4">
      <div class="relative flex h-14 w-14 items-center justify-center">
        <div class="absolute h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
        <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div class="text-center">
        <p class="text-sm font-medium text-slate-700">Connecting your account</p>
        <p class="mt-0.5 text-xs text-slate-400">This will only take a moment…</p>
      </div>
    </div>
  </div>
</template>
