<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { observabilityApi } from "../services/observabilityApi";
import { AUTH_TOKEN_KEY } from "../services/httpClient";

const router = useRouter();
const route = useRoute();

const locationId = ref(route.query.location_id as string || "");
const loading = ref(false);
const error = ref("");

async function login() {
  if (!locationId.value.trim()) {
    error.value = "Please enter a valid Location ID.";
    return;
  }

  error.value = "";
  loading.value = true;

  try {
    const result = await observabilityApi.verifyLocation(locationId.value.trim());
    
    // Save credentials
    localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    localStorage.setItem("ghl_location_id", locationId.value.trim());

    // Redirect to home dashboard
    router.push({ path: "/" });
  } catch (err: any) {
    error.value = err?.message || "Failed to fetch JWT token. Ensure the app is installed for this location and try again.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div class="w-full max-w-md">
      <!-- Card -->
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="px-8 py-10">
          <h1 class="mb-2 text-xl font-semibold text-slate-900">Standalone Access</h1>
          <p class="mb-6 text-sm leading-relaxed text-slate-500">
            You are attempting to access the dashboard outside of GoHighLevel. Please enter a valid Location ID to generate a session token.
          </p>

          <form @submit.prevent="login" class="flex flex-col gap-4">
            <div>
              <label for="locationId" class="mb-1.5 block text-sm font-medium text-slate-700">GoHighLevel Location ID</label>
              <input
                id="locationId"
                v-model="locationId"
                type="text"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Zq2KRWxbuFddOA6Ljo3O"
              />
            </div>
            
            <div v-if="error" class="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="mt-2 flex w-full justify-center rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <svg v-if="loading" class="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {{ loading ? "Authenticating..." : "Connect Location" }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
