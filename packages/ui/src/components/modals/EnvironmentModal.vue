<template>
  <form @submit.prevent="done" v-if="showModalComp">
    <modal :title="`Environment (JSON Format) — ${collectionItem ? collectionItem.name : workspace.name}`"
      v-model="showModalComp" height="70vh" width="55rem">
      <div style="display: grid; grid-template-columns: auto 1fr; height: 100%; overflow: auto;">
        <div
          style="display: grid; grid-template-rows: auto 1fr; height: 100%; overflow: auto; margin-right: 1rem; border-right: 1px solid var(--default-border-color)">
          <button type="button" style="margin-bottom: 0.5rem; margin-right: 0.5rem;" @click="addEnvironment">
            Add Environment
          </button>
          <div style="overflow-y: auto;" class="environment-sidebar">
            <div v-for="environment in environments" class="environment-sidebar-item"
              :class="{ 'environment-sidebar-item-active': environment.name === currentEnvironment }"
              @click="changeEnvironment(environment)" :ref="(el) => { currentEnv = el }">
              <div>{{ environment.name }}</div>
              <div class="environment-sidebar-item-menu"
                :class="{ 'environment-sidebar-item-menu-disable-hide': environment.name === clickedContextMenuEnvironment.name && showEnvironmentContextMenuPopup === true }"
                @click.stop="showEnvironmentContextMenu($event, environment)">
                <svg viewBox="0 0 24 24" focusable="false"
                  style="pointer-events: none; display: block; width: 100%; height: 100%;">
                  <g>
                    <path
                      d="M12,16.5c0.83,0,1.5,0.67,1.5,1.5s-0.67,1.5-1.5,1.5s-1.5-0.67-1.5-1.5S11.17,16.5,12,16.5z M10.5,12 c0,0.83,0.67,1.5,1.5,1.5s1.5-0.67,1.5-1.5s-0.67-1.5-1.5-1.5S10.5,11.17,10.5,12z M10.5,6c0,0.83,0.67,1.5,1.5,1.5 s1.5-0.67,1.5-1.5S12.83,4.5,12,4.5S10.5,5.17,10.5,6z">
                    </path>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div style="display: grid; grid-template-rows: 1fr auto; overflow: auto;">
          <CodeMirrorEditor v-model="environment" lang="json" style="overflow: auto;" :key="currentEnvironment">
          </CodeMirrorEditor>
          <div style="margin-top: 1rem">
            <div v-if="parseError" class="box">{{ parseError }}</div>
            <div class="box box-hidden" v-else>
              Spacer Text
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 0.75rem; text-align: left; line-height: 1rem; margin-right: 0.5rem;" v-pre><span
              class="code">"key": "value"</span> pairs defined in the above JSON object can be referenced in any text
            input in the request panel using <span class="code">{{ key }}</span> for variable substitution</div>
          <div>
            <button>Done</button>
          </div>
        </div>
      </template>
    </modal>
    <template v-if="showEnvironmentContextMenuPopup">
      <div class="context-menu-background-overlay" @click="hideEnvironmentContextMenu()"></div>
      <div class="context-menu"
        :style="{ top: showEnvironmentContextMenuPopupCoords.y, left: showEnvironmentContextMenuPopupCoords.x }">
        <div @click="renameEnvironment">Rename</div>
        <div @click="deleteEnvironment">Delete</div>
      </div>
    </template>
  </form>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useStore } from 'vuex'
import Modal from '@/components/Modal.vue'
import CodeMirrorEditor from '@/components/CodeMirrorEditor.vue'

const emit = defineEmits(['update:showModal'])
const store = useStore()
const environment = ref('{}')
const environmentToSave = ref({})
const parseError = ref('')
const showEnvironmentContextMenuPopup = ref(false)
const clickedContextMenuEnvironment = reactive({ name: '' })
const showEnvironmentContextMenuPopupCoords = reactive({
  x: '',
  y: ''
})
const currentEnv = ref(null)
const props = defineProps({
  showModal: Boolean,
  collectionItem: Object,
  workspace: Object
})

const showModalComp = computed({
  get() {
    return props.showModal
  },
  set(value) {
    emit('update:showModal', value)
  }
})

const environments = computed(() => {
  if (props.collectionItem) {
    return props.collectionItem.environments ?? [
      {
        name: 'Default',
        environment: environmentToSave
      }
    ]
  }

  if (props.workspace) {
    return props.workspace.environments ?? [
      {
        name: 'Default',
        environment: environmentToSave
      }
    ]
  }
})

const currentEnvironment = computed(() => {
  if (props.collectionItem) {
    return props.collectionItem.currentEnvironment ?? 'Default'
  }

  if (props.workspace) {
    return props.workspace.currentEnvironment ?? 'Default'
  }
})

