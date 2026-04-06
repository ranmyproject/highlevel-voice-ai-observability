<script setup lang="ts">
import { computed, ref } from "vue";
import type { AgentAnalysisWorkspace, CallEndType, KpiStatus } from "../../types/highlevel";
import { formatDisplayDate } from "../../utils/format";

type DetailTab = "overview" | "kpis" | "transcript";

const props = defineProps<{
  workspace: AgentAnalysisWorkspace;
  callId: string;
}>();

defineEmits<{
  back: [];
}>();

const activeTab = ref<DetailTab>("overview");

const call = computed(() =>
  props.workspace.calls.find((c) => c.id === props.callId) ?? null
);

const agent = computed(() => props.workspace.agent);

const evaluation = computed(() =>
  props.workspace.evaluations.find((e) => e.callId === props.callId) ?? null
);

const monitor = computed(() => call.value?.monitor ?? null);

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const scoreBadgeClass = computed(() => {
  const score = evaluation.value?.overallScore ?? 0;
  if (score >= 80) return "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200";
  if (score >= 60) return "text-amber-700 bg-amber-50 ring-1 ring-amber-200";
  return "text-red-700 bg-red-50 ring-1 ring-red-200";
});

const monitorBadgeClass = computed(() => {
  const status = monitor.value?.objectiveStatus;
  if (status === "achieved") return "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200";
  if (status === "failed") return "text-red-700 bg-red-50 ring-1 ring-red-200";
  return "text-amber-700 bg-amber-50 ring-1 ring-amber-200";
});

function statusBadgeClass(status: KpiStatus): string {
  if (status === "achieved") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "deviated") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (status === "failed") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (status === "missed") return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
  if (status === "unreachable") return "bg-slate-100 text-slate-500";
  return "bg-slate-100 text-slate-400"; // skipped
}

function statusLabel(status: KpiStatus): string {
  if (status === "achieved") return "Achieved";
  if (status === "deviated") return "Deviated";
  if (status === "failed") return "Failed";
  if (status === "missed") return "Missed";
  if (status === "unreachable") return "Unreachable";
  return "Skipped";
}

const callEndTypeLabelMap: Record<CallEndType, string> = {
  completed: "Completed",
  cut_short: "Cut short",
  caller_hangup: "Caller hung up",
  wrong_number: "Wrong number / too short"
};

function callEndTypeLabel(t: CallEndType): string {
  return callEndTypeLabelMap[t] ?? t;
}

