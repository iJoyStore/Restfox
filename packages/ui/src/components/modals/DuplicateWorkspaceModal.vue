<template>
  <form @submit.prevent="duplicateWorkspace" v-if="showModalComp">
    <modal title="Duplicate Workspace" v-model="showModalComp">
      <label>
        <div style="font-weight: 500; margin-bottom: 0.25rem">Name</div>
        <input type="text"
          style="width: 100%; border: 1px solid var(--default-border-color); outline: 0; padding: 0.3rem; background: inherit;"
          v-model="newName" placeholder="Workspace Name" required spellcheck="false" v-focus>
      </label>

      <template #footer>
        <button>Create</button>
      </template>
    </modal>
  </form>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Modal from '@/components/Modal.vue'

const newName = ref('')
const emit = defineEmits(['update:showModal'])
const vFocus = {
  mounted(element, binding) {
    element.focus()
    element.select()
  }
}

const props = defineProps({
  showModal: Boolean,
  workspaceToDuplicate: Object
})

const showModalComp = computed({
  get() {
    return props.showModal
  },
  set(value) {
    emit('update:showModal', value)
  }
})

watch(
  () => props.workspaceToDuplicate,
  () => {
    if (props.workspaceToDuplicate) {
      newName.value = props.workspaceToDuplicate.name
    }
  }
)

async function duplicateWorkspace() {
  store.dispatch('duplicateWorkspace', {
    sourceWorkspaceId: props.workspaceToDuplicate._id,
    name: newName.value
  })
  showModalComp.value = false
}
</script>