watch(
  () => props.collectionItem,
  () => {
    environment.value = props.collectionItem.environment ? JSON.stringify(props.collectionItem.environment, null, 4) : '{}'
  }
)
watch(
  () => props.workspace,
  () => {
    environment.value = props.workspace.environment ? JSON.stringify(props.workspace.environment, null, 4) : '{}'
  })
watch(
  environment,
  () => {
    let env = {}
    try {
      env = JSON.parse(env.value)
      parseError.value = ''
      environmentToSave.value = env
      saveEnvironment()
    } catch (e) {
      parseError.value = e.message
    }
  }
)
watch(
  () => props.showModal,
  () => {
    if (props.showModal) {
      parseError.value = ''
      if (props.collectionItem) {
        environment.value = props.collectionItem.environment ? JSON.stringify(props.collectionItem.environment, null, 4) : '{}'
      }
      if (props.workspace) {
        environment.value = props.workspace.environment ? JSON.stringify(props.workspace.environment, null, 4) : '{}'
      }
      nextTick(() => {
        currentEnv.value.scrollIntoView({
          behavior: 'auto',
          block: 'center',
          inline: 'center'
        })
      })
    }
  })

async function done() {
  showModalComp.value = false
}
async function addEnvironment() {
  const newEnvironmentName = await window.createPrompt('Enter new environment name')

  if (!newEnvironmentName || newEnvironmentName.trim() === '') {
    return
  }

  if (environments.value.some(environment => environment.name === newEnvironmentName)) {
    alert('Given environment name already exists')
    return
  }

  const environment = { name: newEnvironmentName, environment: {} }

  if (props.collectionItem) {
    if ('environments' in props.collectionItem === false) {
      props.collectionItem.environments = [
        {
          name: 'Default',
          environment: environmentToSave.value
        }
      ]
    }
    props.collectionItem.environments.push(environment)
  }

  if (props.workspace) {
    if ('environments' in props.workspace === false) {
      props.workspace.environments = [
        {
          name: 'Default',
          environment: environmentToSave.value
        }
      ]
    }
    props.workspace.environments.push(environment)
  }

  changeEnvironment(environment)

  nextTick(() => {
    currentEnv.value.scrollIntoView({
      behavior: 'auto',
      block: 'center',
      inline: 'center'
    })
  })
}
function changeEnvironment(environment) {
  if (props.collectionItem) {
    props.collectionItem.currentEnvironment = environment.name
  }

  if (props.workspace) {
    props.workspace.currentEnvironment = environment.name
  }

  saveCurrentEnvironment()

  const environmentString = JSON.stringify(environment.environment, null, 4)

  let manuallyTriggerSave = false

  // environment watch doesn't trigger when value is same as before,
  // so we need to do this trick, to save the new environment
  if (environmentString === environment.value) {
    manuallyTriggerSave = true
  }

  environment.value = environmentString

  if (manuallyTriggerSave) {
    saveEnvironment()
  }
}
function saveEnvironment() {
  if (props.collectionItem) {
    props.collectionItem.environment = environmentToSave.value
    store.commit('updateCollectionItemEnvironment', { collectionId: props.collectionItem._id, environment: environmentToSave.value })
  }

  if (props.workspace) {
    props.workspace.environment = environmentToSave.value
    store.commit('updateWorkspaceEnvironment', { workspaceId: props.workspace._id, environment: environmentToSave.value })
  }

  const currentEnvironment = environments.value.find(environmentItem => environmentItem.name === currentEnvironment.value)
  currentEnvironment.environment = environmentToSave.value

  saveEnvironments()
}
function saveEnvironments() {
  if (props.collectionItem) {
    store.commit('updateCollectionItemEnvironments', { collectionId: props.collectionItem._id, environments: environments.value })
  }

  if (props.workspace) {
    store.commit('updateWorkspaceEnvironments', { workspaceId: props.workspace._id, environments: environments.value })
  }
}
function saveCurrentEnvironment() {
  if (props.collectionItem) {
    store.commit('updateCollectionItemCurrentEnvironment', { collectionId: props.collectionItem._id, currentEnvironment: currentEnvironment.value })
  }

  if (props.workspace) {
    store.commit('updateWorkspaceCurrentEnvironment', { workspaceId: props.workspace._id, currentEnvironment: currentEnvironment.value })
  }
}
function showEnvironmentContextMenu(event, environment) {
  if (clickedContextMenuEnvironment.name === environment.name && showEnvironmentContextMenuPopup.value === true) {
    hideEnvironmentContextMenu()
    return
  }
  const menuElement = event.target
  var clientRect = menuElement.getBoundingClientRect()
  var clientX = clientRect.left
  var clientY = clientRect.top
  clickedContextMenuEnvironment.value = environment
  showEnvironmentContextMenuPopupCoords.x = clientX + 'px'
  showEnvironmentContextMenuPopupCoords.y = (clientY + clientRect.height + 5) + 'px'
  showEnvironmentContextMenuPopup.value = true
}
function hideEnvironmentContextMenu(clearClickedContextMenuEnvironment = true) {
  if (showEnvironmentContextMenuPopup.value === false) {
    return
  }
  showEnvironmentContextMenuPopup.value = false
  if (clearClickedContextMenuEnvironment) {
    clickedContextMenuEnvironment.name = ''
  }
}
async function renameEnvironment() {
  const newEnvironmentName = await window.createPrompt('Enter new environment name', clickedContextMenuEnvironment.name)

  if (!newEnvironmentName || newEnvironmentName.trim() === '') {
    hideEnvironmentContextMenu()
    return
  }

  if (clickedContextMenuEnvironment.name !== newEnvironmentName && environments.value.some(environment => environment.name === newEnvironmentName)) {
    alert('Given environment name already exists')
    hideEnvironmentContextMenu()
    return
  }

  // we need this to re set current environment if the changed
  // environment name is the current environment
  let changeCurrentEnvironment = false

  if (clickedContextMenuEnvironment.name === currentEnvironment.value) {
    changeCurrentEnvironment = true
  }

  clickedContextMenuEnvironment.name = newEnvironmentName

  if (props.workspace && 'environments' in props.workspace === false) {
    props.workspace.environments = environments.value
  }

  if (props.collectionItem && 'environments' in props.collectionItem === false) {
    props.collectionItem.environments = environments.value
  }

  saveEnvironments()

  if (changeCurrentEnvironment) {
    changeEnvironment(clickedContextMenuEnvironment)
  }

  hideEnvironmentContextMenu()
}
function deleteEnvironment() {
  if (environments.value.length === 1) {
    alert('Cannot delete environment as there\'s only one environment left')
    hideEnvironmentContextMenu()
    return
  }

  if (!confirm('Are you sure you want to delete this environment?')) {
    hideEnvironmentContextMenu()
    return
  }

  if (props.collectionItem) {
    props.collectionItem.environments = environments.value.filter(environment => environment.name !== clickedContextMenuEnvironment.name)
  }

  if (props.workspace) {
    props.workspace.environments = environments.value.filter(environment => environment.name !== clickedContextMenuEnvironment.name)
  }

  saveEnvironments()

  if (clickedContextMenuEnvironment.name === currentEnvironment.value) {
    changeEnvironment(environments.value[0])
  }

  hideEnvironmentContextMenu()
}

