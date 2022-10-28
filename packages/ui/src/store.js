import { createStore } from 'vuex'
import { nanoid } from 'nanoid'
import {
  toTree,
  flattenTree,
  handleRequest,
  filterTree,
  addSortOrderToTree,
  sortTree,
  removeFromTree,
  getChildIds,
  findItemInTreeById,
  generateNewIdsForTreeItemChildren,
  isFirstIdIndirectOrDirectParentOfSecondIdInTree,
  generateNewIdsForTree,
  substituteEnvironmentVariables
} from './helpers'
import { db, getCollectionForWorkspace } from './db'
import { nextTick } from 'vue'
import constants from './constants'
import { emitter } from './event-bus'

async function loadResponses(state, tabId) {
  if (tabId in state.responses) {
    return
  }
  state.responses[tabId] = await db.responses.where({ collectionId: tabId }).reverse().sortBy('createdAt')
  if (state.responses[tabId].length > 0) {
    if ((tabId in state.requestResponses) === false || (tabId in state.requestResponses && state.requestResponses[tabId] === null)) {
      state.requestResponses[tabId] = state.responses[tabId][0]
      state.requestResponseStatus[tabId] = 'loaded'
    }
  } else {
    state.requestResponses[tabId] = null
    state.requestResponseStatus[tabId] = 'pending'
  }
}

function setActiveTab(state, tab, scrollSidebarItemIntoView = false, persistActiveWorkspaceTabsBool = true) {
  // skip setActiveTab as it's already the active tab
  if (state.activeTab && state.activeTab._id === tab._id) {
    return
  }
  state.activeTab = tab
  loadResponses(state, tab._id)
  if (scrollSidebarItemIntoView) {
    nextTick(() => {
      const activeSidebarElement = document.querySelector(`.sidebar-list-container div[data-id="${tab._id}"]`)
      if (activeSidebarElement) {
        activeSidebarElement.scrollIntoView({
          behavior: 'auto',
          block: 'center',
          inline: 'center'
        })
      }

      // also scroll active tab element into view
      const activeTabElement = document.querySelector(`.tabs-container > div[data-id="${tab._id}"]`)
      activeTabElement.scrollIntoView()
    })
  }

  if (persistActiveWorkspaceTabsBool) {
    persistActiveWorkspaceTabs(state)
  }
}

async function getAllParents(parentArray, request) {
  if (!request.parentId) {
    return
  }
  const requestParent = await db.collections.where({ ':id': request.parentId }).first()
  if (requestParent) {
    parentArray.push(requestParent)
    await getAllParents(parentArray, requestParent)
  }
}

async function getEnvironmentForRequest(requestWorkspace, request) {
  let environment = requestWorkspace.environment ? JSON.parse(JSON.stringify(requestWorkspace.environment)) : {}

  let parentArray = []
  await getAllParents(parentArray, request)
  parentArray = parentArray.reverse()

  for (const parent of parentArray) {
    if (parent.environment) {
      let tempEnvironment = JSON.stringify(parent.environment)
      tempEnvironment = substituteEnvironmentVariables(environment, tempEnvironment)
      tempEnvironment = JSON.parse(tempEnvironment)
      Object.assign(environment, tempEnvironment)
    }
  }

  return environment
}

let workspaceCache = {
  tabs: {},
  activeTab: {}
}

async function loadWorkspaceTabs(state, workspaceId) {
  if (workspaceId in workspaceCache.tabs) {
    state.tabs = workspaceCache.tabs[workspaceId]
    if (workspaceCache.activeTab[workspaceId]) {
      setActiveTab(state, workspaceCache.activeTab[workspaceId], true, false)
    } else {
      state.activeTab = null
    }
    return
  }

  const tabIds = state.activeWorkspace.tabIds ?? []
  const activeTabId = state.activeWorkspace.activeTabId ?? null

  let tabIdsOrder = {}

  // to restore tab ordering
  tabIds.forEach((tabId, index) => {
    tabIdsOrder[tabId] = index
  })

  workspaceCache.tabs[workspaceId] = state.collection.filter(collectionItem => tabIds.includes(collectionItem._id)).sort((a, b) => tabIdsOrder[a._id] - tabIdsOrder[b._id])
  workspaceCache.activeTab[workspaceId] = workspaceCache.tabs[workspaceId].find(tab => tab._id === activeTabId) ?? null

  state.tabs = workspaceCache.tabs[workspaceId]
  state.activeTab = null

  if (workspaceCache.activeTab[workspaceId]) {
    setActiveTab(state, workspaceCache.activeTab[workspaceId], true, false)
  }
}

