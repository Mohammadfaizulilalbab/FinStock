# White-box Test Document
## FinStock (Sistem Manajemen Keuangan & Persediaan UMKM)

| Version | Author | Description |
| :---: | :---: | :--- |
| **1.0** | **Raditya Zeliq Amanta (202310370311426)** | Dokumen Hasil Pengujian White-Box Testing (Statement Coverage, Branch Coverage, Basis Path Testing) dan Implementasi Unit Testing dengan Test Doubles (Jest) pada Seluruh 8 Fitur FinStock |

---

## 1. Statement Coverage Analysis (Pre-Lab Manual Analysis)

### Function: `authService.login(username, password)`
Lokasi berkas sumber: `backend/src/modules/auth/auth.service.js` (Baris 22–78)

```javascript
/**
 * S1: Query pencarian data pengguna ke database berdasarkan username
 */
const pengguna = await prisma.pengguna.findUnique({
  where: { username },
});

/**
 * S2: Evaluasi keberadaan pengguna (Decision Point 1)
 */
if (!pengguna) {
  // S3: Lempar exception HTTP 401 jika username tidak terdaftar
  throw { status: 401, message: 'Username atau password salah', code: 'INVALID_CREDENTIALS' };
}

/**
 * S4: Evaluasi status keaktifan akun pengguna (Decision Point 2)
 */
if (pengguna.status === 'NONAKTIF') {
  // S5: Lempar exception HTTP 403 jika akun dinonaktifkan
  throw { status: 403, message: 'Akun Anda telah dinonaktifkan. Hubungi admin.', code: 'ACCOUNT_DISABLED' };
}

/**
 * S6: Evaluasi kecocokan password menggunakan hash bcrypt (Decision Point 3)
 */
const isPasswordValid = await bcrypt.compare(password, pengguna.password);
if (!isPasswordValid) {
  // S7: Lempar exception HTTP 401 jika password salah
  throw { status: 401, message: 'Username atau password salah', code: 'INVALID_CREDENTIALS' };
}

/**
 * S8: Inisialisasi variabel permissions dan penetapan default untuk role karyawan
 */
let userPermissions = pengguna.permissions;
const defaultKaryawanPermissions = ['/', '/kasir', '/transaksi', '/menu', '/pengaturan'];

/**
 * S9: Evaluasi kondisi auto-sync permissions untuk karyawan baru (Decision Point 4)
 */
if (pengguna.role === 'KARYAWAN' && (!userPermissions || !Array.isArray(userPermissions) || userPermissions.length === 0)) {
  userPermissions = defaultKaryawanPermissions;
  try {
    // S10: Update permissions default ke database
    await prisma.pengguna.update({
      where: { id: pengguna.id },
      data: { permissions: defaultKaryawanPermissions },
    });
  } catch (err) {
    // S11: Fallback logging jika update database gagal (resilience)
    console.warn('Gagal sinkronisasi permissions ke database:', err.message);
  }
}

/**
 * S12: Penerbitan JSON Web Token (JWT) dengan klaim identitas & permissions
 */
const token = signToken({
  id: pengguna.id,
  username: pengguna.username,
  role: pengguna.role,
  permissions: userPermissions || [],
});

/**
 * S13: Pencatatan rekam jejak aktivitas login pengguna ke tabel LogAktivitas
 */
await prisma.logAktivitas.create({
  data: {
    penggunaId: pengguna.id,
    aksi: 'Login ke sistem',
  },
});

/**
 * S14: Sanitasi data pengguna agar hash password tidak bocor ke sisi klien
 */
const { password: _, ...userData } = pengguna;
userData.permissions = userPermissions;

/**
 * S15: Mengembalikan token autentikasi dan data profil pengguna
 */
return { token, user: userData };
```

---

### Target: 100% Statement Coverage
- **Total Executable Statements**: **15 Statements** ($S_1, S_2, S_3, S_4, S_5, S_6, S_7, S_8, S_9, S_10, S_11, S_12, S_13, S_14, S_15$)

