<template>
  <div class="wrap">
    <a-card title="教育培训机构后台管理系统" class="card">
      <a-form :model="form" layout="vertical" @finish="onSubmit">
        <a-form-item
          label="登录账号"
          name="loginAccount"
          :rules="[{ required: true, message: '请输入登录账号' }]"
        >
          <a-input
            v-model:value="form.loginAccount"
            maxlength="128"
            autocomplete="username"
            placeholder="登录账号"
          />
        </a-form-item>
        <a-form-item label="密码" name="password" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password v-model:value="form.password" autocomplete="current-password" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" block :loading="loading">登录</a-button>
        </a-form-item>
      </a-form>
      <a-typography-text type="secondary" style="font-size: 12px">
        开发阶段：请先执行后端迁移与种子。超级管理员默认登录账号为 13800000001，密码见 backend README。
      </a-typography-text>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { http } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import type { RoleCode } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const loading = ref(false);
const form = reactive({
  loginAccount: '',
  password: '',
});

async function onSubmit() {
  loading.value = true;
  try {
    const { data } = await http.post<{ accessToken: string; roleCode: RoleCode }>('/auth/login', {
      loginAccount: form.loginAccount.trim(),
      password: form.password,
    });
    auth.setSession({
      accessToken: data.accessToken,
      role: data.roleCode,
      campusId: null,
    });
    const redirect = (route.query.redirect as string) || undefined;
    if (redirect) {
      await router.replace(redirect);
    } else {
      await router.replace(auth.afterLoginRoute());
    }
    message.success('登录成功');
  } catch {
    message.error('登录失败，请检查账号密码或后端服务');
  } finally {
    loading.value = false;
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
  width: 400px;
  max-width: 92vw;
}
</style>
