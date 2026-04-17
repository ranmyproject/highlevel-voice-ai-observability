<script setup lang="ts">
import { computed, ref } from "vue";

import type {
  AgentAnalysisWorkspace,
  AgentKpiAggregate,
  AgentKpiItem
} from "../../types/highlevel";
import { formatDisplayDate } from "../../utils/format";
import { observabilityApi } from "../../services/observabilityApi";

type DetailTab = "insights" | "transcripts" | "kpis";

interface CustomKpiDraft {
  kpi: string;
}

interface CustomKpi extends CustomKpiDraft {
  id: string;
}

const props = defineProps<{
  workspace: AgentAnalysisWorkspace;
}>();

defineEmits<{
  viewTranscript: [callId: string];
}>();

const activeTab = ref<DetailTab>("insights");
const customKpiDraft = ref<CustomKpiDraft>({ kpi: "" });
const customKpis = ref<CustomKpi[]>([]);

// apply-recommendation state: key = recommendation id
const applyingId = ref<string | null>(null);
const applyResult = ref<Record<string, { success: boolean; preview?: string; error?: string }>>({});

async function applyFix(recommendationId: string): Promise<void> {
  const agentId = props.workspace.agent.id;
  applyingId.value = recommendationId;
  delete applyResult.value[recommendationId];

  try {
    const result = await observabilityApi.applyRecommendation(agentId, recommendationId);
    applyResult.value[recommendationId] = { success: true, preview: result.updatedPromptPreview };
  } catch (err: unknown) {
    applyResult.value[recommendationId] = {
      success: false,
      error: err instanceof Error ? err.message : "Failed to apply fix"
    };
  } finally {
    applyingId.value = null;
  }
}

const sortedCalls = computed(() =>
  [...props.workspace.calls].sort((a, b) => {
    const left = new Date(b.lastUpdatedAt || b.syncedAt).getTime();
    const right = new Date(a.lastUpdatedAt || a.syncedAt).getTime();
    return left - right;
  })
);

const feedbackCycle = computed(() => props.workspace.agent.latestFeedbackCycle || null);
const aggregates = computed(() => props.workspace.agent.aggregates || null);

// Sort by highest issue rate (most problems first)
const displayedKpis = computed<AgentKpiAggregate[]>(() =>
  aggregates.value?.kpiAggregates
    ? [...aggregates.value.kpiAggregates].sort((a, b) => {
        const aIssueRate = a.total > 0 ? (a.deviated + a.failed + a.missed) / a.total : 0;
        const bIssueRate = b.total > 0 ? (b.deviated + b.failed + b.missed) / b.total : 0;
        return bIssueRate - aIssueRate;
      })
    : []
);

const topActions = computed(() => (props.workspace.agent.recommendations || []).slice(0, 5));

const combinedKpis = computed<AgentKpiItem[]>(() => {
  const blueprintKpis = props.workspace.kpiBlueprint?.kpis ?? [];
  const manualKpis: AgentKpiItem[] = customKpis.value.map((k) => ({
    id: k.id,
    kpi: k.kpi
  }));
  return [...blueprintKpis, ...manualKpis];
});

const healthBadgeClass = computed(() => {
  const health = feedbackCycle.value?.healthStatus;
  if (health === "healthy") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (health === "needs_attention") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (health === "at_risk") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  return "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
});

const healthLabel = computed(() => {
  const health = feedbackCycle.value?.healthStatus;
  if (health === "healthy") return "Healthy";
  if (health === "needs_attention") return "Needs attention";
  if (health === "at_risk") return "At risk";
  return "No data";
});

function issueRate(kpi: AgentKpiAggregate): number {
  return kpi.total > 0 ? Math.round(((kpi.deviated + kpi.failed + kpi.missed) / kpi.total) * 100) : 0;
}

function issueRateClass(rate: number): string {
  if (rate <= 20) return "text-emerald-600";
  if (rate <= 50) return "text-amber-600";
  return "text-red-600";
}

