<script setup lang="ts">
import { computed, ref } from "vue";
import type { StoredHighLevelVoiceAgent } from "../../types/highlevel";

const props = defineProps<{
  agents: StoredHighLevelVoiceAgent[];
  selectedAgentId: string;
}>();

defineEmits<{
  selectAgent: [agentId: string];
}>();

const PAGE_SIZE = 10;
const currentPage = ref(1);

const totalPages = computed(() => Math.max(1, Math.ceil(props.agents.length / PAGE_SIZE)));

const paginatedAgents = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  return props.agents.slice(start, start + PAGE_SIZE);
});

const showingFrom = computed(() =>
  props.agents.length === 0 ? 0 : (currentPage.value - 1) * PAGE_SIZE + 1
);
const showingTo = computed(() => Math.min(currentPage.value * PAGE_SIZE, props.agents.length));

function healthBadgeClass(agent: StoredHighLevelVoiceAgent): string {
  const health = agent.latestFeedbackCycle?.healthStatus;
  if (health === "healthy") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (health === "needs_attention") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (health === "at_risk") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  return "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
}

function healthLabel(agent: StoredHighLevelVoiceAgent): string {
  const health = agent.latestFeedbackCycle?.healthStatus;
  if (health === "healthy") return "Healthy";
  if (health === "needs_attention") return "Needs attention";
  if (health === "at_risk") return "At risk";
  return "No data";
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200";
  if (score >= 60) return "text-amber-700 bg-amber-50 ring-1 ring-amber-200";
  return "text-red-700 bg-red-50 ring-1 ring-red-200";
}

interface KpiBreakdown {
  achieved: number;
  deviated: number;
  failed: number;
  missed: number;
  total: number;
  achievedPct: number;
  deviatedPct: number;
  failedPct: number;
  missedPct: number;
}

function kpiBreakdown(agent: StoredHighLevelVoiceAgent): KpiBreakdown {
  const empty: KpiBreakdown = { achieved: 0, deviated: 0, failed: 0, missed: 0, total: 0, achievedPct: 0, deviatedPct: 0, failedPct: 0, missedPct: 0 };
  const aggs = agent.aggregates?.kpiAggregates;
  if (!aggs || aggs.length === 0) return empty;

  let achieved = 0, deviated = 0, failed = 0, missed = 0;
  for (const k of aggs) {
    achieved += k.achieved;
    deviated += k.deviated;
    failed += k.failed;
    missed += k.missed;
  }
  const total = achieved + deviated + failed + missed;
  if (total === 0) return empty;
  return {
    achieved,
    deviated,
    failed,
    missed,
    total,
    achievedPct: Math.round((achieved / total) * 100),
    deviatedPct: Math.round((deviated / total) * 100),
    failedPct: Math.round((failed / total) * 100),
    missedPct: Math.round((missed / total) * 100)
  };
}
</script>

