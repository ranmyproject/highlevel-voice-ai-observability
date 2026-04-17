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
  <div class="w-full bg-white">
    <!-- Slim action toolbar — no back button since GHL handles navigation -->
    <div class="flex items-center justify-end gap-2 border-b border-slate-100 px-6 py-3">
      <button
        class="inline-flex items-center rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-progress disabled:opacity-60"
        :disabled="syncingCalls"
        @click="$emit('syncCalls')"
      >
        <svg class="mr-1.5 h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {{ syncingCalls ? "Syncing..." : "Sync Calls" }}
      </button>
      <button
        class="inline-flex items-center rounded-md bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-progress disabled:opacity-60"
        :disabled="analyzing"
        @click="$emit('analyze')"
      >
        <svg class="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        {{ analyzing ? "Analyzing..." : "Analyze Transcripts" }}
      </button>
    </div>

    <AgentKpiPanel
      :workspace="workspace"
      @view-transcript="$emit('viewTranscript', $event)"
    />
  </div>
</template>
