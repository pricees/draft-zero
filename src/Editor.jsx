import { useState, useEffect, useRef, useCallback } from "react";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";
import "./Editor.css";

const SAVE_INTERVAL_MS = 10000;
const SAVE_KEYSTROKE_THRESHOLD = 5;
const LOCAL_STORAGE_KEY = "draftZeroFilePath";

function Editor() {
  const [text, setText] = useState("");
  const [filePath, setFilePath] = useState(null);
  const [allowCorrections, setAllowCorrections] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  const textareaRef = useRef(null);
  const keystrokeCountRef = useRef(0);
  const saveTimerRef = useRef(null);
  const textRef = useRef(text);

  // Keep textRef in sync with text state
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Save function
  const saveFile = useCallback(async (forcePath = null) => {
    const pathToUse = forcePath || filePath;
    if (!pathToUse) return;

    try {
      await writeTextFile(pathToUse, textRef.current);
      setLastSaved(new Date());
      setSaveStatus("Saved");
      keystrokeCountRef.current = 0;

      // Clear "Saved" after 2 seconds to show "Saved Xs ago"
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus("Save failed");
    }
  }, [filePath]);

  // Reset save timer
  const resetSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearInterval(saveTimerRef.current);
    }
    saveTimerRef.current = setInterval(() => {
      if (filePath) saveFile();
    }, SAVE_INTERVAL_MS);
  }, [filePath, saveFile]);

  // Trigger save based on keystroke count
  const handleKeystrokeSave = useCallback(() => {
    keystrokeCountRef.current++;
    if (keystrokeCountRef.current >= SAVE_KEYSTROKE_THRESHOLD && filePath) {
      saveFile();
      resetSaveTimer();
    }
  }, [filePath, saveFile, resetSaveTimer]);

  // Initialize: load file path and content
  useEffect(() => {
    async function init() {
      const storedPath = localStorage.getItem(LOCAL_STORAGE_KEY);

      if (storedPath) {
        try {
          const content = await readTextFile(storedPath);
          setText(content);
          setFilePath(storedPath);
          setLastSaved(new Date());
        } catch (err) {
          // File doesn't exist anymore, clear stored path
          console.log("Stored file not found, prompting for new location");
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          await promptForSaveLocation();
        }
      } else {
        await promptForSaveLocation();
      }

      setIsInitialized(true);
    }

    async function promptForSaveLocation() {
      const path = await save({
        title: "Choose where to save your writing",
        filters: [{ name: "Text", extensions: ["txt", "md"] }],
        defaultPath: "draft.txt",
      });

      if (path) {
        localStorage.setItem(LOCAL_STORAGE_KEY, path);
        setFilePath(path);
        // Create empty file
        await writeTextFile(path, "");
        setLastSaved(new Date());
      }
    }

    init();
  }, []);

  // Start save timer when file path is set
  useEffect(() => {
    if (filePath) {
      resetSaveTimer();
    }
    return () => {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current);
      }
    };
  }, [filePath, resetSaveTimer]);

  // Handle keydown for forward-only mode
  const handleKeyDown = (e) => {
    if (allowCorrections) return;

    // Block backspace and delete
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      return;
    }

    // Block cut (Cmd/Ctrl + X)
    if (e.key === "x" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      return;
    }
  };

  // Handle beforeinput for selection overwrites
  const handleBeforeInput = (e) => {
    if (allowCorrections) return;

    const textarea = textareaRef.current;
    const { selectionStart, selectionEnd } = textarea;

    // If there's a selection and this input would replace it
    if (selectionStart !== selectionEnd) {
      // Check if this is an insertion (not deletion)
      if (e.inputType === "insertText" || e.inputType === "insertFromPaste") {
        e.preventDefault();

        // Move cursor to end of selection and insert there
        const newText = text.slice(0, selectionEnd) + (e.data || "") + text.slice(selectionEnd);
        setText(newText);

        // Set cursor position after inserted text
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionEnd + (e.data?.length || 0);
        }, 0);

        handleKeystrokeSave();
      } else if (e.inputType.startsWith("delete")) {
        e.preventDefault();
      }
    }
  };

  // Handle text change
  const handleChange = (e) => {
    setText(e.target.value);
    handleKeystrokeSave();
  };

  // Calculate word count
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Format last saved time
  const getLastSavedText = () => {
    if (saveStatus === "Saved" || saveStatus === "Save failed") {
      return saveStatus;
    }
    if (!lastSaved) return "";

    const seconds = Math.floor((new Date() - lastSaved) / 1000);
    if (seconds < 5) return "Saved just now";
    if (seconds < 60) return `Saved ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `Saved ${minutes}m ago`;
  };

  // Update "Saved Xs ago" every second
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get filename from path
  const getFilename = () => {
    if (!filePath) return "No file";
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  if (!isInitialized) {
    return <div className="loading">Setting up...</div>;
  }

  if (!filePath) {
    return (
      <div className="no-file">
        <p>Please select a save location to begin writing.</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBeforeInput={handleBeforeInput}
        placeholder="Start writing..."
        autoFocus
      />
      <div className="status-bar">
        <label className="corrections-toggle">
          <input
            type="checkbox"
            checked={allowCorrections}
            onChange={(e) => setAllowCorrections(e.target.checked)}
          />
          Allow corrections
        </label>
        <div className="status-right">
          <span className="filename">{getFilename()}</span>
          <span className="word-count">{wordCount} words</span>
          <span className="save-status">{getLastSavedText()}</span>
        </div>
      </div>
    </div>
  );
}

export default Editor;
