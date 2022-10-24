<template>
  <div v-if="showModalComp">
    <Modal title="Settings" v-model="showModalComp">
      <div>
        Sidebar Width:
        <input type="text" :value="sidebarWidth" disabled>
      </div>
      <div style="padding-top: 1rem"></div>
      <div>
        Request Panel Ratio:
        <input type="text" :value="requestPanelRatio" disabled>
      </div>
      <div style="padding-top: 1rem"></div>
      <div>
        Response Panel Ratio:
        <input type="text" :value="responsePanelRatio" disabled>
      </div>
      <div style="padding-top: 1rem"></div>
      <div>
        <button @click="resetSettings('widths')">Reset Widths</button>
        <button @click="resetSettings()" style="margin-left: 1rem">Reset All</button>
      </div>
    </Modal>
  </div>
</template>

<script setup>
  import {ref, computed, watch } from 'vue'
  import Modal from '@/components/Modal.vue'
  import constants from '../../constants'

  const props = defineProps({
    showModal: Boolean
  })

  const emit = defineEmits()

  const sidebarWidth = ref(null)
  const requestPanelRatio = ref(null)
  const responsePanelRatio = ref(null)

  const showModalComp = computed({
    get() {
      return props.showModal
    },
    set(value) {
      emit('update:showModal', value)
    }
  })

  watch(
    () => props.showModal, 
    () => {
      fetchSavedSettings()
    }
  )
  
  function resetWidths() {
    localStorage.removeItem(constants.LOCAL_STORAGE_KEY.SIDEBAR_WIDTH)
    localStorage.removeItem(constants.LOCAL_STORAGE_KEY.REQUEST_PANEL_RATIO)
    localStorage.removeItem(constants.LOCAL_STORAGE_KEY.RESPONSE_PANEL_RATIO)
  }
  function resetLayout() {
    localStorage.removeItem(constants.LOCAL_STORAGE_KEY.REQUEST_RESPONSE_LAYOUT)
  }
  function resetSettings(target=null) {
    if(target) {
      if(target === 'widths') {
        this.resetWidths()
      }
      document.location.reload()
    }

    resetWidths()
    resetLayout()
    document.location.reload()
  }
  function fetchSavedSettings() {
    const savedSidebarWidth = localStorage.getItem(constants.LOCAL_STORAGE_KEY.SIDEBAR_WIDTH)
    const savedRequestPanelRatio = localStorage.getItem(constants.LOCAL_STORAGE_KEY.REQUEST_PANEL_RATIO)
    const savedResponsePanelRatio = localStorage.getItem(constants.LOCAL_STORAGE_KEY.RESPONSE_PANEL_RATIO)

    if(savedSidebarWidth) {
      sidebarWidth.value = savedSidebarWidth
    }

    if(savedRequestPanelRatio) {
      requestPanelRatio.value = savedRequestPanelRatio
    }

    if(savedResponsePanelRatio) {
      responsePanelRatio.value = savedResponsePanelRatio
    }
  }
</script>
