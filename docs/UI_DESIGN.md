# UI/UX Design Specification
# HEIC2JPG Converter

---

## 1. Design Philosophy

- **Minimal but powerful** — satu screen, semua fitur terlihat
- **Dark-first** — dark mode sebagai default (photographer-friendly)
- **Zero learning curve** — drag & drop, done
- **Non-blocking** — UI selalu responsive, semua processing di background
- **Feedback-rich** — setiap aksi punya visual feedback

---

## 2. Color System

### Dark Theme (Default)

```css
/* Background layers */
--bg-primary:     #0f0f13;     /* Window background */
--bg-secondary:   #18181f;     /* Cards, panels */
--bg-tertiary:    #1e1e28;     /* Hover states, dropzone */
--bg-elevated:    #252530;     /* Elevated elements */

/* Accent */
--accent-primary:   #6c5ce7;   /* Primary actions */
--accent-hover:     #7c6ef7;   /* Hover state */
--accent-pressed:   #5a4bd6;   /* Pressed state */
--accent-subtle:    #6c5ce720;  /* Backgrounds with accent tint */

/* Status */
--status-success:   #00cec9;   /* Conversion done */
--status-error:     #ff6b6b;   /* Error / failed */
--status-warning:   #feca57;   /* Warning */
--status-progress:  #6c5ce7;   /* Converting / in-progress */
--status-queued:    #636e72;   /* Waiting in queue */

/* Text */
--text-primary:     #e8e8ed;   /* Primary text */
--text-secondary:   #8b8b9e;   /* Secondary/muted text */
--text-tertiary:    #5a5a6e;   /* Disabled, placeholders */

/* Borders */
--border-default:   #2a2a38;   /* Default borders */
--border-focus:     #6c5ce7;   /* Focus rings */
--border-dropzone:  #6c5ce750; /* Dropzone border */
```

### Light Theme

```css
--bg-primary:     #f8f9fa;
--bg-secondary:   #ffffff;
--bg-tertiary:    #f0f1f3;
--bg-elevated:    #ffffff;

--accent-primary:   #5f3dc4;
--text-primary:     #1a1a2e;
--text-secondary:   #6b7280;
--border-default:   #e5e7eb;
```

---

## 3. Typography

```css
/* Font stack */
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Scale */
--font-xs:    0.75rem;   /* 12px — status labels */
--font-sm:    0.8125rem; /* 13px — secondary info */
--font-base:  0.875rem;  /* 14px — body text */
--font-md:    1rem;      /* 16px — section headers */
--font-lg:    1.25rem;   /* 20px — page title */
--font-xl:    1.5rem;    /* 24px — hero text */

/* Weights */
--font-normal:  400;
--font-medium:  500;
--font-semibold: 600;
--font-bold:    700;
```

---

## 4. Layout Specification

### Window

```
Min size:  480 × 600 px
Default:   720 × 800 px
Max size:  Unlimited (responsive)
Title bar: Custom (frameless window)
```

### Layout Grid

