<script setup lang="ts">
defineProps<{
  activePage?: "agents";
  agentName?: string;
}>();

defineEmits<{
  "nav-agents": [];
}>();
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
    <div class="mx-auto flex max-w-7xl items-center gap-6 px-4 py-0 sm:px-6 lg:px-8">
      <!-- Brand -->
      <div class="flex shrink-0 items-center gap-2.5 py-3.5">
        <div
          class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1.5a.5.5 0 0 1 .5.5v1.586l1.146-1.147a.5.5 0 0 1 .708.708L9.207 4.293A3.5 3.5 0 0 1 11.5 7.5c0 .175-.013.347-.037.516l1.39.695a.5.5 0 0 1-.707.707l-.694-1.39A3.5 3.5 0 1 1 4.538 8.71l-.694 1.39a.5.5 0 0 1-.707-.707l1.39-.695A3.502 3.502 0 0 1 7.5 4.293L6.354 3.147a.5.5 0 0 1 .708-.708L8.207 3.586V2a.5.5 0 0 1-.207-.5ZM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div class="leading-none">
          <p class="text-sm font-bold tracking-tight text-slate-900">Observability Copilot</p>
          <p class="mt-0.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
            Voice AI · HighLevel
          </p>
        </div>
      </div>

      <!-- Divider -->
      <div class="h-6 w-px bg-slate-200" />

      <!-- Nav links -->
      <nav class="flex items-stretch gap-1">
        <button
          class="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition"
          :class="
            activePage === 'agents'
              ? 'text-blue-600 bg-blue-50'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          "
          @click="$emit('nav-agents')"
        >
          <svg
            class="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Agents
        </button>

      </nav>

      <!-- Breadcrumb for agent detail -->
      <div
        v-if="agentName"
        class="flex items-center gap-2 text-sm text-slate-500"
      >
        <svg class="h-3.5 w-3.5 text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span class="max-w-[200px] truncate font-medium text-slate-700">{{ agentName }}</span>
      </div>

      <!-- Right: live status badge -->
      <div class="ml-auto flex items-center gap-2">
        <span class="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span class="relative flex h-1.5 w-1.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>
    </div>
  </header>
</template>
