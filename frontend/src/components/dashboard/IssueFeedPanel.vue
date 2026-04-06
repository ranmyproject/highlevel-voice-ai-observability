<script setup lang="ts">
import type { DashboardIssueFeedItem } from "../../types/observability";

defineProps<{
  issues: DashboardIssueFeedItem[];
}>();
</script>

<template>
  <section class="panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Issue Feed</p>
        <h2>Latest failures and deviations</h2>
      </div>
    </div>

    <div class="issue-feed">
      <article
        v-for="issue in issues"
        :key="`${issue.transcriptId}-${issue.id}`"
        class="issue-row"
      >
        <div>
          <strong>{{ issue.label }}</strong>
          <p>{{ issue.agentName }} · {{ issue.caller }}</p>
        </div>
        <span class="tag">{{ issue.severity }}</span>
      </article>
    </div>
  </section>
</template>
