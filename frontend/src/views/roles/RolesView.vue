<template>
  <div class="page">
    <a-space direction="vertical" style="width: 100%" :size="16">
      <a-card>
        <a-form layout="inline">
          <a-form-item label="编码">
            <a-input v-model:value="filters.code" placeholder="如 admin" allow-clear />
          </a-form-item>
          <a-form-item label="名称">
            <a-input v-model:value="filters.name" placeholder="请输入名称" allow-clear />
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
        <template #title>角色列表</template>
        <template #extra>
          <a-button type="primary" @click="openCreate">新建角色</a-button>
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
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" @click="openEdit(record)">编辑</a-button>
                <a-button type="link" danger @click="onDelete(record)">删除</a-button>
              </a-space>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'updatedAt'">
              {{ formatDateTime(record.updatedAt) }}
            </template>
          </template>
        </a-table>
      </a-card>
    </a-space>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑角色' : '新建角色'"
      :confirm-loading="saving"
      @ok="onSave"
    >
      <a-form layout="vertical">
        <a-form-item label="角色编码" required>
          <a-input v-model:value="form.code" placeholder="如 admin / sales / owner" :disabled="!!editingId" />
        </a-form-item>
        <a-form-item label="角色名称">
          <a-input v-model:value="form.name" placeholder="请输入角色名称" />
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
import { formatDateTime } from '@/utils/datetime';

type Role = {
  id: string;
  code: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};

type RolesListResponse = {
  data: Role[];
  total: number;
  page: number;
  pageSize: number;
};

const loading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const editingId = ref<string | null>(null);

const tableData = ref<Role[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const filters = reactive({
  code: '',
  name: '',
});

const form = reactive({
  code: '',
  name: '',
});

const columns = [
  { title: '编码', dataIndex: 'code', key: 'code', width: 180 },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 220 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 220 },
  { title: '操作', key: 'actions', width: 160, fixed: 'right' as const },
];

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条`,
}));

onMounted(() => {
  void fetchList();
});

async function fetchList() {
  loading.value = true;
  try {
    const { data } = await http.get<RolesListResponse>('/roles', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        code: filters.code || undefined,
        name: filters.name || undefined,
      },
    });
    tableData.value = data.data;
    total.value = data.total;
  } catch (error) {
    message.error(extractErrorMessage(error, '加载角色列表失败'));
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void fetchList();
}

function onReset() {
  filters.code = '';
  filters.name = '';
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
  form.code = '';
  form.name = '';
  modalOpen.value = true;
}

function openEdit(record: Role) {
  editingId.value = record.id;
  form.code = record.code;
  form.name = record.name || '';
  modalOpen.value = true;
}

async function onSave() {
  const code = form.code.trim().toLowerCase();
  if (!code) {
    message.warning('请输入角色编码');
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await http.patch(`/roles/${editingId.value}`, {
        name: form.name.trim() || undefined,
      });
      message.success('更新成功');
    } else {
      await http.post('/roles', {
        code,
        name: form.name.trim() || undefined,
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

function onDelete(record: Role) {
  Modal.confirm({
    title: '确认删除该角色吗？',
    content: `角色「${record.code}」删除后不可恢复。`,
    okText: '确认删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: async () => {
      try {
        await http.delete(`/roles/${record.id}`);
        message.success('删除成功');
        if (tableData.value.length === 1 && page.value > 1) {
          page.value -= 1;
        }
        await fetchList();
      } catch (error) {
        message.error(extractErrorMessage(error, '删除失败，该角色可能仍被用户使用'));
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
