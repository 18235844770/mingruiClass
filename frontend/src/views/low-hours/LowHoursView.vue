<template>
  <div class="page">
    <a-space direction="vertical" style="width: 100%" :size="16">
      <a-card>
        <a-form layout="inline">
          <a-form-item label="姓名">
            <a-input v-model:value="filters.name" placeholder="请输入学生姓名" allow-clear />
          </a-form-item>
          <a-form-item label="手机号">
            <a-input v-model:value="filters.phone" placeholder="请输入手机号" allow-clear />
          </a-form-item>
          <a-form-item label="交费状态">
            <a-select
              v-model:value="filters.paidStatus"
              :options="paidStatusOptions"
              placeholder="全部"
              allow-clear
              style="width: 160px"
            />
          </a-form-item>
          <a-form-item label="年级">
            <a-select
              v-model:value="filters.grade"
              :options="STUDENT_GRADE_OPTIONS"
              placeholder="全部"
              allow-clear
              style="width: 140px"
            />
          </a-form-item>
          <a-form-item>
            <a-checkbox v-model:checked="filters.negativeHours">仅看负课时</a-checkbox>
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
        <template #title>低课时学生列表（默认剩余课时 &lt; 3）</template>
        <a-table
          row-key="id"
          :data-source="tableData"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          @change="onTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'grade'">
              {{ record.grade || '-' }}
            </template>
            <template v-else-if="column.key === 'gender'">
              {{ record.gender || '-' }}
            </template>
            <template v-else-if="column.key === 'paidStatus'">
              <a-tag :color="record.paidStatus ? 'green' : 'orange'">
                {{ record.paidStatus ? '已交费' : '未交费' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'remainingHours'">
              <span
                :class="{
                  'text-danger': record.isNegativeHours,
                  'text-warning': !record.isNegativeHours && record.isLowHours,
                }"
              >
                {{ record.remainingHours }}
              </span>
            </template>
            <template v-else-if="column.key === 'tags'">
              <a-space wrap>
                <a-tag v-if="record.isNegativeHours" color="red">负课时</a-tag>
                <a-tag v-else-if="record.isLowHours" color="gold">低课时</a-tag>
                <a-tag v-if="record.isArrears" color="orange">欠费</a-tag>
              </a-space>
            </template>
            <template v-else-if="column.key === 'updatedAt'">
              {{ formatDateTime(record.updatedAt) }}
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" @click="goStudentDetail(record)">学生详情</a-button>
                <a-button type="link" @click="goConsumption(record)">去消课</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { TablePaginationConfig } from 'ant-design-vue';
import { message } from 'ant-design-vue';
import axios from 'axios';
import { useRouter, useRoute } from 'vue-router';
import { http } from '@/api/http';
import { STUDENT_GRADE_OPTIONS } from '@/constants/studentProfile';
import { formatDateTime } from '@/utils/datetime';

type StudentRow = {
  id: string;
  name: string;
  phone: string | null;
  grade: string | null;
  gender: string | null;
  totalAmount: string;
  paidStatus: boolean;
  campusId: string;
  createdBy: string;
  updatedAt: string;
  remainingHours: string;
  isLowHours: boolean;
  isNegativeHours: boolean;
  isArrears: boolean;
};

type StudentsListResponse = {
  data: StudentRow[];
  total: number;
};

const router = useRouter();
const route = useRoute();
const loading = ref(false);
const tableData = ref<StudentRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const filters = reactive({
  name: '',
  phone: '',
  paidStatus: undefined as boolean | undefined,
  grade: undefined as string | undefined,
  negativeHours: false,
});

const paidStatusOptions = [
  { label: '已交费', value: true },
  { label: '未交费', value: false },
];

const columns = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 160 },
  { title: '年级', key: 'grade', width: 100 },
  { title: '性别', key: 'gender', width: 72 },
  { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140 },
  { title: '交费状态', dataIndex: 'paidStatus', key: 'paidStatus', width: 120 },
  { title: '剩余课时', dataIndex: 'remainingHours', key: 'remainingHours', width: 120 },
  { title: '风险标签', key: 'tags', width: 180 },
  { title: '最近更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', width: 180 },
];

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条`,
}));

onMounted(() => {
  restoreStateFromQuery();
  void fetchList();
});

function restoreStateFromQuery() {
  page.value = parsePositiveInt(route.query.page, 1);
  pageSize.value = parsePositiveInt(route.query.pageSize, 10);
  filters.name = parseString(route.query.name);
  filters.phone = parseString(route.query.phone);
  filters.paidStatus = parseBoolean(route.query.paidStatus);
  filters.grade = parseString(route.query.grade) || undefined;
  filters.negativeHours = parseBoolean(route.query.negativeHours) ?? false;
}

function syncStateToQuery() {
  void router.replace({
    path: '/low-hours',
    query: {
      page: String(page.value),
      pageSize: String(pageSize.value),
      name: filters.name || undefined,
      phone: filters.phone || undefined,
      paidStatus:
        filters.paidStatus === undefined ? undefined : String(filters.paidStatus),
      grade: filters.grade || undefined,
      negativeHours: filters.negativeHours ? 'true' : undefined,
    },
  });
}

async function fetchList() {
  loading.value = true;
  try {
    const { data } = await http.get<StudentsListResponse>('/students', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        name: filters.name || undefined,
        phone: filters.phone || undefined,
        paidStatus: filters.paidStatus,
        grade: filters.grade || undefined,
        lowHours: true,
        negativeHours: filters.negativeHours || undefined,
      },
    });

    tableData.value = data.data;
    total.value = data.total;
    syncStateToQuery();
  } catch (error) {
    message.error(extractErrorMessage(error, '加载低课时列表失败'));
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
  filters.phone = '';
  filters.paidStatus = undefined;
  filters.grade = undefined;
  filters.negativeHours = false;
  page.value = 1;
  pageSize.value = 10;
  void fetchList();
}

function onTableChange(next: TablePaginationConfig) {
  page.value = next.current || 1;
  pageSize.value = next.pageSize || 10;
  void fetchList();
}

function goStudentDetail(record: StudentRow) {
  void router.push({
    path: '/students',
    query: {
      openStudentId: record.id,
      from: 'low-hours',
      lowHoursPage: String(page.value),
      lowHoursPageSize: String(pageSize.value),
      lowHoursName: filters.name || undefined,
      lowHoursPhone: filters.phone || undefined,
      lowHoursPaidStatus:
        filters.paidStatus === undefined ? undefined : String(filters.paidStatus),
      lowHoursGrade: filters.grade || undefined,
      lowHoursNegativeHours: filters.negativeHours ? 'true' : undefined,
    },
  });
}

function goConsumption(record: StudentRow) {
  void router.push({
    path: '/consumptions',
    query: {
      studentId: record.id,
      from: 'low-hours',
      lowHoursPage: String(page.value),
      lowHoursPageSize: String(pageSize.value),
      lowHoursName: filters.name || undefined,
      lowHoursPhone: filters.phone || undefined,
      lowHoursPaidStatus:
        filters.paidStatus === undefined ? undefined : String(filters.paidStatus),
      lowHoursGrade: filters.grade || undefined,
      lowHoursNegativeHours: filters.negativeHours ? 'true' : undefined,
    },
  });
}

function parseString(raw: unknown) {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.trim();
}

function parsePositiveInt(raw: unknown, fallback: number) {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1) {
    return fallback;
  }
  return num;
}

function parseBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }
  return undefined;
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

.text-danger {
  color: #cf1322;
  font-weight: 600;
}

.text-warning {
  color: #d48806;
  font-weight: 600;
}
</style>
