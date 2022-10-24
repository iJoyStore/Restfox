<template>
  <WorkspacesFrame v-if="activeWorkspace === null" />
  <Frame v-if="activeWorkspace" />
  <ReloadPrompt />
  <alert-confirm-prompt />
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useStore } from 'vuex'
import WorkspacesFrame from '@/components/WorkspacesFrame.vue'
import Frame from '@/components/Frame.vue'
import ReloadPrompt from '@/components/ReloadPrompt.vue'
import { getCollectionForWorkspace } from './db'
import constants from './constants'
import { checkHotkeyAgainstKeyEvent, findItemInTreeById } from './helpers'
import './web-components/alert-confirm-prompt'

const currentlySelectedContextMenuItemIndex = ref(-1)
const store = useStore()

const activeTab = computed(() => {
  return store.state.activeTab
})
const activeWorkspace = computed(() => {
  return store.state.activeWorkspace
})
const tabs = computed(() => {
  return store.state.tabs
})
const openContextMenuElement = computed(() => {
  return store.state.openContextMenuElement
})


watch(
  () => activeTab.url,
  () => {
    // sync query params in url with query params in collection if they are the same
    if (activeTab && 'url' in activeTab && activeTab.url && 'parameters' in activeTab) {
      let urlParamsSplit = activeTab.url.split('?')
      if (urlParamsSplit.length > 1) {
        const urlSearchParams = new URLSearchParams(urlParamsSplit[1])
        for (const urlParam of urlSearchParams.entries()) {
          activeTab.parameters.filter(item => !item.disabled && item.name === urlParam[0]).forEach(matchingParam => {
            matchingParam.value = urlParam[1]
          })
        }
      }
    }
  }
)

watch(
  () => activeTab.parameters,
  () => {
    // sync query params in url with query params in collection if they are the same
    if (activeTab && 'url' in activeTab && activeTab.url) {
      let urlParamsSplit = activeTab.url.split('?')
      if (urlParamsSplit.length > 1) {
        const urlSearchParams = new URLSearchParams(urlParamsSplit[1])
        activeTab.parameters.filter(item => !item.disabled).forEach(param => {
          if (urlSearchParams.has(param.name)) {
            urlSearchParams.set(param.name, param.value)
          }
        })
        urlParamsSplit[1] = urlSearchParams.toString()
        activeTab.url = urlParamsSplit.join('?')
      }
    }
  },
  { deep: true }
)
watch(
  activeTab,
  (newValue, oldValue) => {
    // don't commit change when activeTab is set for the first time
    // and when activeTab is changed from one tab to another,
    // having same id in oldValue & newValue means same object
    // has changed, so we need to save the object
    if (oldValue && newValue && oldValue._id === newValue._id) {
      store.commit('persistActiveTab')

      // keep sidebarItem properties in sync with activeTab
      const sidebarItem = findItemInTreeById(store.state.collectionTree, activeTab._id)
      if (sidebarItem) {
        Object.assign(sidebarItem, activeTab)
      }

      // keep tab properties in tabs in sync with activeTab
      const tab = store.state.tabs.find(tab => tab._id === activeTab._id)
      if (tab) {
        Object.assign(tab, activeTab)
      }
    }
  },
  { deep: true }
)
watch(
  activeWorkspace,
  async () => {
    if (activeWorkspace) {
      localStorage.setItem(constants.LOCAL_STORAGE_KEY.ACTIVE_WORKSPACE_ID, activeWorkspace._id)
    } else {
      localStorage.removeItem(constants.LOCAL_STORAGE_KEY.ACTIVE_WORKSPACE_ID)
    }
    await fetchSetCollectionForWorkspace()
  }
)
watch(
  openContextMenuElement,
  () => {
    if (openContextMenuElement === null) {
      currentlySelectedContextMenuItemIndex.value = -1
    }
  }
)

async function fetchSetCollectionForWorkspace() {
  if (!activeWorkspace.value) {
    store.commit('setCollection', [])
    return
  }
  const collections = await getCollectionForWorkspace(activeWorkspace.value._id)
  if (collections.length > 0) {
    store.commit('setCollection', collections)
  }
  store.commit('loadWorkspaceTabs')
}

