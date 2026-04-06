<script setup lang="ts">
import AgentKpiPanel from "./AgentKpiPanel.vue";
import type { AgentAnalysisWorkspace } from "../../types/highlevel";

defineProps<{
  workspace: AgentAnalysisWorkspace;
  syncingCalls: boolean;
  analyzing: boolean;
}>();

defineEmits<{
  back: [];
  syncCalls: [];
  analyze: [];
  viewTranscript: [callId: string];
}>();
</script>

<template>
  <div class="overflow-hidden rounded-lg bg-white">
    <div class="flex items-center justify-between px-6 py-3">
      <button
        class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        @click="$emit('back')"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to agents
      </button>

      <div class="flex items-center gap-2">
        <button
          class="inline-flex items-center rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-progress disabled:opacity-60"
          :disabled="syncingCalls"
          @click="$emit('syncCalls')"
        >
          {{ syncingCalls ? "Syncing..." : "Sync Calls" }}
        </button>
        <button
          class="inline-flex items-center rounded-md bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-progress disabled:opacity-60"
          :disabled="analyzing"
          @click="$emit('analyze')"
        >
          {{ analyzing ? "Analyzing..." : "Analyze Transcripts" }}
        </button>
      </div>
    </div>

    <AgentKpiPanel
      :workspace="workspace"
      @view-transcript="$emit('viewTranscript', $event)"
    />
  </div>
</template>
