<template>
  <div class="page">
    <a-space direction="vertical" style="width: 100%" :size="16">
      <a-card title="报表筛选">
        <a-form layout="inline">
          <a-form-item label="视图">
            <a-select v-model:value="filters.view" :options="viewOptions" style="width: 140px" />
          </a-form-item>
          <a-form-item label="校区">
            <a-select
              v-model:value="filters.campusId"
              allow-clear
              placeholder="全部"
              :options="campusOptions"
              style="width: 200px"
            />
          </a-form-item>
          <a-form-item label="销售">
            <a-select
              v-model:value="filters.salesId"
              allow-clear
              placeholder="全部"
              :options="salesOptions"
              style="width: 180px"
            />
          </a-form-item>
          <a-form-item label="课程类型">
            <a-select
              v-model:value="filters.courseType"
              allow-clear
              placeholder="全部"
              :options="courseTypeOptions"
              style="width: 180px"
            />
          </a-form-item>
          <a-form-item label="时间范围">
            <a-range-picker
              v-model:value="filters.timeRange"
              show-time
              value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            />
          </a-form-item>
          <a-form-item label="未收入策略">
            <a-select
              v-model:value="filters.unitPriceSource"
              :options="unitPriceSourceOptions"
              style="width: 180px"
            />
          </a-form-item>
          <a-form-item label="舍入">
            <a-select
              v-model:value="filters.rounding"
              :options="roundingOptions"
              style="width: 120px"
            />
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" :loading="loading" @click="onSearch">查询</a-button>
              <a-button @click="onReset">重置</a-button>
              <a-button :loading="exportingExcel" @click="onExport('excel')">导出 Excel</a-button>
              <a-button :loading="exportingPdf" @click="onExport('pdf')">导出 PDF</a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>

      <a-row :gutter="16">
        <a-col :span="4">
          <a-card><a-statistic title="在读人数" :value="Number(summary.activeStudents || 0)" /></a-card>
        </a-col>
        <a-col :span="5">
          <a-card>
            <a-statistic title="剩余课时" :value="Number(summary.totalRemainingHours || 0)" />
          </a-card>
        </a-col>
        <a-col :span="5">
          <a-card><a-statistic title="总课时" :value="Number(summary.totalCourseHours || 0)" /></a-card>
        </a-col>
        <a-col :span="5">
          <a-card><a-statistic title="总收入" :value="Number(summary.totalIncome || 0)" /></a-card>
        </a-col>
        <a-col :span="5">
          <a-card>
            <a-statistic title="未收入课时费用" :value="Number(summary.unearnedCourseFee || 0)" />
          </a-card>
        </a-col>
      </a-row>

      <a-card title="报表数据">
        <a-table
          row-key="__rowKey"
          :data-source="rowsWithKey"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          @change="onTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="String(column.key).includes('Time') || String(column.key).includes('createdAt')">
              {{ formatDateTime(record[column.dataIndex || column.key]) }}
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
import { useRoute } from 'vue-router';
import { http } from '@/api/http';
import { formatDateTime } from '@/utils/datetime';

type ReportsSummary = {
  activeStudents: number;
  totalRemainingHours: string;
  totalCourseHours: string;
  totalIncome: string;
  unearnedCourseFee: string;
};

type ReportsResponse = {
  view: 'student' | 'course' | 'consumption';
  data: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
  summary: ReportsSummary;
};

type ReportFiltersResponse = {
  campuses: Array<{ id: string; name: string }>;
  sales: Array<{ id: string; name: string }>;
  courseTypes: string[];
};

const route = useRoute();
const loading = ref(false);
const exportingExcel = ref(false);
const exportingPdf = ref(false);
const rows = ref<Array<Record<string, unknown>>>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const currentView = ref<'student' | 'course' | 'consumption'>('consumption');
const filterOptions = ref<ReportFiltersResponse>({
  campuses: [],
  sales: [],
  courseTypes: [],
});

const summary = reactive<ReportsSummary>({
  activeStudents: 0,
  totalRemainingHours: '0.00',
  totalCourseHours: '0.00',
  totalIncome: '0.00',
  unearnedCourseFee: '0.00',
});

const filters = reactive({
  view: 'consumption' as 'student' | 'course' | 'consumption',
  campusId: undefined as string | undefined,
  salesId: undefined as string | undefined,
  courseType: undefined as string | undefined,
  timeRange: [] as string[],
  unitPriceSource: 'average',
  rounding: 'round',
  sortBy: 'createdAt',
  sortOrder: 'descend' as 'ascend' | 'descend',
});

const viewOptions = [
  { label: '学生聚合', value: 'student' },
  { label: '课程聚合', value: 'course' },
  { label: '消课明细', value: 'consumption' },
];

const unitPriceSourceOptions = [
  { label: '课程均价', value: 'average' },
  { label: '总金额均摊', value: 'student_total_amount' },
];

const roundingOptions = [
  { label: '四舍五入', value: 'round' },
  { label: '向下', value: 'floor' },
  { label: '向上', value: 'ceil' },
];

const campusOptions = computed(() =>
  filterOptions.value.campuses.map((item) => ({ label: item.name, value: item.id })),
);
const salesOptions = computed(() =>
  filterOptions.value.sales.map((item) => ({ label: item.name, value: item.id })),
);
const courseTypeOptions = computed(() =>
  filterOptions.value.courseTypes.map((item) => ({ label: item, value: item })),
);

