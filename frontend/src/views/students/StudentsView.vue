<template>
  <div class="page">
    <a-space direction="vertical" style="width: 100%" :size="16">
      <a-alert v-if="canBackToLowHours" type="info" show-icon>
        <template #message>来自低课时提醒，已自动打开学生详情</template>
        <template #action>
          <a-button type="link" size="small" @click="backToLowHours">返回低课时页</a-button>
        </template>
      </a-alert>

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
            <a-checkbox v-model:checked="filters.lowHours">低课时（&lt;3）</a-checkbox>
          </a-form-item>
          <a-form-item>
            <a-checkbox v-model:checked="filters.negativeHours">负课时（&lt;0）</a-checkbox>
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
        <template #title>学生列表</template>
        <template #extra>
          <a-button type="primary" @click="openCreate">新建学生</a-button>
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
              <span :class="{ 'text-danger': record.isNegativeHours, 'text-warning': !record.isNegativeHours && record.isLowHours }">
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
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" @click="openDetail(record)">详情</a-button>
                <a-button type="link" @click="openCoursesModal(record)">录入课程</a-button>
                <a-button type="link" @click="openEdit(record)">编辑</a-button>
                <a-button type="link" danger @click="onDelete(record)">删除</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-space>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑学生' : '新建学生'"
      :confirm-loading="saving"
      @ok="onSubmit"
    >
      <a-form layout="vertical">
        <a-form-item label="姓名" required>
          <a-input v-model:value="form.name" placeholder="请输入学生姓名" />
        </a-form-item>
        <a-form-item label="手机号">
          <a-input v-model:value="form.phone" placeholder="可选" />
        </a-form-item>
        <a-form-item label="年级">
          <a-select
            v-model:value="form.grade"
            :options="STUDENT_GRADE_OPTIONS"
            placeholder="可选"
            allow-clear
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="性别">
          <a-select
            v-model:value="form.gender"
            :options="STUDENT_GENDER_OPTIONS"
            placeholder="可选"
            allow-clear
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item v-if="editingId" label="提示">
          <a-typography-text type="secondary">
            总金额与交费状态由「录入课程」中的课程金额与逐条交费开关自动汇总，请在该处维护。
          </a-typography-text>
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="3" placeholder="可选" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="coursesModalOpen"
      title="课程录入（可编辑已有课程）"
      :confirm-loading="coursesSaving"
      width="1040px"
      @ok="onSubmitCourses"
    >
      <a-space direction="vertical" style="width: 100%">
        <a-alert
          type="info"
          show-icon
          :message="selectedStudentName ? `当前学生：${selectedStudentName}` : '请选择学生'"
        />
        <a-alert
          type="warning"
          show-icon
          message="保存时为全量同步：请保留需继续使用的课程行；有消课记录的课程不可从列表中移除。"
        />
        <a-space wrap>
          <a-button type="primary" :loading="coursesLoading" @click="reloadCoursesModal">重新加载课程</a-button>
          <a-button @click="addCourseRow">新增一条课程</a-button>
          <a-typography-text strong>课程金额合计（保存后写入学生总金额）：{{ coursesPriceSumText }}</a-typography-text>
        </a-space>
        <a-table
          row-key="key"
          :data-source="courseRows"
          :columns="courseColumns"
          :pagination="false"
          size="small"
          :scroll="{ x: 1000 }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'courseName'">
              <a-input v-model:value="record.courseName" placeholder="课程名" />
            </template>
            <template v-else-if="column.key === 'coursePrice'">
              <a-input v-model:value="record.coursePrice" placeholder="价格" />
            </template>
            <template v-else-if="column.key === 'paidStatus'">
              <a-switch
                v-model:checked="record.paidStatus"
                checked-children="已交"
                un-checked-children="未交"
              />
            </template>
            <template v-else-if="column.key === 'totalHours'">
              <a-input v-model:value="record.totalHours" placeholder="总课时" />
            </template>
            <template v-else-if="column.key === 'remainingHours'">
              <a-input v-model:value="record.remainingHours" placeholder="剩余课时" />
            </template>
            <template v-else-if="column.key === 'courseType'">
              <a-select
                v-model:value="record.courseType"
                :options="courseTypeOptionsForRow(record.courseType)"
                placeholder="请选择"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'remark'">
              <a-input v-model:value="record.remark" placeholder="备注（可选）" />
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-button type="link" danger @click="removeCourseRow(index)">删除</a-button>
            </template>
          </template>
        </a-table>
      </a-space>
    </a-modal>

    <a-drawer
      v-model:open="detailOpen"
      title="学生详情"
      width="900px"
      :destroy-on-close="true"
    >
      <a-skeleton :loading="detailLoading" active>
        <template v-if="detailData">
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item label="姓名">{{ detailData.name }}</a-descriptions-item>
            <a-descriptions-item label="手机号">{{ detailData.phone || '-' }}</a-descriptions-item>
            <a-descriptions-item label="年级">{{ detailData.grade || '-' }}</a-descriptions-item>
            <a-descriptions-item label="性别">{{ detailData.gender || '-' }}</a-descriptions-item>
            <a-descriptions-item label="总金额">{{ detailData.totalAmount }}</a-descriptions-item>
            <a-descriptions-item label="交费状态">
              <a-tag :color="detailData.paidStatus ? 'green' : 'orange'">
                {{ detailData.paidStatus ? '已交费' : '未交费' }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="备注" :span="2">{{ detailData.remark || '-' }}</a-descriptions-item>
          </a-descriptions>

          <a-divider />
          <a-typography-title :level="5">课程列表</a-typography-title>
          <a-table
            row-key="id"
            size="small"
            :data-source="detailData.courses"
            :columns="detailCourseColumns"
            :pagination="false"
          >
            <template #bodyCell="{ column, record, text }">
              <template v-if="column.key === 'paidStatus'">
                <a-tag :color="record.paidStatus ? 'green' : 'orange'">
                  {{ record.paidStatus ? '已交费' : '未交费' }}
                </a-tag>
              </template>
              <template v-else>{{ text }}</template>
            </template>
          </a-table>

          <a-divider />
          <a-typography-title :level="5">消课历史摘要</a-typography-title>
          <a-space style="margin-bottom: 12px">
            <a-tag color="blue">记录数：{{ detailData.consumptionSummary.count }}</a-tag>
            <a-tag color="purple"
              >总消课：{{ detailData.consumptionSummary.totalConsumedHours }}</a-tag
            >
          </a-space>
          <a-table
            row-key="id"
            size="small"
            :data-source="detailData.consumptionHistory"
            :columns="detailConsumptionColumns"
            :pagination="{ pageSize: 5 }"
          />
        </template>
      </a-skeleton>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { TablePaginationConfig } from 'ant-design-vue';
import { message, Modal } from 'ant-design-vue';
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { http } from '@/api/http';
import { STUDENT_GENDER_OPTIONS, STUDENT_GRADE_OPTIONS } from '@/constants/studentProfile';
import { formatDateTime } from '@/utils/datetime';

type StudentRow = {
  id: string;
  name: string;
  phone: string | null;
  grade: string | null;
  gender: string | null;
  totalAmount: string;
  paidStatus: boolean;
  remark: string | null;
  campusId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  remainingHours: string;
  isLowHours: boolean;
  isNegativeHours: boolean;
  isArrears: boolean;
};

type StudentsListResponse = {
  data: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
};

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const editingId = ref<string | null>(null);
const coursesModalOpen = ref(false);
const coursesSaving = ref(false);
const coursesLoading = ref(false);
const selectedStudentId = ref<string | null>(null);
const selectedStudentName = ref('');

const detailOpen = ref(false);
const detailLoading = ref(false);
const detailData = ref<StudentDetail | null>(null);

const tableData = ref<StudentRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const filters = reactive({
  name: '',
  phone: '',
  paidStatus: undefined as boolean | undefined,
  grade: undefined as string | undefined,
  lowHours: false,
  negativeHours: false,
});

const form = reactive({
  name: '',
  phone: '',
  grade: undefined as string | undefined,
  gender: undefined as string | undefined,
  remark: '',
});

type StudentDetail = {
  id: string;
  name: string;
  phone: string | null;
  grade: string | null;
  gender: string | null;
  totalAmount: string;
  paidStatus: boolean;
  remark: string | null;
  courses: Array<{
    id: string;
    courseName: string;
    coursePrice: string;
    paidStatus: boolean;
    totalHours: string;
    remainingHours: string;
    courseType: string;
    remark: string | null;
    createdAt: string;
  }>;
  consumptionSummary: {
    count: number;
    totalConsumedHours: string;
  };
  consumptionHistory: Array<{
    id: string;
    courseName: string;
    consumedHours: string;
    consumptionTime: string;
    consumptionTimeText: string;
    operatorId: string;
    remark: string | null;
  }>;
};

type StudentDetailResponse = StudentDetail;

type CourseFormRow = {
  key: string;
  /** 已有课程的后端 id；新增行为空 */
  courseId?: string;
  courseName: string;
  coursePrice: string;
  paidStatus: boolean;
  totalHours: string;
  remainingHours: string;
  courseType: string;
  remark: string;
};

const courseRows = ref<CourseFormRow[]>([]);

const paidStatusOptions = [
  { label: '已交费', value: true },
  { label: '未交费', value: false },
];

const COURSE_TYPE_STANDARD = [
  { label: '1v1', value: '1v1' },
  { label: '班课', value: '班课' },
] as const;

function courseTypeOptionsForRow(current: string) {
  const v = (current || '').trim();
  if (v && v !== '1v1' && v !== '班课') {
    return [
      { label: `${v}（请改选为 1v1 或班课）`, value: v },
      ...COURSE_TYPE_STANDARD,
    ];
  }
  return [...COURSE_TYPE_STANDARD];
}

function isValidCourseType(value: string) {
  const v = value.trim();
  return v === '1v1' || v === '班课';
}

const columns = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 160 },
  { title: '年级', key: 'grade', width: 100 },
  { title: '性别', key: 'gender', width: 72 },
  { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140 },
  { title: '总金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 120 },
  { title: '交费状态', dataIndex: 'paidStatus', key: 'paidStatus', width: 120 },
  { title: '剩余课时', dataIndex: 'remainingHours', key: 'remainingHours', width: 120 },
  { title: '风险标签', key: 'tags', width: 180 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 200 },
  { title: '操作', key: 'actions', width: 280, fixed: 'right' as const },
];

