# Product Requirements Document (PRD)
# HEIC → JPG Converter Desktop App

**Nama Proyek:** HEIC2JPG  
**Versi:** 1.0.0  
**Tanggal:** 2026-10-26  
**Platform:** Windows 10/11  
**Stack:** Electron + Node.js  

---

## 1. Ringkasan Eksekutif

HEIC2JPG adalah aplikasi desktop Windows yang mengkonversi file HEIC/HEIF ke format JPG dengan **menjaga kualitas** dan **metadata EXIF** secara utuh. Aplikasi mendukung konversi satuan, batch massal, drag & drop file/folder, serta integrasi **klik kanan Windows Explorer** untuk konversi langsung tanpa membuka aplikasi.

---

## 2. Masalah yang Diselesaikan

| Masalah | Dampak |
|---------|--------|
| File HEIC dari iPhone/iPad tidak bisa dibuka di banyak software Windows | User harus convert manual satu-satu |
| Tool online mengompres ulang dan menghilangkan metadata | Kualitas turun, data lokasi/kamera hilang |
| Tool gratis biasanya lambat untuk batch besar (100+ file) | Waktu terbuang, UI freeze |
| Tidak ada tool yang terintegrasi langsung di Explorer | Workflow terganggu, harus buka app terpisah |

---

## 3. Target User

- **Fotografer** yang transfer foto dari iPhone ke PC
- **Content creator** yang butuh batch convert cepat
- **User umum** yang menerima file HEIC dan butuh JPG
- **Professional** yang butuh metadata (GPS, kamera settings) tetap utuh

---

## 4. Fitur Utama

### 4.1 Konversi HEIC → JPG

| Aspek | Spesifikasi |
|-------|-------------|
| Format input | `.heic`, `.heif` |
| Format output | `.jpg` / `.jpeg` |
| Quality default | 95 (range: 1-100, configurable) |
| Metadata | EXIF, IPTC, XMP — dipertahankan 100% |
| Color profile | ICC profile dipertahankan |
| Orientasi | EXIF orientation tag dipertahankan (tidak di-rotate secara destructive) |

### 4.2 Mode Konversi

#### A. Single File
- Pilih satu file → convert → selesai
- Melalui UI atau klik kanan Explorer

#### B. Multiple Files
- Pilih banyak file sekaligus (Ctrl+Click / Shift+Click)
- Drag & drop multiple files ke window aplikasi
- Klik kanan di Explorer → "Convert to JPG" (multi-select)

#### C. Folder
- Drag & drop folder ke window aplikasi
- Browse folder via dialog
- Opsi: scan subfolder secara rekursif (toggle on/off)

#### D. Klik Kanan Explorer (Context Menu)
- Muncul di klik kanan file `.heic` / `.heif`
- Muncul di klik kanan folder
- Support multi-select file
- Konversi berjalan di background, notifikasi saat selesai
- Menu label: **"Convert to JPG"**

### 4.3 Output Options

| Setting | Default | Opsi |
|---------|---------|------|
| Output location | Sama dengan file sumber | Custom folder |
| Naming | `{original_name}.jpg` | `{original_name}_converted.jpg`, custom prefix/suffix |
| Conflict handling | Skip jika sudah ada | Overwrite, Rename (tambah angka) |
| Delete original | Tidak | Ya (dengan konfirmasi) |
| Quality slider | 95 | 1–100 |

### 4.4 Batch Processing

| Aspek | Spesifikasi |
|-------|-------------|
| Concurrency | Worker threads (jumlah = CPU cores - 1) |
| Progress | Per-file progress bar + overall progress |
| Cancel | Bisa cancel batch kapan saja |
| Error handling | Skip file error, lanjut file berikutnya, tampilkan summary |
| Resume | Tidak perlu — skip file yang sudah ada |
| Memory | Streaming per-file, tidak load semua ke RAM |

### 4.5 UI Requirements

#### Layout
```
┌──────────────────────────────────────────────┐
│  HEIC2JPG                          [─] [□] [×]│
├──────────────────────────────────────────────┤
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │                                      │   │
│   │     📁 Drop files or folders here    │   │
│   │        or click to browse            │   │
│   │                                      │   │
│   └──────────────────────────────────────┘   │
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │ File List / Queue                    │   │
│   │ ┌────┬────────────┬──────┬────────┐  │   │
│   │ │ ✓  │ Name       │ Size │ Status │  │   │
│   │ ├────┼────────────┼──────┼────────┤  │   │
│   │ │ ☑  │ IMG_001    │ 3MB  │ ✅ Done│  │   │
│   │ │ ☑  │ IMG_002    │ 4MB  │ ⏳ ... │  │   │
│   │ │ ☐  │ IMG_003    │ 2MB  │ Queued │  │   │
│   │ └────┴────────────┴──────┴────────┘  │   │
│   └──────────────────────────────────────┘   │
│                                              │
│   Overall: ████████░░░░░░░░░  45%  12/27     │
│                                              │
│   ⚙️ Settings    [Clear] [Convert All]       │
│                                              │
├──────────────────────────────────────────────┤
│  Output: 📁 Same as source  [Change...]      │
│  Quality: ████████████░░ 95                  │
│  ☐ Scan subfolders  ☐ Delete originals       │
└──────────────────────────────────────────────┘
```

