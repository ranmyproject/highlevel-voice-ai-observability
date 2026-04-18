import { createRouter, createWebHistory, type RouteLocationNormalized } from "vue-router";
import AppShell from "../app/AppShell.vue";
import ErrorPage from "../views/ErrorPage.vue";
import InstalledPage from "../views/InstalledPage.vue";
import OAuthCallback from "../views/OAuthCallback.vue";
import LoginPage from "../views/LoginPage.vue";
import { AUTH_TOKEN_KEY } from "../services/httpClient";
import { observabilityApi } from "../services/observabilityApi";

const routes = [
  {
    path: "/oauth/callback",
    name: "oauth-callback",
    component: OAuthCallback,
    meta: { public: true }
  },
  {
    path: "/login",
    name: "login",
    component: LoginPage,
    meta: { public: true }
  },
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

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp) return false;
    // Buffer of 60 seconds to avoid edge cases
    return payload.exp * 1000 < Date.now() + 60000;
  } catch {
    return true;
  }
}

router.beforeEach(async (to) => {
  if (to.meta.public) return true;

  const locationId = to.query.location_id || to.query.locationId || to.query.locationid || localStorage.getItem("ghl_location_id");
  let token = localStorage.getItem(AUTH_TOKEN_KEY);

  // If token is expired, treat it as missing
  if (token && isTokenExpired(token)) {
    console.warn("JWT has expired locally. Removing.");
    localStorage.removeItem(AUTH_TOKEN_KEY);
    token = null;
  }

  // If we have a valid token, we're good
  if (token) {
    return true;
  }

  // If no token, we NEED a locationId to get one
  if (!locationId || typeof locationId !== "string") {
    console.warn("No location_id or token found. Redirecting to login.");
    return { name: "login" };
  }

  // Persist locationId
  localStorage.setItem("ghl_location_id", locationId);

  try {
    const result = await observabilityApi.verifyLocation(locationId);
    localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    return true;
  } catch (error) {
    console.error("Failed to bootstrap auth token automatically. Sending to login.", error);
    return { name: "login" };
  }
});

export default router;