| ID Test | Input (`username`, `password`) & Kondisi Mock | Expected Output / Behavior | Covered Statements | Cumulative Coverage |
| :---: | :--- | :--- | :--- | :--- |
| **TC-01** | `user="unknown"`, `pass="pass123"`<br>*(Prisma: `null`)* | `throws 401 INVALID_CREDENTIALS` | S1, S2, S3 | {S1, S2, S3} |
| **TC-02** | `user="karyawan_nonaktif"`, `pass="pass123"`<br>*(Prisma: user status `NONAKTIF`)* | `throws 403 ACCOUNT_DISABLED` | S1, S2, S4, S5 | {S1, S2, S3, **S4**, **S5**} |
| **TC-03** | `user="owner"`, `pass="salah123"`<br>*(Prisma: user AKTIF, bcrypt: `false`)* | `throws 401 INVALID_CREDENTIALS` | S1, S2, S4, S6, S7 | {S1, S2, S3, S4, S5, **S6**, **S7**} |
| **TC-04** | `user="owner"`, `pass="owner123"`<br>*(Prisma: user OWNER, role `OWNER`, permissions lengkap)* | `return { token, user }` (Token JWT diterbitkan, password disanitasi) | S1, S2, S4, S6, S8, S9, S12, S13, S14, S15 | {S1..S9, **S12**, **S13**, **S14**, **S15**} |
| **TC-05** | `user="budi_kasir"`, `pass="pass123"`<br>*(Prisma: user KARYAWAN, permissions `null`)* | `return { token, user }` (Auto-sync default permissions sukses di-update ke DB) | S1, S2, S4, S6, S8, S9, S10, S12, S13, S14, S15 | {S1..S10, S12..S15} |
| **TC-06** | `user="sari_kasir"`, `pass="sari123"`<br>*(Prisma update permissions gagal / reject)* | `return { token, user }` & `console.warn` tertrigger di catch block | S1, S2, S4, S6, S8, S9, S10, S11, S12, S13, S14, S15 | {S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, **S11**, S12, S13, S14, S15} |

| Statements Covered After All Test Cases | {S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15} |
| :--- | :--- |
| **Coverage Percentage** | **(15 / 15) * 100% = 100%** |

---

## 2. Branch Coverage & Basis Path Analysis

### Identifikasi Decision Points & Branches:
1. **Decision Point 1 (`if (!pengguna)`)**:
   - **B1 (True)**: Pengguna tidak ditemukan $\rightarrow$ Lari ke $S_3$.
   - **B2 (False)**: Pengguna ditemukan $\rightarrow$ Lanjut ke $S_4$.
2. **Decision Point 2 (`if (pengguna.status === 'NONAKTIF')`)**:
   - **B3 (True)**: Akun berstatus nonaktif $\rightarrow$ Lari ke $S_5$.
   - **B4 (False)**: Akun aktif $\rightarrow$ Lanjut ke $S_6$.
3. **Decision Point 3 (`if (!isPasswordValid)`)**:
   - **B5 (True)**: Password salah $\rightarrow$ Lari ke $S_7$.
   - **B6 (False)**: Password valid $\rightarrow$ Lanjut ke $S_8$.
4. **Decision Point 4 (`if (role === 'KARYAWAN' && permissions kosong)`)**:
   - **B7 (True)**: Karyawan tanpa permissions $\rightarrow$ Auto-assign default permissions ($S_9 \rightarrow S_{10}$).
   - **B8 (False)**: Akun Owner atau Karyawan yang sudah memiliki permissions $\rightarrow$ Langsung lanjut ke pembuatan token ($S_{12}$).

