<template>
  <div class="page">
    <a-space direction="vertical" style="width: 100%" :size="16">
      <a-alert v-if="canBackToLowHours" type="info" show-icon>
        <template #message>来自低课时提醒，已自动预选学生</template>
        <template #action>
          <a-button type="link" size="small" @click="backToLowHours">返回低课时页</a-button>
        </template>
      </a-alert>

      <a-card title="消课录入">
        <a-form layout="inline">
          <a-form-item label="学生" required>
            <a-select
              v-model:value="createForm.studentId"
              placeholder="请选择学生"
              show-search
              :options="studentOptions"
              style="width: 220px"
              @change="onStudentChange"
            />
          </a-form-item>
          <a-form-item label="课程" required>
            <a-select
              v-model:value="createForm.studentCourseId"
              placeholder="请选择课程"
              show-search
              :options="courseOptions"
              style="width: 280px"
            />
          </a-form-item>
          <a-form-item label="消课课时" required>
            <a-input
              v-model:value="createForm.consumedHours"
              placeholder="例如：1"
              style="width: 120px"
            />
          </a-form-item>
          <a-form-item label="消课时间" required>
            <a-date-picker
              v-model:value="createForm.consumptionTime"
              show-time
              value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
              style="width: 220px"
            />
          </a-form-item>
          <a-form-item label="备注">
            <a-input
              v-model:value="createForm.remark"
              placeholder="可选"
              style="width: 220px"
              allow-clear
            />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" :loading="creating" @click="onSubmit">确认消课</a-button>
          </a-form-item>
        </a-form>
      </a-card>

      <a-card>
        <a-form layout="inline">
          <a-form-item label="学生">
            <a-select
              v-model:value="filters.studentId"
              placeholder="全部"
              allow-clear
              show-search
              :options="studentOptions"
              style="width: 220px"
              @change="onFilterStudentChange"
            />
          </a-form-item>
          <a-form-item label="课程">
            <a-select
              v-model:value="filters.studentCourseId"
              placeholder="全部"
              allow-clear
              show-search
              :options="filterCourseOptions"
              style="width: 280px"
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
          <a-form-item label="日期范围">
            <a-range-picker
              v-model:value="filters.timeRange"
              show-time
              value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            />
          </a-form-item>
          <a-form-item v-if="canFilterOperator" label="销售">
            <a-select
              v-model:value="filters.operatorId"
              placeholder="全部"
              allow-clear
              :options="operatorOptions"
              style="width: 200px"
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

      <a-card title="消课记录">
        <a-table
          row-key="id"
          :data-source="tableData"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          @change="onTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'consumptionTime'">
              {{ formatDateTime(record.consumptionTime) }}
            </template>
            <template v-else-if="column.key === 'remainingHoursAfter'">
              <span :class="{ 'text-danger': record.isNegativeHours, 'text-warning': !record.isNegativeHours && record.isLowHours }">
                {{ record.remainingHoursAfter }}
              </span>
            </template>
            <template v-else-if="column.key === 'riskTags'">
              <a-space wrap>
                <a-tag v-if="record.isNegativeHours" color="red">负课时</a-tag>
                <a-tag v-else-if="record.isLowHours" color="gold">低课时</a-tag>
              </a-space>
            </template>
            <template v-else-if="column.key === 'operatorName'">
              {{ record.operatorName || '-' }}
            </template>
            <template v-else-if="column.key === 'studentGrade'">
              {{ record.studentGrade || '-' }}
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
import { message, Modal } from 'ant-design-vue';
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { http } from '@/api/http';
import { STUDENT_GRADE_OPTIONS } from '@/constants/studentProfile';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime } from '@/utils/datetime';

type StudentOption = {
  id: string;
  name: string;
};

type StudentCourseOption = {
  id: string;
  courseName: string;
};

type ConsumptionsListItem = {
  id: string;
  studentId: string;
  studentName: string;
  studentGrade: string | null;
  studentCourseId: string;
  courseName: string;
  consumedHours: string;
  consumptionTime: string;
  operatorId: string;
  operatorName: string;
  remark: string | null;
  remainingHoursAfter: string;
  isLowHours: boolean;
  isNegativeHours: boolean;
};

