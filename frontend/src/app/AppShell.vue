<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import AgentDetailPage from "../components/highlevel/AgentDetailPage.vue";
import TranscriptDetailPage from "../components/highlevel/TranscriptDetailPage.vue";
import AgentListTable from "../components/highlevel/AgentListTable.vue";
import AgentsHeader from "../components/highlevel/AgentsHeader.vue";
import AgentOverviewBar from "../components/highlevel/AgentOverviewBar.vue";
import ToolbarRow from "../components/highlevel/ToolbarRow.vue";
import { useHighLevelVoiceAgents } from "../composables/useHighLevelVoiceAgents";

const props = defineProps<{
  agentId?: string;
  callId?: string;
}>();

const router = useRouter();
const route = useRoute();

// Preserve location_id in all navigation so httpClient can always read it from window.location.search
const locationQuery = computed(() => {
  const id = route.query.location_id || route.query.locationId || route.query.locationid || localStorage.getItem("ghl_location_id");
  return id ? { location_id: id as string } : {};
});

const {
  loading,
  loadingWorkspace,
  firstTimeSync,
  syncingAgents,
  syncingCalls,
  analyzing,
  error,
  searchQuery,
  statusFilter,
  filteredAgents,
  workspace,
  totalAgents,
  healthyAgents,
  needsAttentionAgents,
  lastSyncedLabel,
  isDetailPage,
  syncAgents,
  syncCalls,
  analyzeCalls,
  selectAgent: internalSelectAgent,
  refreshWorkspace,
  backToList: internalBackToList,
  setStatusFilter
} = useHighLevelVoiceAgents();

const isTranscriptPage = computed(() => Boolean(props.agentId && props.callId && workspace.value));
const isWorkspaceRoute = computed(() => Boolean(props.agentId));

function selectAgent(agentId: string) {
  router.push({ path: `/agents/${agentId}`, query: locationQuery.value });
}

function backToList() {
  router.push({ path: "/", query: locationQuery.value });
}

function backToAgent() {
  if (props.agentId) router.push({ path: `/agents/${props.agentId}`, query: locationQuery.value });
}

function viewTranscript(callId: string) {
  if (props.agentId) router.push({ path: `/agents/${props.agentId}/calls/${callId}`, query: locationQuery.value });
}

async function handleRecommendationsApplied() {
  await refreshWorkspace();
  showToast("Applied selected fixes and refreshed agent insights");
}

// Sync router params into composable
watch(() => props.agentId, (newId) => {
  if (newId) {
    internalSelectAgent(newId);
  } else {
    internalBackToList();
  }
}, { immediate: true });

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

const toasts = ref<Toast[]>([]);
let toastCounter = 0;

function showToast(message: string, type: "success" | "error" = "success"): void {
  const id = ++toastCounter;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, 3500);
}

watch(syncingAgents, (newVal, oldVal) => {
  if (oldVal && !newVal && !error.value) {
    showToast(`${totalAgents.value} agent${totalAgents.value === 1 ? "" : "s"} synced`);
  }
});

watch(syncingCalls, (newVal, oldVal) => {
  if (oldVal && !newVal && !error.value) {
    showToast("Calls synced successfully");
  }
});

watch(analyzing, (newVal, oldVal) => {
  if (oldVal && !newVal && !error.value && workspace.value) {
    const count = workspace.value.evaluations.length;
    showToast(`Analyzed ${count} transcript${count === 1 ? "" : "s"} for ${workspace.value.agent.name}`);
  }
});

watch(error, (val) => {
  if (val) showToast(val, "error");
});

</script>