#### UX Requirements
- **Drag & drop zone** yang jelas dan besar
- **Visual feedback** saat drag hover (border highlight, animasi)
- **File queue** dengan scroll virtual (untuk 10,000+ file tidak lag)
- **Progress per file** dan **progress keseluruhan**
- **Status indicator** per file: Queued → Converting → Done / Error
- **Settings panel** collapsible di bawah
- **Dark mode** sebagai default, light mode toggle
- **Toast notification** saat batch selesai (termasuk saat minimize/background)

#### Performance UX
- UI thread **tidak boleh freeze** — semua konversi di worker thread
- File list menggunakan **virtual scrolling** (hanya render visible rows)
- Drop 10,000 file harus tetap **responsive dalam < 500ms**
- Start convert harus dimulai **< 100ms** setelah klik

---

## 5. Integrasi Windows Context Menu

### 5.1 Registrasi

Saat install (atau first launch), app meregistrasi context menu entry di Windows Registry:

```
HKCU\Software\Classes\.heic\shell\HEIC2JPG\command
HKCU\Software\Classes\.heif\shell\HEIC2JPG\command
HKCU\Software\Classes\Directory\shell\HEIC2JPG\command
```

Menggunakan `HKCU` (tidak butuh admin privilege).

### 5.2 Behavior

| Trigger | Behavior |
|---------|----------|
| Klik kanan 1 file `.heic` → "Convert to JPG" | Convert file tersebut, output di folder yang sama |
| Klik kanan beberapa file `.heic` → "Convert to JPG" | Convert semua file yang dipilih |
| Klik kanan folder → "Convert to JPG" | Scan folder untuk `.heic`, convert semua |

### 5.3 Silent Mode

Saat dipanggil via context menu:
- App bisa berjalan **tanpa window** (headless/tray mode)
- Tampilkan **progress toast/notification** di system tray
- Atau buka window kecil dengan progress bar minimal
- Selesai → **Windows toast notification** "Converted X files successfully"

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metrik | Target |
|--------|--------|
| Single file (5MB HEIC) | < 2 detik |
| Batch 100 files | < 60 detik (dengan 4-core CPU) |
| Batch 1000 files | < 10 menit |
| Memory usage | < 300MB saat batch 1000 files |
| Startup time | < 2 detik |
| UI responsiveness | 60fps, zero jank |

### 6.2 Reliability

- Crash pada 1 file **tidak** menghentikan batch
- File corrupt di-skip dengan error message yang jelas
- App crash → bisa restart dan re-drop file
- Log error ke file untuk debugging

### 6.3 Compatibility

| OS | Support |
|----|---------|
| Windows 10 (1903+) | ✅ Full |
| Windows 11 | ✅ Full |
| Windows 7/8 | ❌ Tidak didukung |
| macOS | ❌ Phase 2 (future) |
| Linux | ❌ Phase 2 (future) |

---

## 7. Technical Constraints

| Constraint | Detail |
|-----------|--------|
| JPEG adalah format lossy | Quality 95 ≈ visually lossless, tapi secara teknis tetap lossy. Ini limitasi format JPEG, bukan app. Dokumentasikan di UI. |
| HEIC decoding | Menggunakan native library (sharp + libvips atau heic-convert) |
| Metadata transfer | Harus extract dari HEIC lalu inject ke JPEG (bukan bawaan library converter) |
| Context menu Windows | Registry-based, butuh cleanup saat uninstall |

---

## 8. Out of Scope (v1.0)

- ❌ Konversi ke format lain (PNG, WebP, AVIF)
- ❌ Resize / crop / edit gambar
- ❌ Cloud/online processing
- ❌ macOS / Linux support
- ❌ Watermark
- ❌ Konversi video HEVC
- ❌ Auto-update mechanism (Phase 2)
- ❌ Multi-language UI (Phase 2)

---

## 9. Success Metrics

| Metrik | Target |
|--------|--------|
| Conversion accuracy | 100% pixel-identical at max quality |
| Metadata preservation | 100% EXIF fields preserved |
| Crash rate | < 0.1% per batch |
| User satisfaction | "It just works" |

---

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| `sharp` gagal decode HEIC tertentu | File tidak terconvert | Fallback ke `heic-convert` library |
| EXIF injection gagal | Metadata hilang | Validate sebelum & sesudah, warn user |
| Registry write gagal (permission) | Context menu tidak muncul | Graceful fallback, manual install instruction |
| File sangat besar (50MB+ HEIC) | Memory spike | Streaming processing, per-file memory limit |
| Antivirus block registry write | Context menu gagal | Dokumentasi whitelist instruction |
