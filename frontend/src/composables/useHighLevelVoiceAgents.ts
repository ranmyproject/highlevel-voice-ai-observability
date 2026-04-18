import { computed, onMounted, ref } from "vue";

import { observabilityApi } from "../services/observabilityApi";
import type {
  AgentAnalysisWorkspace,
  HighLevelVoiceAgentListResponse,
  StoredHighLevelVoiceAgent
} from "../types/highlevel";
import type { DashboardIssueFeedItem } from "../types/observability";
import { formatRelativeSyncTime } from "../utils/format";

export function useHighLevelVoiceAgents() {
  const loading = ref(true);
  const firstTimeSync = ref(false);
  const syncingAgents = ref(false);
  const syncingCalls = ref(false);
  const analyzing = ref(false);
  const error = ref("");
  const searchQuery = ref("");
  const selectedAgentId = ref("");
  const response = ref<HighLevelVoiceAgentListResponse | null>(null);
  const workspace = ref<AgentAnalysisWorkspace | null>(null);
  const statusFilter = ref<"all" | "healthy" | "attention">("all");

  const filteredAgents = computed(() => {
    let agents = response.value?.agents || [];
    const query = searchQuery.value.trim().toLowerCase();

    if (statusFilter.value === "healthy") {
      agents = agents.filter((a) => a.latestFeedbackCycle?.healthStatus === "healthy");
    } else if (statusFilter.value === "attention") {
      agents = agents.filter(
        (a) =>
          a.latestFeedbackCycle?.healthStatus === "needs_attention" ||
          a.latestFeedbackCycle?.healthStatus === "at_risk"
      );
    }

    if (!query) {
      return agents;
    }

    return agents.filter((agent) => {
      const haystack = [agent.name, agent.goal, agent.channels.join(" "), agent.status]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  });

  function setStatusFilter(filter: "all" | "healthy" | "attention"): void {
    statusFilter.value = filter;
  }

  const totalAgents = computed(() => response.value?.count || 0);
  const healthyAgents = computed(
    () =>
      response.value?.agents.filter((a) => a.latestFeedbackCycle?.healthStatus === "healthy").length || 0
  );
  const needsAttentionAgents = computed(
    () =>
      response.value?.agents.filter(
        (a) =>
          a.latestFeedbackCycle?.healthStatus === "needs_attention" ||
          a.latestFeedbackCycle?.healthStatus === "at_risk"
      ).length || 0
  );
  const lastSyncedLabel = computed(() =>
    response.value?.syncedAt ? formatRelativeSyncTime(response.value.syncedAt) : ""
  );
  const isDetailPage = computed(() => Boolean(selectedAgentId.value && workspace.value));

  async function loadSavedAgents(): Promise<void> {
    response.value = await observabilityApi.getHighLevelVoiceAgents();
  }



  async function loadWorkspace(agentId: string): Promise<void> {
    try {
      workspace.value = await observabilityApi.getHighLevelAgentWorkspace(agentId);
    } catch (err) {
      console.warn("Failed to load workspace, attempting to sync agents first...", err);
      // If it fails (e.g. 404 because agent isn't synced locally yet), trigger a sync
      await syncAgents();
      workspace.value = await observabilityApi.getHighLevelAgentWorkspace(agentId);
    }
  }

  async function syncAgents(): Promise<void> {
    syncingAgents.value = true;
    error.value = "";

    try {
      response.value = await observabilityApi.syncHighLevelVoiceAgents();
    } catch (syncError: unknown) {
      error.value = syncError instanceof Error ? syncError.message : "Failed to sync agents";
    } finally {
      syncingAgents.value = false;
    }
  }

  async function syncCalls(): Promise<void> {
    if (!selectedAgentId.value) {
      return;
    }

    syncingCalls.value = true;
    error.value = "";

    try {
      await observabilityApi.syncHighLevelVoiceCalls(selectedAgentId.value);
      await loadWorkspace(selectedAgentId.value);
    } catch (syncError: unknown) {
      error.value = syncError instanceof Error ? syncError.message : "Failed to sync calls";
    } finally {
      syncingCalls.value = false;
    }
  }

  async function analyzeCalls(): Promise<void> {
    if (!selectedAgentId.value) {
      return;
    }

    analyzing.value = true;
    error.value = "";

    try {
      await observabilityApi.analyzeHighLevelAgentCalls(selectedAgentId.value);
      await loadWorkspace(selectedAgentId.value);
    } catch (analysisError: unknown) {
      error.value =
        analysisError instanceof Error ? analysisError.message : "Failed to analyze calls";
    } finally {
      analyzing.value = false;
    }
  }

  async function selectAgent(agentId: string): Promise<void> {
    selectedAgentId.value = agentId;
    await loadWorkspace(agentId);
  }

  function backToList(): void {
    selectedAgentId.value = "";
    workspace.value = null;
  }

  onMounted(async () => {
    loading.value = true;
    error.value = "";
    firstTimeSync.value = sessionStorage.getItem("ghl_first_sync") === "true";
    sessionStorage.removeItem("ghl_first_sync");

    try {
      await loadSavedAgents();
    } catch (loadError: unknown) {
      error.value = loadError instanceof Error ? loadError.message : "Failed to load agents";
    } finally {
      loading.value = false;
      firstTimeSync.value = false;
    }
  });

  return {
    loading,
    firstTimeSync,
    syncingAgents,
    syncingCalls,
    analyzing,
    error,
    searchQuery,
    statusFilter,
    selectedAgentId,
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
    selectAgent,
    backToList,
    setStatusFilter
};
}
