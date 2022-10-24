<template>
  <div class="workspace-container">
    <div class="workspace" v-for="workspace in workspaces" @click="setActiveWorkspace(workspace)">
      <div class="workspace-settings-button-container">
        <div class="workspace-settings-button" @click.stop="handleContextMenu($event, workspace)">
          <svg width="1em" height="1em" viewBox="0 0 14 3" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd"
              d="M1.5 3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM7 3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12.5 3a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
              fill=""></path>
          </svg>
        </div>
      </div>
      <div class="workspace-name">{{ workspace.name }}</div>
      <div class="workspace-timestamp">{{ dateFormat(workspace.createdAt) }}</div>
    </div>
    <ContextMenu :options="options" v-model:show="showContextMenu" @click="handleContextMenuClick"
      :element="contextMenuElement" />
    <AddWorkspaceModal v-model:showModal="showAddWorkspaceModal" :workspace="contextMenuWorkspace" />
    <DuplicateWorkspaceModal v-model:showModal="showDuplicateWorkspaceModal"
      :workspace-to-duplicate="workspaceToDuplicate" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import ContextMenu from './ContextMenu.vue'
import AddWorkspaceModal from './modals/AddWorkspaceModal.vue'
import DuplicateWorkspaceModal from './modals/DuplicateWorkspaceModal.vue'
import dayjs from 'dayjs'

const store = useStore()
const showContextMenu = ref(false)
const contextMenuElement = ref(null)
const contextMenuWorkspace = ref(null)
const showAddWorkspaceModal = ref(false)
const showDuplicateWorkspaceModal = ref(false)
const workspaceToDuplicate = ref(null)

const workspaces = computed(() => {
  return store.state.workspaces
})
const options = computed(() => {
  return [
    {
      'type': 'option',
      'label': 'Duplicate',
      'value': 'Duplicate'
    },
    {
      'type': 'option',
      'label': 'Rename',
      'value': 'Rename'
    },
    {
      'type': 'separator'
    },
    {
      'type': 'option',
      'label': 'Delete',
      'value': 'Delete'
    }
  ]
})

function setActiveWorkspace(workspaceId) {
  store.commit('setActiveWorkspace', workspaceId)
}
function handleContextMenu(event, workspace) {
  contextMenuElement.value = event.target.closest('.workspace-settings-button')
  contextMenuWorkspace.value = workspace
  showContextMenu.value = true
}
function handleContextMenuClick(clickedContextMenuItem) {
  if (clickedContextMenuItem === 'Duplicate') {
    workspaceToDuplicate.value = JSON.parse(JSON.stringify(contextMenuWorkspace.value))
    showDuplicateWorkspaceModal.value = true
  }

  if (clickedContextMenuItem === 'Rename') {
    showAddWorkspaceModal.value = true
  }

  if (clickedContextMenuItem === 'Delete') {
    if (confirm('Are you sure?')) {
      store.dispatch('deleteWorkspace', contextMenuWorkspace.value._id)
    }
  }
}
function dateFormat(date) {
  return dayjs(date).format('DD-MMM-YY hh:mm A')
}

</script>

<style scoped>
.workspace-container {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 1rem;
  margin: 1rem;
}

.workspace {
  border: 1px solid var(--default-border-color);
  cursor: pointer;
  height: 196px;
  width: 204px;
  border-radius: 4px;
  user-select: none;
  word-break: break-all;
  display: grid;
  grid-template-rows: auto auto 1fr;
}

.workspace:hover {
  border: 1px solid var(--base-color-info);
}

.workspace svg {
  fill: black;
  color: black;
}

.workspace-settings-button-container {
  text-align: right;
}

.workspace-settings-button {
  display: inline-block;
  padding: 1rem;
}

.workspace-name,
.workspace-timestamp {
  padding-left: 1rem;
  padding-right: 1rem;
}

.workspace-timestamp {
  margin-bottom: 1rem;
  display: grid;
  place-items: self-end;
}

.workspace-settings-button:hover {
  background-color: #dbedff;
}
</style>