- **Total Decision Branches**: **8 Branches** ($B_1$ s/d $B_8$)
- **Cyclomatic Complexity $V(G)$**:
  $$V(G) = \text{Decision Points} + 1 = 4 + 1 = 5 \text{ Independent Paths}$$
  *(Ditambah 1 Exception Handling Path untuk blok `try-catch` $S_{11}$, sehingga terdapat 6 skenario komprehensif).*

### Branch Coverage Table:

| ID Test | Decision Branches Evaluated | Covered Branches | Status |
| :---: | :--- | :--- | :---: |
| **TC-01** | DP1: True | {B1} | Validated |
| **TC-02** | DP1: False, DP2: True | {B2, B3} | Validated |
| **TC-03** | DP1: False, DP2: False, DP3: True | {B2, B4, B5} | Validated |
| **TC-04** | DP1: False, DP2: False, DP3: False, DP4: False | {B2, B4, B6, B8} | Validated |
| **TC-05** | DP1: False, DP2: False, DP3: False, DP4: True | {B2, B4, B6, B7} | Validated |
| **TC-06** | Eksekusi Fallback Catch Block pada Sub-alur Auto-Sync | {B2, B4, B6, B7, Exception-Handler} | Validated |

- **Total Executable Branches**: **8 Branches**
- **Executed Branches**: **8 Branches** ($B_1, B_2, B_3, B_4, B_5, B_6, B_7, B_8$)
- **Branch Coverage Percentage**: **(8 / 8) * 100% = 100%**

---

## 3. Practicum: Unit/Integration Testing (Lab Session 8 Fitur)

Pengujian Unit Test diimplementasikan untuk seluruh **8 Fitur FinStock** pada sisi backend service:

| No | Judul / Fitur | Berkas Test & Unit yang Diuji | Deskripsi Implementasi & Verifikasi | Hasil |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Register** | `backend/tests/unit/auth.register.test.js`<br>Unit: `authService.register()` | Memvalidasi input wajib, keunikan username, role pengguna (OWNER/KARYAWAN), hashing kata sandi (Bcrypt), dan penetapan hak akses default. | **4 Passed** (100%) |
| **2** | **Login** | `backend/tests/unit/auth.service.test.js`<br>Unit: `authService.login()` | Memvalidasi verifikasi kredensial, pencegahan login akun nonaktif, verifikasi kecocokan hash bcrypt, auto-sync permissions karyawan, dan penerbitan JWT token. | **6 Passed** (100%) |
| **3** | **Forgot Password** | `backend/tests/unit/forgot_password.test.js`<br>Unit: `authService.requestPasswordReset()` | Memvalidasi pencarian identifier (username/email), pencegahan reset untuk akun nonaktif, pembuatan token crypto OTP 6 digit, dan pemanggilan mailer SMTP. | **4 Passed** (100%) |
| **4** | **Transaksi** | `backend/tests/unit/transaksi.service.test.js`<br>Unit: `transaksiService.generateKodeTransaksi()`, `getById()`, `getAll()` | Memvalidasi auto-increment kode transaksi (`#T-0001`, `#T-0010`), penanganan transaksi 404, dan filter transaksi dinamis (status, kasirId, pagination). | **4 Passed** (100%) |
| **5** | **Pengeluaran** | `backend/tests/unit/pengeluaran.service.test.js`<br>Unit: `pengeluaranService.getAllPengeluaran()`, `getSummary()` | Memvalidasi filtering pengeluaran berdasarkan tanggal dan kategori, kalkulasi agregasi bulanan, serta identifikasi kategori pengeluaran terbesar. | **3 Passed** (100%) |
| **6** | **Menu** | `backend/tests/unit/menu.service.test.js`<br>Unit: `menuService.getById()`, `create()`, `remove()` | Memvalidasi pembuatan menu, error 404 jika menu tidak ditemukan, serta aturan bisnis integritas referensial (pencegahan hapus menu yang terikat transaksi). | **4 Passed** (100%) |
| **7** | **Persediaan** | `backend/tests/unit/persediaan.service.test.js`<br>Unit: `persediaanService.hitungStatusStok()`, `create()`, `getById()` | Memvalidasi kalkulasi status stok otomatis (**HABIS**, **KRITIS**, **AMAN**), pembuatan data persediaan, dan pencatatan audit log aktivitas. | **3 Passed** (100%) |
| **8** | **Vendor** | `backend/tests/unit/vendor.service.test.js`<br>Unit: `vendorService.getById()`, `create()`, `update()`, `remove()` | Memvalidasi pendaftaran vendor baru dengan status default AKTIF, penanganan 404, pembaruan kontak/status, dan penghapusan mitra supplier. | **4 Passed** (100%) |

