<script setup lang="ts">
defineEmits<{
  refresh: [];
}>();
</script>

<template>
  <section class="hero">
    <div>
      <p class="eyebrow">HighLevel Voice AI Assignment</p>
      <h1>Observability Copilot</h1>
      <p class="hero-copy">
        Monitor transcripts, surface KPI deviations, and turn call failures into prompt and script
        recommendations.
      </p>
    </div>

    <button class="refresh-button" @click="$emit('refresh')">Refresh Dashboard</button>
  </section>
</template>
