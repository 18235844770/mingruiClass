<template>
  <div class="page">
    <a-space direction="vertical" style="width: 100%" :size="16">
      <a-card>
        <a-form layout="inline">
          <a-form-item label="名称 / 登录账号">
            <a-input
              v-model:value="filters.username"
              placeholder="支持按展示名称或登录账号模糊查询"
              allow-clear
            />
          </a-form-item>
          <a-form-item label="角色">
            <a-select
              v-model:value="filters.roleId"
              placeholder="全部"
              allow-clear
              style="width: 180px"
              :options="roleOptions"
            />
          </a-form-item>
          <a-form-item label="状态">
            <a-select
              v-model:value="filters.status"
              placeholder="全部"
              allow-clear
              style="width: 140px"
              :options="statusOptions"
            />
          </a-form-item>
          <a-form-item label="校区">
            <a-select
              v-model:value="filters.campusId"
              placeholder="全部"
              allow-clear
              style="width: 200px"
              :options="campusOptions"
            />
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" :loading="loading" @click="onSearch">查询</a-button>
              <a-button @click="onReset">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>

      <a-card>
        <template #title>用户列表</template>
        <template #extra>
          <a-button type="primary" @click="openCreate">新建用户</a-button>
        </template>
        <a-table
          row-key="id"
          :data-source="tableData"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          @change="onTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'active' ? 'green' : 'default'">
                {{ record.status === 'active' ? '启用' : '停用' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'role'">
              {{ record.role.name || record.role.code }}
            </template>
            <template v-else-if="column.key === 'campuses'">
              <a-space wrap>
                <a-tag v-for="campus in record.campuses" :key="campus.id">{{ campus.name }}</a-tag>
              </a-space>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" @click="openEdit(record)">编辑</a-button>
                <a-button
                  v-if="record.loginAccount !== SUPER_ADMIN_LOGIN_ACCOUNT"
                  type="link"
                  danger
                  @click="onDelete(record)"
                >
                  删除
                </a-button>
                <a-typography-text v-else type="secondary">不可删除</a-typography-text>
              </a-space>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
          </template>
        </a-table>
      </a-card>
    </a-space>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑用户' : '新建用户'"
      :confirm-loading="saving"
      width="640px"
      @ok="onSave"
    >
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="登录账号" required>
              <a-input
                v-model:value="form.loginAccount"
                maxlength="128"
                placeholder="唯一，用于登录"
                autocomplete="username"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="名称" required>
              <a-input v-model:value="form.username" placeholder="如：张三" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="角色" required>
              <a-select v-model:value="form.roleId" :options="roleOptions" placeholder="请选择角色" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态" required>
              <a-select v-model:value="form.status" :options="statusOptions" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="editingId ? '重置密码（可选）' : '密码'" :required="!editingId">
              <a-input-password
                v-model:value="form.password"
                :placeholder="editingId ? '不填写则不修改密码' : '至少 6 位'"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="绑定校区">
          <a-select
            v-model:value="form.campusIds"
            mode="multiple"
            :options="campusOptions"
            placeholder="可多选"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { TablePaginationConfig } from 'ant-design-vue';
import { message, Modal } from 'ant-design-vue';
import axios from 'axios';
import { http } from '@/api/http';
import { SUPER_ADMIN_LOGIN_ACCOUNT } from '@/constants/super-admin';
import { formatDateTime } from '@/utils/datetime';

type Role = {
  id: string;
  code: string;
  name: string | null;
};

type Campus = {
  id: string;
  name: string;
  status: string;
};

type UserRow = {
  id: string;
  loginAccount: string;
  username: string;
  roleId: string;
  status: string;
  role: Role;
  campuses: Campus[];
  campusIds: string[];
  createdAt: string;
  updatedAt: string;
};

type UsersListResponse = {
  data: UserRow[];
  total: number;
  page: number;
  pageSize: number;
};

type RolesListResponse = {
  data: Role[];
};

type CampusesListResponse = {
  data: Campus[];
};

const loading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const editingId = ref<string | null>(null);

const tableData = ref<UserRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const roleOptions = ref<{ label: string; value: string }[]>([]);
const campusOptions = ref<{ label: string; value: string }[]>([]);

const filters = reactive({
  username: '',
  roleId: undefined as string | undefined,
  status: undefined as string | undefined,
  campusId: undefined as string | undefined,
});

const form = reactive({
  loginAccount: '',
  username: '',
  roleId: undefined as string | undefined,
  status: 'active',
  password: '',
  campusIds: [] as string[],
});

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

const columns = [
  { title: '登录账号', dataIndex: 'loginAccount', key: 'loginAccount', width: 160 },
  { title: '名称', dataIndex: 'username', key: 'username', width: 140 },
  { title: '角色', key: 'role', width: 160 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '绑定校区', key: 'campuses' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 220 },
  { title: '操作', key: 'actions', width: 160, fixed: 'right' as const },
];

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条`,
}));

onMounted(async () => {
  await Promise.all([fetchRoles(), fetchCampuses()]);
  await fetchList();
});

async function fetchRoles() {
  const { data } = await http.get<RolesListResponse>('/roles', {
    params: { page: 1, pageSize: 100 },
  });
  roleOptions.value = data.data.map((role) => ({
    label: role.name || role.code,
    value: role.id,
  }));
}

async function fetchCampuses() {
  const { data } = await http.get<CampusesListResponse>('/campuses', {
    params: { page: 1, pageSize: 100 },
  });
  campusOptions.value = data.data.map((campus) => ({
    label: campus.name,
    value: campus.id,
  }));
}

async function fetchList() {
  loading.value = true;
  try {
    const { data } = await http.get<UsersListResponse>('/users', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        username: filters.username || undefined,
        roleId: filters.roleId,
        status: filters.status,
        campusId: filters.campusId,
      },
    });
    tableData.value = data.data;
    total.value = data.total;
  } catch (error) {
    message.error(extractErrorMessage(error, '加载用户列表失败'));
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void fetchList();
}

function onReset() {
  filters.username = '';
  filters.roleId = undefined;
  filters.status = undefined;
  filters.campusId = undefined;
  page.value = 1;
  void fetchList();
}

function onTableChange(next: TablePaginationConfig) {
  page.value = next.current || 1;
  pageSize.value = next.pageSize || 10;
  void fetchList();
}

function openCreate() {
  editingId.value = null;
  form.loginAccount = '';
  form.username = '';
  form.roleId = undefined;
  form.status = 'active';
  form.password = '';
  form.campusIds = [];
  modalOpen.value = true;
}

function openEdit(record: UserRow) {
  editingId.value = record.id;
  form.loginAccount = record.loginAccount;
  form.username = record.username;
  form.roleId = record.roleId;
  form.status = record.status;
  form.password = '';
  form.campusIds = [...record.campusIds];
  modalOpen.value = true;
}

async function onSave() {
  if (!form.roleId) {
    message.warning('请选择角色');
    return;
  }
  const loginAccount = form.loginAccount.trim();
  if (!loginAccount) {
    message.warning('请输入登录账号');
    return;
  }
  if (!form.username.trim()) {
    message.warning('请输入展示名称');
    return;
  }
  if (!editingId.value && form.password.length < 6) {
    message.warning('密码至少 6 位');
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await http.patch(`/users/${editingId.value}`, {
        loginAccount,
        username: form.username.trim(),
        roleId: form.roleId,
        status: form.status,
        password: form.password || undefined,
        campusIds: form.campusIds,
      });
      message.success('更新成功');
    } else {
      await http.post('/users', {
        loginAccount,
        username: form.username.trim(),
        password: form.password,
        roleId: form.roleId,
        status: form.status,
        campusIds: form.campusIds,
      });
      message.success('创建成功');
    }
    modalOpen.value = false;
    void fetchList();
  } catch (error) {
    message.error(extractErrorMessage(error, '保存失败'));
  } finally {
    saving.value = false;
  }
}

function onDelete(record: UserRow) {
  Modal.confirm({
    title: '确认删除该用户吗？',
    content: `用户 ${record.loginAccount}（${record.username}）删除后不可恢复。`,
    okText: '确认删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: async () => {
      try {
        await http.delete(`/users/${record.id}`);
        message.success('删除成功');
        if (tableData.value.length === 1 && page.value > 1) {
          page.value -= 1;
        }
        await fetchList();
      } catch (error) {
        message.error(extractErrorMessage(error, '删除失败，可能受业务规则限制'));
      }
    },
  });
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg;
    }
  }
  return fallback;
}
</script>

<style scoped>
.page {
  width: 100%;
}
</style>