- **Total Test Cases**: **32 Test Cases** (Seluruhnya LULUS / 100% Passed).
- **Runtime**: **1.108 detik** (Super cepat karena seluruh dependensi eksternal diisolasi secara murni).
- **Commit Link**: `https://github.com/YeXiu96/FinStock/commit/3fc29404b812678a16283d490bb45346ca809b1c` *(Branch: `testing`)*

---

## 4. Test Double Implementation (Alasan Pemilihan 2 Tipe Berbeda)

Pada pengujian 8 fitur ini, kami menerapkan **2 tipe utama Test Double** (disertai tipe pelengkap) dengan rincian dan alasan teknis sebagai berikut:

| Test Double | Type | Purpose | Reason for Selection (Alasan Pemilihan) |
| :--- | :---: | :--- | :--- |
| **1. Mock Object** (`jest.fn()`) | **Mock** | Memverifikasi interaksi panggilan method eksternal (apakah dipanggil, berapa kali dipanggil, dan argumen apa yang dikirimkan). | **Mengapa Mock Dipilih?**<br>Dalam sistem finansial & persediaan, integritas data sangat krusial. Kita tidak hanya peduli pada output balikan, tetapi **harus memastikan bahwa aksi penting benar-benar dijalankan atau dicegah**: <br>1. Pada Fitur Menu (`TC-MNU-02`), Mock memastikan method `prisma.menu.delete()` **sama sekali TIDAK PERNAH dipanggil** ketika menu masih memiliki relasi transaksi aktif.<br>2. Pada Fitur Persediaan (`TC-INV-03`), Mock memastikan method `prisma.logAktivitas.create()` dipanggil dengan payload audit trail yang tepat.<br>3. Pada Fitur Forgot Password (`TC-FP-04`), Mock memvalidasi bahwa `mailer.sendResetPasswordEmail` dipanggil dengan alamat email tujuan dan nama pengguna yang sesuai. |
| **2. Stub Object** (`mockResolvedValue` / `mockRejectedValue`) | **Stub** | Menyediakan respons data terprogram (*predefined responses*) saat suatu fungsi eksternal dipanggil tanpa menjalankan implementasi aslinya. | **Mengapa Stub Dipilih?**<br>Unit testing menuntut eksekusi yang **cepat, terisolasi, dan deterministik**:<br>1. **Menghilangkan Ketergantungan I/O**: Mengganti query database Prisma dengan Stub membuat pengujian berjalan dalam hitungan milidetik tanpa memerlukan koneksi internet ke PostgreSQL/Supabase.<br>2. **Mempermudah Simulasi Kasus Negatif / Edge Cases**: Sangat sulit dan lambat membuat database sungguhan melempar error koneksi atau kondisi tertentu secara konsisten. Dengan Stub, kita dapat dengan mudah menyimulasikan user tidak ditemukan (`null`), akun nonaktif (`status: 'NONAKTIF'`), password salah (`bcrypt.compare -> false`), atau database down (`mockRejectedValue`) secara instan. |
| **3. Spy Object** *(Tipe Tambahan)* (`jest.spyOn`) | **Spy** | Memantau dan merekam pemanggilan fungsi internal tanpa mengubah perilakunya. | Digunakan pada `console.warn` untuk membuktikan bahwa penanganan error fallback (*catch block*) berjalan dengan benar tanpa mengotori konsol terminal pengujian. |

