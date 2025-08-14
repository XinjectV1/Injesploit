"use client"

import { useState, useEffect, useRef } from "react"
import Editor from "@monaco-editor/react"
import { Plus, X, FileText, Save, Edit3, SettingsIcon, Trash2, Eye, EyeOff } from "lucide-react"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

interface Tab {
  id: string
  name: string
  content: string
  language: string
  saved: boolean
  isRenaming?: boolean
}

interface SavedTab {
  id: string
  name: string
  content: string
  language: string
  savedAt: string
}

interface EditorSettings {
  miniMapEnabled: boolean
  fontSize: number
  wordWrap: boolean
  lineNumbers: boolean
}

const getLanguageFromName = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "lua":
      return "lua"
    case "js":
    case "jsx":
      return "javascript"
    case "ts":
    case "tsx":
      return "typescript"
    case "css":
      return "css"
    case "html":
      return "html"
    case "json":
      return "json"
    case "md":
      return "markdown"
    case "py":
      return "python"
    default:
      return "javascript"
  }
}

const getDefaultContent = (language: string): string => {
  switch (language) {
    case "lua":
      return `-- Welcome to Celestia

print("Hello World")`
    default:
      return ""
  }
}

export default function MonacoEditor() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>("")
  const [showSaveError, setShowSaveError] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [savedTabName, setSavedTabName] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [savedTabs, setSavedTabs] = useState<SavedTab[]>([])
  const [pasteNotification, setPasteNotification] = useState("")
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    miniMapEnabled: true,
    fontSize: 14,
    wordWrap: true,
    lineNumbers: true,
  })
  const editorRef = useRef<any>(null)
  const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Load saved data from localStorage
  useEffect(() => {
    const savedTabsData = localStorage.getItem("celestia-editor-tabs")
    const savedActiveTab = localStorage.getItem("celestia-editor-active-tab")
    const savedTabsStorage = localStorage.getItem("celestia-saved-tabs")
    const settingsStorage = localStorage.getItem("celestia-settings")

    if (savedTabsData) {
      const parsedTabs = JSON.parse(savedTabsData)
      setTabs(parsedTabs)
      if (savedActiveTab && parsedTabs.find((tab: Tab) => tab.id === savedActiveTab)) {
        setActiveTabId(savedActiveTab)
      } else if (parsedTabs.length > 0) {
        setActiveTabId(parsedTabs[0].id)
      }
    } else {
      const defaultTab: Tab = {
        id: "1",
        name: "Welcome.lua",
        content: getDefaultContent("lua"),
        language: "lua",
        saved: true,
      }
      setTabs([defaultTab])
      setActiveTabId("1")
    }

    if (savedTabsStorage) {
      setSavedTabs(JSON.parse(savedTabsStorage))
    }

    if (settingsStorage) {
      setEditorSettings({ ...editorSettings, ...JSON.parse(settingsStorage) })
    }
  }, [])

  // Save data to localStorage
  useEffect(() => {
    if (tabs.length > 0) {
      localStorage.setItem("celestia-editor-tabs", JSON.stringify(tabs))
    }
  }, [tabs])

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem("celestia-editor-active-tab", activeTabId)
    }
  }, [activeTabId])

  useEffect(() => {
    localStorage.setItem("celestia-saved-tabs", JSON.stringify(savedTabs))
  }, [savedTabs])

  useEffect(() => {
    localStorage.setItem("celestia-settings", JSON.stringify(editorSettings))
  }, [editorSettings])

  // Alternative paste method using hidden textarea
  const handlePasteWithTextarea = () => {
    console.log("🔄 Using textarea paste method...")

    if (!editorRef.current || !activeTabId) {
      console.log("❌ Editor or tab not ready")
      return
    }

    if (!hiddenTextareaRef.current) {
      console.log("❌ Hidden textarea not ready")
      return
    }

    // Clear the textarea and focus it
    const textarea = hiddenTextareaRef.current
    textarea.value = ""
    textarea.focus()
    textarea.select()

    // Set up a one-time paste event listener
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      const clipboardData = e.clipboardData?.getData("text") || ""

      console.log("📋 Pasted content:", clipboardData ? `${clipboardData.length} characters` : "empty")

      if (clipboardData && editorRef.current) {
        // Replace content in Monaco editor
        const model = editorRef.current.getModel()
        if (model) {
          const fullRange = model.getFullModelRange()
          editorRef.current.executeEdits("paste-replace", [
            {
              range: fullRange,
              text: clipboardData,
            },
          ])

          // Update our state
          setTabs((prev) =>
            prev.map((tab) => (tab.id === activeTabId ? { ...tab, content: clipboardData, saved: false } : tab)),
          )

          console.log("✅ Content replaced successfully")
          setPasteNotification(`✅ Pasted ${clipboardData.length} characters`)
          setTimeout(() => setPasteNotification(""), 2000)

          // Focus back to editor
          editorRef.current.focus()
        }
      } else {
        setPasteNotification("📋 Nothing to paste")
        setTimeout(() => setPasteNotification(""), 2000)
      }

      // Remove the event listener
      textarea.removeEventListener("paste", handlePaste)
    }

    // Add paste event listener
    textarea.addEventListener("paste", handlePaste)

    // Trigger paste programmatically
    setTimeout(() => {
      document.execCommand("paste")
    }, 10)
  }

  // Keyboard event handler - simplified to only handle our custom paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save shortcut
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault()
        setShowSaveError(true)
        setTimeout(() => setShowSaveError(false), 3000)
        return
      }

      // Settings shortcut
      if (e.altKey && (e.key === "j" || e.key === "J")) {
        e.preventDefault()
        setShowSettings(true)
        return
      }

      // Custom paste shortcut - replace all content
      if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        // Check if we're in the editor area
        const activeElement = document.activeElement
        const isInEditor =
          activeElement?.closest(".monaco-editor") ||
          activeElement?.classList.contains("monaco-editor") ||
          activeElement?.tagName === "TEXTAREA"

        if (isInEditor) {
          e.preventDefault()
          e.stopPropagation()
          handlePasteWithTextarea()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [activeTabId])

  const handleEditorDidMount = (editor: any, monaco: any) => {
    console.log("🎯 Editor mounted")
    editorRef.current = editor

    monaco.editor.defineTheme("futuristic-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "keyword", foreground: "569CD6" },
        { token: "string", foreground: "CE9178" },
        { token: "number", foreground: "B5CEA8" },
        { token: "function", foreground: "DCDCAA" },
        { token: "variable", foreground: "9CDCFE" },
        { token: "type", foreground: "4EC9B0" },
        { token: "operator", foreground: "D4D4D4" },
        { token: "delimiter", foreground: "D4D4D4" },
      ],
      colors: {
        "editor.background": "#1a1a1a",
        "editor.foreground": "#D4D4D4",
        "editorLineNumber.foreground": "#6e6e6e",
        "editorLineNumber.activeForeground": "#ffffff",
        "editor.selectionBackground": "#264F78",
        "editor.selectionHighlightBackground": "#ADD6FF26",
        "editorCursor.foreground": "#ffffff",
        "editor.lineHighlightBackground": "#ffffff08",
        "editorWhitespace.foreground": "#404040",
        "editorIndentGuide.background": "#404040",
        "editorIndentGuide.activeBackground": "#707070",
      },
    })

    monaco.editor.setTheme("futuristic-dark")
    editor.focus()
  }

  const getNextTabNumber = () => {
    const scriptTabs = tabs.filter((tab) => tab.name.startsWith("Script #"))
    const numbers = scriptTabs.map((tab) => {
      const match = tab.name.match(/Script #(\d+)/)
      return match ? Number.parseInt(match[1]) : 0
    })
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  }

  const addTab = () => {
    const tabNumber = getNextTabNumber()
    const newTab: Tab = {
      id: Date.now().toString(),
      name: `Script #${tabNumber}`,
      content: "", // Empty content for new tabs
      language: "javascript",
      saved: false,
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) return

    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.id !== tabId)
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[0].id)
      }
      return newTabs
    })
  }

  const handleContentChange = (value: string | undefined) => {
    if (value === undefined || !activeTabId) return

    setTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? { ...tab, content: value, saved: false } : tab)))
  }

  const saveTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return

    // Update tab as saved
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, saved: true } : t)))

    // Add to saved tabs
    const savedTab: SavedTab = {
      id: Date.now().toString(),
      name: tab.name,
      content: tab.content,
      language: tab.language,
      savedAt: new Date().toLocaleString(),
    }

    setSavedTabs((prev) => {
      const filtered = prev.filter((st) => st.name !== tab.name)
      return [...filtered, savedTab]
    })

    // Show success notification
    setSavedTabName(tab.name)
    setShowSaveSuccess(true)
    setTimeout(() => setShowSaveSuccess(false), 3000)
  }

  const loadSavedTab = (savedTab: SavedTab) => {
    const newTab: Tab = {
      id: Date.now().toString(),
      name: savedTab.name,
      content: savedTab.content,
      language: savedTab.language,
      saved: true,
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setShowSettings(false)
  }

  const deleteSavedTab = (savedTabId: string) => {
    setSavedTabs((prev) => prev.filter((tab) => tab.id !== savedTabId))
  }

  const startRenaming = (tabId: string) => {
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, isRenaming: true } : tab)))
  }

  const finishRenaming = (tabId: string, newName: string) => {
    if (!newName.trim()) {
      setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, isRenaming: false } : tab)))
      return
    }

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              name: newName.trim(),
              language: getLanguageFromName(newName.trim()),
              saved: false,
              isRenaming: false,
            }
          : tab,
      ),
    )
  }

  const cancelRenaming = (tabId: string) => {
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, isRenaming: false } : tab)))
  }

  const updateSettings = (key: keyof EditorSettings, value: any) => {
    setEditorSettings((prev) => ({ ...prev, [key]: value }))
  }

  const activeTab = tabs.find((tab) => tab.id === activeTabId)

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] relative">
      {/* Hidden textarea for clipboard access */}
      <textarea
        ref={hiddenTextareaRef}
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        tabIndex={-1}
      />

      {/* Save Error Message */}
      {showSaveError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">😭</span>
            <span className="font-medium">Bruh did u tried to save our whole website 😭</span>
          </div>
        </div>
      )}

      {/* Save Success Message */}
      {showSaveSuccess && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="font-medium">Successfully Saved "{savedTabName}"</span>
          </div>
        </div>
      )}

      {/* Paste Notification */}
      {pasteNotification && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-top-2 duration-300">
          <span className="font-medium">{pasteNotification}</span>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex items-center bg-transparent min-h-[40px] px-2 pt-2">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger>
                <div
                  className={`
                    flex items-center px-4 py-2 cursor-pointer relative
                    transition-all duration-200 group min-w-[120px] max-w-[200px]
                    rounded-t-lg
                    ${
                      activeTabId === tab.id
                        ? "text-white shadow-lg"
                        : "text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]"
                    }
                  `}
                  style={{
                    backgroundColor: "rgb(35,35,35)",
                    opacity: activeTabId === tab.id ? 1 : 0.7,
                  }}
                  onClick={() => !tab.isRenaming && setActiveTabId(tab.id)}
                >
                  <FileText className="w-4 h-4 mr-2 flex-shrink-0 opacity-60" />

                  {tab.isRenaming ? (
                    <input
                      type="text"
                      defaultValue={tab.name}
                      className="bg-transparent text-sm font-medium outline-none border-b border-blue-400 text-white min-w-0 flex-1"
                      autoFocus
                      onBlur={(e) => finishRenaming(tab.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          finishRenaming(tab.id, e.currentTarget.value)
                        } else if (e.key === "Escape") {
                          cancelRenaming(tab.id)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate text-sm font-medium">
                      {tab.name}
                      {!tab.saved && <span className="text-blue-400 ml-1">•</span>}
                    </span>
                  )}

                  {tabs.length > 1 && !tab.isRenaming && (
                    <button
                      className="ml-2 p-1 rounded hover:bg-white/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.id)
                      }}
                    >
                      <X className="w-3 h-3 text-gray-400 hover:text-white" />
                    </button>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="bg-[#2a2a2a] border-[#404040]">
                <ContextMenuItem
                  className="text-gray-300 hover:bg-[#404040] focus:bg-[#404040]"
                  onClick={() => startRenaming(tab.id)}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-gray-300 hover:bg-[#404040] focus:bg-[#404040]"
                  onClick={() => saveTab(tab.id)}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          <button className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg ml-1" onClick={addTab}>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Button */}
        <div className="ml-auto">
          <button
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg"
            onClick={() => setShowSettings(true)}
            title="Settings (Alt + J)"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Test Paste Button */}
        <div className="ml-2">
          <button
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg text-xs"
            onClick={handlePasteWithTextarea}
            title="Test Paste (Ctrl+V)"
          >
            📋
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 border-t border-[#333333]">
        {activeTab && (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            onChange={handleContentChange}
            onMount={handleEditorDidMount}
            options={{
              theme: "futuristic-dark",
              fontSize: editorSettings.fontSize,
              fontFamily: "JetBrains Mono, Consolas, Monaco, monospace",
              lineNumbers: editorSettings.lineNumbers ? "on" : "off",
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              minimap: { enabled: editorSettings.miniMapEnabled },
              wordWrap: editorSettings.wordWrap ? "on" : "off",
              tabSize: 2,
              insertSpaces: true,
              renderWhitespace: "none",
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: false,
                indentation: true,
              },
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              renderLineHighlight: "line",
              renderLineHighlightOnlyWhenFocus: false,
              selectionHighlight: true,
              occurrencesHighlight: true,
              codeLens: false,
              folding: true,
              foldingHighlight: true,
              showFoldingControls: "mouseover",
              matchBrackets: "always",
              autoIndent: "full",
              formatOnPaste: true,
              formatOnType: false,
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: "on",
              quickSuggestions: {
                other: true,
                comments: true,
                strings: true,
              },
              quickSuggestionsDelay: 100,
              parameterHints: { enabled: true },
              hover: { enabled: true },
              contextmenu: true,
              mouseWheelZoom: true,
              multiCursorModifier: "ctrlCmd",
              accessibilitySupport: "auto",
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              wordBasedSuggestions: true,
              wordBasedSuggestionsOnlySameLanguage: false,
              suggest: {
                showWords: true,
                showSnippets: true,
                showKeywords: true,
                showFunctions: true,
                showVariables: true,
                showClasses: true,
                showModules: true,
                showProperties: true,
                showEvents: true,
                showOperators: true,
                showUnits: true,
                showValues: true,
                showConstants: true,
                showEnums: true,
                showEnumMembers: true,
                showColors: true,
                showFiles: true,
                showReferences: true,
                showFolders: true,
                showTypeParameters: true,
                showIssues: true,
                showUsers: true,
                filterGraceful: true,
                snippetsPreventQuickSuggestions: false,
                localityBonus: true,
                shareSuggestSelections: true,
                showInlineDetails: true,
                showStatusBar: true,
              },
              scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-[#2a2a2a] border-[#404040] text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Celestia Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Editor Settings */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Editor</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editorSettings.miniMapEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span>Mini Map</span>
                  </div>
                  <Switch
                    checked={editorSettings.miniMapEnabled}
                    onCheckedChange={(checked) => updateSettings("miniMapEnabled", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Line Numbers</span>
                  <Switch
                    checked={editorSettings.lineNumbers}
                    onCheckedChange={(checked) => updateSettings("lineNumbers", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Word Wrap</span>
                  <Switch
                    checked={editorSettings.wordWrap}
                    onCheckedChange={(checked) => updateSettings("wordWrap", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Font Size</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateSettings("fontSize", Math.max(10, editorSettings.fontSize - 1))}
                      className="bg-transparent border-[#404040] text-gray-300 hover:bg-[#404040] hover:text-white"
                    >
                      -
                    </Button>
                    <span className="w-8 text-center text-white">{editorSettings.fontSize}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateSettings("fontSize", Math.min(24, editorSettings.fontSize + 1))}
                      className="bg-transparent border-[#404040] text-gray-300 hover:bg-[#404040] hover:text-white"
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Saved Tabs */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Saved Tabs</h3>
              {savedTabs.length === 0 ? (
                <p className="text-gray-400">No saved tabs yet. Right-click a tab and select "Save" to save it.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {savedTabs.map((savedTab) => (
                    <div
                      key={savedTab.id}
                      className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-[#404040]"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 opacity-60" />
                          <span className="font-medium">{savedTab.name}</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">Saved: {savedTab.savedAt}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadSavedTab(savedTab)}
                          className="bg-transparent border-[#404040] text-gray-300 hover:bg-[#404040] hover:text-white"
                        >
                          Load
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteSavedTab(savedTab.id)}
                          className="bg-transparent border-red-600 text-red-400 hover:bg-red-600/20 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
