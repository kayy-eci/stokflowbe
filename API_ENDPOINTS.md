# Dokumentasi API StockFlow

Dokumen ini merangkum endpoint yang saat ini terdaftar pada aplikasi. Semua endpoint mengembalikan JSON, kecuali jika terjadi kegagalan sebelum handler route berjalan.

## URL dan autentikasi

- Base URL lokal: `http://localhost:8000`
- Prefix API: `/api`
- Health check berada di `/health` (di luar prefix `/api`).
- Untuk endpoint terlindungi, kirim header `Authorization: Bearer <token>`.
- Token diperoleh dari endpoint register atau login. Token JWT berisi ID, email, dan role, dengan masa berlaku sesuai `JWT_EXPIRES_IN` (default `7d`).
- Role yang digunakan: `owner` dan `staff`. Endpoint owner hanya dapat dipakai owner, sedangkan endpoint staff hanya dapat dipakai staff.
- Body request yang menerima data harus dikirim sebagai `Content-Type: application/json`.

### Ringkasan akses

| Prefix | Hak akses | Kegunaan |
|---|---|---|
| `/health` | Publik | Memeriksa server dan koneksi database |
| `/api/users` | Publik untuk register/login; token untuk daftar user dan profil | Autentikasi dan data akun |
| `/api/owner` | Token owner | Administrasi kategori, produk, stok, transaksi, dan laporan |
| `/api/staff` | Token staff | Katalog POS, pembuatan transaksi, dan riwayat transaksi sendiri |

Semua respons endpoint bisnis umumnya berbentuk `{ "message": "...", "data": ... }`. Respons validasi juga menyertakan `errors` dari Zod. Endpoint health check memiliki format respons tersendiri.

## Health check

### `GET /health`

Memeriksa aplikasi dan menjalankan query sederhana ke database.

- **Autentikasi:** Tidak diperlukan.
- **Sukses — `200`:** `{ "status": "ok", "db": "connected", "result": [...] }`
- **Gagal — `500`:** `{ "status": "error", "db": "disconnected" }`

## Pengguna dan autentikasi

### `POST /api/users`

Mendaftarkan akun baru dan mengembalikan data pengguna serta token JWT. Password di-hash sebelum disimpan dan tidak disertakan pada data pengguna yang dikembalikan.

- **Autentikasi:** Tidak diperlukan.
- **Body:**

  | Field | Tipe | Wajib | Aturan |
  |---|---|---:|---|
  | `name` | string | Ya | 1–100 karakter |
  | `email` | string | Ya | Email valid, maksimal 150 karakter |
  | `password` | string | Ya | Minimal 8 karakter |
  | `role` | string | Tidak | `owner` atau `staff`; default `staff` |

- **Contoh body:**

  ```json
  {
    "name": "Kasir",
    "email": "kasir@example.com",
    "password": "password123",
    "role": "staff"
  }
  ```

- **Sukses — `201`:** `{ "message": "Berhasil register!", "data": { "user": {...}, "token": "..." } }`
- **Kemungkinan error:** `400` input tidak valid; `409` email sudah terdaftar; `500` kegagalan server.

### `POST /api/users/auth/login`

Memverifikasi email dan password lalu menerbitkan token JWT.

- **Autentikasi:** Tidak diperlukan.
- **Body:**

  | Field | Tipe | Wajib | Aturan |
  |---|---|---:|---|
  | `email` | string | Ya | Email valid |
  | `password` | string | Ya | Minimal 8 karakter |

- **Contoh body:**

  ```json
  {
    "email": "kasir@example.com",
    "password": "password123"
  }
  ```

- **Sukses — `200`:** `{ "message": "Berhasil login!", "data": { "user": {...}, "token": "..." } }`
- **Kemungkinan error:** `400` credentials tidak valid; `401` email atau password salah; `500` kegagalan server.
- Hash password tidak disertakan dalam objek `user`.

### `GET /api/users/users`

Mengambil semua pengguna, diurutkan berdasarkan waktu pembuatan paling awal. Path ini memang `/api/users/users`: router utama memasang router users pada `/api/users`, sedangkan route ini menambahkan `/users`.

- **Autentikasi:** Token valid; route tidak membatasi role.
- **Sukses — `200`:** `{ "message": "Berhasil fetch users!", "data": [...] }`
- Tiap pengguna memuat `id`, `name`, `email`, `role`, `created_at`, dan `updated_at`; password tidak dikembalikan.
- **Kemungkinan error:** `401` token tidak ada/tidak valid; `500` kegagalan server.

### `GET /api/users/profile`

Mengambil profil pengguna berdasarkan ID di token.