<template>
  <section>
    <div
      v-if="agents.length === 0"
      class="flex flex-col items-center gap-2 border-t border-slate-200 bg-white px-6 py-12 text-center"
    >
      <p class="text-sm font-semibold text-slate-700">No agents found</p>
      <p class="text-sm text-slate-500">
        Try a different filter or click "Sync Agents" to fetch from HighLevel.
      </p>
    </div>

    <div v-else class="overflow-x-auto border-t border-slate-200">
      <table class="min-w-full border-collapse bg-white">
        <thead>
          <tr class="border-b border-slate-200">
            <th class="px-5 py-3 text-left text-xs font-medium text-slate-500">Agent</th>
            <th class="px-5 py-3 text-left text-xs font-medium text-slate-500">Health</th>
            <th class="px-5 py-3 text-left text-xs font-medium text-slate-500">Score</th>
            <th class="px-5 py-3 text-left text-xs font-medium text-slate-500">Calls</th>
            <th class="px-5 py-3 text-left text-xs font-medium text-slate-500">Goal Rate</th>
            <th class="px-5 py-3 text-left text-xs font-medium text-slate-500 min-w-[160px]">KPI Breakdown</th>
            <th class="px-5 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="agent in paginatedAgents"
            :key="agent.id"
            class="bg-white transition hover:bg-slate-50"
            :class="selectedAgentId === agent.id ? 'bg-blue-50' : ''"
          >
            <!-- Agent name + goal -->
            <td class="px-5 py-4">
              <p class="text-sm font-medium text-slate-900">{{ agent.name }}</p>
              <p v-if="agent.derivedProfile?.primaryGoal" class="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                {{ agent.derivedProfile.primaryGoal }}
              </p>
            </td>

            <!-- Health badge -->
            <td class="px-5 py-4">
              <span :class="healthBadgeClass(agent)" class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium">
                {{ healthLabel(agent) }}
              </span>
            </td>

            <!-- Overall score -->
            <td class="px-5 py-4">
              <template v-if="agent.aggregates && agent.aggregates.evaluatedCalls > 0">
                <span
                  class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
                  :class="scoreBadgeClass(agent.aggregates.overallScore)"
                >
                  {{ agent.aggregates.overallScore }}/100
                </span>
              </template>
              <span v-else class="text-xs text-slate-400">—</span>
            </td>

            <!-- Calls analyzed -->
            <td class="px-5 py-4">
              <template v-if="agent.aggregates">
                <p class="text-sm font-medium text-slate-900 tabular-nums">
                  {{ agent.aggregates.evaluatedCalls }}
                  <span class="text-slate-400">/{{ agent.aggregates.totalCalls }}</span>
                </p>
                <p class="text-xs text-slate-400">analyzed</p>
              </template>
              <span v-else class="text-xs text-slate-400">—</span>
            </td>

            <!-- Goal achievement rate -->
            <td class="px-5 py-4">
              <template v-if="agent.aggregates && agent.aggregates.evaluatedCalls > 0">
                <p class="text-sm font-semibold tabular-nums"
                  :class="agent.aggregates.goalAchievementRate >= 70 ? 'text-emerald-700' : agent.aggregates.goalAchievementRate >= 50 ? 'text-amber-700' : 'text-red-700'"
                >
                  {{ agent.aggregates.goalAchievementRate }}%
                </p>
              </template>
              <span v-else class="text-xs text-slate-400">—</span>
            </td>

            <!-- KPI breakdown -->
            <td class="px-5 py-4">
              <template v-if="agent.aggregates && agent.aggregates.evaluatedCalls > 0">
                <div class="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div v-if="kpiBreakdown(agent).achievedPct > 0" class="bg-emerald-400 transition-all" :style="{ width: kpiBreakdown(agent).achievedPct + '%' }" />
                  <div v-if="kpiBreakdown(agent).deviatedPct > 0" class="bg-amber-400 transition-all" :style="{ width: kpiBreakdown(agent).deviatedPct + '%' }" />
                  <div v-if="kpiBreakdown(agent).missedPct > 0" class="bg-orange-300 transition-all" :style="{ width: kpiBreakdown(agent).missedPct + '%' }" />
                  <div v-if="kpiBreakdown(agent).failedPct > 0" class="bg-red-400 transition-all" :style="{ width: kpiBreakdown(agent).failedPct + '%' }" />
                </div>
                <div class="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                  <span v-if="kpiBreakdown(agent).achieved > 0" class="flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {{ kpiBreakdown(agent).achieved }} achieved
                  </span>
                  <span v-if="kpiBreakdown(agent).deviated > 0" class="flex items-center gap-1 text-xs font-medium text-amber-700">
                    <span class="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    {{ kpiBreakdown(agent).deviated }} deviated
                  </span>
                  <span v-if="kpiBreakdown(agent).failed > 0" class="flex items-center gap-1 text-xs font-medium text-red-600">
                    <span class="h-1.5 w-1.5 rounded-full bg-red-400" />
                    {{ kpiBreakdown(agent).failed }} failed
                  </span>
                  <span v-if="kpiBreakdown(agent).missed > 0" class="flex items-center gap-1 text-xs font-medium text-orange-600">
                    <span class="h-1.5 w-1.5 rounded-full bg-orange-300" />
                    {{ kpiBreakdown(agent).missed }} missed
                  </span>
                </div>
              </template>
              <span v-else class="text-xs text-slate-400">No analysis yet</span>
            </td>

            <td class="px-5 py-4 text-right">
              <button
                class="cursor-pointer text-sm font-medium text-blue-600 transition hover:text-blue-800"
                @click.stop="$emit('selectAgent', agent.id)"
              >
                View
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3">
      <p class="text-sm text-slate-500">
        Showing {{ showingFrom }} to {{ showingTo }} of {{ agents.length }} result{{ agents.length === 1 ? "" : "s" }}
      </p>
      <div class="flex items-center gap-1">
        <button
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          Previous
        </button>
        <button
          v-for="page in totalPages"
          :key="page"
          class="min-w-[32px] rounded-md border px-2 py-1.5 text-sm font-medium transition"
          :class="
            currentPage === page
              ? 'border-blue-600 bg-white text-blue-600'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          "
          @click="currentPage = page"
        >
          {{ page }}
        </button>
        <button
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          Next
        </button>
      </div>
    </footer>
  </section>
</template>
