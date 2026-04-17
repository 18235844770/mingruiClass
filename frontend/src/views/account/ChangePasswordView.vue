<template>
  <div class="wrap">
    <a-card title="修改密码" class="card">
      <a-form :model="form" layout="vertical" @finish="onSubmit">
        <a-form-item
          label="当前密码"
          name="currentPassword"
          :rules="[{ required: true, message: '请输入当前密码' }]"
        >
          <a-input-password v-model:value="form.currentPassword" autocomplete="current-password" />
        </a-form-item>
        <a-form-item
          label="新密码"
          name="newPassword"
          :rules="[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '新密码至少 6 位' },
          ]"
        >
          <a-input-password v-model:value="form.newPassword" autocomplete="new-password" />
        </a-form-item>
        <a-form-item
          label="确认新密码"
          name="confirmPassword"
          :rules="[
            { required: true, message: '请再次输入新密码' },
            {
              validator: async (_rule, value: string) => {
                if (value && value !== form.newPassword) {
                  return Promise.reject('两次输入的新密码不一致');
                }
                return Promise.resolve();
              },
            },
          ]"
        >
          <a-input-password v-model:value="form.confirmPassword" autocomplete="new-password" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" html-type="submit" :loading="loading">保存</a-button>
            <a-button @click="goBack">返回</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import axios from 'axios';
import { http } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);

const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    void router.replace({ name: 'login' });
  }
}

async function onSubmit() {
  loading.value = true;
  try {
    await http.post('/auth/change-password', {
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
    message.success('密码已更新，请使用新密码重新登录');
    form.currentPassword = '';
    form.newPassword = '';
    form.confirmPassword = '';
    auth.clear();
    await router.replace({ name: 'login' });
  } catch (e) {
    message.error(extractErrorMessage(e, '修改失败'));
  } finally {
    loading.value = false;
  }
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
.wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 16px;
}
.card {
  width: 420px;
  max-width: 100%;
}
</style>