function handleGlobalKeydown(event) {
  if (openContextMenuElement.value) {
    const enabledContextMenuItems = Array.from(openContextMenuElement.value.querySelectorAll('.context-menu > div > button:not(:disabled)'))
    if (event.key === 'ArrowUp') {
      currentlySelectedContextMenuItemIndex.value = currentlySelectedContextMenuItemIndex.value > 0 ? currentlySelectedContextMenuItemIndex.value - 1 : enabledContextMenuItems.length - 1
      enabledContextMenuItems[currentlySelectedContextMenuItemIndex.value].focus()
      return
    }

    if (event.key === 'ArrowDown') {
      currentlySelectedContextMenuItemIndex.value = currentlySelectedContextMenuItemIndex.value < enabledContextMenuItems.length - 1 ? currentlySelectedContextMenuItemIndex.value + 1 : 0
      enabledContextMenuItems[currentlySelectedContextMenuItemIndex.value].focus()
      return
    }

    if (event.key === 'Home') {
      currentlySelectedContextMenuItemIndex.value = 0
      enabledContextMenuItems[currentlySelectedContextMenuItemIndex.value].focus()
      return
    }

    if (event.key === 'End') {
      currentlySelectedContextMenuItemIndex.value = enabledContextMenuItems.length - 1
      enabledContextMenuItems[currentlySelectedContextMenuItemIndex.value].focus()
      return
    }

    if (event.key === 'Escape') {
      openContextMenuElement.querySelector('.context-menu-background').click()
      return
    }
  }

  const hotkeys = constants.HOTKEYS

  // all keyboard shortcuts below depend on the active tab, so we return if there's no active tab
  if (!activeTab) {
    return
  }

  if (checkHotkeyAgainstKeyEvent(hotkeys.SEND_REQUEST, event)) {
    event.preventDefault()
    event.stopPropagation()

    store.dispatch('sendRequest', activeTab)

    return
  }

  if (checkHotkeyAgainstKeyEvent(hotkeys.CLOSE_TAB, event) || checkHotkeyAgainstKeyEvent(hotkeys.CLOSE_TAB_ALTERNATE, event)) {
    event.preventDefault()
    event.stopPropagation()

    store.commit('closeTab', activeTab._id)
    store.commit('persistActiveWorkspaceTabs')

    return
  }

  if (checkHotkeyAgainstKeyEvent(hotkeys.SWITCH_TO_NEXT_TAB, event) || checkHotkeyAgainstKeyEvent(hotkeys.SWITCH_TO_NEXT_TAB_ALTERNATE, event)) {
    event.preventDefault()
    event.stopPropagation()

    const tabIndex = tabs.findIndex(tab => tab._id === activeTab._id)

    const nextTabIndex = tabIndex + 1

    const nextTab = nextTabIndex <= tabs.length - 1 ? tabs[nextTabIndex] : tabs[0]

    if (nextTab) {
      store.commit('setActiveTab', nextTab)
    }

    return
  }

  if (checkHotkeyAgainstKeyEvent(hotkeys.SWITCH_TO_PREVIOUS_TAB, event) || checkHotkeyAgainstKeyEvent(hotkeys.SWITCH_TO_PREVIOUS_TAB_ALTERNATE, event)) {
    event.preventDefault()
    event.stopPropagation()

    const tabIndex = tabs.findIndex(tab => tab._id === activeTab._id)

    const previousTabIndex = tabIndex - 1

    const previousTab = previousTabIndex >= 0 ? tabs[previousTabIndex] : tabs[tabs.length - 1]

    if (previousTab) {
      store.commit('setActiveTab', previousTab)
    }

    return
  }
}

async function init() {
  store.dispatch('loadPlugins')
  await store.dispatch('loadWorkspaces')

  if (import.meta.env.MODE === 'desktop') {
    store.state.flags.isBrowser = false
  }
}

onMounted(async () => {
  await init()

  const messageHandler = message => {
    if (message.data.event === '__EXTENSION_HOOK__') {
      // this keeps getting called whenever tab is changed, so we do this
      if (window.__EXTENSION_HOOK__ === message.data.eventData) {
        return
      }
      window.__EXTENSION_HOOK__ = message.data.eventData
      store.state.flags.hideBrowserRelatedResponsePanelErrors = true
      store.state.flags.browserExtensionEnabled = true
      console.log(message.data.eventData)
    }

    if (message.data.event === '__EXTENSION_UN_HOOK__') {
      delete window.__EXTENSION_HOOK__
      store.state.flags.hideBrowserRelatedResponsePanelErrors = false
      store.state.flags.browserExtensionEnabled = false
      console.log(message.data.eventData)
    }
  }

  window.addEventListener('message', messageHandler)
  window.addEventListener('keydown', handleGlobalKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
}) 
</script>

<style lang="scss">
@import '@/styles/normalize.css';
@import '@/styles/reset.css';
@import '@/styles/main.css';
</style>
