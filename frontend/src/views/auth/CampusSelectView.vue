<template>
  <div class="wrap">
    <a-card title="选择当前校区" class="card">
      <a-alert
        message="销售账号需先选择校区，后续数据将按校区隔离。"
        type="info"
        show-icon
        style="margin-bottom: 16px"
      />
      <a-form layout="vertical">
        <a-form-item label="校区">
          <a-select
            v-model:value="selected"
            placeholder="请选择"
            :options="options"
            :loading="loading"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item>
          <a-space direction="vertical" style="width: 100%" :size="8">
            <a-button type="primary" block :disabled="!selected" :loading="submitting" @click="onSubmit">
              进入系统
            </a-button>
            <a-button block @click="goBackToLogin">返回上一步</a-button>
          </a-space>
        </a-form-item>
        <a-typography-link @click="goChangePassword">修改密码</a-typography-link>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { http } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const loading = ref(false);
const submitting = ref(false);
const selected = ref<string | undefined>(undefined);
const options = ref<{ label: string; value: string }[]>([]);

onMounted(async () => {
  if (!auth.isSales) {
    await router.replace(auth.afterLoginRoute());
    return;
  }
  loading.value = true;
  try {
    const { data } = await http.get<{ id: string; name: string }[]>('/campuses/mine');
    options.value = data.map((c) => ({ label: c.name, value: c.id }));
    if (options.value.length === 0) {
      message.warning('暂无绑定校区，请联系管理员');
    }
  } catch {
    message.error('加载校区失败');
  } finally {
    loading.value = false;
  }
});

function goChangePassword() {
  void router.push({ name: 'account-password' });
}

function goBackToLogin() {
  auth.clear();
  void router.replace({ name: 'login' });
}

async function onSubmit() {
  if (!selected.value) {
    return;
  }
  submitting.value = true;
  try {
    const label = options.value.find((o) => o.value === selected.value)?.label ?? '';
    auth.setCampus(selected.value, label);
    const redirect = (route.query.redirect as string) || '/students';
    await router.replace(redirect);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}
.card {
  width: 440px;
  max-width: 92vw;
}
</style>
