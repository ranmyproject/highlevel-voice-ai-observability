<script setup lang="ts">
import type { AgentDetailResponse } from "../../types/observability";
import { formatDateTime, formatPercent } from "../../utils/format";

defineProps<{
  selectedAgent: AgentDetailResponse;
}>();
</script>

<template>
  <section class="detail-grid">
    <article class="panel detail-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Analyze</p>
          <h2>{{ selectedAgent.agent.name }}</h2>
        </div>
        <span class="tag">{{ selectedAgent.agent.channel }}</span>
      </div>

      <div class="detail-stats">
        <div>
          <span>Booking Rate</span>
          <strong>{{ formatPercent(selectedAgent.summary.bookingRate) }}</strong>
        </div>
        <div>
          <span>Compliance</span>
          <strong>{{ formatPercent(selectedAgent.summary.complianceRate) }}</strong>
        </div>
        <div>
          <span>Avg Handle Time</span>
          <strong>{{ selectedAgent.summary.averageHandleTimeSec }}s</strong>
        </div>
      </div>

      <p class="agent-goal">{{ selectedAgent.agent.goal }}</p>

      <div class="recommendation-list">
        <h3>AI Recommendations</h3>
        <article
          v-for="recommendation in selectedAgent.recommendations"
          :key="recommendation.issueId"
          class="recommendation-card"
        >
          <strong>{{ recommendation.label }}</strong>
          <p>{{ recommendation.recommendation }}</p>
          <small>Seen in {{ recommendation.count }} call(s)</small>
        </article>
        <p v-if="selectedAgent.recommendations.length === 0" class="empty-state">
          No active recommendations for this agent.
        </p>
      </div>
    </article>

    <article class="panel detail-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Use Actions</p>
          <h2>Human intervention queue</h2>
        </div>
      </div>

      <div class="action-list">
        <article
          v-for="action in selectedAgent.useActions"
          :key="`${action.transcriptId}-${action.action}`"
          class="action-card"
        >
          <strong>{{ action.action }}</strong>
          <p>{{ action.caller }} · {{ formatDateTime(action.timestamp) }}</p>
        </article>
        <p v-if="selectedAgent.useActions.length === 0" class="empty-state">
          No human interventions required right now.
        </p>
      </div>

      <div class="transcript-list">
        <h3>Recent analyzed calls</h3>
        <article
          v-for="transcript in selectedAgent.transcripts"
          :key="transcript.id"
          class="transcript-card"
        >
          <div class="transcript-header">
            <strong>{{ transcript.caller }}</strong>
            <span>{{ transcript.booked ? "Booked" : "Not booked" }}</span>
          </div>
          <p>{{ transcript.transcript }}</p>
          <div class="issue-tags">
            <span
              v-for="issue in transcript.analyzedIssues"
              :key="`${transcript.id}-${issue.id}`"
              class="tag"
            >
              {{ issue.label }}
            </span>
          </div>
        </article>
      </div>
    </article>
  </section>
</template>
