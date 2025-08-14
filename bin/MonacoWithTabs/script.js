class CelestiaEditor {
  constructor() {
    this.tabs = []
    this.activeTabId = ""
    this.tabCounter = 1
    this.currentModel = null
    this.isRenaming = false
    this.currentRenameTabId = ""
    this.maxTabs = 6
    this.notificationTimeout = null
    this.minimapVisible = false

    this.WELCOME_CONTENT = `-- Welcome, User

-- Example Script
local player = game.Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()
local humanoid = character:WaitForChild("Humanoid")

humanoid.WalkSpeed = 50
`

    this.initMonaco()
    this.loadTabsFromLocalStorage()
    this.setupUI()
    this.setupWindowEvents()
    this.setupMinimapToggle()
    this.setupOpenSaveFunctions()
  }

  initMonaco() {
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs' }})
    require(['vs/editor/editor.main'], () => {
      this.editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: '',
        language: 'lua',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: this.minimapVisible }
      })
      this.editor.onDidChangeModelContent(() => this.handleContentChange())
      const welcomeTab = this.tabs.find(t => t.name === "Welcome.lua")
      if (welcomeTab) {
        this.activeTabId = welcomeTab.id
        this.updateEditorContent()
      }
      this.updateStatusBar()
    })
  }

  loadTabsFromLocalStorage() {
    const storedTabs = localStorage.getItem("celestia-editor-tabs")
    const storedActive = localStorage.getItem("celestia-editor-active-tab")
    if (storedTabs) {
      try {
        this.tabs = JSON.parse(storedTabs)
      } catch {
        this.tabs = []
      }
    }
    let welcomeTab = this.tabs.find(t => t.name === "Welcome.lua")
    if (!welcomeTab) {
      welcomeTab = {
        id: "welcome",
        name: "Welcome.lua",
        content: this.WELCOME_CONTENT,
        language: "lua",
        saved: true,
      }
      this.tabs.unshift(welcomeTab)
    } else {
      if (welcomeTab.content === undefined || welcomeTab.content === null) {
        welcomeTab.content = this.WELCOME_CONTENT
        welcomeTab.saved = true
      }
      welcomeTab.language = "lua"
      const idx = this.tabs.indexOf(welcomeTab)
      if (idx > 0) {
        this.tabs.splice(idx, 1)
        this.tabs.unshift(welcomeTab)
      }
    }
    let highest = 0
    for (const tab of this.tabs) {
      const m = tab.name.match(/^Script #(\d+)\.lua$/)
      if (m) highest = Math.max(highest, parseInt(m[1]))
    }
    this.tabCounter = highest + 1
    if (storedActive && this.tabs.find(t => t.id === storedActive)) {
      this.activeTabId = storedActive
    } else {
      this.activeTabId = this.tabs[0].id
    }
    this.renderTabs()
  }

  setupUI() {
    const container = document.getElementById('tabs-container')
    if (!document.getElementById('add-tab-btn')) {
      const plusBtn = document.createElement('button')
      plusBtn.id = 'add-tab-btn'
      plusBtn.innerText = '+'
      plusBtn.title = 'New Tab'
      plusBtn.style.marginLeft = '10px'
      plusBtn.style.fontWeight = 'bold'
      plusBtn.style.fontSize = '17px'
      plusBtn.style.background = 'transparent'
      plusBtn.style.border = 'none'
      plusBtn.style.color = '#87aaff'
      plusBtn.style.cursor = 'pointer'
      plusBtn.style.padding = '0 10px'
      plusBtn.style.height = '30px'
      plusBtn.style.verticalAlign = 'middle'
      plusBtn.addEventListener('mouseenter', () => plusBtn.style.background = '#29304b')
      plusBtn.addEventListener('mouseleave', () => plusBtn.style.background = 'transparent')
      container.parentNode.insertBefore(plusBtn, container.nextSibling)
    }
    document.getElementById('add-tab-btn').onclick = () => this.addTab()
    window.addEventListener('click', () => this.hideContextMenu())
  }

  renderTabs() {
    const container = document.getElementById('tabs-container')
    container.innerHTML = ""
    this.tabs.forEach((tab) => {
      const tabElement = document.createElement('div')
      tabElement.className = `tab ${this.activeTabId === tab.id ? "active" : ""}`
      tabElement.dataset.id = tab.id
      tabElement.draggable = tab.name !== "Welcome.lua"
      tabElement.innerHTML = `
        <img src="luaicon.png" alt="Lua" class="tab-icon" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;">
        <span class="tab-name">${this.escapeHtml(tab.name)}</span>
        <span class="unsaved-indicator">${tab.saved ? "" : "•"}</span>
        ${tab.name !== "Welcome.lua" ? `<span class="close-btn" style="margin-left:18px;" title="Close tab">×</span>` : ""}
      `
      tabElement.addEventListener("click", (e) => {
        if (e.target.classList.contains("close-btn")) return
        this.switchTab(tab.id)
      })
      if (tab.name !== "Welcome.lua") {
        const closeBtn = tabElement.querySelector(".close-btn")
        if (closeBtn) {
          closeBtn.addEventListener("click", (e) => {
            e.stopPropagation()
            this.closeTab(tab.id)
          })
        }
      }
      if (tab.name !== "Welcome.lua") {
        tabElement.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", tab.id)
          e.dataTransfer.effectAllowed = "move"
        })
        tabElement.addEventListener("dragover", (e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
        })
        tabElement.addEventListener("drop", (e) => {
          e.preventDefault()
          const draggedTabId = e.dataTransfer.getData("text/plain")
          if (draggedTabId === tab.id) return
          this.reorderTabs(draggedTabId, tab.id)
        })
      }
      container.appendChild(tabElement)
    })
    this.saveTabsToLocalStorage()
  }

  reorderTabs(draggedTabId, targetTabId) {
    const draggedIndex = this.tabs.findIndex((t) => t.id === draggedTabId)
    const targetIndex = this.tabs.findIndex((t) => t.id === targetTabId)
    if (draggedIndex <= 0 || targetIndex <= 0) return
    const [draggedTab] = this.tabs.splice(draggedIndex, 1)
    this.tabs.splice(targetIndex, 0, draggedTab)
    this.renderTabs()
  }

  switchTab(id) {
    if (this.activeTabId === id) return
    this.activeTabId = id
    this.updateEditorContent()
    this.renderTabs()
    this.updateStatusBar()
  }

  updateEditorContent() {
    const activeTab = this.tabs.find((tab) => tab.id === this.activeTabId)
    if (!activeTab) return
    if (!this.editor) return
    if (activeTab.name === "Welcome.lua") {
      if (activeTab.content === undefined || activeTab.content === null) {
        activeTab.content = this.WELCOME_CONTENT
        activeTab.saved = true
      }
    }
    if (this.currentModel) {
      this.currentModel.dispose()
      this.currentModel = null
    }
    this.currentModel = window.monaco.editor.createModel(activeTab.content, activeTab.language)
    this.editor.setModel(this.currentModel)
    this.isRenaming = false
  }

  addTab() {
    if (this.tabs.length >= this.maxTabs) {
      return
    }
    let highest = 0
    for (const tab of this.tabs) {
      const m = tab.name.match(/^Script #(\d+)\.lua$/)
      if (m) highest = Math.max(highest, parseInt(m[1]))
    }
    const name = `Script #${highest + 1}.lua`
    this.tabCounter = highest + 2
    localStorage.setItem("celestia-editor-last-tab-number", String(this.tabCounter))
    const language = this.getLanguageFromName(name)
    const content = ""
    const newTab = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name,
      content,
      language,
      saved: true,
    }
    this.tabs.push(newTab)
    this.activeTabId = newTab.id
    this.renderTabs()
    this.updateEditorContent()
    this.updateStatusBar()
  }

  handleContentChange() {
    if (!this.editor) return
    const model = this.editor.getModel()
    if (!model) return
    const tab = this.tabs.find((t) => t.id === this.activeTabId)
    if (!tab) return
    tab.content = model.getValue()
    tab.saved = false
    this.renderTabs()
    this.updateStatusBar()
    this.saveTabsToLocalStorage()
  }

  closeTab(id) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab) return
    if (tab.name === "Welcome.lua") return
    if (this.activeTabId === id) {
      if (this.editor && this.currentModel) {
        this.currentModel.dispose()
        this.currentModel = null
      }
    }
    this.tabs = this.tabs.filter((t) => t.id !== id)
    if (this.activeTabId === id) {
      if (this.tabs.length > 0) {
        this.activeTabId = this.tabs[0].id
        this.updateEditorContent()
      } else {
        this.activeTabId = ""
        if (this.editor) {
          this.editor.setModel(null)
        }
      }
    }
    this.renderTabs()
    this.updateStatusBar()
  }

  getLanguageFromName(name) {
    const ext = name.split('.').pop().toLowerCase()
    switch (ext) {
      case "lua": return "lua"
      case "js": return "javascript"
      case "ts": return "typescript"
      case "json": return "json"
      case "html": return "html"
      case "css": return "css"
      case "py": return "python"
      default: return "plaintext"
    }
  }

  saveTabsToLocalStorage() {
    localStorage.setItem("celestia-editor-tabs", JSON.stringify(this.tabs))
    localStorage.setItem("celestia-editor-active-tab", this.activeTabId)
    localStorage.setItem("celestia-editor-last-tab-number", String(this.tabCounter))
  }

  updateStatusBar() {
    const status = document.getElementById('status-bar')
    const tab = this.tabs.find(t => t.id === this.activeTabId)
    if (!tab) {
      status.textContent = "No file open"
      return
    }
    const lang = tab.language || "plaintext"
    status.textContent = `${tab.name} — ${lang}`
  }

  escapeHtml(text) {
    return text.replace(/[&<>"']/g, (m) => {
      switch (m) {
        case "&": return "&amp;"
        case "<": return "&lt;"
        case ">": return "&gt;"
        case '"': return "&quot;"
        case "'": return "&#039;"
        default: return m
      }
    })
  }

  hideContextMenu() {
    const menu = document.getElementById("context-menu")
    if (menu) menu.style.display = "none"
  }

  setupWindowEvents() {
    window.addEventListener("beforeunload", () => {
      this.saveTabsToLocalStorage()
    })
  }

  setText(newText) {
    if (!this.editor) return
    const model = this.editor.getModel()
    if (!model) return
    model.setValue(newText)
    const tab = this.tabs.find(t => t.id === this.activeTabId)
    if (tab) {
      tab.content = newText
      tab.saved = false
      this.renderTabs()
      this.updateStatusBar()
      this.saveTabsToLocalStorage()
    }
  }

  clearText() {
    const tab = this.tabs.find(t => t.id === this.activeTabId)
    if (!tab) return
    if (tab.name === "Welcome.lua") {
      tab.content = ""
      tab.saved = false
      this.setText("")
    } else {
      this.setText("")
    }
  }

  setupMinimapToggle() {
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'j' || e.key === 'J')) {
        this.minimapVisible = !this.minimapVisible
        if (this.editor) {
          this.editor.updateOptions({ minimap: { enabled: this.minimapVisible } })
        }
        e.preventDefault()
      }
    })
  }

  setupOpenSaveFunctions() {
    if (!document.getElementById('open-file-input')) {
      const input = document.createElement('input')
      input.type = 'file'
      input.id = 'open-file-input'
      input.style.display = 'none'
      document.body.appendChild(input)
    }
    document.getElementById('open-file-input').onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          this.setText(ev.target.result)
        }
        reader.readAsText(file)
      }
    }
  }

  saveCurrentTabToFile() {
    const tab = this.tabs.find(t => t.id === this.activeTabId)
    if (!tab) return
    const text = tab.content
    const fname = tab.name || "celestia.lua"
    const blob = new Blob([text], { type: "text/plain" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = fname
    document.body.appendChild(link)
    link.click()
    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    }, 50)
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.celestiaEditor = new CelestiaEditor()
})