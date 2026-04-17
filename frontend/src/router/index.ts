import { createRouter, createWebHistory, type RouteLocationNormalized } from "vue-router";
import AppShell from "../app/AppShell.vue";
import ErrorPage from "../views/ErrorPage.vue";
import InstalledPage from "../views/InstalledPage.vue";
import { AUTH_TOKEN_KEY } from "../services/httpClient";
import { observabilityApi } from "../services/observabilityApi";

const routes = [
  {
    path: "/error",
    name: "error",
    component: ErrorPage,
    meta: { public: true }
  },
  {
    path: "/installed",
    name: "installed",
    component: InstalledPage,
    meta: { public: true }
  },
  {
    path: "/",
    name: "home",
    component: AppShell,
    props: (route: RouteLocationNormalized) => ({ agentId: route.params.agentId })
  },
  {
    path: "/agents/:agentId",
    name: "agent-detail",
    component: AppShell,
    props: true
  },
  {
    path: "/agents/:agentId/calls/:callId",
    name: "transcript-detail",
    component: AppShell,
    props: true
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  if (to.meta.public) return true;

  const locationId = to.query.location_id || to.query.locationId || localStorage.getItem("ghl_location_id");

  if (!locationId) {
    console.warn("No location_id found in query parameters or localStorage. Redirecting to error page.");
    return { name: "error" };
  }

  // Persist the locationId from query params to localStorage
  const activeLocationId = (to.query.location_id || to.query.locationId) as string | undefined;
  if (activeLocationId) {
    localStorage.setItem("ghl_location_id", activeLocationId);
  }

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    return true;
  }

  if (!locationId || typeof locationId !== "string") {
    console.warn("No location_id found in query parameters or localStorage. Redirecting to error page.");
    return { name: "error" };
  }

  return observabilityApi
    .verifyLocation(locationId)
    .then((result) => {
      localStorage.setItem(AUTH_TOKEN_KEY, result.token);
      localStorage.setItem("ghl_location_id", locationId);
      return true;
    })
    .catch((error: unknown) => {
      console.error("Failed to bootstrap auth token", error);
      return { name: "error" };
    });
});

export default router;