const columns = computed(() => {
  if (currentView.value === 'student') {
    return [
      { title: '学生', key: 'studentName', dataIndex: 'studentName', sorter: true },
      { title: '手机号', key: 'phone', dataIndex: 'phone' },
      { title: '总收入', key: 'totalIncome', dataIndex: 'totalIncome', sorter: true },
      { title: '总课时', key: 'totalCourseHours', dataIndex: 'totalCourseHours' },
      { title: '剩余课时', key: 'totalRemainingHours', dataIndex: 'totalRemainingHours' },
      { title: '状态', key: 'paidStatus', dataIndex: 'paidStatus' },
      { title: '创建时间', key: 'createdAt', dataIndex: 'createdAt', sorter: true },
    ];
  }
  if (currentView.value === 'course') {
    return [
      { title: '课程', key: 'courseName', dataIndex: 'courseName', sorter: true },
      { title: '课程类型', key: 'courseType', dataIndex: 'courseType', sorter: true },
      { title: '学生', key: 'studentName', dataIndex: 'studentName' },
      { title: '总课时', key: 'totalHours', dataIndex: 'totalHours', sorter: true },
      { title: '剩余课时', key: 'remainingHours', dataIndex: 'remainingHours', sorter: true },
      { title: '已消课时', key: 'consumedHours', dataIndex: 'consumedHours' },
      { title: '创建时间', key: 'createdAt', dataIndex: 'createdAt', sorter: true },
    ];
  }
  return [
    { title: '消课时间', key: 'consumptionTime', dataIndex: 'consumptionTime', sorter: true },
    { title: '学生', key: 'studentName', dataIndex: 'studentName' },
    { title: '课程', key: 'courseName', dataIndex: 'courseName' },
    { title: '课程类型', key: 'courseType', dataIndex: 'courseType' },
    { title: '消课课时', key: 'consumedHours', dataIndex: 'consumedHours', sorter: true },
    { title: '消课后剩余', key: 'remainingHoursAfter', dataIndex: 'remainingHoursAfter' },
  ];
});

const rowsWithKey = computed(() =>
  rows.value.map((item, index) => ({
    ...item,
    __rowKey: String(item.studentId || item.courseId || item.consumptionId || index),
  })),
);

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条`,
}));

onMounted(async () => {
  applyRoutePreset();
  await fetchFilterOptions();
  await fetchReports();
});

function applyRoutePreset() {
  filters.campusId = parseQuery(route.query.campusId);
  const start = parseQuery(route.query.startTime);
  const end = parseQuery(route.query.endTime);
  filters.timeRange = [start, end].filter(Boolean) as string[];
  filters.unitPriceSource = parseQuery(route.query.unitPriceSource) || 'average';
  filters.rounding = parseQuery(route.query.rounding) || 'round';
}

async function fetchFilterOptions() {
  try {
    const { data } = await http.get<ReportFiltersResponse>('/reports/filters');
    filterOptions.value = data;
  } catch {
    filterOptions.value = { campuses: [], sales: [], courseTypes: [] };
  }
}

async function fetchReports() {
  loading.value = true;
  try {
    const { data } = await http.get<ReportsResponse>('/reports', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        view: filters.view,
        campusId: filters.campusId,
        salesId: filters.salesId,
        courseType: filters.courseType,
        startTime: filters.timeRange[0] || undefined,
        endTime: filters.timeRange[1] || undefined,
        unitPriceSource: filters.unitPriceSource,
        rounding: filters.rounding,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      },
    });
    rows.value = data.data;
    currentView.value = data.view;
    total.value = data.total;
    Object.assign(summary, data.summary);
  } catch (error) {
    message.error(extractErrorMessage(error, '加载报表失败'));
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void fetchReports();
}

function onReset() {
  filters.view = 'consumption';
  filters.campusId = undefined;
  filters.salesId = undefined;
  filters.courseType = undefined;
  filters.timeRange = [];
  filters.unitPriceSource = 'average';
  filters.rounding = 'round';
  filters.sortBy = 'createdAt';
  filters.sortOrder = 'descend';
  page.value = 1;
  void fetchReports();
}

function onTableChange(next: TablePaginationConfig, _f: unknown, sorter: unknown) {
  page.value = next.current || 1;
  pageSize.value = next.pageSize || 10;
  const normalizedSorter = sorter as { field?: string; order?: 'ascend' | 'descend' | undefined };
  filters.sortBy = normalizedSorter.field || 'createdAt';
  filters.sortOrder = normalizedSorter.order || 'descend';
  void fetchReports();
}

async function onExport(format: 'excel' | 'pdf') {
  if (format === 'excel') {
    exportingExcel.value = true;
  } else {
    exportingPdf.value = true;
  }
  try {
    const { data } = await http.get('/reports/export', {
      params: {
        format,
        view: filters.view,
        campusId: filters.campusId,
        salesId: filters.salesId,
        courseType: filters.courseType,
        startTime: filters.timeRange[0] || undefined,
        endTime: filters.timeRange[1] || undefined,
        unitPriceSource: filters.unitPriceSource,
        rounding: filters.rounding,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      },
      responseType: 'blob',
    });
    const blob = new Blob([data], {
      type:
        format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
    });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = format === 'excel' ? 'reports-export.xlsx' : 'reports-export.pdf';
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
    URL.revokeObjectURL(url);
  } catch (error) {
    message.error(extractErrorMessage(error, '导出失败'));
  } finally {
    exportingExcel.value = false;
    exportingPdf.value = false;
  }
}

function parseQuery(raw: unknown) {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const t = raw.trim();
  return t ? t : undefined;
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

:deep(.ant-form-item) {
  margin-bottom: 16px;
}
</style>
