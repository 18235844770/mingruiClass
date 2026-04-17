import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type RoleCode = 'admin' | 'sales' | 'owner';

const TOKEN_KEY = 'mingrui_token';
const CAMPUS_KEY = 'mingrui_campus_id';
const CAMPUS_NAME_KEY = 'mingrui_campus_name';
const ROLE_KEY = 'mingrui_role';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const campusId = ref<string | null>(localStorage.getItem(CAMPUS_KEY));
  const campusName = ref<string | null>(localStorage.getItem(CAMPUS_NAME_KEY));
  const roleCode = ref<RoleCode | null>(
    (localStorage.getItem(ROLE_KEY) as RoleCode | null) ?? null,
  );

  const isSales = computed(() => roleCode.value === 'sales');
  const isAdmin = computed(() => roleCode.value === 'admin');
  const isOwner = computed(() => roleCode.value === 'owner');

  function setSession(next: {
    accessToken: string;
    role: RoleCode;
    campusId?: string | null;
  }) {
    token.value = next.accessToken;
    roleCode.value = next.role;
    localStorage.setItem(TOKEN_KEY, next.accessToken);
    localStorage.setItem(ROLE_KEY, next.role);
    if (next.campusId !== undefined) {
      campusId.value = next.campusId;
      if (next.campusId) {
        localStorage.setItem(CAMPUS_KEY, next.campusId);
      } else {
        localStorage.removeItem(CAMPUS_KEY);
        campusName.value = null;
        localStorage.removeItem(CAMPUS_NAME_KEY);
      }
    }
  }

  /** 销售选择校区时写入 id 与展示名称 */
  function setCampus(id: string, displayName?: string | null) {
    campusId.value = id;
    localStorage.setItem(CAMPUS_KEY, id);
    if (displayName !== undefined && displayName !== null) {
      const t = displayName.trim();
      if (t) {
        campusName.value = t;
        localStorage.setItem(CAMPUS_NAME_KEY, t);
      } else {
        campusName.value = null;
        localStorage.removeItem(CAMPUS_NAME_KEY);
      }
    }
  }

  /** 仅更新展示名称（例如从接口补全），不改变当前校区 id */
  function setCampusDisplayName(name: string) {
    const t = name.trim();
    if (!t) {
      return;
    }
    campusName.value = t;
    localStorage.setItem(CAMPUS_NAME_KEY, t);
  }

  function clear() {
    token.value = null;
    campusId.value = null;
    campusName.value = null;
    roleCode.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CAMPUS_KEY);
    localStorage.removeItem(CAMPUS_NAME_KEY);
    localStorage.removeItem(ROLE_KEY);
  }

  function needsCampusSelection() {
    return isSales.value && !campusId.value;
  }

  function afterLoginRoute() {
    if (needsCampusSelection()) {
      return { name: 'campus-select' };
    }
    if (isSales.value) {
      return { name: 'low-hours' };
    }
    if (isAdmin.value) {
      return { name: 'dashboard' };
    }
    return { name: 'dashboard' };
  }

  return {
    token,
    campusId,
    campusName,
    roleCode,
    isSales,
    isAdmin,
    isOwner,
    setSession,
    setCampus,
    setCampusDisplayName,
    clear,
    needsCampusSelection,
    afterLoginRoute,
  };
});
