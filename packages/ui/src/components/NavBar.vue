<template>
  <div class="navbar">
    <div class="heading">
      <div v-if="activeWorkspace === null">Workspaces</div>
      <template v-else>
        <a href="#" @click.prevent="setActiveWorkspace(null)">Workspaces</a> > <span>{{ activeWorkspace.name }}</span>
      </template>
    </div>
    <div class="right-nav-container">
      <div v-if="nav === 'collection'" style="height: 100%;">
        <template v-if="activeTab">
          <a href="#" @click.prevent="requestResponseLayout = 'top-bottom'"
            v-if="requestResponseLayout === 'left-right'" class="bl">View: Column</a>
          <a href="#" @click.prevent="requestResponseLayout = 'left-right'" v-else class="bl">View: Row</a>
        </template>
        <div style="display: inline-flex; align-items: center; height: 100%; margin-right: 0.5rem;">
          <a href="#" @click.prevent="environmentModalShow = true" style="margin-right: 0.2rem; padding-right: 0.2rem;"
            class="bl">Environment</a>
          <select v-model="currentEnvironment"
            style="border: 1px solid var(--default-border-color); outline: 0; background-color: inherit;"
            title="Change Environment">
            <option v-for="environment in environments">{{ environment.name }}</option>
          </select>
        </div>
        <a href="#" @click.prevent="showImportModal" class="bl">Import</a>
        <a href="#" @click.prevent="exportCollection" class="bl">Export</a>
        <a href="#" @click.prevent="clearCollection" class="bl">Clear Collection</a>
      </div>
      <template v-if="nav === 'workspaces'">
        <a href="#" @click.prevent="showAddWorkspace" class="bl">Add Workspace</a>
      </template>
      <a href="#" @click.prevent="showPluginsManager" class="bl">Plugins</a>
      <a href="#" @click.prevent="showSettings" class="bl br">Settings</a>
      <span class="spacer"></span>
      <div style="width: 80px; height: 10px; margin-top: -0.56rem">
        <GithubButton title="Star Restfox" href="https://github.com/flawiddsouza/Restfox" data-show-count="true"
          data-text="Star" aria-label="Star Restfox on GitHub" />
      </div>
    </div>
  </div>
  <PluginManagerModal v-model:showModal="showPluginManagerModal" />
  <AddWorkspaceModal v-model:showModal="showAddWorkspaceModal" />
  <SettingsModal v-model:showModal="showSettingsModal" />
  <EnvironmentModal v-model:showModal="environmentModalShow" :workspace="activeWorkspace" />
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import PluginManagerModal from './modals/PluginManagerModal.vue'
import AddWorkspaceModal from './modals/AddWorkspaceModal.vue'
import SettingsModal from './modals/SettingsModal.vue'
import EnvironmentModal from './modals/EnvironmentModal.vue'
import GithubButton from 'vue-github-button'
import { exportRestfoxCollection } from '@/helpers'
import { getCollectionForWorkspace } from '@/db'
import constants from '../constants'

const store = useStore()
const showSettingsModal = ref(false)
const showPluginManagerModal = ref(false)
const showAddWorkspaceModal = ref(false)
const environmentModalShow = ref(false)
const props = defineProps({
  nav: String,
  required: false
})

const activeWorkspace = computed(() => {
  return store.state.activeWorkspace
})
const environments = computed(() => {
  return activeWorkspace.value.environments ?? [
    {
      name: 'Default',
      environment: activeWorkspace.value.environment
    }
  ]
})
const currentEnvironment = computed({
  get() {
    return activeWorkspace.value.currentEnvironment ?? 'Default'
  },
  set(value) {
    activeWorkspace.value.currentEnvironment = value
    store.commit('updateWorkspaceCurrentEnvironment', {
      workspaceId: activeWorkspace.value._id,
      currentEnvironment: value
    })
    const selectedEnvironment = environments.value.find(environmentItem => environmentItem.name === value)
    activeWorkspace.value.environment = selectedEnvironment.environment
    store.commit('updateWorkspaceEnvironment', {
      workspaceId: activeWorkspace.value._id,
      environment: selectedEnvironment.environment
    })
  }
})
const requestResponseLayout = computed({
  get() {
    return store.state.requestResponseLayout
  },
  set(value) {
    store.state.requestResponseLayout = value
    localStorage.setItem(constants.LOCAL_STORAGE_KEY.REQUEST_RESPONSE_LAYOUT, value)
  }
})
const activeTab = computed(() => {
  return store.state.activeTab
})

async function exportCollection() {
  const collection = await getCollectionForWorkspace(activeWorkspace.value._id)
  exportRestfoxCollection(collection)
}
function clearCollection() {
  if (confirm('Are you sure?')) {
    store.commit('clearCollection')
  }
}
function setActiveWorkspace(workspace) {
  store.commit('setActiveWorkspace', workspace)
}
function showSettings() {
  showSettingsModal.value = true
}
function showPluginsManager() {
  showPluginManagerModal.value = true
}
function showAddWorkspace() {
  showAddWorkspaceModal.value = true
}
function showImportModal() {
  store.commit('showImportModalSelectedRequestGroupId', null)
  store.commit('showImportModal', true)
}
</script>

<style scoped>
.navbar {
  padding-left: 1em;
  padding-right: 1em;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 31.5px;
}

.spacer {
  margin-left: 1rem;
}

.spacer-and-half {
  margin-left: 1.5rem;
}

.heading {
  font-weight: 500;
}

.right-nav-container {
  display: flex;
  align-items: center;
  height: 100%;
}

.heading a:not(:hover),
.right-nav-container a {
  text-decoration: none;
}

.heading a {
  color: rgb(0, 0, 238);
}

.right-nav-container a {
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  color: black;
}

.right-nav-container a:hover {
  background-color: #f1f1f147;
}

.right-nav-container a.bl {
  border-left: 1px solid #f1f1f1;
}

.right-nav-container a.br {
  border-right: 1px solid #f1f1f1;
}
</style>
