import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import App from './App.vue';
import { router } from './router';
import { pinia } from './stores';
import 'ant-design-vue/dist/reset.css';
import './style.css';

createApp(App).use(pinia).use(router).use(Antd).mount('#app');
