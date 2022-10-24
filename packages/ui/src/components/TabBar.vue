<template>
  <div class="tabs-container">
    <div class="tab" :class="{ 'tab-active': activeTab && activeTab._id === tab._id }" v-for="tab in tabs"
      @click="setActiveTab(tab)" @mousedown.middle.prevent="closeTab(tab)" :data-id="tab._id" draggable="true"
      @contextmenu.prevent="handleTabContextMenu($event, tab)">
      <span :class="`request-method--${tab.method}`">{{ tab.method }}</span> <template
        v-if="tab._id in sidebarItemTemporaryName">{{ sidebarItemTemporaryName[tab._id] }}</template><template v-else>{{
        tab.name }}</template>
      <span style="margin-left: 0.5rem" @click.stop="closeTab(tab)" class="tab-close">x</span>
    </div>
  </div>
  <!-- <div class="tab-add" @click="addTab" style="visibility: hidden">+</div> -->
  <ContextMenu :options="tabContextMenuOptions" :element="tabContextMenuElement" v-model:show="showTabContextMenu"
    @click="handleTabContextMenuItemClick" />
</template>

<script setup>
import { ref, onMounted,onUnmounted } from 'vue'
import { useStore } from 'vuex'
import ContextMenu from './ContextMenu.vue'
import { arrayMove } from '@/helpers'
import { computed } from '@vue/reactivity';

const draggedTabElement = ref(null)
const indexOfDraggedTab = ref(null)
const tabContextMenuElement = ref(null)
const tabContextMenuTab = ref(null)
const showTabContextMenu = ref(false)

const store = useStore()

const tabs = computed(() => {
  return store.state.tabs
})
const activeTab = computed(() => {
  return store.state.activeTab
})
const sidebarItemTemporaryName = computed(() => {
  return store.state.sidebarItemTemporaryName
})
const tabContextMenuOptions = computed(() => {
  return [
    {
      'type': 'option',
      'label': 'Close',
      'value': 'Close'
    },
    {
      'type': 'option',
      'label': 'Close Others',
      'value': 'Close Others',
      'disabled': tabs.value.length === 1
    },
    {
      'type': 'option',
      'label': 'Close All',
      'value': 'Close All'
    }
  ]
})

function setActiveTab(tab) {
  store.commit('setActiveTab', tab)
}

function closeTab(tab, persist = true) {
  store.commit('closeTab', tab._id)

  if (persist) {
    store.commit('persistActiveWorkspaceTabs')
  }
}

function dragStart(event) {
  draggedTabElement.value = event.target.closest('.tab')
  if (!draggedTabElement.value) {
    return
  }
  indexOfDraggedTab.value = tabs.value.findIndex(item => item._id === draggedTabElement.value.dataset.id)
  setActiveTab(tabs.value[indexOfDraggedTab.value])
  draggedTabElement.value.style.background = 'white'
  draggedTabElement.value.style.opacity = '0.5'
}

function dragEnd(event) {
  if (!draggedTabElement.value) {
    return
  }
  draggedTabElement.value.style.background = ''
  draggedTabElement.value.style.opacity = ''
}

function dragOver(event) {
  if (!draggedTabElement.value) {
    return
  }
  event.preventDefault()
}

function dragEnter(event) {
  if (!draggedTabElement.value) {
    return
  }
  const tabToDropOn = event.target.closest('.tab')
  if (tabToDropOn) {
    tabToDropOn.classList.add('disable-pointer-events')
    tabToDropOn.style.background = '#ffc0cb1f'
  }
}

function dragLeave(event) {
  if (!draggedTabElement.value) {
    return
  }
  const tabToDropOn = event.target.closest('.tab')
  if (tabToDropOn) {
    tabToDropOn.classList.remove('disable-pointer-events')
    tabToDropOn.style.background = ''
  }
}

function drop(event) {
  if (!draggedTabElement.value) {
    return
  }
  event.preventDefault()
  const tabToDropOn = event.target.closest('.tab')
  if (tabToDropOn) {
    tabToDropOn.style.background = ''
    const indexOfTabToDropOn = tabs.value.findIndex(item => item._id === tabToDropOn.dataset.id)
    arrayMove(tabs.value, indexOfDraggedTab.value, indexOfTabToDropOn)
    store.commit('persistActiveWorkspaceTabs')
  }
}

function handleTabContextMenu(event, tab) {
  tabContextMenuElement.value = event.target
  tabContextMenuTab.value = tab
  showTabContextMenu.value = true
}

function handleTabContextMenuItemClick(clickedContextMenuitem) {
  if (clickedContextMenuitem === 'Close') {
    closeTab(tabContextMenuTab.value)
  }
  if (clickedContextMenuitem === 'Close Others') {
    tabs.value.filter(tab => tab._id !== tabContextMenuTab.value._id).forEach(tab => {
      closeTab(tab, false)
    })
    store.commit('persistActiveWorkspaceTabs')
  }
  if (clickedContextMenuitem === 'Close All') {
    store.commit('closeAllTabs')
  }
}

onMounted(() => {
  document.addEventListener('dragstart', dragStart)
  document.addEventListener('dragend', dragEnd)
  document.addEventListener('dragover', dragOver)
  document.addEventListener('dragenter', dragEnter)
  document.addEventListener('dragleave', dragLeave)
  document.addEventListener('drop', drop)
})

onUnmounted(() => {
  document.removeEventListener('dragstart', dragStart)
  document.removeEventListener('dragend', dragEnd)
  document.removeEventListener('dragover', dragOver)
  document.removeEventListener('dragenter', dragEnter)
  document.removeEventListener('dragleave', dragLeave)
  document.removeEventListener('drop', drop)
})
</script>

<style scoped>
.tab-bar .tabs-container {
  display: flex;
  flex-basis: fit-content;
  overflow-y: auto;
}

.tab-bar .tab {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 0.7rem;
  padding-right: 0.7rem;
  border-right: 1px solid var(--default-border-color);
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
  white-space: nowrap;
}

.tab-bar .tab.disable-pointer-events * {
  pointer-events: none;
}

.tab-bar .tab-active {
  border-top: 1px solid red;
  border-bottom: 1px solid transparent;
}

.tab-bar .tab-add {
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 1rem;
  padding-right: 1rem;
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
}
</style>
