<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div class="w-full max-w-md">
      <!-- Card -->
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <!-- Red top bar -->
        <div class="h-1.5 w-full bg-gradient-to-r from-red-500 to-rose-400" />

        <div class="px-8 py-10 text-center">
          <!-- Icon -->
          <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/50">
            <svg class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>

          <!-- Text -->
          <h1 class="mb-2 text-lg font-semibold text-slate-900">Access not authorised</h1>
          <p class="mx-auto max-w-xs text-sm leading-relaxed text-slate-500">
            This app must be opened from your GoHighLevel account. Launch it through the GHL marketplace to continue.
          </p>

          <!-- Divider -->
          <div class="my-7 border-t border-slate-100" />

          <!-- Steps -->
          <ol class="space-y-3 text-left">
            <li v-for="(step, i) in steps" :key="i" class="flex items-start gap-3">
              <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {{ i + 1 }}
              </span>
              <span class="text-sm text-slate-500">{{ step }}</span>
            </li>
          </ol>
        </div>
      </div>

      <!-- Footer note -->
      <p class="mt-5 text-center text-xs text-slate-400">
        Need help? Contact your GoHighLevel administrator.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const steps = [
  "Log in to your GoHighLevel account",
  "Navigate to the App Marketplace",
  "Open Voice AI Observability from your installed apps",
];
</script>