const courseColumns = [
  { title: '课程名', key: 'courseName', width: 140 },
  { title: '价格', key: 'coursePrice', width: 100 },
  { title: '是否交费', key: 'paidStatus', width: 100 },
  { title: '总课时', key: 'totalHours', width: 100 },
  { title: '剩余课时', key: 'remainingHours', width: 100 },
  { title: '类型', key: 'courseType', width: 120 },
  { title: '备注', key: 'remark' },
  { title: '操作', key: 'actions', width: 80 },
];

const detailCourseColumns = [
  { title: '课程名', dataIndex: 'courseName', key: 'courseName', width: 160 },
  { title: '价格', dataIndex: 'coursePrice', key: 'coursePrice', width: 100 },
  { title: '交费', key: 'paidStatus', width: 100 },
  { title: '总课时', dataIndex: 'totalHours', key: 'totalHours', width: 100 },
  { title: '剩余课时', dataIndex: 'remainingHours', key: 'remainingHours', width: 100 },
  { title: '类型', dataIndex: 'courseType', key: 'courseType', width: 120 },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
];

const detailConsumptionColumns = [
  { title: '课程', dataIndex: 'courseName', key: 'courseName', width: 160 },
  { title: '消课课时', dataIndex: 'consumedHours', key: 'consumedHours', width: 100 },
  { title: '消课时间', dataIndex: 'consumptionTimeText', key: 'consumptionTimeText', width: 180 },
  { title: '操作人', dataIndex: 'operatorId', key: 'operatorId', width: 220 },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
];

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条`,
}));

const coursesPriceSumText = computed(() => {
  let sum = 0;
  for (const row of courseRows.value) {
    const n = Number(String(row.coursePrice ?? '').trim());
    if (!Number.isFinite(n)) {
      continue;
    }
    sum += n;
  }
  return sum.toFixed(2);
});

const canBackToLowHours = computed(() => route.query.from === 'low-hours');

onMounted(() => {
  void initializePage();
});

async function initializePage() {
  const lowHoursGrade = parseStringQuery(route.query.lowHoursGrade);
  if (lowHoursGrade) {
    filters.grade = lowHoursGrade;
  }
  await fetchList();
  const openStudentId = route.query.openStudentId;
  if (typeof openStudentId === 'string' && openStudentId.trim()) {
    await openDetailById(openStudentId.trim());
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
        lowHours: filters.lowHours || undefined,
        negativeHours: filters.negativeHours || undefined,
      },
    });
    tableData.value = data.data;
    total.value = data.total;
  } catch (error) {
    message.error(extractErrorMessage(error, '加载学生列表失败'));
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
  filters.lowHours = false;
  filters.negativeHours = false;
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
  form.phone = '';
  form.grade = undefined;
  form.gender = undefined;
  form.remark = '';
  modalOpen.value = true;
}

function openEdit(record: StudentRow) {
  editingId.value = record.id;
  form.name = record.name;
  form.phone = record.phone || '';
  form.grade = record.grade ?? undefined;
  form.gender = record.gender ?? undefined;
  form.remark = record.remark || '';
  modalOpen.value = true;
}

function openCoursesModal(record: StudentRow) {
  selectedStudentId.value = record.id;
  selectedStudentName.value = record.name;
  coursesModalOpen.value = true;
  void loadCoursesForModal(record.id);
}

function mapDetailCoursesToRows(
  courses: StudentDetail['courses'],
): CourseFormRow[] {
  if (courses.length === 0) {
    return [createEmptyCourseRow()];
  }
  return courses.map((c) => ({
    key: c.id,
    courseId: c.id,
    courseName: c.courseName,
    coursePrice: c.coursePrice,
    paidStatus: c.paidStatus,
    totalHours: c.totalHours,
    remainingHours: c.remainingHours,
    courseType: c.courseType,
    remark: c.remark ?? '',
  }));
}

async function loadCoursesForModal(studentId: string) {
  coursesLoading.value = true;
  try {
    const { data } = await http.get<StudentDetailResponse>(`/students/${studentId}`);
    courseRows.value = mapDetailCoursesToRows(data.courses);
  } catch (error) {
    message.error(extractErrorMessage(error, '加载课程列表失败'));
    courseRows.value = [createEmptyCourseRow()];
  } finally {
    coursesLoading.value = false;
  }
}

async function reloadCoursesModal() {
  if (!selectedStudentId.value) {
    return;
  }
  await loadCoursesForModal(selectedStudentId.value);
}

function createEmptyCourseRow(): CourseFormRow {
  return {
    key: `${Date.now()}-${Math.random()}`,
    courseName: '',
    coursePrice: '',
    paidStatus: false,
    totalHours: '',
    remainingHours: '',
    courseType: '1v1',
    remark: '',
  };
}

function addCourseRow() {
  courseRows.value.push(createEmptyCourseRow());
}

function removeCourseRow(index: number) {
  courseRows.value.splice(index, 1);
  if (courseRows.value.length === 0) {
    courseRows.value.push(createEmptyCourseRow());
  }
}

async function onSubmitCourses() {
  if (!selectedStudentId.value) {
    message.warning('请选择学生');
    return;
  }
  const rowsToSave = courseRows.value.filter(
    (row) =>
      row.courseName.trim() ||
      row.coursePrice.trim() ||
      row.totalHours.trim() ||
      row.remainingHours.trim() ||
      row.courseType.trim() ||
      row.remark.trim(),
  );
  for (const [index, row] of rowsToSave.entries()) {
    if (
      !row.courseName.trim() ||
      !row.coursePrice.trim() ||
      !row.totalHours.trim() ||
      !row.remainingHours.trim() ||
      !isValidCourseType(row.courseType)
    ) {
      message.warning(
        `第 ${index + 1} 条课程信息不完整，或课程类型未选择为 1v1 / 班课（若不需要请删除空行）`,
      );
      return;
    }
  }
  coursesSaving.value = true;
  try {
    await http.post(`/students/${selectedStudentId.value}/courses`, {
      courses: rowsToSave.map((row) => ({
        ...(row.courseId ? { id: row.courseId } : {}),
        courseName: row.courseName.trim(),
        coursePrice: row.coursePrice.trim(),
        totalHours: row.totalHours.trim(),
        remainingHours: row.remainingHours.trim(),
        courseType: row.courseType.trim(),
        paidStatus: row.paidStatus,
        remark: row.remark.trim() || undefined,
      })),
    });
    message.success('课程录入成功');
    coursesModalOpen.value = false;
    await fetchList();
  } catch (error) {
    message.error(extractErrorMessage(error, '课程录入失败'));
  } finally {
    coursesSaving.value = false;
  }
}

async function openDetail(record: StudentRow) {
  await openDetailById(record.id);
}

async function openDetailById(studentId: string) {
  detailOpen.value = true;
  detailLoading.value = true;
  detailData.value = null;
  try {
    const { data } = await http.get<StudentDetailResponse>(`/students/${studentId}`);
    detailData.value = {
      ...data,
      consumptionHistory: data.consumptionHistory.map((item) => ({
        ...item,
        consumptionTimeText: formatDateTime(item.consumptionTime),
      })),
    };
  } catch (error) {
    detailOpen.value = false;
    message.error(extractErrorMessage(error, '加载学生详情失败'));
  } finally {
    detailLoading.value = false;
  }
}

async function onSubmit() {
  const name = form.name.trim();
  if (!name) {
    message.warning('请输入学生姓名');
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await http.patch(`/students/${editingId.value}`, {
        name,
        phone: form.phone.trim() || undefined,
        remark: form.remark.trim() || undefined,
        grade: form.grade?.trim() ?? '',
        gender: form.gender?.trim() ?? '',
      });
      message.success('更新成功');
    } else {
      await http.post('/students', {
        name,
        phone: form.phone.trim() || undefined,
        remark: form.remark.trim() || undefined,
        grade: form.grade?.trim() || undefined,
        gender: form.gender?.trim() || undefined,
      });
      message.success('创建成功');
    }
    modalOpen.value = false;
    page.value = 1;
    await fetchList();
  } catch (error) {
    message.error(extractErrorMessage(error, '保存学生失败'));
  } finally {
    saving.value = false;
  }
}

function onDelete(record: StudentRow) {
  Modal.confirm({
    title: '确认删除该学生吗？',
    content: `学生「${record.name}」删除后不可恢复。`,
    okText: '确认删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: async () => {
      try {
        await http.delete(`/students/${record.id}`);
        message.success('删除成功');
        if (tableData.value.length === 1 && page.value > 1) {
          page.value -= 1;
        }
        await fetchList();
      } catch (error) {
        message.error(extractErrorMessage(error, '删除失败'));
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