```
┌─────────────────────────────────────┐
│ Title Bar (32px)                     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Drop Zone (160px min)           │ │  padding: 16px
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ File Queue (flex: 1)            │ │  flex grow
│ │                                 │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Progress Bar (48px)             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Action Bar (56px)               │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Settings Panel (collapsible)    │ │  0px collapsed
│ │                                 │ │  ~200px expanded
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 5. Component Specs

### 5.1 Drop Zone

**States:**

| State | Visual |
|-------|--------|
| Default | Dashed border (`--border-dropzone`), file icon, "Drop files or folders here" text |
| Hover (drag over) | Solid border (`--accent-primary`), pulsing glow, background tint, "Release to add files" |
| Active (files processing) | Collapsed to smaller height, "Drop more files to add" |
| Disabled (during conversion) | Grayed out, "Conversion in progress" |

**Specs:**
```
Height:           160px (default), 80px (collapsed when files added)
Border:           2px dashed
Border radius:    12px
Padding:          24px
Icon:             📁 folder icon, 48px
Text primary:     "Drop files or folders here"
Text secondary:   "or click to browse"
Transition:       all 300ms ease
```

**Interaction:**
- Click → opens file picker dialog (with folder option)
- Drop files → adds to queue
- Drop folder → scans for HEIC files, adds to queue
- Drag hover animation: border pulse + background gradient shift

---

### 5.2 File Queue

**Row specs:**
```
Height:        44px per row
Padding:       0 12px
Columns:       [Checkbox 32px] [Icon 28px] [Name flex] [Size 72px] [Status 80px]
```

**Row states:**

| State | Background | Status Icon | Status Text |
|-------|-----------|-------------|-------------|
| Queued | transparent | ⏳ (gray) | "Queued" |
| Converting | `--accent-subtle` | 🔄 (animated spin) | "Converting..." |
| Done | `--status-success` 5% opacity | ✅ (green) | "Done" |
| Error | `--status-error` 5% opacity | ❌ (red) | "Error" (hover for details) |
| Skipped | transparent | ⏭️ (gray) | "Skipped" |
| Cancelled | transparent | 🚫 (gray) | "Cancelled" |

**Features:**
- Virtual scrolling: only render visible rows + buffer
- Column header with sort (by name, size, status)
- Multi-select with Shift+Click, Ctrl+Click
- Right-click context menu: "Remove", "Open in Explorer", "Retry"
- Empty state: illustration + "No files added yet"

---

### 5.3 Progress Bar

**Layout:**
```
┌───────────────────────────────────────┐
│  ████████████░░░░░░░░  45%            │
│  12 / 27 files  •  ETA: 00:32        │
└───────────────────────────────────────┘
```

**Specs:**
```
Height:           48px
Bar height:       6px
Bar radius:       3px
Track color:      --bg-tertiary
Fill color:       --accent-primary (gradient to --status-success at 100%)
Fill transition:  width 200ms ease-out
```

**States:**
- Idle: hidden (0 height, collapsed)
- Converting: visible with animated fill
- Complete: full bar, green color, "✅ All files converted"
- Partial error: full bar, yellow tint, "⚠ 25/27 converted, 2 errors"
- Cancelled: partial fill, gray, "Cancelled at 45%"

---

### 5.4 Action Bar

```
┌─────────────────────────────────────────┐
│  ⚙ Settings                [Clear]  [Convert All]  │
└─────────────────────────────────────────┘
```

**Buttons:**

| Button | Style | State |
|--------|-------|-------|
| Convert All | Primary (accent bg, white text) | Disabled when queue empty |
| Clear | Ghost (no bg, text only) | Disabled when queue empty |
| Cancel | Danger (red outline) | Only visible during conversion |
| Settings toggle | Ghost with gear icon | Toggle settings panel |

**Button specs:**
```
Height:        36px
Padding:       0 20px
Border radius: 8px
Font:          --font-base, --font-semibold
Transition:    background 150ms, transform 100ms
```

---

### 5.5 Settings Panel

**Layout (expanded):**
```
┌─────────────────────────────────────────┐
│  Output                                 │
│  ○ Same as source file                  │
│  ○ Custom folder: [C:\Photos\JPG] [📁]  │
│                                         │
│  Quality                                │
│  ──────────●──── 95                     │
│  "Higher = better quality, larger file" │
│                                         │
│  Options                                │
│  ☐ Scan subfolders recursively          │
│  ☐ Delete originals after conversion    │
│  ☐ Preserve file timestamps             │
│                                         │
│  File Conflicts                         │
│  [▼ Skip existing files            ]    │
│                                         │
│  Context Menu                           │
│  ☑ Enable "Convert to JPG" in Explorer  │
│  ☑ Silent mode (tray only)              │
│  Status: ✅ Registered                   │
└─────────────────────────────────────────┘
```

**Specs:**
```
Max height:     300px (scrollable if needed)
Padding:        16px 20px
Background:     --bg-secondary
Border-top:     1px solid --border-default
Transition:     max-height 300ms ease, opacity 200ms
```

---

## 6. Animations

### Drop Zone Hover

```css
@keyframes dropzone-pulse {
  0% { border-color: var(--accent-primary); box-shadow: 0 0 0 0 var(--accent-subtle); }
  50% { border-color: var(--accent-hover); box-shadow: 0 0 20px 4px var(--accent-subtle); }
  100% { border-color: var(--accent-primary); box-shadow: 0 0 0 0 var(--accent-subtle); }
}
/* Duration: 1.5s, infinite during drag hover */
```

### File Added (Slide In)

```css
@keyframes file-slide-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Duration: 200ms, ease-out */
```

### Converting Spinner

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
/* Duration: 800ms, linear, infinite */
```

### Conversion Complete (Checkmark)

```css
@keyframes checkmark-pop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
/* Duration: 300ms, ease-out */
```

### Progress Bar Fill

```css
.progress-fill {
  transition: width 200ms ease-out;
  background: linear-gradient(90deg, var(--accent-primary), var(--status-success));
}
```

### Settings Panel Toggle

```css
.settings-panel {
  transition: max-height 300ms ease, opacity 200ms ease;
  overflow: hidden;
}
.settings-panel.collapsed { max-height: 0; opacity: 0; }
.settings-panel.expanded { max-height: 300px; opacity: 1; }
```

---

## 7. Responsive Behavior

| Window Width | Behavior |
|-------------|----------|
| < 480px | Not supported (min width) |
| 480-600px | Compact mode: smaller dropzone, condensed file rows |
| 600-900px | Default layout |
| > 900px | File queue gets more horizontal space, wider rows |

| Window Height | Behavior |
|--------------|----------|
| < 600px | Not supported (min height) |
| 600-700px | Dropzone collapses to 80px, settings hidden |
| > 700px | Full layout |

---

## 8. System Tray (Silent Mode)

### Tray Icon States
- **Idle:** App icon (static)
- **Converting:** App icon with small progress overlay
- **Complete:** App icon with green checkmark (5 seconds)
- **Error:** App icon with red exclamation (until dismissed)

### Tray Context Menu
```
Show HEIC2JPG
─────────────
Converting: 12/27 files...
Cancel Conversion
─────────────
Settings
Quit
```

### Toast Notifications
```
┌──────────────────────────────┐
│ ✅ HEIC2JPG                   │
│ Converted 27 files            │
│ Output: C:\Photos\            │
│                   [Open]      │
└──────────────────────────────┘
```

---

## 9. Empty States

### No Files Added
```
┌──────────────────────────────┐
│                              │
│         📁                   │
│   No files added yet         │
│                              │
│   Drop HEIC files here or    │
│   click to browse            │
│                              │
└──────────────────────────────┘
```

### No HEIC Files Found (in dropped folder)
```
Toast: "No HEIC files found in the selected folder"
```

### All Conversions Complete
```
┌──────────────────────────────┐
│  ✅ All 27 files converted    │
│  Time: 00:45                 │
│  Output: C:\Photos\          │
│                              │
│  [Open Output Folder]        │
└──────────────────────────────┘
```

---

## 10. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open file dialog |
| `Ctrl+Shift+O` | Open folder dialog |
| `Ctrl+Enter` | Start conversion |
| `Escape` | Cancel conversion |
| `Ctrl+A` | Select all files |
| `Delete` | Remove selected files |
| `Ctrl+,` | Toggle settings panel |
| `F5` | Retry failed files |
| `Ctrl+L` | Clear file queue |
