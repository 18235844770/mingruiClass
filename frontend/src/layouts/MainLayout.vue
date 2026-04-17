<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible theme="light" width="220">
      <div class="logo">教务后台</div>
      <a-menu
        v-model:selectedKeys="selectedKeys"
        mode="inline"
        @click="onMenuClick"
      >
        <a-menu-item v-for="item in menuItems" :key="item.key">
          {{ item.label }}
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="header">
        <span class="title">{{ pageTitle }}</span>
        <a-space>
          <span v-if="auth.campusId" class="muted">当前校区：{{ campusHeaderLabel }}</span>
          <a-button type="link" @click="goChangePassword">修改密码</a-button>
          <a-button type="link" @click="logout">退出</a-button>
        </a-space>
      </a-layout-header>
      <a-layout-content class="content">
        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { http } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const collapsed = ref(false);
const router = useRouter();
const vueRoute = useRoute();
const auth = useAuthStore();

const campusHeaderLabel = computed(() => auth.campusName?.trim() || auth.campusId || '');

onMounted(async () => {
  if (!auth.campusId || auth.campusName?.trim()) {
    return;
  }
  if (!auth.isSales) {
    return;
  }
  try {
    const { data } = await http.get<Array<{ id: string; name: string }>>('/campuses/mine');
    const row = data.find((c) => c.id === auth.campusId);
    if (row?.name) {
      auth.setCampusDisplayName(row.name);
    }
  } catch {
    /* 保持仅显示 id */
  }
});

const selectedKeys = ref<string[]>([]);

const menuItems = computed(() => {
  const r = auth.roleCode;
  const all: { key: string; label: string; roles?: string[] }[] = [
    { key: '/dashboard', label: '仪表盘', roles: ['admin', 'owner'] },
    { key: '/students', label: '学生管理', roles: ['admin', 'sales'] },
    { key: '/consumptions', label: '消课管理', roles: ['sales', 'admin'] },
    { key: '/low-hours', label: '低课时提醒', roles: ['sales'] },
    { key: '/users', label: '用户管理', roles: ['admin'] },
    { key: '/roles', label: '角色管理', roles: ['admin'] },
    { key: '/campuses', label: '校区管理', roles: ['admin'] },
    { key: '/reports', label: '报表管理', roles: ['admin', 'owner'] },
    { key: '/logs', label: '日志管理', roles: ['admin', 'owner'] },
  ];
  return all.filter((i) => !i.roles || (r && i.roles.includes(r)));
});

const pageTitle = computed(() => (vueRoute.meta.title as string) || '');

watch(
  () => vueRoute.path,
  (p) => {
    selectedKeys.value = [p === '/' ? '/dashboard' : p];
  },
  { immediate: true },
);

function onMenuClick({ key }: { key: string | number }) {
  router.push(String(key));
}

function goChangePassword() {
  void router.push({ name: 'account-password' });
}

function logout() {
  auth.clear();
  router.replace({ name: 'login' });
}
</script>

<style scoped>
.logo {
  padding: 16px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}
.title {
  font-size: 16px;
  font-weight: 500;
}
.content {
  margin: 16px;
  padding: 16px;
  background: #fff;
  min-height: 280px;
}
.muted {
  color: #888;
  font-size: 12px;
}
</style>
