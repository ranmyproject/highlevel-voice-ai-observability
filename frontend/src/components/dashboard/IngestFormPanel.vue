<script setup lang="ts">
import type { DashboardAgentSummary, IngestFormState } from "../../types/observability";

const model = defineModel<IngestFormState>({ required: true });

defineProps<{
  agents: DashboardAgentSummary[];
  ingesting: boolean;
}>();

defineEmits<{
  submit: [];
}>();
</script>

<template>
  <article class="panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Monitor</p>
        <h2>Transcript ingestion</h2>
      </div>
    </div>

    <form class="ingest-form" @submit.prevent="$emit('submit')">
      <label>
        Agent
        <select v-model="model.agentId">
          <option v-for="agent in agents" :key="agent.id" :value="agent.id">
            {{ agent.name }}
          </option>
        </select>
      </label>

      <label>
        Caller
        <input v-model="model.caller" placeholder="Jordan Lee" required />
      </label>

      <label>
        Duration (sec)
        <input v-model.number="model.durationSec" min="30" step="1" type="number" />
      </label>

      <label class="checkbox">
        <input v-model="model.booked" type="checkbox" />
        Mark call as booked
      </label>

      <label>
        Transcript summary
        <textarea
          v-model="model.transcript"
          placeholder="Caller asked about pricing, was unsure about next steps, and wanted a callback later."
          required
        />
      </label>

      <button class="submit-button" :disabled="ingesting">
        {{ ingesting ? "Analyzing..." : "Ingest Transcript" }}
      </button>
    </form>
  </article>
</template>