- **Autentikasi:** Token valid; route tidak membatasi role.
- **Sukses — `200`:** `{ "message": "Berhasil fetch profile!", "data": { ... } }`
- Data profil memuat `id`, `name`, `email`, `role`, `created_at`, dan `updated_at`.
- **Kemungkinan error:** `401` token tidak ada/tidak valid; `404` pengguna tidak ditemukan; `500` kegagalan server.

## Endpoint owner

Semua endpoint pada bagian ini memerlukan token dengan role `owner`.

### Kategori

#### `GET /api/owner/categories`

Mengambil semua kategori, diurutkan berdasarkan nama.

- **Sukses — `200`:** `{ "message": "Berhasil fetch categories!", "data": [...] }`
- Setiap item kategori berisi `id`, `name`, dan `created_at`.
- **Kemungkinan error:** `401` token tidak valid/tidak ada; `403` role bukan owner; `500` kegagalan server.

#### `POST /api/owner/categories`

Membuat kategori baru.

- **Body:** `name` (string, wajib, 1–100 karakter).
- **Contoh:** `{ "name": "Minuman" }`
- **Sukses — `201`:** `{ "message": "Berhasil membuat kategori!", "data": { "id": 1, "name": "Minuman", "created_at": "..." } }`
- **Kemungkinan error:** `400` input tidak valid; `401` token tidak valid/tidak ada; `403` role bukan owner; `500` kegagalan server.

#### `PUT /api/owner/categories/:id`

Mengubah nama kategori. `:id` adalah ID kategori berupa angka.

- **Body:** `name` (string, opsional; jika diberikan harus 1–100 karakter). Objek kosong tidak mengubah data.
- **Contoh:** `{ "name": "Minuman Dingin" }`
- **Sukses — `200`:** `{ "message": "Berhasil update kategori!", "data": { ... } }`
- **Kemungkinan error:** `400` input tidak valid; `401` token tidak valid/tidak ada; `403` role bukan owner; `404` kategori tidak ditemukan; `500` kegagalan server.

#### `DELETE /api/owner/categories/:id`

Menghapus kategori. Produk yang sebelumnya memakai kategori tersebut akan memiliki `category_id: null`.

- **Path:** `:id` adalah ID kategori berupa angka.
- **Sukses — `200`:** `{ "message": "Berhasil hapus kategori!", "data": { ...kategori yang dihapus } }`
- **Kemungkinan error:** `401` token tidak valid/tidak ada; `403` role bukan owner; `404` kategori tidak ditemukan; `500` kegagalan server.

### Produk

#### `GET /api/owner/products`

Mengambil katalog produk aktif, diurutkan berdasarkan nama. Produk nonaktif tidak muncul pada endpoint daftar ini.

- **Sukses — `200`:** `{ "message": "Berhasil fetch products!", "data": [...] }`
- Item produk berisi kolom produk, termasuk `id`, `sku`, `name`, `category_id`, `cost_price`, `sell_price`, `stock_qty`, `low_stock_threshold`, `is_active`, `created_at`, dan `updated_at`.
- **Kemungkinan error:** `401` token tidak valid/tidak ada; `403` role bukan owner; `500` kegagalan server.

#### `POST /api/owner/products`

Membuat produk baru.

- **Body:**

  | Field | Tipe | Wajib | Aturan/default |
  |---|---|---:|---|
  | `sku` | string | Ya | 1–50 karakter |
  | `name` | string | Ya | 1–150 karakter |
  | `category_id` | integer atau `null` | Tidak | Harus positif jika angka |
  | `cost_price` | number | Ya | Minimal 0 |
  | `sell_price` | number | Ya | Minimal 0 |
  | `stock_qty` | integer | Tidak | Minimal 0; default `0` |
  | `low_stock_threshold` | integer | Tidak | Minimal 0; default `5` |
  | `is_active` | boolean | Tidak | Default `true` |

- **Contoh body:**

  ```json
  {
    "sku": "MIN-001",
    "name": "Teh Botol",
    "category_id": 1,
    "cost_price": 3000,
    "sell_price": 5000,
    "stock_qty": 20,
    "low_stock_threshold": 5,
    "is_active": true
  }
  ```

- **Sukses — `201`:** `{ "message": "Berhasil membuat produk!", "data": { ...produk } }`
- **Kemungkinan error:** `400` input tidak valid; `401` token tidak valid/tidak ada; `403` role bukan owner; `500` kegagalan server.

#### `PUT /api/owner/products/:id`

Memperbarui satu atau beberapa field produk. Field yang tidak dikirim tidak diubah; `category_id: null` menghapus relasi kategori.