function priorityBadgeClass(priority: string): string {
  if (priority === "high") return "bg-red-100 text-red-700";
  if (priority === "medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function ownerBadgeClass(owner: string): string {
  if (owner === "prompt") return "bg-blue-100 text-blue-700";
  if (owner === "operations") return "bg-violet-100 text-violet-700";
  return "bg-orange-100 text-orange-700";
}

function ownerLabel(owner: string): string {
  if (owner === "prompt") return "Prompt fix";
  if (owner === "operations") return "Operations";
  return "QA review";
}

function getCallEvaluation(callId: string) {
  return props.workspace.evaluations.find((e) => e.callId === callId) ?? null;
}

function addCustomKpi(): void {
  const kpi = customKpiDraft.value.kpi.trim();
  if (!kpi) return;

  customKpis.value.unshift({ id: `manual-${Date.now()}`, kpi });
  customKpiDraft.value = { kpi: "" };
}
</script>

<template>
  <!-- Agent header — Redundant when embedded in GHL agent details page so we just show stats directly -->
  <div class="px-6 py-5">
    <!-- Stats row -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-lg bg-blue-50 px-4 py-3">
        <p class="text-xs text-blue-500">Overall Score</p>
        <p class="mt-1 text-xl font-semibold text-blue-700">
          {{ aggregates ? `${aggregates.overallScore}/100` : "—" }}
        </p>
      </div>
      <div class="rounded-lg bg-emerald-50 px-4 py-3">
        <p class="text-xs text-emerald-600">Goal Achievement</p>
        <p class="mt-1 text-xl font-semibold text-emerald-700">
          {{ aggregates ? `${aggregates.goalAchievementRate}%` : "—" }}
        </p>
      </div>
      <div class="rounded-lg bg-violet-50 px-4 py-3">
        <p class="text-xs text-violet-500">Analyzed Calls</p>
        <p class="mt-1 text-xl font-semibold text-violet-700">
          {{ feedbackCycle?.monitorSummary.llmAnalyzedCalls ?? 0 }}
        </p>
      </div>
      <div class="rounded-lg bg-amber-50 px-4 py-3">
        <p class="text-xs text-amber-600">Skipped Calls</p>
        <p class="mt-1 text-xl font-semibold text-amber-700">
          {{ feedbackCycle?.monitorSummary.skippedCalls ?? 0 }}
        </p>
      </div>
    </div>
  </div>

  <!-- Tabs -->
  <nav class="flex gap-6 border-b border-slate-100 px-6">
    <button
      v-for="tab in [
        { id: 'insights', label: 'Insights' },
        { id: 'transcripts', label: 'Transcripts' },
        { id: 'kpis', label: 'KPIs' }
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

  <!-- Insights tab -->
  <section v-if="activeTab === 'insights'" class="px-6 py-5">
    <div class="grid gap-5 lg:grid-cols-[1fr_340px]">

      <!-- Recommendations -->
      <div>
        <div class="mb-3 flex items-center justify-between">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Recommendations</p>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {{ topActions.length }} actions
          </span>
        </div>

        <div v-if="topActions.length === 0" class="rounded-lg bg-slate-50 px-5 py-8 text-center text-sm text-slate-400">
          No recommendations yet. Run transcript analysis first.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="item in topActions"
            :key="item.id"
            class="rounded-lg bg-slate-50 p-4"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
                :class="priorityBadgeClass(item.priority)"
              >
                {{ item.priority }}
              </span>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="ownerBadgeClass(item.owner)"
              >
                {{ ownerLabel(item.owner) }}
              </span>
              <span class="ml-auto text-xs text-slate-400">{{ item.basedOnCallCount }} calls</span>
            </div>
            <p class="mt-2 text-sm font-semibold text-slate-800">{{ item.title }}</p>
            <p class="mt-0.5 text-sm leading-5 text-slate-500">{{ item.description }}</p>

            <!-- Apply Fix button (only for prompt-type recommendations) -->
            <div v-if="item.owner === 'prompt'" class="mt-3">
              <!-- Success state -->
              <div v-if="applyResult[item.id]?.success" class="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <span class="font-semibold">✓ Applied to HighLevel.</span>
                <span v-if="applyResult[item.id]?.preview" class="ml-1 text-emerald-600 line-clamp-2">{{ applyResult[item.id].preview }}</span>
              </div>
              <!-- Error state -->
              <div v-else-if="applyResult[item.id]?.error" class="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                ✕ {{ applyResult[item.id].error }}
              </div>
              <!-- Button -->
              <button
                v-else
                class="mt-1 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-progress disabled:opacity-60"
                :disabled="applyingId === item.id"
                @click="applyFix(item.id)"
              >
                <svg v-if="applyingId === item.id" class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ applyingId === item.id ? "Applying fix…" : "Apply Fix" }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- KPI breakdown -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">KPI Performance</p>

        <div v-if="displayedKpis.length === 0" class="rounded-lg bg-slate-50 px-5 py-8 text-center text-sm text-slate-400">
          Run transcript analysis to see KPI performance.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="kpi in displayedKpis"
            :key="kpi.kpiId"
            class="rounded-lg bg-slate-50 p-4"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm leading-5 text-slate-700">{{ kpi.kpi }}</p>
              <span
                class="shrink-0 text-sm font-bold"
                :class="issueRateClass(issueRate(kpi))"
              >{{ issueRate(kpi) }}%</span>
            </div>

            <!-- Stacked bar -->
            <div v-if="kpi.total > 0" class="mt-2.5 flex h-1.5 overflow-hidden rounded-full">
              <div
                v-if="kpi.achieved > 0"
                class="bg-emerald-400"
                :style="{ width: `${(kpi.achieved / kpi.total) * 100}%` }"
              />
              <div
                v-if="kpi.deviated > 0"
                class="bg-amber-400"
                :style="{ width: `${(kpi.deviated / kpi.total) * 100}%` }"
              />
              <div
                v-if="kpi.failed > 0"
                class="bg-red-400"
                :style="{ width: `${(kpi.failed / kpi.total) * 100}%` }"
              />
              <div
                v-if="kpi.missed > 0"
                class="bg-orange-300"
                :style="{ width: `${(kpi.missed / kpi.total) * 100}%` }"
              />
            </div>

            <!-- Count pills -->
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span v-if="kpi.achieved > 0" class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                ✓ {{ kpi.achieved }} achieved
              </span>
              <span v-if="kpi.deviated > 0" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                ~ {{ kpi.deviated }} deviated
              </span>
              <span v-if="kpi.failed > 0" class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                ✕ {{ kpi.failed }} failed
              </span>
              <span v-if="kpi.missed > 0" class="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                — {{ kpi.missed }} missed
              </span>
              <span class="ml-auto text-xs text-slate-400">{{ kpi.total }} calls</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </section>

  <!-- Transcripts tab -->
  <section v-else-if="activeTab === 'transcripts'" class="px-6 py-5">
    <div v-if="sortedCalls.length === 0" class="rounded-lg bg-slate-50 px-5 py-8 text-center text-sm text-slate-400">
      No synced calls yet. Sync calls first, then analyze transcripts.
    </div>

    <div v-else class="overflow-x-auto rounded-lg bg-slate-50">
      <table class="min-w-full border-collapse bg-transparent text-sm">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50">
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Caller</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Monitor</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Decision</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Duration</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Score</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">KPIs</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 bg-white">
          <tr
            v-for="call in sortedCalls"
            :key="call.id"
            class="cursor-pointer hover:bg-blue-50 transition-colors"
            @click="$emit('viewTranscript', call.id)"
          >
            <td class="px-4 py-3 font-medium text-slate-900">{{ call.caller }}</td>
            <td class="px-4 py-3 text-slate-500">{{ formatDisplayDate(call.lastUpdatedAt || call.syncedAt) }}</td>
            <td class="px-4 py-3 text-slate-500">{{ call.monitor?.objectiveStatus || "—" }}</td>
            <td class="px-4 py-3 text-slate-500">{{ call.monitor?.shouldAnalyze ? "Analyze" : "Skip" }}</td>
            <td class="px-4 py-3 text-slate-500">{{ call.durationSec }}s</td>
            <td class="px-4 py-3 text-slate-500">
              {{ getCallEvaluation(call.id) ? `${getCallEvaluation(call.id)!.overallScore}/100` : "—" }}
            </td>
            <td class="px-4 py-3 text-slate-500">{{ getCallEvaluation(call.id)?.kpiResults.length || 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>


  <!-- KPIs tab -->
  <section v-else class="px-6 py-5">
    <div class="grid gap-5 lg:grid-cols-2">
      <div class="rounded-lg bg-slate-50 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Tracked KPIs</p>
        <ul class="mt-4 space-y-2">
          <li
            v-for="(kpi, index) in combinedKpis"
            :key="kpi.id"
            class="flex items-start gap-3 rounded-md bg-white px-3 py-2.5"
          >
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {{ index + 1 }}
            </span>
            <span class="text-sm leading-6 text-slate-700">{{ kpi.kpi }}</span>
          </li>
        </ul>
      </div>

      <div class="rounded-lg bg-slate-50 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Add Manual KPI</p>
        <div class="mt-3 space-y-2">
          <textarea
            v-model="customKpiDraft.kpi"
            rows="3"
            placeholder="Plain English statement of what a good call should do or avoid"
            class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
          />
          <button
            class="inline-flex items-center rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            @click="addCustomKpi"
          >
            Add KPI
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