type ConsumptionsListResponse = {
  data: ConsumptionsListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type StudentsListResponse = {
  data: Array<{ id: string; name: string }>;
  total: number;
};

type StudentDetailResponse = {
  id: string;
  courses: Array<{ id: string; courseName: string }>;
};

type Operator = {
  id: string;
  username: string;
};

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const creating = ref(false);
const tableData = ref<ConsumptionsListItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const students = ref<StudentOption[]>([]);
const createCourses = ref<StudentCourseOption[]>([]);
const filterCourses = ref<StudentCourseOption[]>([]);
const operatorOptions = ref<{ label: string; value: string }[]>([]);

const createForm = reactive({
  studentId: undefined as string | undefined,
  studentCourseId: undefined as string | undefined,
  consumedHours: '',
  consumptionTime: '',
  remark: '',
});

const filters = reactive({
  studentId: undefined as string | undefined,
  studentCourseId: undefined as string | undefined,
  grade: undefined as string | undefined,
  operatorId: undefined as string | undefined,
  timeRange: [] as string[],
});

const canFilterOperator = computed(() => auth.roleCode === 'admin' || auth.roleCode === 'owner');
const canBackToLowHours = computed(() => route.query.from === 'low-hours');

const studentOptions = computed(() =>
  students.value.map((item) => ({
    label: item.name,
    value: item.id,
  })),
);

const courseOptions = computed(() =>
  createCourses.value.map((item) => ({
    label: item.courseName,
    value: item.id,
  })),
);

const filterCourseOptions = computed(() =>
  filterCourses.value.map((item) => ({
    label: item.courseName,
    value: item.id,
  })),
);

const columns = [
  { title: '学生', dataIndex: 'studentName', key: 'studentName', width: 130 },
  { title: '年级', key: 'studentGrade', width: 90 },
  { title: '课程', dataIndex: 'courseName', key: 'courseName', width: 160 },
  { title: '消课课时', dataIndex: 'consumedHours', key: 'consumedHours', width: 100 },
  { title: '消课时间', key: 'consumptionTime', width: 180 },
  { title: '剩余课时', key: 'remainingHoursAfter', width: 100 },
  { title: '风险标签', key: 'riskTags', width: 120 },
  { title: '操作人', key: 'operatorName', width: 140 },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
];

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条`,
}));

onMounted(async () => {
  await fetchStudents();
  await applyRoutePreset();
  if (canFilterOperator.value) {
    await fetchOperators();
  }
  await fetchList();
});

async function applyRoutePreset() {
  const studentId = parseStringQuery(route.query.studentId);
  if (studentId) {
    createForm.studentId = studentId;
    filters.studentId = studentId;
    await onStudentChange(studentId);
    await onFilterStudentChange(studentId);
  }

  const studentCourseId = parseStringQuery(route.query.studentCourseId);
  if (studentCourseId) {
    createForm.studentCourseId = studentCourseId;
    filters.studentCourseId = studentCourseId;
  }

  const grade = parseStringQuery(route.query.lowHoursGrade);
  if (grade) {
    filters.grade = grade;
  }
}

function backToLowHours() {
  void router.push({
    path: '/low-hours',
    query: {
      page: parseStringQuery(route.query.lowHoursPage) || undefined,
      pageSize: parseStringQuery(route.query.lowHoursPageSize) || undefined,
      name: parseStringQuery(route.query.lowHoursName) || undefined,
      phone: parseStringQuery(route.query.lowHoursPhone) || undefined,
      paidStatus: parseStringQuery(route.query.lowHoursPaidStatus) || undefined,
      grade: parseStringQuery(route.query.lowHoursGrade) || undefined,
      negativeHours:
        parseStringQuery(route.query.lowHoursNegativeHours) === 'true'
          ? 'true'
          : undefined,
    },
  });
}

async function fetchStudents() {
  const list: StudentOption[] = [];
  const size = 100;
  let p = 1;
  let totalCount = Infinity;
  while (list.length < totalCount) {
    const { data } = await http.get<StudentsListResponse>('/students', {
      params: { page: p, pageSize: size },
    });
    totalCount = data.total;
    for (const item of data.data) {
      list.push({ id: item.id, name: item.name });
    }
    if (data.data.length === 0) {
      break;
    }
    p += 1;
    if (p > 500) {
      break;
    }
  }
  students.value = list;
}

async function fetchStudentCourses(studentId: string) {
  const { data } = await http.get<StudentDetailResponse>(`/students/${studentId}`);
  return data.courses.map((course) => ({
    id: course.id,
    courseName: course.courseName,
  }));
}

async function fetchOperators() {
  try {
    const { data } = await http.get<Operator[]>('/logs/operators');
    operatorOptions.value = data.map((item) => ({
      label: item.username,
      value: item.id,
    }));
  } catch {
    operatorOptions.value = [];
  }
}

async function onStudentChange(value: string) {
  createForm.studentCourseId = undefined;
  createCourses.value = await fetchStudentCourses(value);
}

async function onFilterStudentChange(value?: string) {
  filters.studentCourseId = undefined;
  if (!value) {
    filterCourses.value = [];
    return;
  }
  filterCourses.value = await fetchStudentCourses(value);
}

async function fetchList() {
  loading.value = true;
  try {
    const { data } = await http.get<ConsumptionsListResponse>('/consumptions', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        studentId: filters.studentId,
        studentCourseId: filters.studentCourseId,
        grade: filters.grade || undefined,
        operatorId: canFilterOperator.value ? filters.operatorId : undefined,
        startTime: filters.timeRange[0] || undefined,
        endTime: filters.timeRange[1] || undefined,
      },
    });
    tableData.value = data.data;
    total.value = data.total;
  } catch (error) {
    message.error(extractErrorMessage(error, '加载消课记录失败'));
  } finally {
    loading.value = false;
  }
}

async function submitConsumption(duplicateWarningAcknowledged: boolean) {
  const studentCourseId = createForm.studentCourseId;
  const consumedHours = createForm.consumedHours.trim();
  const consumptionTime = createForm.consumptionTime;

  if (!createForm.studentId) {
    message.warning('请选择学生');
    return;
  }
  if (!studentCourseId) {
    message.warning('请选择课程');
    return;
  }
  if (!consumedHours) {
    message.warning('请输入消课课时');
    return;
  }
  const numericHours = Number(consumedHours);
  if (!Number.isFinite(numericHours) || numericHours <= 0) {
    message.warning('消课课时必须大于 0');
    return;
  }
  if (!consumptionTime) {
    message.warning('请选择消课时间');
    return;
  }

  creating.value = true;
  try {
    await http.post('/consumptions', {
      studentCourseId,
      consumedHours,
      consumptionTime,
      remark: createForm.remark.trim() || undefined,
      duplicateWarningAcknowledged,
    });
    message.success('消课成功');
    createForm.consumedHours = '';
    createForm.remark = '';
    createForm.consumptionTime = '';
    await fetchList();
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 409 &&
      error.response.data?.duplicateWarning === true &&
      !duplicateWarningAcknowledged
    ) {
      Modal.confirm({
        title: '检测到疑似重复消课',
        content: '同课程、相同课时、临近时间已有记录。确认仍要继续提交吗？',
        okText: '继续提交',
        cancelText: '取消',
        onOk: async () => {
          await submitConsumption(true);
        },
      });
      return;
    }
    message.error(extractErrorMessage(error, '消课失败'));
  } finally {
    creating.value = false;
  }
}

function onSubmit() {
  void submitConsumption(false);
}

function onSearch() {
  page.value = 1;
  void fetchList();
}

function onReset() {
  filters.studentId = undefined;
  filters.studentCourseId = undefined;
  filters.grade = undefined;
  filters.operatorId = undefined;
  filters.timeRange = [];
  filterCourses.value = [];
  page.value = 1;
  void fetchList();
}

function onTableChange(next: TablePaginationConfig) {
  page.value = next.current || 1;
  pageSize.value = next.pageSize || 10;
  void fetchList();
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

function parseStringQuery(raw: unknown) {
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return '';
}
</script>

<style scoped>
.page {
  width: 100%;
}

:deep(.ant-form-item) {
  margin-bottom: 16px;
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
