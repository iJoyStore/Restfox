<template>
  <form @submit.prevent="importFile" v-if="showImportModal">
    <modal title="Import" v-model="showImportModal">
      <label>
        <div style="font-weight: 500; margin-bottom: 0.25rem">Import From</div>
        <select
          style="width: 100%; border: 1px solid var(--default-border-color); outline: 0; padding: 0.3rem; background: inherit;"
          v-model="importFrom">
          <option>Restfox</option>
          <option>Postman</option>
          <option>Postman URL</option>
          <option>Insomnia</option>
        </select>
      </label>

      <div style="margin-top: 1rem">
        <template v-if="importFrom !== 'Postman URL'">
          <input type="file" @change="fileToImport = $event.target.files[0]" accept=".json, .zip" required>
        </template>
        <template v-else>
          <input type="url" v-model="urlToImport" required placeholder="https://postman.com/collections/{collectionId}"
            style="width: 100%; border: 1px solid var(--default-border-color); outline: 0px; padding: 0.3rem; background: inherit;">
        </template>
      </div>

      <div style="margin-top: 1.5rem">
        <label>
          <div style="font-weight: 500; margin-bottom: 0.25rem">Import Into</div>
          <select
            style="width: 100%; border: 1px solid var(--default-border-color); outline: 0; padding: 0.3rem; background: inherit;"
            v-model="selectedRequestGroupId">
            <option :value="null">Root of the workspace</option>
            <option v-for="activeWorkspaceFolder in activeWorkspaceFolders" :value="activeWorkspaceFolder._id">{{
                activeWorkspaceFolder.name
            }}</option>
          </select>
        </label>
      </div>

      <template #footer>
        <button>Import</button>
      </template>
    </modal>
  </form>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useStore } from 'vuex'
import Modal from '@/components/Modal.vue'
import {
  fileToJSON,
  convertInsomniaExportToRestfoxCollection,
  convertPostmanExportToRestfoxCollection,
  convertRestfoxExportToRestfoxCollection,
  generateNewIdsForTree
} from '@/helpers'

import { getCollectionForWorkspace } from '@/db'
import { emitter } from '@/event-bus'
import { flattenTree, sortTree, toTree } from '../helpers'

const store = useStore()
const activeWorkspaceFolders = ref([])
const fileToImport = ref(null)
const urlToImport = ref('')
const importFrom = ref('Restfox')

const showImportModal = computed({
  get() {
    return store.state.showImportModal
  },
  set(value) {
    store.commit('showImportModal', value)
  }
})
const selectedRequestGroupId = computed({
  get() {
    return store.state.showImportModalSelectedRequestGroupId
  },
  set(value) {
    store.commit('showImportModalSelectedRequestGroupId', value)
  }
})
const activeWorkspace = computed(() => {
  return store.state.activeWorkspace
})
const collectionTree = computed(() => {
  return store.state.collectionTree
})

watch(
  activeWorkspace,
  () => {
    () => {
      if (activeWorkspace.value) {
        handleActiveWorkspace()
      }
    }
  }
)

async function handleActiveWorkspace() {
  let workspaceFolders = await getCollectionForWorkspace(activeWorkspace.value._id, 'request_group')
  workspaceFolders = toTree(workspaceFolders)
  sortTree(workspaceFolders)
  prependParentTitleToChildTitle(workspaceFolders)
  workspaceFolders = flattenTree(workspaceFolders)
  activeWorkspaceFolders.value = workspaceFolders
  selectedRequestGroupId.value = null
}
async function importFile() {
  try {
    let json = null

    if (fileToImport.value && fileToImport.value.name.endsWith('.json')) {
      json = await fileToJSON(fileToImport.value)
    } else {
      json = fileToImport.value
    }

    let collectionTree = []

    if (importFrom.value === 'Postman') {
      collectionTree = await convertPostmanExportToRestfoxCollection(json, fileToImport.value.name.endsWith('.zip'), activeWorkspace.value._id)
    }

    if (importFrom.value === 'Postman URL') {
      const response = await fetch(urlToImport.value)
      json = await response.json()

      collectionTree = await convertPostmanExportToRestfoxCollection(json, false, activeWorkspace.value._id)
    }

    if (importFrom.value === 'Insomnia') {
      collectionTree = convertInsomniaExportToRestfoxCollection(json, activeWorkspace.value._id)
    }

    if (importFrom.value === 'Restfox') {
      collectionTree = convertRestfoxExportToRestfoxCollection(json, activeWorkspace.value._id)
    }

    if (selectedRequestGroupId.value) {
      collectionTree.forEach(collection => {
        collection.parentId = selectedRequestGroupId.value
      })
    }

    generateNewIdsForTree(collectionTree)

    store.dispatch('setCollectionTree', { collectionTree, parentId: selectedRequestGroupId.value })

    fileToImport.value = null
    showImportModal.value = false

    alert('File imported successfully')
  } catch (e) {
    console.log(e)
    alert('Invalid import file given')
  }
}
function prependParentTitleToChildTitle(array, prepend = '') {
  array.forEach(item => {
    item.name = `${prepend ? prepend + ' ' : ''}${item.name}`
    if ('children' in item) {
      prependParentTitleToChildTitle(item.children, item.name + ' → ')
    }
  })
}

onMounted(() => {
  handleActiveWorkspace()
  emitter.on('request_group', handleActiveWorkspace)
})
onBeforeUnmount(() => {
  emitter.off('request_group', handleActiveWorkspace)
})

</script>
