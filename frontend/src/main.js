import { createApp } from 'vue';
import App from './App.vue';
import { install as VueMonacoEditorPlugin } from "@guolao/vue-monaco-editor";

const app = createApp(App);

app.use(VueMonacoEditorPlugin, {
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs",
  },
});

app.mount("#app");
