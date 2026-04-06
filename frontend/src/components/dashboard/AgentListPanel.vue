<script setup lang="ts">
import type { DashboardAgentSummary } from "../../types/observability";
import { formatPercent } from "../../utils/format";

defineProps<{
  agents: DashboardAgentSummary[];
  selectedAgentId: string;
}>();

defineEmits<{
  selectAgent: [agentId: string];
}>();
</script>

<template>
  <article class="panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Unified Dashboard</p>
        <h2>Agent performance</h2>
      </div>
    </div>

    <div class="agent-list">
      <button
        v-for="agent in agents"
        :key="agent.id"
        class="agent-row"
        :class="{ active: selectedAgentId === agent.id }"
        @click="$emit('selectAgent', agent.id)"
      >
        <div>
          <strong>{{ agent.name }}</strong>
          <p>{{ agent.goal }}</p>
        </div>
        <div class="agent-stats">
          <span>{{ formatPercent(agent.summary.bookingRate) }} booked</span>
          <span>{{ agent.topIssue }}</span>
        </div>
      </button>
    </div>
  </article>
</template>
