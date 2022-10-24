<template>
  <div class="sidebar-item" :class="{ 'sidebar-item-active': activeTab && sidebarItem._id === activeTab._id }"
    @click="handleSidebarItemClick(sidebarItem)" @dblclick="handleSidebarItemDoubleClick(sidebarItem)"
    @contextmenu.prevent="handleContextMenu(sidebarItem, $event)" :draggable="collectionFilter === '' ? true : false"
    :data-parent-id="sidebarItem.parentId" :data-id="sidebarItem._id" :data-type="sidebarItem._type">
    <template v-if="sidebarItem._type === 'request_group'">
      <div style="margin-right: 0.3rem">
        <i class="fa space-right fa-folder-open" v-if="getSidebarItemExpandedState(sidebarItem)"></i>
        <i class="fa space-right fa-folder" v-else></i>
      </div>
    </template>
    <template v-if="sidebarItem._type === 'request'">
      <div class="sidebar-item-method" :class="`request-method--${sidebarItem.method}`">
        {{ sidebarItem.method.slice(0, 4) }}
      </div>
    </template>
    <div style="width: 100%; margin-right: 0.5rem">
      <div v-if="!showInputToRenameRequest">
        {{ sidebarItem.name }}
        <span v-if="sidebarItem.name === ''" style="visibility: hidden;">Empty Name</span>
      </div>
      <input type="text" v-model="newSidebarItemName" @input="updateTemporarySidebarItemName"
        style="pointer-events: auto; border: 0; outline: 0; width: 100%; padding: 0; background-color: inherit; font-style: italic;"
        spellcheck="false" @keydown.enter="showInputToRenameRequest = false" @blur="saveSidebarItemName(sidebarItem)"
        @dblclick.stop v-focus v-else>
    </div>
  </div>
  <div class="sidebar-list"
    v-if="'children' in sidebarItem && sidebarItem.children.length && getSidebarItemExpandedState(sidebarItem)">
    <template v-for="sidebarItem1 in sidebarItem.children">
      <SidebarItem :sidebar-item="sidebarItem1" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStore } from 'vuex';
import { findItemInTreeById } from '../helpers'

const store = useStore()
const showInputToRenameRequest = ref(false)
const newSidebarItemName = ref(null)

const props = defineProps({
  sidebarItem: Object
})
const vFocus = {
  mounted: (element) => {
    element.focus()
    element.select()
  }
}

const activeTab = computed(() => {
  return store.state.activeTab
})
const collectionFilter = computed(() => {
  return store.state.collectionFilter
})

function handleSidebarItemClick(sidebarItem) {
  if (sidebarItem._type === 'request') {
    store.commit('addTab', sidebarItem)
  }

  if (sidebarItem._type === 'request_group') {
    sidebarItem.collapsed = !(sidebarItem.collapsed)
    store.dispatch('saveCollectionItemCollapsedState', { _id: sidebarItem._id, collapsed: sidebarItem.collapsed })
  }
}
function handleSidebarItemDoubleClick(sidebarItem) {
  if (sidebarItem._type === 'request') {
    newSidebarItemName.value = sidebarItem.name
    showInputToRenameRequest.value = true
  }
}
function handleContextMenu(sidebarItem, event) {
  store.commit('setActiveSidebarItemForContextMenu', { sidebarItem, element: event.target.closest('.sidebar-item') })
}
function getSidebarItemExpandedState(sidebarItem) {
  // always keep sidebar item expanded if search filter is active
  if (collectionFilter.value !== '') {
    return true
  }

  return sidebarItem.collapsed === undefined || sidebarItem.collapsed === false
}
function saveSidebarItemName(sidebarItem) {
  store.commit('updateCollectionItemName', {
    _id: sidebarItem._id,
    _type: sidebarItem._type,
    name: newSidebarItemName.value
  })

  const sidebarItemToUpdate = findItemInTreeById(store.state.collectionTree, sidebarItem._id)
  if (sidebarItemToUpdate) {
    sidebarItemToUpdate.name = newSidebarItemName.value
  }

  const tab = store.state.tabs.find(tab => tab._id === sidebarItem._id)
  if (tab) {
    tab.name = newSidebarItemName.value
  }

  delete store.state.sidebarItemTemporaryName[props.sidebarItem._id]
  newSidebarItemName.value = null
  showInputToRenameRequest.value = false
}
function updateTemporarySidebarItemName() {
  store.state.sidebarItemTemporaryName[props.sidebarItem._id] = newSidebarItemName.value
}

</script>
