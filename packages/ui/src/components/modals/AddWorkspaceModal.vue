<template>
  <form @submit.prevent="createWorkspace" v-if="showModalComp">
    <modal :title="!workspace ? 'New Workspace' : 'Rename Workspace'" v-model="showModalComp">
      <label>
        <div style="font-weight: 500; margin-bottom: 0.25rem">Name</div>
        <input type="text"
          style="width: 100%; border: 1px solid var(--default-border-color); outline: 0; padding: 0.3rem; background: inherit;"
          v-model="workspaceName" :placeholder="!workspace ? 'New Workspace' : 'Workspace Name'" required
          spellcheck="false" v-focus>
      </label>

      <template #footer>
        <button v-if="!workspace">Create</button>
        <button v-else>Rename</button>
      </template>
    </modal>
  </form>
</template>

<script setup>
import { ref,watch,computed } from 'vue'
import {useStore} from 'vuex'
import Modal from '@/components/Modal.vue'

const store = useStore()
const workspaceName = ref('New Workspace')
const props = defineProps({
  showModal: Boolean,
  workspace: {
    type: Object,
    required: false
  }
})
const emit = defineEmits(['update:showModal'])
const vFocus = {
  mounted: (element, binding) => {
    element.focus()
    if (!binding.instance.workspace) {
      element.select()
    }
  }
}

const showModalComp = computed({
  get() {
    return props.showModal
  },
  set(value) {
    emit('update:showModal', value)
  }
})

watch(
  () => props.workspace,
  () => {
    if (props.workspace) {
      workspaceName.value = props.workspace.name
    }
  }
)

watch(
  () => props.showModal,
  () => {
    if (props.showModal && props.workspace === undefined) {
      workspaceName.value = 'New Workspace'
    }
  }
)

async function createWorkspace() {
  if (!props.workspace) {
    store.dispatch('createWorkspace', {
      name: workspaceName.value
    })
  } else {
    store.dispatch('updateWorkspace', {
      _id: props.workspace._id,
      name: workspaceName.value
    })
  }
  showModalComp.value = false
}
</script>