<template>
  <main class="w-full min-h-screen bg-white font-sans text-sm">
    <!-- First-time sync loading -->
    <div v-if="loading && firstTimeSync" class="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div class="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div class="relative mb-6 flex h-16 w-16 items-center justify-center">
          <div class="absolute h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </svg>
        </div>
        <p class="text-base font-semibold text-slate-800">Syncing your agents</p>
        <p class="mt-1.5 max-w-xs text-sm text-slate-500">
          We're fetching your voice agents and deriving their KPI profiles for the first time. This usually takes 10–20 seconds.
        </p>
        <div class="mt-6 flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-medium text-blue-700">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
          Setting up your workspace…
        </div>
      </div>
    </div>

    <!-- Regular loading skeleton -->
    <div v-else-if="loading" class="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div class="px-6 py-6 sm:px-8">
        <div class="h-10 w-48 animate-pulse rounded-xl bg-slate-200" />
        <div class="mt-4 flex gap-3">
          <div class="h-8 w-20 animate-pulse rounded-full bg-slate-200" />
          <div class="h-8 w-28 animate-pulse rounded-full bg-slate-200" />
          <div class="h-8 w-20 animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>
      <div class="divide-y divide-slate-200 border-t border-slate-200">
        <div v-for="i in 4" :key="i" class="flex items-center gap-4 px-6 py-5">
          <div class="flex-1 space-y-2">
            <div class="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div class="h-3 w-72 animate-pulse rounded bg-slate-100" />
          </div>
          <div class="h-6 w-16 animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>
    </div>

    <!-- Transcript detail page -->
    <template v-else-if="isTranscriptPage && workspace && callId">
      <TranscriptDetailPage
        :workspace="workspace"
        :call-id="callId"
        @back="backToAgent"
      />
    </template>

    <!-- Agent workspace loading -->
    <template v-else-if="isWorkspaceRoute && loadingWorkspace">
      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div class="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div class="relative mb-6 flex h-16 w-16 items-center justify-center">
            <div class="absolute h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p class="text-base font-semibold text-slate-800">Loading agent observability</p>
          <p class="mt-1.5 max-w-md text-sm text-slate-500">
            We're fetching this Voice AI agent from HighLevel and preparing its KPI workspace. On the first load, this can take a few extra seconds.
          </p>
          <div class="mt-6 flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-medium text-blue-700">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            Pulling agent details and observability context…
          </div>
        </div>
      </div>
    </template>

    <!-- Agent detail page -->
    <template v-else-if="isDetailPage && workspace">
      <AgentDetailPage
        :workspace="workspace"
        :syncing-calls="syncingCalls"
        :analyzing="analyzing"
        @back="backToList"
        @sync-calls="syncCalls"
        @analyze="analyzeCalls"
        @view-transcript="viewTranscript"
        @recommendations-applied="handleRecommendationsApplied"
      />
    </template>

    <!-- Home / Dashboard View -->
    <template v-else-if="!isDetailPage && !isTranscriptPage">
      <div v-if="error" class="mb-4 overflow-hidden rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p class="font-semibold">Unable to load agent observability data</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div class="px-6 py-6 sm:px-8">
          <AgentsHeader :syncing-agents="syncingAgents" @sync-agents="syncAgents" />

          <AgentOverviewBar
            :total-agents="totalAgents"
            :healthy-agents="healthyAgents"
            :needs-attention-agents="needsAttentionAgents"
            :active-filter="statusFilter"
            @filter-change="setStatusFilter"
          />

          <ToolbarRow
            v-if="totalAgents >= 5"
            v-model="searchQuery"
            :count="filteredAgents.length"
            :last-synced-label="lastSyncedLabel"
            :show-search="true"
          />
        </div>

        <AgentListTable
          :agents="filteredAgents"
          :selected-agent-id="''"
          @select-agent="selectAgent"
        />
      </div>
    </template>

    <!-- Unmatched / Error state -->
    <template v-else>
      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
        <p class="font-semibold">Agent details not found</p>
        <p class="mt-2 text-sm">Please verify the URL or ensure the app is installed correctly.</p>
      </div>
    </template>

    <!-- Toast notifications -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <transition-group
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-2 opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg"
          :class="
            toast.type === 'success'
              ? 'bg-slate-900 text-white'
              : 'bg-red-600 text-white'
          "
        >
          <span
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
            :class="toast.type === 'success' ? 'bg-emerald-400 text-emerald-900' : 'bg-red-300 text-red-900'"
          >
            {{ toast.type === "success" ? "✓" : "!" }}
          </span>
          {{ toast.message }}
        </div>
      </transition-group>
    </div>
  </main>
</template>
