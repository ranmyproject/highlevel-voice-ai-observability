<script setup lang="ts">
import type { SummaryCard } from "../../types/observability";

defineProps<{
  cards: SummaryCard[];
}>();
</script>

<template>
  <section class="summary-grid">
    <article v-for="card in cards" :key="card.label" class="metric-card">
      <span>{{ card.label }}</span>
      <strong>{{ card.value }}</strong>
      <small>{{ card.detail }}</small>
    </article>
  </section>
</template>
