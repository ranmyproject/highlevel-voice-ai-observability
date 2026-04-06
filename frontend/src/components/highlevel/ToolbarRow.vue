<script setup lang="ts">
const searchQuery = defineModel<string>({ required: true });

defineProps<{
  count: number;
  lastSyncedLabel: string;
  showSearch: boolean;
}>();
</script>

<template>
  <section class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
    <label v-if="showSearch" class="w-full sm:w-[320px]">
      <input
        v-model="searchQuery"
        placeholder="Search name or channel"
        type="search"
        class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  </section>
</template>
