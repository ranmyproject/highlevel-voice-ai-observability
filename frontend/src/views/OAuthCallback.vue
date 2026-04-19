<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { observabilityApi } from "../services/observabilityApi";

const route = useRoute();
const router = useRouter();

const status = ref<"processing" | "success" | "error">("processing");
const message = ref("Completing installation...");

onMounted(async () => {
  const code = (route.query.code) as string | undefined;

  if (!code) {
    status.value = "error";
    message.value = "Missing installation code from HighLevel.";
    return;
  }

  try {
    const userType = (route.query.companyId && !route.query.locationId) ? "Company" : "Location";
    const response = await observabilityApi.exchangeOAuthCode(code, userType);
    
    if (response.locationId || response.companyId) {
      status.value = "success";
      message.value = "Installation complete. Opening setup instructions...";
      
      // Store the token and location ID locally
      if (response.token) {
        localStorage.setItem("ghl_auth_token", response.token);
      }
      if (response.locationId) {
        localStorage.setItem("ghl_location_id", response.locationId);
      }

      // Redirect to the success page which will deeply link inside GHL Voice AI
      setTimeout(() => {
        router.push({ 
          name: "installed", 
          query: response.locationId ? { location_id: response.locationId } : {} 
        });
      }, 1000);
    } else {
      throw new Error("Invalid response from server.");
    }
  } catch (error) {
    status.value = "error";
    message.value = error instanceof Error ? error.message : "Failed to securely exchange installation token.";
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div class="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm border border-slate-200">
      <div v-if="status === 'processing'" class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        <svg class="h-6 w-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>

      <div v-else-if="status === 'success'" class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
        <svg class="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div v-else class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>

      <h2 class="text-xl font-semibold text-slate-800">
        {{ status === "processing" ? "Authenticating..." : status === "success" ? "Success!" : "Installation Error" }}
      </h2>
      <p class="mt-2 text-sm text-slate-500">{{ message }}</p>

      <button
        v-if="status === 'error'"
        class="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        @click="router.push('/installed')"
      >
        Continue Anyway
      </button>
    </div>
  </div>
</template>