---

## 5. Built-in Test Coverage Report (Jest / Istanbul)

Berikut adalah laporan metrik *coverage* bawaan (*built-in*) yang diekstraksi dari hasil eksekusi `npm run test:coverage` pada branch `testing` untuk seluruh 8 fitur:

```text
PASS tests/unit/persediaan.service.test.js
  White-Box Unit Testing: Feature 7 - Persediaan (persediaan.service)
    √ TC-INV-01 [Logic]: hitungStatusStok menghitung status AMAN, KRITIS, dan HABIS dengan presisi (2 ms)
    √ TC-INV-02 [Negative]: getById melempar error 404 STOCK_NOT_FOUND jika bahan baku tidak ditemukan (1 ms)
    √ TC-INV-03 [Positive]: create otomatis menghitung status stok dan mencatat logAktivitas jika userId disertakan (1 ms)

PASS tests/unit/transaksi.service.test.js
  White-Box Unit Testing: Feature 4 - Transaksi (transaksi.service)
    √ TC-TRX-01 [Positive]: generateKodeTransaksi harus menghasilkan #T-0001 jika belum ada transaksi
    √ TC-TRX-02 [Positive]: generateKodeTransaksi harus menambah urutan jika transaksi terakhir ada (1 ms)
    √ TC-TRX-03 [Negative]: getById melempar error 404 jika transaksi tidak ditemukan
    √ TC-TRX-04 [Positive]: getAll berhasil memfilter transaksi berdasarkan kasirId dan status

PASS tests/unit/forgot_password.test.js
  White-Box Unit Testing: Feature 3 - Forgot Password (auth.service)
    √ TC-FP-01 [Negative]: Lempar error 400 jika identifier kosong (1 ms)
    √ TC-FP-02 [Negative]: Lempar error 404 jika pengguna tidak terdaftar
    √ TC-FP-03 [Negative]: Lempar error 403 jika akun berstatus NONAKTIF
    √ TC-FP-04 [Positive]: Berhasil meminta reset password & mengirim email OTP (1 ms)

PASS tests/unit/auth.register.test.js
  White-Box Unit Testing: auth.service.register() [FinStock]
    √ TC-REG-01 [Negative]: Harap melempar error MISSING_FIELDS jika input wajib kosong (1 ms)
    √ TC-REG-02 [Negative]: Harap melempar error INVALID_ROLE jika role tidak valid
    √ TC-REG-03 [Negative]: Harap melempar error USERNAME_EXISTS jika username sudah dipakai (1 ms)
    √ TC-REG-04 [Positive]: Harap berhasil registrasi akun KARYAWAN baru

PASS tests/unit/pengeluaran.service.test.js
  White-Box Unit Testing: Feature 5 - Pengeluaran (pengeluaran.service)
    √ TC-EXP-01 [Positive]: getAllPengeluaran memfilter dengan benar berdasarkan kategori dan tanggal (1 ms)
    √ TC-EXP-02 [Positive]: getSummary menghitung total bulan ini, bulan lalu, dan kategori terbesar
    √ TC-EXP-03 [Positive]: getSummary menangani data agregasi kosong dengan aman

PASS tests/unit/auth.service.test.js
  White-Box Unit Testing: auth.service.login() [FinStock]
    √ TC-01 [Negative]: Harap melempar error 401 INVALID_CREDENTIALS jika username tidak ditemukan (1 ms)
    √ TC-02 [Negative]: Harap melempar error 403 ACCOUNT_DISABLED jika status pengguna NONAKTIF
    √ TC-03 [Negative]: Harap melempar error 401 INVALID_CREDENTIALS jika password salah (hash tidak cocok)
    √ TC-04 [Positive]: Harap berhasil login untuk akun OWNER dengan permissions yang telah terdefinisi (1 ms)
    √ TC-05 [Positive & Edge]: Harap memberikan default permissions untuk akun KARYAWAN baru jika permissions masih null
    √ TC-06 [Resilience]: Harap menangani kegagalan update permissions dengan aman (fallback catch block) (1 ms)

PASS tests/unit/vendor.service.test.js
  White-Box Unit Testing: Feature 8 - Vendor (vendor.service)
    √ TC-VND-01 [Negative]: getById melempar error 404 VENDOR_NOT_FOUND jika vendor tidak ada
    √ TC-VND-02 [Positive]: create berhasil mendaftarkan vendor baru dengan nilai default AKTIF (1 ms)
    √ TC-VND-03 [Positive]: update memperbarui status dan catatan vendor dengan benar
    √ TC-VND-04 [Positive]: remove berhasil menghapus vendor yang terdaftar

PASS tests/unit/menu.service.test.js
  White-Box Unit Testing: Feature 6 - Menu (menu.service)
    √ TC-MNU-01 [Negative]: getById melempar error 404 MENU_NOT_FOUND jika menu tidak ada (1 ms)
    √ TC-MNU-02 [Negative]: remove melempar error 400 MENU_IN_USE jika menu sudah dipakai transaksi
    √ TC-MNU-03 [Positive]: remove berhasil menghapus menu jika tidak dipakai dalam transaksi (1 ms)
    √ TC-MNU-04 [Positive]: create berhasil membuat menu baru

-------------------------|---------|----------|---------|---------|-------------------------------------
File                     | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s                   
-------------------------|---------|----------|---------|---------|-------------------------------------
All files                |    53.6 |    35.51 |   45.23 |   56.68 |                                     
 auth                    |   53.48 |    39.32 |   57.14 |   54.83 |                                     
  auth.service.js        |   53.48 |    39.32 |   57.14 |   54.83 | 152-154,159,214-274,284-303,312-338 
 menu                    |      60 |    33.33 |      60 |   69.23 |                                     
  menu.service.js        |      60 |    33.33 |      60 |   69.23 | 9,33-40                             
 pengeluaran             |   78.04 |    33.33 |   33.33 |   78.04 |                                     
  pengeluaran.service.js |   78.04 |    33.33 |   33.33 |   78.04 | 100-109,116,132-134,151-153         
 persediaan              |   37.87 |    19.44 |    37.5 |   39.65 |                                     
  persediaan.service.js  |   37.87 |    19.44 |    37.5 |   39.65 | 20,33,60-85,89-98,105-131,138-155   
 transaksi               |      56 |    39.28 |   42.85 |   56.52 |                                     
  transaksi.service.js   |      56 |    39.28 |   42.85 |   56.52 | 38-43,87,95-128,135-137,151-155     
 vendor                  |   49.15 |     42.1 |   44.44 |   57.14 |                                     
  vendor.service.js      |   49.15 |     42.1 |   44.44 |   57.14 | 11,77-78,85-86,98-112,119-127       
-------------------------|---------|----------|---------|---------|-------------------------------------
Test Suites: 8 passed, 8 total
Tests:       32 passed, 32 total
Snapshots:   0 total
Time:        1.108 s, estimated 4 s
Ran all test suites.
```

---

## 6. GitHub Issues

| Komponen | Tautan / Informasi |
| :--- | :--- |
| **GitHub Repository** | `https://github.com/YeXiu96/FinStock` |
| **Target Branch** | `testing` |
| **Commit URL** | `https://github.com/YeXiu96/FinStock/commit/3fc29404b812678a16283d490bb45346ca809b1c` |
| **GitHub Issue Title** | `[SQA-MODUL-4] Implementasi White-Box Testing & Unit Testing 8 Fitur FinStock` |
| **GitHub Issue URL** | `https://github.com/YeXiu96/FinStock/issues/1` *(atau nomor Issue yang Anda buat di repo GitHub)* |