- **Path:** `:id` adalah ID produk berupa angka.
- **Body:** Semua field produk pada endpoint pembuatan bersifat opsional di endpoint ini (`sku`, `name`, `category_id`, `cost_price`, `sell_price`, `stock_qty`, `low_stock_threshold`, `is_active`) dan tetap mengikuti aturan tipe serta batas nilainya.
- **Sukses — `200`:** `{ "message": "Berhasil update produk!", "data": { ...produk } }`
- **Kemungkinan error:** `400` input tidak valid; `401` token tidak valid/tidak ada; `403` role bukan owner; `404` produk tidak ditemukan; `500` kegagalan server.

#### `PATCH /api/owner/products/:id/deactivate`

Menonaktifkan produk dengan mengubah `is_active` menjadi `false`. Produk tetap tersimpan dan tidak lagi muncul di daftar produk aktif.

- **Path:** `:id` adalah ID produk berupa angka.
- **Body:** Tidak diperlukan.
- **Sukses — `200`:** `{ "message": "Produk berhasil dinonaktifkan!", "data": { ...produk yang telah dinonaktifkan } }`
- **Kemungkinan error:** `401` token tidak valid/tidak ada; `403` role bukan owner; `404` produk tidak ditemukan; `500` kegagalan server.

#### `GET /api/owner/products/:id/adjustments`

Mengambil riwayat penyesuaian stok untuk produk tertentu, dari yang terbaru.

- **Path:** `:id` adalah ID produk berupa angka.
- **Sukses — `200`:** `{ "message": "Berhasil fetch riwayat adjustment!", "data": [...] }`
- Item riwayat berisi `id`, `product_id`, `adjusted_by`, `change_qty`, `reason`, `note`, dan `created_at`. Jika belum ada riwayat, `data` berupa array kosong.
- **Kemungkinan error:** `401` token tidak valid/tidak ada; `403` role bukan owner; `500` kegagalan server.

### Penyesuaian stok

#### `POST /api/owner/stock-adjustments`

Menambah atau mengurangi stok produk dan mencatat alasan serta pengguna owner yang melakukan penyesuaian. Penyesuaian ditolak jika stok akhirnya kurang dari nol.

- **Body:**

  | Field | Tipe | Wajib | Aturan |
  |---|---|---:|---|
  | `product_id` | integer | Ya | Harus positif |
  | `change_qty` | integer | Ya | Tidak boleh `0`; nilai positif menambah stok dan negatif mengurangi stok |
  | `reason` | string | Ya | `restock`, `correction`, `shrinkage`, atau `return` |
  | `note` | string atau `null` | Tidak | Catatan bebas |

- **Contoh body:**

  ```json
  {
    "product_id": 1,
    "change_qty": 10,
    "reason": "restock",
    "note": "Stok masuk dari pemasok"
  }
  ```

- **Sukses — `201`:** `{ "message": "Berhasil menyesuaikan stok!", "data": { ...record adjustment } }`
- **Kemungkinan error:** `400` input tidak valid, produk tidak ditemukan, atau stok akan menjadi negatif; `401` token tidak valid/tidak ada; `403` role bukan owner.

### Transaksi

#### `GET /api/owner/orders`

Mengambil semua transaksi dari seluruh staff, diurutkan dari yang terbaru. Setiap transaksi juga menyertakan `staff_name`.

- **Sukses — `200`:** `{ "message": "Berhasil fetch semua order!", "data": [...] }`
- **Kemungkinan error:** `401` token tidak valid/tidak ada; `403` role bukan owner; `500` kegagalan server.

### Laporan

Untuk laporan revenue, produk terlaris, dan margin, parameter `start` dan `end` wajib diisi sebagai tanggal `YYYY-MM-DD`. Rentang mencakup seluruh hari `start` dan `end` (inklusif). Nilai tanggal yang tidak dapat dikonversi oleh PostgreSQL dapat menyebabkan respons `500`.

#### `GET /api/owner/reports/revenue?start=YYYY-MM-DD&end=YYYY-MM-DD`

Merangkum total revenue dan jumlah transaksi pada rentang tanggal.

- **Query:** `start` (wajib), `end` (wajib).
- **Sukses — `200`:** `{ "message": "Berhasil fetch laporan revenue!", "data": { "total_revenue": ..., "total_orders": ... } }`
- Jika belum ada transaksi, total revenue bernilai `0` dan jumlah transaksi `0`.
- **Kemungkinan error:** `400` parameter tanggal tidak lengkap; `401` token tidak valid/tidak ada; `403` role bukan owner; `500` kegagalan server atau tanggal tidak dapat diproses.

#### `GET /api/owner/reports/top-products?start=YYYY-MM-DD&end=YYYY-MM-DD`

Mengurutkan produk berdasarkan jumlah unit terjual pada rentang tanggal. Hasil dibatasi maksimal 10 produk.

