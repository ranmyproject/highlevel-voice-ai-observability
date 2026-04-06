import { computed, onMounted, ref } from "vue";

import { observabilityApi } from "../services/observabilityApi";
import type {
  AgentDetailResponse,
  DashboardResponse,
  IngestFormState,
  SummaryCard
} from "../types/observability";
import { formatPercent } from "../utils/format";

const DEFAULT_AGENT_ID = "mortgage-qualification";

function createInitialIngestForm(agentId = DEFAULT_AGENT_ID): IngestFormState {
  return {
    agentId,
    caller: "",
    durationSec: 360,
    booked: false,
    transcript: ""
  };
}

export function useObservabilityDashboard() {
  const dashboard = ref<DashboardResponse | null>(null);
  const selectedAgentId = ref("");
  const selectedAgent = ref<AgentDetailResponse | null>(null);
  const loading = ref(true);
  const ingesting = ref(false);
  const error = ref("");
  const ingestForm = ref<IngestFormState>(createInitialIngestForm());

  const summaryCards = computed<SummaryCard[]>(() => {
    if (!dashboard.value) {
      return [];
    }

    return [
      {
        label: "Total Calls",
        value: dashboard.value.overview.totalCalls,
        detail: "Observed across all active agents"
      },
      {
        label: "Booking Rate",
        value: formatPercent(dashboard.value.overview.bookingRate),
        detail: `${dashboard.value.overview.bookings} bookings completed`
      },
      {
        label: "Escalations",
        value: dashboard.value.overview.escalations,
        detail: "Calls requiring human intervention"
      },
      {
        label: "Open Issues",
        value: dashboard.value.overview.totalIssueCount,
        detail: "Detected KPI or script deviations"
      }
    ];
  });

  async function loadDashboard(): Promise<void> {
    dashboard.value = await observabilityApi.getDashboard();

    if (!selectedAgentId.value && dashboard.value.agentSummaries.length > 0) {
      const firstAgentId = dashboard.value.agentSummaries[0].id;
      selectedAgentId.value = firstAgentId;
      ingestForm.value.agentId = firstAgentId;
    }
  }

  async function selectAgent(agentId: string): Promise<void> {
    selectedAgentId.value = agentId;
    selectedAgent.value = await observabilityApi.getAgent(agentId);
  }

  async function refreshAll(): Promise<void> {
    loading.value = true;
    error.value = "";

    try {
      await loadDashboard();

      if (selectedAgentId.value) {
        await selectAgent(selectedAgentId.value);
      }
    } catch (loadError: unknown) {
      error.value = loadError instanceof Error ? loadError.message : "Failed to load dashboard";
    } finally {
      loading.value = false;
    }
  }

  async function submitIngestion(): Promise<void> {
    ingesting.value = true;
    error.value = "";

    try {
      await observabilityApi.ingestTranscript(ingestForm.value);
      const nextAgentId = ingestForm.value.agentId;
      ingestForm.value = createInitialIngestForm(nextAgentId);
      await refreshAll();
    } catch (submitError: unknown) {
      error.value =
        submitError instanceof Error ? submitError.message : "Transcript ingestion failed";
    } finally {
      ingesting.value = false;
    }
  }

  onMounted(() => {
    void refreshAll();
  });

  return {
    dashboard,
    selectedAgentId,
    selectedAgent,
    loading,
    ingesting,
    error,
    ingestForm,
    summaryCards,
    refreshAll,
    selectAgent,
    submitIngestion
  };
}
