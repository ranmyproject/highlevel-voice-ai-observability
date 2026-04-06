import { createRouter, createWebHistory, type RouteLocationNormalized } from "vue-router";
import AppShell from "../app/AppShell.vue";

const routes = [
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

export default router;
