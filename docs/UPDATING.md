# Memperbarui HEIC2JPG ke v1.1.0

1. Selesaikan atau hentikan konversi yang sedang berjalan.
2. Tutup HEIC2JPG. Jika ikonnya masih ada di system tray dekat jam Windows, klik kanan ikon tersebut lalu pilih **Quit**.
3. Jalankan `HEIC2JPG-Setup-1.1.0.exe` dari folder `release/v1.1.0`.
4. Gunakan lokasi instalasi yang sama seperti versi sebelumnya. Tidak perlu uninstall manual.
5. Buka aplikasi, lalu cek **Advanced settings**. Versi **1.1.0** ditampilkan di sana.

Installer memakai identitas aplikasi yang sama sehingga instalasi lama diperbarui, dan preferensi di folder data pengguna tetap digunakan. Foto sumber dan hasil konversi di folder foto tidak menjadi target pembaruan aplikasi.

Installer baru menyimpan status menu klik kanan sebelum uninstaller v1.0 menghapus entri lama, lalu mendaftarkan kembali menu jika sebelumnya aktif. Jika menu belum muncul, buka **Advanced settings**, matikan lalu aktifkan **Add “Convert to JPG” to right-click**. Pada Windows 11, gunakan **Show more options**.

## Progres klik kanan

Klik kanan file/folder → **Convert to JPG** otomatis memproses pilihan tersebut dan menampilkan jendela kecil 404×276 piksel di dekat sudut kanan bawah layar yang sedang dipakai. Jendela ini tidak mengambil fokus dari Explorer.

- Ikon orbit dan cahaya bergerak menandakan aktivitas; persentase dihitung dari file yang benar-benar selesai diproses.
- Nama file, tahap konversi, jumlah selesai dan waktu proses terlihat di jendela kecil.
- **Stop** menyelesaikan foto yang aktif dan menghentikan foto berikutnya. **Show app** membuka antrean lengkap untuk melanjutkan atau memeriksa hasil.
- Tombol **×** menyembunyikan progres; konversi tetap berjalan.
- Konversi berhasil berubah hijau dan jendela tersembunyi setelah 8 detik. Error atau proses yang dihentikan tetap tampil sampai ditutup.
- File asli tetap disimpan untuk semua konversi dari Explorer.

**Use compact progress window** aktif secara default. Jika dimatikan, konversi klik kanan ditampilkan melalui aplikasi utama. Pilihan Explorer tetap diproses otomatis, termasuk ketika aplikasi utama sudah terbuka; file lain yang telah menunggu di antrean tidak ikut dimulai.

Pembaruan versi ini dilakukan dengan menjalankan installer baru. Pengunduhan/pemasangan otomatis belum tersedia.