// Called when
// - Tab added
// - Tab made active / switched to
// - Tab closed
// - Tab reordered
async function persistActiveWorkspaceTabs(state) {
  workspaceCache.tabs[state.activeWorkspace._id] = state.tabs
  workspaceCache.activeTab[state.activeWorkspace._id] = state.activeTab

  const tabIds = state.tabs.map(tab => tab._id)
  const activeTabId = state.activeTab ? state.activeTab._id : null

  // persist to already loaded workspace state
  state.activeWorkspace.tabIds = tabIds
  state.activeWorkspace.activeTabId = activeTabId

  // persist to db
  await db.workspaces.update(state.activeWorkspace._id, {
    tabIds,
    activeTabId
  })
}

const store = createStore({
  state() {
    return {
      collection: [],
      collectionTree: [],
      tabs: [],
      activeTab: null,
      requestResponseStatus: {},
      requestResponses: {},
      requestAbortController: {},
      responses: {},
      showImportModal: false,
      showImportModalSelectedRequestGroupId: null,
      collectionFilter: '',
      activeSidebarItemForContextMenu: '',
      sidebarContextMenuElement: null,
      workspaces: [],
      activeWorkspace: null,
      plugins: [],
      requestResponseLayout: 'left-right',
      sidebarItemTemporaryName: {},
      flags: {
        hideBrowserRelatedResponsePanelErrors: false,
        browserExtensionEnabled: false,
        isBrowser: true
      },
      openContextMenuElement: null
    }
  },
  getters: {
    collectionTreeFiltered(state) {
      if (state.collectionFilter) {
        return filterTree(state.collectionTree, state.collectionFilter)
      }

      return state.collectionTree
    },
    enabledPlugins(state) {
      return state.plugins.filter(plugin => plugin.enabled)
    }
  },
  mutations: {
    addTab(state, tab) {
      const tabCopy = JSON.parse(JSON.stringify(tab))
            if(tab.body.mimeType === 'multipart/form-data') {
                let params = []
                for(const param of tab.body.params) {
                    let paramExtracted = {...param}
                    if('files' in paramExtracted) {
                        paramExtracted.files = [...paramExtracted.files]
                    }
                    params.push(paramExtracted)
                }
                tabCopy.body.params = params
            }
      const existingTab = state.tabs.find(tabItem => tabItem._id === tabCopy._id)
      if (!existingTab) {
        state.tabs.push(tabCopy)
      }
      setActiveTab(state, tabCopy)
      nextTick(() => {
        const activeTabElement = document.querySelector(`.tabs-container > div[data-id="${tabCopy._id}"]`)
        activeTabElement.scrollIntoView()
      })
    },
    setActiveTab(state, tab) {
      setActiveTab(state, tab, true)
    },
    closeTab(state, collectionItemId) {
      const tabIndex = state.tabs.findIndex(tabItem => tabItem._id === collectionItemId)
      if (tabIndex === -1) {
        return
      }

      const tabIndexLeft = tabIndex - 1
      const tabIndexRight = tabIndex + 1

      if (state.activeTab && state.activeTab._id === collectionItemId) {
        state.activeTab = tabIndexLeft >= 0 ? state.tabs[tabIndexLeft] : (tabIndexRight <= state.tabs.length - 1 ? state.tabs[tabIndexRight] : null)
      }

      state.tabs.splice(tabIndex, 1)
    },
    closeAllTabs(state) {
      state.activeTab = null
      state.tabs = []
      persistActiveWorkspaceTabs(state)
    },
    showImportModal(state, value) {
      state.showImportModal = value
    },
    showImportModalSelectedRequestGroupId(state, value) {
      state.showImportModalSelectedRequestGroupId = value
    },
    setCollection(state, collection) {
      state.collection = collection
      let collectionTree = toTree(state.collection)
      sortTree(collectionTree)
      state.collectionTree = collectionTree
    },
    clearCollection(state) {
      state.collection = []
      db.collections.where({ workspaceId: state.activeWorkspace._id }).delete()
      state.collectionTree = []
      state.activeTab = null
      state.tabs = []
    },
    setCollectionFilter(state, filter) {
      state.collectionFilter = filter
    },
    persistActiveTab(state) {
      if (state.activeTab) {
        db.collections.update(state.activeTab._id, JSON.parse(JSON.stringify(state.activeTab)))
      }
    },
    setActiveSidebarItemForContextMenu(state, payload) {
      state.activeSidebarItemForContextMenu = payload.sidebarItem
      state.sidebarContextMenuElement = payload.element
    },
    clearActiveSidebarItemForContextMenu(state) {
      state.activeSidebarItemForContextMenu = null
      state.sidebarContextMenuElement = null
    },
    async updateCollectionItemEnvironment(_state, { collectionId, environment }) {
      if (environment) {
        await db.collections.update(collectionId, { environment: JSON.parse(JSON.stringify(environment)) })
      }
    },
    async updateWorkspaceEnvironment(_state, { workspaceId, environment }) {
      if (environment) {
        await db.workspaces.update(workspaceId, { environment: JSON.parse(JSON.stringify(environment)) })
      }
    },
    async updateCollectionItemEnvironments(_state, { collectionId, environments }) {
      if (environments) {
        await db.collections.update(collectionId, { environments: JSON.parse(JSON.stringify(environments)) })
      }
    },
    async updateWorkspaceEnvironments(_state, { workspaceId, environments }) {
      if (environments) {
        await db.workspaces.update(workspaceId, { environments: JSON.parse(JSON.stringify(environments)) })
      }
    },
    async updateCollectionItemCurrentEnvironment(_state, { collectionId, currentEnvironment }) {
      if (currentEnvironment) {
        await db.collections.update(collectionId, { currentEnvironment: currentEnvironment })
      }
    },
    async updateWorkspaceCurrentEnvironment(_state, { workspaceId, currentEnvironment }) {
      if (currentEnvironment) {
        await db.workspaces.update(workspaceId, { currentEnvironment: currentEnvironment })
      }
    },
    async updateCollectionItemName(_state, collectionItem) {
      await db.collections.update(collectionItem._id, { name: collectionItem.name })

      if (collectionItem._type === 'request_group') {
        emitter.emit('request_group', 'renamed')
      }
    },
    setWorkspaces(state, workspaces) {
      state.workspaces = workspaces
    },
    setActiveWorkspace(state, workspace) {
      state.activeWorkspace = workspace
      if (workspace === null) {
        state.tabs = []
        state.activeTab = null
      }
    },
    async addPlugin(state, plugin) {
      const newPlugin = {
        _id: nanoid(),
        name: plugin.name,
        code: plugin.code,
        enabled: true,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      }
      await db.plugins.put(newPlugin)
      state.plugins.push(newPlugin)
    },
    async updatePlugin(state, plugin) {
      const updatePlugin = {
        name: plugin.name,
        code: plugin.code,
        updatedAt: new Date().getTime()
      }
      await db.plugins.update(plugin._id, updatePlugin)
      const foundPlugin = state.plugins.find(item => item._id === plugin._id)
      foundPlugin.name = updatePlugin.name
      foundPlugin.code = updatePlugin.code
      foundPlugin.updatedAt = updatePlugin.updatedAt
    },
    async updatePluginStatus(state, plugin) {
      await db.plugins.update(plugin._id, { enabled: plugin.enabled })
      const foundPlugin = state.plugins.find(item => item._id === plugin._id)
      foundPlugin.enabled = plugin.enabled
    },
    async deletePlugin(state, pluginId) {
      await db.plugins.where({ _id: pluginId }).delete()
      state.plugins = state.plugins.filter(plugin => plugin._id !== pluginId)
    },
    async saveResponse(state, response) {
      if (response._id) {
        state.responses[state.activeTab._id].unshift(response)
        await db.responses.put(response)
      }
    },
    async clearResponseHistory(state) {
      await db.responses.where({ collectionId: state.activeTab._id }).delete()
      state.responses[state.activeTab._id] = []
      state.requestResponses[state.activeTab._id] = null
      state.requestResponseStatus[state.activeTab._id] = 'pending'
    },
    async renameCurrentlyActiveResponse(state, newResponseName) {
      const activeResponse = state.requestResponses[state.activeTab._id]
      activeResponse.name = newResponseName !== '' ? newResponseName : null
      await db.responses.update(activeResponse._id, { name: activeResponse.name })
    },
    async deleteCurrentlyActiveResponse(state) {
      const responseId = state.requestResponses[state.activeTab._id]._id
      await db.responses.where({ _id: responseId }).delete()
      state.responses[state.activeTab._id] = state.responses[state.activeTab._id].filter(response => response._id !== responseId)
      if (state.responses[state.activeTab._id].length > 0) {
        state.requestResponses[state.activeTab._id] = state.responses[state.activeTab._id][0]
        state.requestResponseStatus[state.activeTab._id] = 'loaded'
      } else {
        state.requestResponses[state.activeTab._id] = null
        state.requestResponseStatus[state.activeTab._id] = 'pending'
      }
    },
    persistActiveWorkspaceTabs(state) {
      persistActiveWorkspaceTabs(state)
    },
    loadWorkspaceTabs(state) {
      loadWorkspaceTabs(state, state.activeWorkspace._id)
    }
  },
  actions: {
    async deleteCollectionItem(context, collectionItem) {
      const childIds = getChildIds(context.state.collection, collectionItem._id)
      await db.responses.where('collectionId').anyOf(childIds).delete()
      await db.collections.where(':id').anyOf(childIds).delete()
      await removeFromTree(context.state.collectionTree, '_id', collectionItem._id)
      childIds.forEach(childId => {
        context.commit('closeTab', childId)
        // clear unneeded response cache
        if (childId in context.state.responses) {
          delete context.state.responses[childId]
          delete context.state.requestResponses[childId]
          delete context.state.requestResponseStatus[childId]
        }
      })
      context.state.collection = context.state.collection.filter(item => childIds.includes(item._id) === false)

      if (collectionItem._type === 'request_group') {
        emitter.emit('request_group', 'deleted')
      }

      if (childIds.length > 0) {
        persistActiveWorkspaceTabs(context.state)
      }
    },
    async duplicateCollectionItem(context, collectionItem) {
      const newCollectionItem = JSON.parse(JSON.stringify(collectionItem))
      newCollectionItem._id = nanoid()

      if (collectionItem._type === 'request_group') {
        generateNewIdsForTreeItemChildren(newCollectionItem)
      }

      const collectionItemsToSave = flattenTree([newCollectionItem])
      await db.collections.bulkPut(collectionItemsToSave)
      context.state.collection = context.state.collection.concat(collectionItemsToSave)

      if (collectionItem.parentId) {
        let parentCollection = findItemInTreeById(context.state.collectionTree, collectionItem.parentId)
        const childIndex = parentCollection.children.findIndex(item => item._id === collectionItem._id)
        parentCollection.children.splice(childIndex + 1, 0, newCollectionItem)
        // new sort order for new item and its siblings
        parentCollection.children.forEach((item, index) => {
          item.sortOrder = index
          db.collections.update(item._id, { sortOrder: index })
        })
      } else {
        const childIndex = context.state.collectionTree.findIndex(item => item._id === collectionItem._id)
        context.state.collectionTree.splice(childIndex + 1, 0, newCollectionItem)
        // new sort order for new item and its siblings
        context.state.collectionTree.forEach((item, index) => {
          item.sortOrder = index
          db.collections.update(item._id, { sortOrder: index })
        })
      }

      if (newCollectionItem._type === 'request') {
        context.commit('addTab', newCollectionItem)
      }

      if (newCollectionItem._type === 'request_group') {
        emitter.emit('request_group', 'added')
      }
    },
    async createCollectionItem(context, payload) {
      let newCollectionItem = null

      if (payload.type === 'request') {
        newCollectionItem = {
          _id: nanoid(),
          _type: 'request',
          name: payload.name,
          method: payload.method,
          body: {
            mimeType: payload.mimeType
          },
          parentId: payload.parentId,
          workspaceId: context.state.activeWorkspace._id
        }
      }

      if (payload.type === 'request_group') {
        newCollectionItem = {
          _id: nanoid(),
          _type: 'request_group',
          name: payload.name,
          children: [],
          parentId: payload.parentId,
          workspaceId: context.state.activeWorkspace._id
        }
      }

      await db.collections.put(newCollectionItem)
      context.state.collection.push(newCollectionItem)

      if (newCollectionItem.parentId) {
        let parentCollection = findItemInTreeById(context.state.collectionTree, newCollectionItem.parentId)
        parentCollection.children.splice(0, 0, newCollectionItem)
        // new sort order for new item and its siblings
        parentCollection.children.forEach((item, index) => {
          item.sortOrder = index
          db.collections.update(item._id, { sortOrder: index })
        })
      } else {
        context.state.collectionTree.splice(0, 0, newCollectionItem)
        // new sort order for new item and its siblings
        context.state.collectionTree.forEach((item, index) => {
          item.sortOrder = index
          db.collections.update(item._id, { sortOrder: index })
        })
      }

      if (payload.type === 'request') {
        context.commit('addTab', newCollectionItem)
      }

      if (payload.type === 'request_group') {
        emitter.emit('request_group', 'added')
      }
    },
    async reorderCollectionItem(context, payload) {
      if (payload.from.id === payload.to.id) { // don't allow an item to be dropped onto itself
        return
      }

      // don't allow an item to be dropped into its children
      if (isFirstIdIndirectOrDirectParentOfSecondIdInTree(context.state.collectionTree, payload.from.id, payload.to.id)) {
        return
      }

      let targetKey = 'parentId'
      if (payload.to.type === 'request_group' && payload.to.cursorPosition === 'bottom') { // dropping an item into a folder, bottom = pink highlight
        targetKey = 'id'
      }

      const sourceParentCollection = !payload.from.parentId ? context.state.collectionTree : findItemInTreeById(context.state.collectionTree, payload.from.parentId).children
      const targetParentCollection = !payload.to[targetKey] ? context.state.collectionTree : findItemInTreeById(context.state.collectionTree, payload.to[targetKey]).children

      let sourceIndex = sourceParentCollection.findIndex(item => item._id === payload.from.id)
      const sourceItem = sourceParentCollection[sourceIndex]
      sourceParentCollection.splice(sourceIndex, 1)
      sourceItem.parentId = payload.to[targetKey] ?? null

      let targetIndex = targetParentCollection.findIndex(item => item._id === payload.to.id)
      if (payload.to.type === 'request_group' && payload.to.cursorPosition === 'bottom') { // dropping an item into a folder, bottom = pink highlight
        targetIndex = 0
      }
      if (payload.to.type === 'request' && payload.to.cursorPosition === 'bottom') {
        targetIndex++
      }
      targetParentCollection.splice(targetIndex, 0, sourceItem)

      await db.collections.update(sourceItem._id, { parentId: sourceItem.parentId })

      targetParentCollection.forEach((item, index) => {
        item.sortOrder = index
        db.collections.update(item._id, { sortOrder: index })
      })
    },
    async loadPlugins(context) {
      const plugins = await db.plugins.toArray()
      context.state.plugins = plugins
    },
    async sendRequest(context, activeTab) {
      context.state.requestResponseStatus[activeTab._id] = 'loading'
      const environment = await getEnvironmentForRequest(context.state.activeWorkspace, activeTab)
      context.state.requestAbortController[activeTab._id] = new AbortController()
      const response = await handleRequest(activeTab, environment, context.getters.enabledPlugins, context.state.requestAbortController[activeTab._id].signal)
      context.commit('saveResponse', response)
      context.state.requestResponses[activeTab._id] = response
      context.state.requestResponseStatus[activeTab._id] = 'loaded'
    },
    async createWorkspace(context, payload) {
      const newWorkspaceId = nanoid()

      const newWorkspace = {
        _id: newWorkspaceId,
        name: payload.name,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      }

      await db.workspaces.put(newWorkspace)

      context.state.workspaces.unshift(newWorkspace)

      if (payload.setAsActive) {
        context.commit('setActiveWorkspace', newWorkspace)
      }

      return newWorkspaceId
    },
    async updateWorkspace(context, payload) {
      const updatedAt = new Date().getTime()
      await db.workspaces.update(payload._id, {
        name: payload.name,
        updatedAt
      })
      const workspace = context.state.workspaces.find(item => item._id === payload._id)
      workspace.name = payload.name
      workspace.updatedAt = updatedAt
      context.state.workspaces.sort((a, b) => b.updatedAt - a.updatedAt)
    },
    async deleteWorkspace(context, workspaceId) {
      const collectionIds = await db.collections.where({ workspaceId: workspaceId }).primaryKeys()
      await db.responses.where('collectionId').anyOf(collectionIds).delete()
      await db.collections.where({ workspaceId: workspaceId }).delete()
      await db.workspaces.where({ _id: workspaceId }).delete()
      context.state.workspaces = context.state.workspaces.filter(item => item._id !== workspaceId)
      collectionIds.forEach(collectionId => {
        context.commit('closeTab', collectionId)
      })
    },
    async loadWorkspaces(context) {
      let workspaces = await db.workspaces.toCollection().reverse().sortBy('updatedAt')

      if (workspaces.length > 0) {
        context.commit('setWorkspaces', workspaces)

        const activeWorkspaceId = localStorage.getItem(constants.LOCAL_STORAGE_KEY.ACTIVE_WORKSPACE_ID)
        if (activeWorkspaceId) {
          const activeWorkspace = workspaces.find(item => item._id === activeWorkspaceId)
          if (activeWorkspace) {
            context.commit('setActiveWorkspace', activeWorkspace)
          }
        }
      } else {
        await context.dispatch('createWorkspace', {
          name: 'My Collection',
          setAsActive: true
        })

        // update pre-existing collections with a default workspaceId, so as to not break
        // collections created before the introduction of workspaces
        await db.collections.toCollection().modify({ workspaceId: context.state.activeWorkspace._id })
      }
    },
    async saveCollectionItemCollapsedState(_context, payload) {
      await db.collections.update(payload._id, { collapsed: payload.collapsed })
    },
    async duplicateWorkspace(context, workspace) {
      const newWorkspaceId = await context.dispatch('createWorkspace', {
        name: workspace.name
      })
      const workspaceCollectionItems = await getCollectionForWorkspace(workspace.sourceWorkspaceId)
      workspaceCollectionItems.forEach(collectionItem => {
        collectionItem.workspaceId = newWorkspaceId
      })
      const collectionTree = toTree(workspaceCollectionItems)
      generateNewIdsForTree(collectionTree)
      await db.collections.bulkPut(flattenTree(collectionTree))
    },
    async setCollectionTree(context, { collectionTree, parentId = null }) {
      if (parentId) {
        const parentCollection = findItemInTreeById(context.state.collectionTree, parentId)
        collectionTree = parentCollection.children.concat(collectionTree)
      } else {
        collectionTree = context.state.collectionTree.concat(collectionTree)
      }
      addSortOrderToTree(collectionTree)
      const flattenedCollectionTree = JSON.parse(JSON.stringify(flattenTree(collectionTree)))
      await db.collections.bulkPut(flattenedCollectionTree)
      context.commit('setCollection', await getCollectionForWorkspace(context.state.activeWorkspace._id))
    }
  }
})

export default store