</script>

<style scoped>
.box {
  padding: 0.6rem;
  border: 1px dotted #d04444;
  border-radius: 0.3rem;
}

.box-hidden {
  border: 1px dotted transparent;
  visibility: hidden;
}

.environment-sidebar-item {
  display: flex;
  padding-top: 0.3rem;
  padding-bottom: 0.3rem;
  padding-left: 0.3rem;
  padding-right: 0.3rem;
  cursor: pointer;
  justify-content: space-between;
  align-items: center;
}

.environment-sidebar-item-active {
  background-color: rgb(104 114 254 / 26%);
}

.environment-sidebar-item>.environment-sidebar-item-menu {
  visibility: hidden;
  border-radius: 10px;
  height: 1.4rem;
}

.environment-sidebar-item:hover>.environment-sidebar-item-menu,
.environment-sidebar-item>.environment-sidebar-item-menu.environment-sidebar-item-menu-disable-hide {
  visibility: visible;
}

.environment-sidebar-item.environment-sidebar-item-selected>.environment-sidebar-item-menu svg {
  fill: white;
}

.environment-sidebar-item>.environment-sidebar-item-menu:hover,
.environment-sidebar-item>.environment-sidebar-item-menu.environment-sidebar-item-menu-disable-hide {
  background-color: rgba(240, 248, 255, 0.233);
}

.environment-sidebar-item:not(.environment-sidebar-item-selected)>.environment-sidebar-item-menu:hover,
.environment-sidebar-item:not(.environment-sidebar-item-selected)>.environment-sidebar-item-menu.environment-sidebar-item-menu-disable-hide {
  background-color: rgb(108 194 197 / 20%);
}

.context-menu-background-overlay {
  position: fixed;
  z-index: 10;
  height: 100vh;
  width: 100vw;
  top: 0;
  left: 0;
}

.context-menu {
  position: fixed;
  z-index: 10;
  top: 0;
  left: 0;
  background-color: white;
  border-radius: 5px;
  box-shadow: 1px 1px 8px -4px black;
}

.context-menu>div {
  padding: 0.3rem 0.5rem;
  cursor: pointer;
}

.context-menu>div:hover {
  background-color: slateblue;
  color: white;
}
</style>
