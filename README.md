# PakPost — API Workbench

PakPost adalah REST API client berbasis web untuk mengirim request, mengelola Collection, Environment, dan berkolaborasi di Workspace. Pengujian request **Local** bisa dilakukan tanpa login; penyimpanan dan kolaborasi **Cloud** menggunakan Google Sign-In, PostgreSQL, dan role Workspace.

> **Status:** aplikasi self-hostable yang masih memerlukan pemeriksaan keamanan dan operasional sebelum dipasang sebagai layanan publik. Jangan gunakan konfigurasi Development di internet.

## Isi dokumentasi

1. [Persyaratan dan struktur proyek](#1-persyaratan-dan-struktur-proyek)
2. [Instalasi untuk development](#2-instalasi-untuk-development)
3. [Penggunaan PakPost](#3-penggunaan-pakpost)
4. [Mode Public dan Self-Hosted](#4-mode-public-dan-self-hosted)
5. [Instance Admin dan undangan](#5-instance-admin-dan-undangan)
6. [Ekstensi browser](#6-ekstensi-browser)
7. [Pengujian](#7-pengujian)
8. [Deployment dan keamanan](#8-deployment-dan-keamanan)
9. [Maintenance enkripsi](#9-maintenance-enkripsi)
10. [Troubleshooting](#10-troubleshooting)

## 1. Persyaratan dan struktur proyek

- **.NET SDK 10** untuk ASP.NET Core API, EF Core dan xUnit.
- **Bun** untuk Vite + React; Node.js 22+ diperlukan oleh beberapa script verifikasi. NPM dapat digunakan sebagai alternatif instalasi dependency frontend.
- **PostgreSQL** (contohnya NeonDB). Siapkan database/branch pengujian terpisah sebelum menjalankan migration.
- **Google OAuth Web Client ID**, dengan authorized JavaScript origin yang sesuai alamat frontend.
- **SMTP** untuk undangan email, misalnya Gmail SMTP dengan App Password.
- **Bash, Python 3** untuk script pengembangan dan build ekstensi.

```text
pakpost-api-client/
├── backend/
│   ├── src/
│   │   ├── Pakpost.Api/             # HTTP API, auth, middleware
│   │   ├── Pakpost.Application/     # CQRS, validator, kontrak
│   │   ├── Pakpost.Domain/          # Entity dan aturan domain
│   │   └── Pakpost.Infrastructure/  # EF Core, PostgreSQL, encryption, SMTP
│   ├── tests/                      # Unit, security, integration
│   └── scripts/                    # Run, migration, DB verification
├── frontend/
│   ├── src/app/                    # Workbench composition
│   ├── src/features/               # Modul fitur React
│   ├── tests/                      # Unit/contract test per fitur
│   └── e2e/                        # Playwright browser tests
└── extension/                      # Chrome/Edge dan Firefox interceptor
```

### Arsitektur singkat

Backend memverifikasi hak akses; pembatasan tombol pada frontend bukan kontrol otorisasi. User dan session di `auth`, membership/Workspace di `organization`, Collections di `collection`. Sesi browser disimpan di PostgreSQL dan dikirim sebagai **HttpOnly cookie**; jangan taruh JWT maupun session token di browser storage.

Frontend memisahkan fitur `auth`, `requests`, `collections`, `environments`, `workspace`, `realtime`, `settings`, `console`, dan `import-export`. State Workbench dibatasi per instance; data sensitif Cloud tidak dipersist sebagai cache biasa. Pengelolaan Workspace di UI memakai **Collections** serta **Members & Roles**; tabel/API Teams lama masih disimpan untuk kompatibilitas, tetapi tidak ditampilkan.

## 2. Instalasi untuk development

Jalankan perintah dari root repository kecuali disebutkan lain.

### 2.1. Backend environment

```bash
cp backend/.env.example backend/.env
openssl rand -base64 48  # Jwt__SigningKey
openssl rand -base64 32  # WorkspaceEncryption__MasterKey
openssl rand -base64 32  # EnvironmentEncryption__Key: kunci berbeda
```

Edit `backend/.env` dan isi minimal:

| Variable | Keterangan |
| --- | --- |
| `ConnectionStrings__Postgres` | Connection string PostgreSQL/Neon untuk database yang benar |
| `Jwt__SigningKey` | Secret acak; **masih dibutuhkan** untuk keamanan sesi/CSRF meski login Google-only |
| `WorkspaceEncryption__MasterKey` | Base64 32 byte untuk workspace envelope encryption; backup di luar DB |
| `WorkspaceEncryption__MasterKeyId` | ID kunci aktif, awali dengan `master-v1` |
| `EnvironmentEncryption__Key` | Base64 32 byte **berbeda** untuk environment/riwayat terenkripsi |
| `Google__ClientId` | Google OAuth Web Client ID |
| `Invitations__FrontendBaseUrl` | Base URL frontend tempat penerima membuka link undangan |
| `Invitations__Smtp__*` | Host, port, sender, username dan password SMTP |
| `Pakpost__DeploymentMode` | `SelfHosted` (default aman) atau `Public` |

`.env` dimuat dengan Bash `source`: **anggap file itu sebagai script tepercaya** dan jangan pernah commit. Semua kunci enkripsi harus stabil antar-restart; mengganti kunci tanpa prosedur rewrap dapat membuat data tidak bisa dibaca.

### 2.2. Google OAuth

Di Google Cloud Console buat OAuth client tipe **Web application**, kemudian tambahkan authorized JavaScript origin `http://127.0.0.1:5173` (atau origin localhost yang benar-benar dipakai). Client ID frontend dan backend harus sama.

```bash
cp frontend/.env.example frontend/.env
# Isi VITE_GOOGLE_CLIENT_ID dengan Web Client ID yang sama.
```

`VITE_*` diekspos ke browser, jadi **jangan masukkan `client_secret`**. Login/register via password tidak tersedia untuk penggunaan normal. `Authentication__EnableLegacyPasswordLogin` hanya untuk pemulihan akun lama yang terkontrol; biarkan `false`.

### 2.3. Build dan migration database

```bash
cd backend
dotnet tool restore
dotnet restore Pakpost.slnx
dotnet build Pakpost.slnx

dotnet ef migrations list \
  --project src/Pakpost.Infrastructure \
  --startup-project src/Pakpost.Api \
  --context PakpostDbContext
```

**Pastikan connection string menuju database/branch yang sudah disiapkan.** Backup sebelum migrasi database yang sudah berisi data. Review SQL migrasi yang pending dengan `dotnet ef migrations script` (pilih rentang migration sesuai riwayat DB). Setelah review:

```bash
./scripts/apply-migrations.sh --apply
```

Script tidak melakukan reset database. Jangan memakai script `init.sh` untuk mengulang `InitialCreate` jika repository sudah mempunyai rangkaian migration lengkap.

### 2.4. Menjalankan aplikasi

Terminal 1:

```bash
cd backend
./scripts/run.sh
# API http://127.0.0.1:5080
```

Terminal 2:

```bash
cd frontend
bun install
bun run dev
# UI http://127.0.0.1:5173
```

Proxy Vite meneruskan `/api`, `/hubs` (termasuk WebSocket), dan `/health` ke `http://127.0.0.1:5080`. Jika port backend berubah, sesuaikan `frontend/vite.config.js`. Gunakan origin yang konsisten untuk pengujian cookie.

Cek kesehatan API:

```bash
curl -i http://127.0.0.1:5080/health
```

## 3. Penggunaan PakPost

### REST API Workbench

1. Buka PakPost; mode **Local** dapat digunakan tanpa login.
2. Pilih HTTP method, masukkan URL, lalu isi query parameter, header, authorization dan body sesuai kebutuhan.
3. Tekan **Send**, lalu lihat status, durasi, headers, dan response body.
4. Simpan request ke Collection Local atau login Google untuk menggunakan Cloud Workspace.
5. Gunakan Environment, collection variables dan placeholder untuk nilai yang sering berubah.

Fitur lain meliputi impor cURL/Postman/OpenAPI, ekspor Collection, folder bertingkat, request revision/history, response examples, Runner, code generation, dan script pre-request/post-response yang kompatibel dengan banyak pola `pm.*` Postman. Script pengguna dijalankan dalam sandbox; jangan menyimpan rahasia produksi tanpa mengevaluasi akses jaringan dan kebijakan ekstensi.

### Cloud Workspace dan kolaborasi

Login lewat **Continue with Google**. Sesi memakai HttpOnly cookie dan dipulihkan setelah refresh; pilihan Local/Cloud dan Workspace terakhir disimpan per akun tanpa menyimpan kredensial. Buat Workspace jika kebijakan instalasi mengizinkan, lalu gunakan **Members & Roles** untuk mengundang atau memberi peran. Founder adalah pemilik Workspace, sedangkan role Workspace berlaku hanya untuk Workspace tersebut.

Email undangan Workspace memakai HTML **Blueprint Courier** dan link sekali pakai yang berlaku tujuh hari. Request Cloud mempunyai revision/concurrency guard: jika orang lain lebih dulu menyimpan versi baru, review perbedaan *My Draft vs Latest Cloud* sebelum mengambil field dan menyimpan ulang.

### Account & Security

Klik avatar → **Security & sessions** untuk melihat atau mencabut sesi yang aktif. **Sign out** berada di menu avatar dan memerlukan konfirmasi. Bila memakai Google, foto profil digunakan jika tersedia; jika tidak, avatar inisial ditampilkan.

## 4. Mode Public dan Self-Hosted

Atur **sebelum menjalankan API** melalui `backend/.env`:

```dotenv
# Pilih SATU:
Pakpost__DeploymentMode='Public'
# atau
Pakpost__DeploymentMode='SelfHosted'
```

| Kebijakan | `Public` | `SelfHosted` |
| --- | --- | --- |
| Login browser | Google | Google |
| Membuat Workspace | Semua akun Google terverifikasi | Instance Admin / user dengan izin Workspace Creator |
| Kuota per Workspace | **10 kursi**, termasuk Founder dan pending invitation yang memenuhi syarat | **Tanpa batas anggota** |
| Batas jumlah Workspace per user | Tidak ada limit global yang diimplementasikan | Tidak ada limit global |
| Hak akses Collection/Environment | Role per Workspace | Role per Workspace |

Untuk Public, 10 kursi dihitung dari anggota aktif ditambah undangan pending unik yang belum kedaluwarsa/dicabut. Backend melakukan pengecekan kuota dan penguncian transaksi saat mengundang, menambahkan, dan menerima anggota. Self-Hosted tidak membatasi jumlah anggota. **Instance Admin tidak otomatis dapat membaca isi atau secret Workspace orang lain.**

Mengubah mode tidak menghapus Workspace yang sudah ada. Lakukan perubahan kebijakan secara terencana dan uji ulang alur undangan/kuota.

## 5. Instance Admin dan undangan

### Bootstrap satu Instance Admin (Self-Hosted)

Pengguna yang ditunjuk **harus sudah login Google sekali** agar identitasnya ada di database. Dengan akses DBA terbatas, pastikan alamat email, Google identity dan UUID pengguna benar, kemudian set status Admin:

```sql
SELECT "Id", "Email", "IsSuperAdmin", "IsDisabled"
FROM auth.users
WHERE "Email" = 'ADMIN_EMAIL_HERE';

-- Jalankan hanya setelah identitas dan database target dipastikan.
UPDATE auth.users
SET "IsSuperAdmin" = TRUE, "UpdatedAt" = NOW()
WHERE "Id" = 'VERIFIED_USER_UUID_HERE'::uuid
  AND "IsDisabled" = FALSE;
```

Login ulang, lalu buka **Settings → Instance admin**. Admin dapat mencari user dan **Grant/Revoke Workspace Creator** tanpa memasukkannya ke Workspace lain.

### Mengundang Workspace Creator baru

Jika email belum terdaftar, cari alamat lengkap di Instance Admin lalu pilih **Invite via email**. Sistem mengirim template email PakPost; penerima login Google dengan **email yang sama** dan mengaktifkan izin Workspace Creator melalui link undangan.

- Undangan bukan keanggotaan Workspace, hanya pemberian izin instance.
- Token acak hanya disimpan sebagai hash; kedaluwarsa tujuh hari dan sekali pakai.
- Undangan pending dapat di-*resend* (token berubah) atau di-*revoke*.
- Wrong-email, expired/revoked, dan penggunaan ulang harus ditolak backend.

Pastikan `Invitations__FrontendBaseUrl` menuju origin HTTPS yang benar di luar localhost. Uji delivery SMTP di Gmail/Outlook sebelum membuka instalasi untuk pengguna sungguhan.

## 6. Ekstensi browser

Ekstensi **PakPost Interceptor** memungkinkan browser mengirim request ke destination yang disetujui, termasuk endpoint LAN/VPN yang memang dapat dijangkau browser. Ekstensi tidak membuat VPN baru, tidak mengabaikan TLS, dan tidak otomatis memberi akses ke semua host.

Build dari root:

```bash
bash extension/build.sh
```

Hasilnya berada di `extension/dist/chrome` dan `extension/dist/firefox`.

**Chrome/Edge:** buka `chrome://extensions` (atau `edge://extensions`), aktifkan Developer Mode, pilih **Load unpacked**, arahkan ke `extension/dist/chrome`, lalu pin ekstensi.

**Firefox:** buka `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pilih `extension/dist/firefox/manifest.json`. Instalasi sementara akan hilang saat browser di-restart.

Di popup ekstensi, tambahkan **Allowed PakPost Origins** (alamat website PakPost, bukan destination API). Setelah menyetujui izin browser, pilih:

- **Specified Destinations** (default): *Scan this PakPost tab*, review host yang ditemukan, lalu *Grant selected destinations*, atau paste beberapa URL sekaligus.
- **Allow All**: secara eksplisit minta izin wildcard HTTP/HTTPS, jika memang dibolehkan kebijakan perangkat.

Refresh tab PakPost, lalu buka **Settings → Interceptor → Browser Extension → Check connection**. Izin destination berlaku pada origin termasuk port; jangan menambahkan setiap endpoint satu per satu. Untuk membuat paket rilis unsigned: `bash extension/release.sh`. Paket Firefox tetap harus ditandatangani melalui prosedur Mozilla/enterprise untuk instalasi permanen; ZIP/XPI yang diunduh manual **tidak menyediakan auto-update**.

**Keamanan:** ekstensi memeriksa origin pemanggil, origin tujuan, method, izin browser, dan header terlarang; cookies tidak ikut terkirim otomatis dan redirect diblokir. Jangan pernah mengizinkan domain PakPost tak tepercaya mengontrol ekstensi, terlebih jika sudah memiliki izin akses API internal.

## 7. Pengujian

Test **dipisahkan berdasarkan fitur**, tidak digabung dalam satu file besar. Nama test menggambarkan perilaku yang dilindungi, bukan versi rilis (`vXX`). Pemindahan folder/rename test tidak mengubah assertion atau data produksi.

### Frontend

```bash
cd frontend
bun run verify:imports
bun run test                   # Unit + source-contract tests
bun run build
bun run test:e2e              # Playwright memakai dist/ hasil build
```

Untuk E2E tertentu: `bun run test:e2e -- e2e/accountSecurity.spec.js`.

Folder `frontend/tests/` mencakup `architecture`, `backend-contract`, `auth`, `collections`, `console`, `environments`, `network`, `realtime`, `requests`, dan `workspace`; browser E2E terpisah di `frontend/e2e/`.

### Backend

```bash
cd backend
dotnet build Pakpost.slnx
dotnet test Pakpost.slnx
dotnet run --project tests/Pakpost.SecurityChecks
```

Test .NET dikelompokkan menurut domain di `tests/Pakpost.UnitTests/`. SecurityChecks menguji aturan authorization dan pengamanan request, tanpa migrasi database sungguhan.

### Integration tests (PostgreSQL)

**Wajib database disposable** dengan nama `pakpost_integration_*`. Jangan arahkan ke Neon produksi atau database bersama. Buat `backend/.env.integration` yang berisi connection string test, encryption keys test, serta:

```dotenv
PAKPOST_TEST_POSTGRES='Host=localhost;Port=5432;Database=pakpost_integration_local;Username=postgres;Password=TEST_PASSWORD'
PAKPOST_ALLOW_TEST_MIGRATIONS='YES_DISPOSABLE_DB'
```

Lalu dari root jalankan:

```bash
./backend/scripts/verify-postgres-integration.sh
```

Tes ini menerapkan migration pada DB disposable, menguji transaksi/rollback serta concurrency, dan **tidak otomatis menghapus database**. Hapus database uji secara terpisah setelah selesai.

## 8. Deployment dan keamanan

**Sebelum Public:**

- Gunakan HTTPS dan `Secure` HttpOnly cookie, konfigurasi trusted reverse proxy, CORS origin eksplisit, CSRF protection, dan WebSocket/SignalR origin yang dibatasi.
- Atur Google OAuth authorized JavaScript origins ke domain frontend production.
- Pindahkan kunci, connection string, dan password SMTP ke secret manager; jangan pakai `.env.example` sebagai kredensial nyata.
- Batasi egress jaringan API pada firewall/infrastructure. Proxy HTTP anonim butuh rate limiting dan perlindungan abuse; jangan aktifkan `Proxy__AllowPrivateNetworks=true` pada instalasi yang dapat dijangkau internet.
- Uji session revocation, workspace isolation, keamanan secret, email delivery, kuota dan undangan, termasuk request paralel.
- Review seluruh EF migration terhadap branch DB yang benar, buat backup, dan sediakan prosedur restore.
- Paket browser extension untuk distribusi publik memerlukan proses publishing dan permission review tersendiri.

PakPost memakai **server-side envelope encryption**, bukan end-to-end encryption; backend yang memegang kunci tetap dapat mendekripsi data setelah authorization. Kolom penting request/variable terenkripsi; metadata untuk index/listing seperti nama, method, dan timestamp bisa tetap plaintext. Jangan menulis request secret, token, scripts atau body ke log. Audit akses role tetap dijalankan di backend.

## 9. Maintenance enkripsi

**Jangan rotasi `WorkspaceEncryption__MasterKey` hanya dengan mengganti `.env`.** Master key dipakai untuk membuka wrapped Workspace DEK di PostgreSQL. Jika kehilangan kunci, data Workspace terenkripsi mungkin tidak bisa dipulihkan. Simpan backup kunci secara terpisah dari backup database.

Untuk rotasi master key secara offline:

1. Backup DB dan kedua versi kunci. Uji semua langkah pada clone disposable terlebih dahulu. Hentikan **semua** API/worker yang bisa menulis Workspace.
2. Tentukan jumlah Workspace dan nama database yang tepat. Siapkan master key baru (Base64 32 byte).
3. Masukkan secret secara interaktif, tanpa merekamnya di shell history atau log:

   ```bash
   read -rsp 'Old master key (Base64): ' WorkspaceRotation__OldMasterKey; echo
   read -rsp 'New master key (Base64): ' WorkspaceRotation__NewMasterKey; echo
   export WorkspaceRotation__OldMasterKey WorkspaceRotation__NewMasterKey
   export WorkspaceRotation__OldMasterKeyId='master-v1'
   export WorkspaceRotation__NewMasterKeyId='master-v2'
   export WorkspaceRotation__ExpectedWorkspaces='3'  # GANTI dengan jumlah terverifikasi
   backend/scripts/rotate-workspace-master-key.sh --dry-run --expect-database YOUR_DB_NAME
   ```

4. Setelah dry-run berhasil dan backup teruji, semua writer **tetap mati**; jalankan `backend/scripts/rotate-workspace-master-key.sh --execute --expect-database YOUR_DB_NAME`.
5. Hanya setelah transaksi berhasil, update **kedua** setting `WorkspaceEncryption__MasterKey` dan `WorkspaceEncryption__MasterKeyId` ke nilai baru, restart API, lalu verifikasi data lama dan Workspace baru. Hapus export secret dari shell dengan `unset WorkspaceRotation__OldMasterKey WorkspaceRotation__NewMasterKey`.

Operasi ini mentransaksikan rewrap DEK; tidak mengubah `EnvironmentEncryption__Key`. Setelah rotasi DB berhasil, **jangan rollback konfigurasi ke key lama begitu saja**; lakukan reverse rotation yang diuji jika perlu. Proses ini memerlukan downtime terencana.

## 10. Troubleshooting

| Masalah | Pemeriksaan |
| --- | --- |
| Google login gagal | Client ID backend/frontend sama, authorized origin tepat, Google Identity script dapat dimuat |
| Cookie hilang | Origin/port yang dipakai, HTTPS di production, reverse proxy dan atribut `Secure`/`SameSite` |
| Cloud kembali ke Local setelah refresh | Pastikan sesi di `/api/auth/session` valid dan build frontend terbaru terpakai |
| HTTP 401/403 | Session expired/revoked, role Workspace, izin Creator, atau CSRF proof |
| Tidak boleh membuat Workspace (SelfHosted) | Grant Workspace Creator via Settings → Instance admin, lalu refresh user/session |
| Invitation tidak masuk | SMTP host/port, sender, App Password, spam folder, `Invitations__FrontendBaseUrl` |
| `dotnet ef migrations` gagal | Cek DB/branch, daftar migration pending, dan SQL yang dihasilkan; jangan reset data sembarangan |
| Playwright gagal setelah patch CSS | Jalankan `bun run build` **sebelum** `bun run test:e2e`, karena E2E memakai Vite preview dari `dist/` |
| Ekstensi `Not connected` | Approve origin PakPost, izin browser, refresh tab, lalu Check connection |
| `Destination not allowed` | Tambahkan origin API dengan scheme dan port di Specified Destinations, atau cek izin Allow All |
| API internal tidak bisa diakses | Pastikan browser memiliki VPN/DNS/TLS ke tujuan; ekstensi tidak mengganti kebijakan jaringan |

---

Dokumentasi ini adalah **sumber tunggal** instalasi dan penggunaan PakPost. File implementasi, migration EF Core, konfigurasi, dan test tetap berada di folder masing-masing; catatan fase/refactor/performance historis tidak disimpan sebagai dokumentasi pengguna.
