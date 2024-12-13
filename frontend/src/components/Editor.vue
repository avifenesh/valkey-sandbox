<template>
  <div ref="editorContainer" class="editor-container">
    <vue-monaco-editor v-model:value="code" :language="language" theme="vs-dark" :options="MONACO_EDITOR_OPTIONS"
      @mount="handleMount" @change="onChange" />
  </div>
</template>

<script>
import { defineComponent, watch, shallowRef, onBeforeUnmount } from 'vue';
import { VueMonacoEditor } from '@guolao/vue-monaco-editor';

export default defineComponent({
  components: {
    VueMonacoEditor,
  },
  name: 'CodeEditor',
  props: {
    language: {
      type: String,
      default: 'javascript',
    },
    content: {
      type: String,
      default: '',
    },
  },
  emits: ['update:content'],
  setup(props, { emit }) {
    const MONACO_EDITOR_OPTIONS = {
      automaticLayout: true,
      formatOnType: true,
      formatOnPaste: true,
      fixedOverflowWidgets: true,
      glyphMargin: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
      },
      fontSize: 14,
    };
    const editorRef = shallowRef();
    const code = shallowRef(props.content);

    const handlePaste = () => {
      editorRef.value?.getAction('editor.action.formatDocument').run();
    };

    const handleBlur = () => {
      editorRef.value?.getAction('editor.action.formatDocument').run();
    };

    const handleMount = editor => {
      editorRef.value = editor;
      code.value = props.content;
      const editorContainer = editor.getDomNode();
      if (editorContainer) {
        editorContainer.style.paddingTop = '10px';
      }
    };

    const onChange = (value) => {
      emit('update:content', value);
    };

    watch(() => props.content, (newContent) => {
      if (code.value !== newContent) {
        code.value = newContent;
      }
    });

    watch(() => props.language, (newLang) => {
      editorRef.value?.updateOptions({ language: newLang });
    });

    onBeforeUnmount(() => {
      editorRef.value?.dispose();
    });

    return {
      MONACO_EDITOR_OPTIONS,
      handlePaste,
      handleBlur,
      handleMount,
      editorRef,
      code,
      onChange,
    };
  },
});
</script>

<style>
@import '../assets/styles/shared.css';
</style>
