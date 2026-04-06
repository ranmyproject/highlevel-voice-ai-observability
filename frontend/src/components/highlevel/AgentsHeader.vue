<script setup lang="ts">
defineProps<{
  syncingAgents: boolean;
}>();

defineEmits<{
  syncAgents: [];
}>();
</script>

<template>
  <header
    class="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between"
  >
    <div class="space-y-1">
      <h1 class="text-4xl font-semibold tracking-tight text-slate-900">AI Agents</h1>
      <p class="text-sm text-slate-500">Voice agent health and transcript readiness</p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button
        class="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-progress disabled:opacity-70"
        :disabled="syncingAgents"
        @click="$emit('syncAgents')"
      >
        {{ syncingAgents ? "Syncing Agents..." : "Sync Agents" }}
      </button>
    </div>
  </header>
</template>