- **Query:** `start` (wajib), `end` (wajib).
- **Sukses — `200`:** `{ "message": "Berhasil fetch produk terlaris!", "data": [{ "id": 1, "name": "...", "total_sold": ..., "total_revenue": ... }] }`
- **Kemungkinan error:** `400` parameter tanggal tidak lengkap; `401` token tidak valid/tidak ada; `403` role bukan owner; `500` kegagalan server atau tanggal tidak dapat diproses.

#### `GET /api/owner/reports/margin?start=YYYY-MM-DD&end=YYYY-MM-DD`

Menghitung ringkasan penjualan, revenue, biaya, dan margin tiap produk pada rentang tanggal. Margin dihitung dari revenue penjualan dikurangi biaya produk saat laporan dijalankan.

- **Query:** `start` (wajib), `end` (wajib).
- **Sukses — `200`:** `{ "message": "Berhasil fetch laporan margin!", "data": [{ "id": 1, "name": "...", "total_sold": ..., "total_revenue": ..., "total_cost": ..., "total_margin": ... }] }`
- Hasil diurutkan dari margin tertinggi.
- **Kemungkinan error:** `400` parameter tanggal tidak lengkap; `401` token tidak valid/tidak ada; `403` role bukan owner; `500` kegagalan server atau tanggal tidak dapat diproses.

#### `GET /api/owner/reports/low-stock`

Mengambil produk aktif dengan stok saat ini kurang dari atau sama dengan `low_stock_threshold`.

- **Query/body:** Tidak diperlukan.
- **Sukses — `200`:** `{ "message": "Berhasil fetch produk stok menipis!", "data": [...] }`
- **Kemungkinan error:** `401` token tidak valid/tidak ada; `403` role bukan owner; `500` kegagalan server.

## Endpoint staff

Semua endpoint pada bagian ini memerlukan token dengan role `staff`.

### `GET /api/staff/products`

Mengambil katalog produk aktif untuk POS, diurutkan berdasarkan nama.

- **Sukses — `200`:** `{ "message": "Berhasil fetch products!", "data": [...] }`
- Produk nonaktif tidak disertakan.
- **Kemungkinan error:** `401` token tidak valid/tidak ada; `403` role bukan staff; `500` kegagalan server.

### `GET /api/staff/categories`

Mengambil daftar kategori untuk filter katalog POS, diurutkan berdasarkan nama.

- **Sukses — `200`:** `{ "message": "Berhasil fetch categories!", "data": [...] }`
- **Kemungkinan error:** `401` token tidak valid/tidak ada; `403` role bukan staff; `500` kegagalan server.

### `POST /api/staff/orders`

Membuat transaksi atas nama staff yang terautentikasi. Harga item diambil dari harga jual produk saat transaksi dibuat; total dan subtotal dihitung server, lalu stok dikurangi. Jika satu produk tidak ditemukan atau stok tidak cukup, transaksi dibatalkan.

- **Body:** `items` wajib berupa array minimal satu item:

  | Field item | Tipe | Aturan |
  |---|---|---|
  | `product_id` | integer | Harus positif |
  | `quantity` | integer | Harus positif |

- **Contoh body:**

  ```json
  {
    "items": [
      { "product_id": 1, "quantity": 2 },
      { "product_id": 3, "quantity": 1 }
    ]
  }
  ```

- **Sukses — `201`:** `{ "message": "Berhasil membuat order!", "data": { "id": 1, "staff_id": 2, "total_amount": 15000, "created_at": "...", "items": [...] } }`
- Item pada data sukses memuat `productId`, `quantity`, `unitPrice`, dan `subtotal`.
- **Kemungkinan error:** `400` input tidak valid, produk tidak ditemukan, atau stok tidak cukup; `401` token tidak valid/tidak ada; `403` role bukan staff.

### `GET /api/staff/orders`

Mengambil riwayat transaksi milik staff yang tokennya digunakan, diurutkan dari yang terbaru.

- **Sukses — `200`:** `{ "message": "Berhasil fetch riwayat order!", "data": [...] }`
- **Kemungkinan error:** `401` token tidak valid/tidak ada; `403` role bukan staff; `500` kegagalan server.

## Catatan validasi dan error

- Request yang gagal validasi skema biasanya mendapat `400` dengan bentuk `{ "message": "...", "errors": { ... } }`.
- Request terlindungi tanpa token atau dengan token tidak valid mendapat `401`.
- Token valid dengan role yang tidak sesuai mendapat `403`.
- ID pada path didokumentasikan sebagai angka positif, tetapi route saat ini mengonversi nilai path ke angka dan tidak selalu memvalidasi format ID sebelum query.
- Response contoh di atas menunjukkan struktur data; nilai numerik dan format timestamp aktual mengikuti hasil PostgreSQL.