function callEndTypeBadgeClass(t: CallEndType): string {
  if (t === "completed") return "bg-emerald-50 text-emerald-700";
  if (t === "cut_short") return "bg-amber-50 text-amber-700";
  if (t === "caller_hangup") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-500";
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <!-- Top bar -->
    <div class="flex items-center justify-between border-b border-slate-200 px-6 py-3">
      <button
        class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        @click="$emit('back')"
      >
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to {{ agent.name }}
      </button>
    </div>

    <!-- No call found -->
    <div v-if="!call" class="px-6 py-12 text-center text-sm text-slate-400">
      Call not found in workspace. Try syncing calls again.
    </div>

    <template v-else>
      <!-- Call header -->
      <div class="border-b border-slate-200 px-6 py-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Transcript</p>
            <h2 class="mt-1 text-xl font-semibold text-slate-900">{{ call.caller }}</h2>
            <p v-if="call.summary" class="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {{ call.summary }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
            <span
              v-if="evaluation"
              :class="scoreBadgeClass"
              class="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium"
            >
              Score {{ evaluation.overallScore }}/100
            </span>
            <span
              v-if="evaluation && evaluation.callEndType !== 'completed'"
              :class="callEndTypeBadgeClass(evaluation.callEndType)"
              class="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium"
            >
              {{ callEndTypeLabel(evaluation.callEndType) }}
            </span>
            <span
              v-if="monitor"
              :class="monitorBadgeClass"
              class="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium"
            >
              {{ monitor.objectiveStatus }}
            </span>
            <span class="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {{ formatDuration(call.durationSec) }}
            </span>
          </div>
        </div>

        <!-- Stats row -->
        <div class="mt-5 grid grid-cols-2 divide-x divide-y divide-slate-200 rounded-lg border border-slate-200 sm:grid-cols-4 sm:divide-y-0">
          <div class="px-4 py-3">
            <p class="text-xs text-slate-500">Overall Score</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">
              {{ evaluation ? `${evaluation.overallScore}/100` : "—" }}
            </p>
          </div>
          <div class="px-4 py-3">
            <p class="text-xs text-slate-500">Goal Achieved</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">
              {{ evaluation ? (evaluation.goalAchieved ? "Yes" : "No") : "—" }}
            </p>
          </div>
          <div class="px-4 py-3">
            <p class="text-xs text-slate-500">KPIs Evaluated</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">
              {{ evaluation?.kpiResults.length ?? "—" }}
            </p>
          </div>
          <div class="px-4 py-3">
            <p class="text-xs text-slate-500">Date</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">
              {{ formatDisplayDate(call.lastUpdatedAt || call.syncedAt) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <nav class="flex gap-6 border-b border-slate-200 px-6">
        <button
          v-for="tab in [
            { id: 'overview', label: 'Overview' },
            { id: 'kpis', label: 'KPI Scores' },
            { id: 'transcript', label: 'Transcript' }
          ]"
          :key="tab.id"
          class="border-b-2 py-3.5 text-sm font-medium transition"
          :class="
            activeTab === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          "
          @click="activeTab = tab.id as DetailTab"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- Overview tab -->
      <section v-if="activeTab === 'overview'" class="px-6 py-5">
        <div v-if="!evaluation" class="rounded-lg border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-400">
          This call has not been analyzed yet. Run "Analyze Transcripts" from the agent page.
        </div>

        <div v-else class="grid gap-4 lg:grid-cols-2">
          <!-- Summary -->
          <div class="rounded-lg border border-slate-200 p-5">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Evaluation Summary</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">{{ evaluation.summary }}</p>

            <div v-if="evaluation.topFix" class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-amber-600">Top Fix</p>
              <p class="mt-1 text-sm text-amber-800">{{ evaluation.topFix }}</p>
            </div>

            <div v-if="evaluation.promptSnippet" class="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-blue-600">Prompt Snippet</p>
              <pre class="mt-1 whitespace-pre-wrap font-sans text-sm text-blue-800">{{ evaluation.promptSnippet }}</pre>
            </div>
          </div>

          <!-- Monitor + Human Followups -->
          <div class="space-y-4">
            <div class="rounded-lg border border-slate-200 p-5">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Monitor Gate</p>
              <p class="mt-2 text-sm text-slate-700">
                {{ monitor?.shouldAnalyze ? "Sent to LLM for analysis" : "Skipped — high confidence success" }}
              </p>
              <ul v-if="monitor?.notes?.length" class="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-500">
                <li v-for="note in monitor.notes" :key="note">{{ note }}</li>
              </ul>
              <p v-if="monitor?.missingRequirements?.length" class="mt-2 text-sm text-slate-500">
                Missing: {{ monitor.missingRequirements.join(", ") }}
              </p>
            </div>

            <div
              v-if="evaluation.kpiResults.some((r) => r.humanFollowup)"
              class="rounded-lg border border-red-200 bg-red-50 p-5"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-red-500">Human Follow-up Required</p>
              <ul class="mt-3 space-y-2">
                <li
                  v-for="result in evaluation.kpiResults.filter((r) => r.humanFollowup)"
                  :key="result.kpiId"
                  class="text-sm text-red-800"
                >
                  <span class="font-medium">{{ result.kpi }}</span>
                  <blockquote v-if="result.evidence" class="mt-1 border-l-2 border-red-300 pl-3 text-xs italic text-red-700">
                    "{{ result.evidence }}"
                  </blockquote>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- KPI Scores tab -->
      <section v-else-if="activeTab === 'kpis'" class="px-6 py-5">
        <div v-if="!evaluation" class="rounded-lg border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-400">
          No KPI data yet. Run "Analyze Transcripts" from the agent page.
        </div>

        <template v-else>
          <div
            v-if="evaluation.kpiResults.some((r) => r.status === 'unreachable')"
            class="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
          >
            {{ evaluation.kpiResults.filter((r) => r.status === 'unreachable').length }} KPI(s) marked as
            <span class="font-medium text-slate-700">unreachable</span> — the call ended before these stages were reached.
            They are excluded from the score.
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="result in evaluation.kpiResults"
              :key="result.kpiId"
              class="rounded-lg border border-slate-200 p-4"
              :class="{ 'opacity-50': result.status === 'unreachable' }"
            >
              <div class="flex items-start justify-between gap-3">
                <p class="min-w-0 text-sm font-medium text-slate-900">{{ result.kpi }}</p>
                <span
                  class="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
                  :class="statusBadgeClass(result.status)"
                >
                  {{ statusLabel(result.status) }}
                </span>
              </div>
              <p v-if="result.status === 'unreachable'" class="mt-1 text-xs text-slate-400 italic">
                {{ result.evidence }}
              </p>
              <template v-else>
                <blockquote
                  v-if="result.evidence && result.status !== 'skipped'"
                  class="mt-2 border-l-2 border-slate-300 pl-3 text-xs italic text-slate-500"
                >
                  "{{ result.evidence }}"
                </blockquote>
                <p v-if="result.fix" class="mt-2 text-xs text-slate-500">
                  <span class="font-medium text-slate-600">Fix:</span> {{ result.fix }}
                </p>
                <span
                  v-if="result.humanFollowup"
                  class="mt-2 inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700"
                >
                  Human follow-up required
                </span>
              </template>
            </div>
          </div>
        </template>
      </section>

      <!-- Transcript tab -->
      <section v-else-if="activeTab === 'transcript'" class="px-6 py-5">
        <div v-if="!call.transcript" class="rounded-lg border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-400">
          No transcript available for this call.
        </div>
        <div v-else class="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <pre class="whitespace-pre-wrap text-sm leading-7 text-slate-700 font-sans">{{ call.transcript }}</pre>
        </div>
      </section>
    </template>
  </div>
</template>
