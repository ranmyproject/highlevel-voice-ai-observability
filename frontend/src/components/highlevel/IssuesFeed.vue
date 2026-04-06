<script setup lang="ts">
import type { DashboardIssueFeedItem } from "../../types/observability";
import { formatDisplayDate } from "../../utils/format";

defineProps<{
  issues: DashboardIssueFeedItem[];
}>();

defineEmits<{
  "select-agent": [agentId: string];
}>();

function severityClass(severity: string): string {
  if (severity === "high") return "bg-red-500";
  if (severity === "medium") return "bg-amber-400";
  return "bg-slate-300";
}

function severityLabelClass(severity: string): string {
  if (severity === "high") return "text-red-600 bg-red-50 ring-1 ring-red-200";
  if (severity === "medium") return "text-amber-600 bg-amber-50 ring-1 ring-amber-200";
  return "text-slate-600 bg-slate-100";
}
</script>

<template>
  <div v-if="issues.length > 0" class="border-t border-slate-200 bg-white">
    <div class="px-6 py-3 sm:px-8">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
          Recent Issues
        </span>
        <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
          {{ issues.length }}
        </span>
      </div>

      <div class="space-y-2">
        <div
          v-for="issue in issues.slice(0, 5)"
          :key="issue.id"
          class="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-slate-200 hover:bg-white"
        >
          <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="severityClass(issue.severity)" />

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <button
                class="text-sm font-semibold text-slate-800 hover:text-blue-600 transition"
                @click="$emit('select-agent', issue.agentId)"
              >
                {{ issue.agentName }}
              </button>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                :class="severityLabelClass(issue.severity)"
              >
                {{ issue.severity }}
              </span>
              <span class="text-xs text-slate-400">
                {{ issue.caller }} · {{ formatDisplayDate(issue.timestamp) }}
              </span>
            </div>
            <p class="mt-0.5 text-sm text-slate-600">{{ issue.label }}</p>
            <p v-if="issue.recommendation" class="mt-0.5 text-xs text-slate-400">
              → {{ issue.recommendation }}
            </p>
          </div>

          <button
            class="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            @click="$emit('select-agent', issue.agentId)"
          >
            View
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
