<template>
  <div class="page">
    <a-space direction="vertical" style="width: 100%" :size="16">
      <a-card title="筛选条件">
        <a-form layout="inline">
          <a-form-item label="校区">
            <a-select
              v-model:value="filters.campusId"
              allow-clear
              placeholder="全部校区"
              :options="campusOptions"
              style="width: 220px"
            />
          </a-form-item>
          <a-form-item label="时间范围">
            <a-range-picker
              v-model:value="filters.timeRange"
              show-time
              value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            />
          </a-form-item>
          <a-form-item label="未收入课时费用策略">
            <a-select
              v-model:value="filters.unitPriceSource"
              :options="unitPriceSourceOptions"
              style="width: 220px"
            />
          </a-form-item>
          <a-form-item label="舍入策略">
            <a-select
              v-model:value="filters.rounding"
              :options="roundingOptions"
              style="width: 160px"
            />
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" :loading="loading" @click="onSearch">查询</a-button>
              <a-button @click="onReset">重置</a-button>
              <a-button @click="goReports">打开报表</a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>

      <a-row :gutter="16">
        <a-col :span="4">
          <a-card>
            <a-statistic title="在读人数" :value="Number(summary.activeStudents || 0)" />
          </a-card>
        </a-col>
        <a-col :span="5">
          <a-card>
            <a-statistic title="剩余课时" :value="Number(summary.totalRemainingHours || 0)" />
          </a-card>
        </a-col>
        <a-col :span="5">
          <a-card>
            <a-statistic title="总课时" :value="Number(summary.totalCourseHours || 0)" />
          </a-card>
        </a-col>
        <a-col :span="5">
          <a-card>
            <a-statistic title="总收入" :value="Number(summary.totalIncome || 0)" />
          </a-card>
        </a-col>
        <a-col :span="5">
          <a-card>
            <a-statistic title="未收入课时费用" :value="Number(summary.unearnedCourseFee || 0)" />
          </a-card>
        </a-col>
      </a-row>

      <a-card title="口径说明">
        <a-descriptions :column="1" size="small">
          <a-descriptions-item label="公式">
            {{ summary.unearnedExplanation?.formula || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="单价来源">
            {{ summary.unearnedExplanation?.unitPriceSource || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="舍入策略">
            {{ summary.unearnedExplanation?.rounding || '-' }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { http } from '@/api/http';

type DashboardSummary = {
  activeStudents: number;
  totalRemainingHours: string;
  totalCourseHours: string;
  totalIncome: string;
  unearnedCourseFee: string;
  unearnedExplanation?: {
    formula: string;
    unitPriceSource: string;
    rounding: string;
  };
};

type ReportFiltersResponse = {
  campuses: Array<{ id: string; name: string }>;
};

const router = useRouter();
const loading = ref(false);
const summary = reactive<DashboardSummary>({
  activeStudents: 0,
  totalRemainingHours: '0.00',
  totalCourseHours: '0.00',
  totalIncome: '0.00',
  unearnedCourseFee: '0.00',
});
const campuses = ref<Array<{ id: string; name: string }>>([]);

const filters = reactive({
  campusId: undefined as string | undefined,
  timeRange: [] as string[],
  unitPriceSource: 'average',
  rounding: 'round',
});

const campusOptions = computed(() =>
  campuses.value.map((item) => ({
    label: item.name,
    value: item.id,
  })),
);

const unitPriceSourceOptions = [
  { label: '课程均价', value: 'average' },
  { label: '学生总金额均摊', value: 'student_total_amount' },
];

const roundingOptions = [
  { label: '四舍五入', value: 'round' },
  { label: '向下取整', value: 'floor' },
  { label: '向上取整', value: 'ceil' },
];

onMounted(async () => {
  await fetchFilters();
  await fetchSummary();
});

async function fetchFilters() {
  try {
    const { data } = await http.get<ReportFiltersResponse>('/reports/filters');
    campuses.value = data.campuses;
  } catch {
    campuses.value = [];
  }
}

async function fetchSummary() {
  loading.value = true;
  try {
    const { data } = await http.get<DashboardSummary>('/dashboard/summary', {
      params: {
        campusId: filters.campusId,
        startTime: filters.timeRange[0] || undefined,
        endTime: filters.timeRange[1] || undefined,
        unitPriceSource: filters.unitPriceSource,
        rounding: filters.rounding,
      },
    });
    Object.assign(summary, data);
  } catch (error) {
    message.error(extractErrorMessage(error, '加载仪表盘指标失败'));
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  void fetchSummary();
}

function onReset() {
  filters.campusId = undefined;
  filters.timeRange = [];
  filters.unitPriceSource = 'average';
  filters.rounding = 'round';
  void fetchSummary();
}

function goReports() {
  void router.push({
    path: '/reports',
    query: {
      campusId: filters.campusId || undefined,
      startTime: filters.timeRange[0] || undefined,
      endTime: filters.timeRange[1] || undefined,
      unitPriceSource: filters.unitPriceSource,
      rounding: filters.rounding,
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
:deep(.ant-form-item) {
  margin-bottom: 16px;
}
</style>
