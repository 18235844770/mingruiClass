<template>
  <div class="page">
    <a-space direction="vertical" style="width: 100%" :size="16">
      <a-card>
        <a-form layout="inline">
          <a-form-item label="校区名称">
            <a-input v-model:value="filters.name" placeholder="请输入名称" allow-clear />
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
          <a-form-item>
            <a-space>
              <a-button type="primary" :loading="loading" @click="onSearch">查询</a-button>
              <a-button @click="onReset">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>

      <a-card>
        <template #title>校区列表</template>
        <template #extra>
          <a-button type="primary" @click="openCreate">新建校区</a-button>
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
            <template v-else-if="column.key === 'actions'">
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
      :title="editingId ? '编辑校区' : '新建校区'"
      :confirm-loading="saving"
      @ok="onSave"
    >
      <a-form layout="vertical">
        <a-form-item label="校区名称" required>
          <a-input v-model:value="form.name" placeholder="请输入校区名称" />
        </a-form-item>
        <a-form-item label="状态" required>
          <a-select v-model:value="form.status" :options="statusOptions" />
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

type Campus = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type CampusesListResponse = {
  data: Campus[];
  total: number;
  page: number;
  pageSize: number;
};

const loading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const editingId = ref<string | null>(null);

const tableData = ref<Campus[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const filters = reactive({
  name: '',
  status: undefined as string | undefined,
});

const form = reactive({
  name: '',
  status: 'active',
});

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

const columns = [
  { title: '校区名称', dataIndex: 'name', key: 'name' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 140 },
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
    const { data } = await http.get<CampusesListResponse>('/campuses', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        name: filters.name || undefined,
        status: filters.status,
      },
    });
    tableData.value = data.data;
    total.value = data.total;
  } catch (error) {
    message.error(extractErrorMessage(error, '加载校区列表失败'));
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void fetchList();
}

function onReset() {
  filters.name = '';
  filters.status = undefined;
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
  form.name = '';
  form.status = 'active';
  modalOpen.value = true;
}

function openEdit(record: Campus) {
  editingId.value = record.id;
  form.name = record.name;
  form.status = record.status || 'active';
  modalOpen.value = true;
}

async function onSave() {
  const name = form.name.trim();
  if (!name) {
    message.warning('请输入校区名称');
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await http.patch(`/campuses/${editingId.value}`, {
        name,
        status: form.status,
      });
      message.success('更新成功');
    } else {
      await http.post('/campuses', {
        name,
        status: form.status,
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

function onDelete(record: Campus) {
  Modal.confirm({
    title: '确认删除该校区吗？',
    content: `校区「${record.name}」删除后不可恢复。`,
    okText: '确认删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: async () => {
      try {
        await http.delete(`/campuses/${record.id}`);
        message.success('删除成功');
        if (tableData.value.length === 1 && page.value > 1) {
          page.value -= 1;
        }
        await fetchList();
      } catch (error) {
        message.error(extractErrorMessage(error, '删除失败，请先解除关联数据'));
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
