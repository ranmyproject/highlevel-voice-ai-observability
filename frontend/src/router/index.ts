import { createRouter, createWebHistory, type RouteLocationNormalized } from "vue-router";
import AppShell from "../app/AppShell.vue";
import ErrorPage from "../views/ErrorPage.vue";

const routes = [
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

  const locationId = to.query.location_id || localStorage.getItem("ghl_location_id");

  if (!locationId) {
    return { name: "error" };
  }

  if (to.query.location_id) {
    localStorage.setItem("ghl_location_id", String(to.query.location_id));
  }

  return true;
});

export default router;
