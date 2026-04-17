import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { RoleCode } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/campus',
      name: 'campus-select',
      component: () => import('@/views/auth/CampusSelectView.vue'),
      meta: { requiresAuth: true, requiresCampus: false, roles: ['sales'] as RoleCode[] },
    },
    {
      path: '/account/password',
      name: 'account-password',
      component: () => import('@/views/account/ChangePasswordView.vue'),
      meta: { requiresAuth: true, requiresCampus: false, title: '修改密码' },
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { requiresAuth: true, requiresCampus: true },
      children: [
        {
          path: '',
          redirect: () => useAuthStore().afterLoginRoute(),
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/dashboard/DashboardView.vue'),
          meta: { title: '仪表盘', roles: ['owner', 'admin'] as RoleCode[] },
        },
        {
          path: 'students',
          name: 'students',
          component: () => import('@/views/students/StudentsView.vue'),
          meta: { title: '学生管理', roles: ['admin', 'sales'] as RoleCode[] },
        },
        {
          path: 'consumptions',
          name: 'consumptions',
          component: () => import('@/views/consumptions/ConsumptionsView.vue'),
          meta: { title: '消课管理', roles: ['sales', 'admin'] as RoleCode[] },
        },
        {
          path: 'low-hours',
          name: 'low-hours',
          component: () => import('@/views/low-hours/LowHoursView.vue'),
          meta: { title: '低课时提醒', roles: ['sales'] as RoleCode[] },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/users/UsersView.vue'),
          meta: { title: '用户管理', roles: ['admin'] as RoleCode[] },
        },
        {
          path: 'roles',
          name: 'roles',
          component: () => import('@/views/roles/RolesView.vue'),
          meta: { title: '角色管理', roles: ['admin'] as RoleCode[] },
        },
        {
          path: 'campuses',
          name: 'campuses',
          component: () => import('@/views/campuses/CampusesView.vue'),
          meta: { title: '校区管理', roles: ['admin'] as RoleCode[] },
        },
        {
          path: 'reports',
          name: 'reports',
          component: () => import('@/views/reports/ReportsView.vue'),
          meta: { title: '报表管理', roles: ['owner', 'admin'] as RoleCode[] },
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('@/views/logs/LogsView.vue'),
          meta: { title: '日志管理', roles: ['admin', 'owner'] as RoleCode[] },
        },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore();
  const isPublic = to.meta.public === true;

  if (isPublic) {
    if (auth.token && to.name === 'login') {
      next(auth.afterLoginRoute());
      return;
    }
    next();
    return;
  }

  if (!auth.token) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }

  if (to.meta.requiresCampus !== false && auth.needsCampusSelection()) {
    next({ name: 'campus-select', query: { redirect: to.fullPath } });
    return;
  }

  const roles = to.meta.roles as RoleCode[] | undefined;
  if (roles && roles.length > 0 && (!auth.roleCode || !roles.includes(auth.roleCode))) {
    next(auth.afterLoginRoute());
    return;
  }

  next();
});

export { router };
