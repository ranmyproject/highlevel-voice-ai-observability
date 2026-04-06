<script setup lang="ts">
defineProps<{
  totalAgents: number;
  healthyAgents: number;
  needsAttentionAgents: number;
  activeFilter: "all" | "healthy" | "attention";
}>();

defineEmits<{
  "filter-change": ["all" | "healthy" | "attention"];
}>();
</script>

<template>
  <section class="flex flex-wrap items-center gap-2 pb-5 pt-3">
    <button
      class="rounded-full px-3 py-1.5 text-sm font-semibold transition"
      :class="
        activeFilter === 'all'
          ? 'bg-slate-200 text-slate-700'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      "
      @click="$emit('filter-change', 'all')"
    >
      All
      <span class="ml-1.5 tabular-nums">{{ totalAgents }}</span>
    </button>

    <button
      class="rounded-full px-3 py-1.5 text-sm font-semibold transition"
      :class="
        activeFilter === 'attention'
          ? 'bg-red-500 text-white'
          : 'bg-red-50 text-red-600 hover:bg-red-100'
      "
      @click="$emit('filter-change', 'attention')"
    >
      Needs Review
      <span class="ml-1.5 tabular-nums">{{ needsAttentionAgents }}</span>
    </button>

    <button
      class="rounded-full px-3 py-1.5 text-sm font-semibold transition"
      :class="
        activeFilter === 'healthy'
          ? 'bg-emerald-500 text-white'
          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
      "
      @click="$emit('filter-change', 'healthy')"
    >
      Healthy
      <span class="ml-1.5 tabular-nums">{{ healthyAgents }}</span>
    </button>
  </section>
</template>
