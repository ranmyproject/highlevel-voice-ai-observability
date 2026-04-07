import { createRouter, createWebHistory, type RouteLocationNormalized } from "vue-router";
import AppShell from "../app/AppShell.vue";
import AuthCallback from "../views/AuthCallback.vue";
import ErrorPage from "../views/ErrorPage.vue";

const routes = [
  {
    path: "/oauth/callback",
    name: "auth-callback",
    component: AuthCallback,
    meta: { public: true }
  },
  {
    path: "/error",
    name: "error",
    component: ErrorPage,
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

  // If GHL redirected here with a code (e.g. /?code=abc), forward to the callback handler
  if (to.query.code) {
    return { name: "auth-callback", query: { code: to.query.code } };
  }

  const token = localStorage.getItem("ghl_token");
  if (!token) {
    return { name: "error" };
  }

  return true;
});

export default router;
