import { Router } from "express";
import { tokenMiddleWare } from "../middleware/auth.middleware.ts";
import { ownerMiddleware } from "../middleware/owner.middleware.ts";
import {
    CreateCategorySchema,
    UpdateCategorySchema,
    CreateProductSchema,
    UpdateProductSchema,
    CreateStockAdjustmentSchema,
    CreateStaffSchema,
    UpdateStaffSchema,
    CreatePaymentSchema,
} from "../models/schema.ts";
import * as categoriesService from "../services/categories.service.ts";
import * as productsService from "../services/products.service.ts";
import * as stockAdjustmentsService from "../services/stockAdjustments.service.ts";
import * as reportsService from "../services/reports.service.ts";
import * as ordersService from "../services/orders.service.ts";
import * as usersService from "../services/users.service.ts";
import * as subscriptionsService from "../services/subscriptions.service.ts";
import {
    uploadProductImage,
    destroyImage,
} from "../services/cloudinary.service.ts";
import { uploadSingleImage } from "../middleware/upload.middleware.ts";
import { isCloudinaryConfigured } from "../config/cloudinary.ts";

const router = Router();

router.use(tokenMiddleWare, ownerMiddleware);

// Kategori
router.get("/categories", async (req, res) => {
    try {
        const data = await categoriesService.getAllCategories();
        res.status(200).json({ message: "Berhasil fetch categories!", data });
    } catch (error) {
        console.error("Get categories error:", error);
        res.status(500).json({ message: "Gagal mengambil data kategori" });
    }
});

router.post("/categories", async (req, res) => {
    const parsed = CreateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Data kategori tidak valid", errors: parsed.error.flatten() });
        return;
    }

    try {
        const data = await categoriesService.createCategory(parsed.data);
        res.status(201).json({ message: "Berhasil membuat kategori!", data });
    } catch (error) {
        console.error("Create category error:", error);
        res.status(500).json({ message: "Gagal membuat kategori" });
    }
});

router.put("/categories/:id", async (req, res) => {
    const parsed = UpdateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Data kategori tidak valid", errors: parsed.error.flatten() });
        return;
    }

    try {
        const data = await categoriesService.updateCategory(Number(req.params.id), parsed.data);
        if (!data) {
            res.status(404).json({ message: "Kategori tidak ditemukan" });
            return;
        }
        res.status(200).json({ message: "Berhasil update kategori!", data });
    } catch (error) {
        console.error("Update category error:", error);
        res.status(500).json({ message: "Gagal update kategori" });
    }
});

router.delete("/categories/:id", async (req, res) => {
    try {
        const data = await categoriesService.deleteCategory(Number(req.params.id));
        if (!data) {
            res.status(404).json({ message: "Kategori tidak ditemukan" });
            return;
        }
        res.status(200).json({ message: "Berhasil hapus kategori!", data });
    } catch (error) {
        console.error("Delete category error:", error);
        res.status(500).json({ message: "Gagal hapus kategori" });
    }
});

// Produk
router.get("/products", async (req, res) => {
    try {
        const data = await productsService.getAllProducts();
        res.status(200).json({ message: "Berhasil fetch products!", data });
    } catch (error) {
        console.error("Get products error:", error);
        res.status(500).json({ message: "Gagal mengambil data produk" });
    }
});

router.post("/products", async (req, res) => {
    const parsed = CreateProductSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Data produk tidak valid", errors: parsed.error.flatten() });
        return;
    }

    try {
        const data = await productsService.createProduct(parsed.data);
        res.status(201).json({ message: "Berhasil membuat produk!", data });
    } catch (error) {
        console.error("Create product error:", error);
        res.status(500).json({ message: "Gagal membuat produk" });
    }
});

router.put("/products/:id", async (req, res) => {
    const parsed = UpdateProductSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Data produk tidak valid", errors: parsed.error.flatten() });
        return;
    }

    try {
        const data = await productsService.updateProduct(Number(req.params.id), parsed.data);
        if (!data) {
            res.status(404).json({ message: "Produk tidak ditemukan" });
            return;
        }
        res.status(200).json({ message: "Berhasil update produk!", data });
    } catch (error) {
        console.error("Update product error:", error);
        res.status(500).json({ message: "Gagal update produk" });
    }
});

router.patch("/products/:id/deactivate", async (req, res) => {
    try {
        const data = await productsService.deactivateProduct(Number(req.params.id));
        if (!data) {
            res.status(404).json({ message: "Produk tidak ditemukan" });
            return;
        }
        res.status(200).json({ message: "Produk berhasil dinonaktifkan!", data });
    } catch (error) {
        console.error("Deactivate product error:", error);
        res.status(500).json({ message: "Gagal menonaktifkan produk" });
    }
});

/**
 * Upload/replace foto produk (multipart, field `image`, maks 5 MB).
 * Hasil Cloudinary langsung disimpan ke kolom produk, jadi klien cukup
 * memanggil satu endpoint ini setelah produk dibuat.
 */
router.post("/products/:id/image", uploadSingleImage, async (req, res) => {
    if (!isCloudinaryConfigured) {
        res.status(503).json({
            message: "Upload gambar belum dikonfigurasi di server",
        });
        return;
    }

    const file = req.file;
    if (!file) {
        res.status(400).json({ message: "File gambar wajib dikirim" });
        return;
    }

    const productId = Number(req.params.id);

    try {
        const product = await productsService.getProductById(productId);
        if (!product) {
            res.status(404).json({ message: "Produk tidak ditemukan" });
            return;
        }

        const uploaded = await uploadProductImage(file.buffer, productId);

        // Baru hapus gambar lama setelah upload baru berhasil, supaya produk
        // tidak pernah tanpa gambar kalau upload gagal di tengah jalan.
        if (product.image_public_id) {
            await destroyImage(String(product.image_public_id));
        }

        const data = await productsService.updateProduct(productId, uploaded);
        res.status(200).json({ message: "Foto produk diperbarui!", data });
    } catch (error) {
        console.error("Upload product image error:", error);
        const msg =
            error instanceof Error ? error.message : "Gagal mengunggah gambar";
        res.status(500).json({ message: msg });
    }
});

/** Hapus foto produk dari Cloudinary dan kosongkan kolomnya. */
router.delete("/products/:id/image", async (req, res) => {
    const productId = Number(req.params.id);

    try {
        const product = await productsService.getProductById(productId);
        if (!product) {
            res.status(404).json({ message: "Produk tidak ditemukan" });
            return;
        }

        if (product.image_public_id) {
            await destroyImage(String(product.image_public_id));
        }

        const data = await productsService.updateProduct(productId, {
            image_url: null,
            image_public_id: null,
        });
        res.status(200).json({ message: "Foto produk dihapus!", data });
    } catch (error) {
        console.error("Delete product image error:", error);
        res.status(500).json({ message: "Gagal menghapus foto produk" });
    }
});

router.get("/products/:id/adjustments", async (req, res) => {
    try {
        const data = await stockAdjustmentsService.getAdjustmentsByProduct(Number(req.params.id));
        res.status(200).json({ message: "Berhasil fetch riwayat adjustment!", data });
    } catch (error) {
        console.error("Get adjustments error:", error);
        res.status(500).json({ message: "Gagal mengambil riwayat adjustment" });
    }
});

router.post("/stock-adjustments", async (req, res) => {
    const parsed = CreateStockAdjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Data stock adjustment tidak valid",
            errors: parsed.error.flatten(),
        });
        return;
    }

    try {
        const ownerId = res.locals.user!.id;
        const data = await stockAdjustmentsService.createStockAdjustment(ownerId, parsed.data);
        res.status(201).json({ message: "Berhasil menyesuaikan stok!", data });
    } catch (error) {
        console.error("Create stock adjustment error:", error);
        const msg = error instanceof Error ? error.message : "Gagal menyesuaikan stok";
        res.status(400).json({ message: msg });
    }
});

router.get("/orders", async (req, res) => {
    try {
        const data = await ordersService.getAllOrders();
        res.status(200).json({ message: "Berhasil fetch semua order!", data });
    } catch (error) {
        console.error("Get all orders error:", error);
        res.status(500).json({ message: "Gagal mengambil riwayat transaksi" });
    }
});

router.get("/reports/revenue", async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            res.status(400).json({ message: "Parameter start dan end wajib diisi" });
            return;
        }

        const data = await reportsService.getRevenueSummary(String(start), String(end));
        res.status(200).json({ message: "Berhasil fetch laporan revenue!", data });
    } catch (error) {
        console.error("Get revenue report error:", error);
        res.status(500).json({ message: "Gagal mengambil laporan revenue" });
    }
});

router.get("/reports/top-products", async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            res.status(400).json({ message: "Parameter start dan end wajib diisi" });
            return;
        }

        const data = await reportsService.getTopProducts(String(start), String(end), 10);
        res.status(200).json({ message: "Berhasil fetch produk terlaris!", data });
    } catch (error) {
        console.error("Get top products error:", error);
        res.status(500).json({ message: "Gagal mengambil data produk terlaris" });
    }
});

router.get("/reports/margin", async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            res.status(400).json({ message: "Parameter start dan end wajib diisi" });
            return;
        }

        const data = await reportsService.getMarginReport(String(start), String(end));
        res.status(200).json({ message: "Berhasil fetch laporan margin!", data });
    } catch (error) {
        console.error("Get margin report error:", error);
        res.status(500).json({ message: "Gagal mengambil laporan margin" });
    }
});

router.get("/reports/low-stock", async (req, res) => {
    try {
        const data = await reportsService.getLowStockProducts();
        res.status(200).json({ message: "Berhasil fetch produk stok menipis!", data });
    } catch (error) {
        console.error("Get low stock error:", error);
        res.status(500).json({ message: "Gagal mengambil data stok menipis" });
    }
});

// ===== Manajemen staff =====

router.get("/staff", async (req, res) => {
    try {
        const data = await usersService.getStaffUsers();
        res.status(200).json({ message: "Berhasil fetch staff!", data });
    } catch (error) {
        console.error("Get staff error:", error);
        res.status(500).json({ message: "Gagal mengambil data staff" });
    }
});

router.post("/staff", async (req, res) => {
    const parsed = CreateStaffSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Data staff tidak valid",
            errors: parsed.error.flatten(),
        });
        return;
    }

    try {
        const existing = await usersService.getUserByEmail(parsed.data.email);
        if (existing) {
            res.status(409).json({ message: "Email sudah terdaftar" });
            return;
        }

        // Role selalu staff — endpoint ini tidak boleh membuat owner.
        const data = await usersService.createUser({
            ...parsed.data,
            role: "staff",
        });
        res.status(201).json({ message: "Berhasil membuat akun staff!", data });
    } catch (error) {
        console.error("Create staff error:", error);
        res.status(500).json({ message: "Gagal membuat akun staff" });
    }
});

router.patch("/staff/:id", async (req, res) => {
    const parsed = UpdateStaffSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Data staff tidak valid",
            errors: parsed.error.flatten(),
        });
        return;
    }

    try {
        const data = await usersService.updateStaff(
            Number(req.params.id),
            parsed.data
        );
        if (!data) {
            res.status(404).json({ message: "Staff tidak ditemukan" });
            return;
        }
        res.status(200).json({ message: "Berhasil update staff!", data });
    } catch (error) {
        console.error("Update staff error:", error);
        res.status(500).json({ message: "Gagal update staff" });
    }
});

// ===== Detail transaksi =====

router.get("/orders/:id", async (req, res) => {
    try {
        const data = await ordersService.getOrderWithItems(Number(req.params.id));
        if (!data) {
            res.status(404).json({ message: "Transaksi tidak ditemukan" });
            return;
        }
        res.status(200).json({ message: "Berhasil fetch transaksi!", data });
    } catch (error) {
        console.error("Get order detail error:", error);
        res.status(500).json({ message: "Gagal mengambil detail transaksi" });
    }
});

// ===== Paket langganan & pembayaran (simulasi) =====

router.get("/plans", async (req, res) => {
    try {
        const data = await subscriptionsService.getActivePlans();
        res.status(200).json({ message: "Berhasil fetch paket!", data });
    } catch (error) {
        console.error("Get plans error:", error);
        res.status(500).json({ message: "Gagal mengambil data paket" });
    }
});

router.get("/subscription", async (req, res) => {
    try {
        const ownerId = res.locals.user!.id;
        const [active, history] = await Promise.all([
            subscriptionsService.getActiveSubscription(ownerId),
            subscriptionsService.getSubscriptionHistory(ownerId),
        ]);
        res.status(200).json({
            message: "Berhasil fetch langganan!",
            data: { active, history },
        });
    } catch (error) {
        console.error("Get subscription error:", error);
        res.status(500).json({ message: "Gagal mengambil data langganan" });
    }
});

router.get("/payments", async (req, res) => {
    try {
        const ownerId = res.locals.user!.id;
        const data = await subscriptionsService.getPayments(ownerId);
        res.status(200).json({ message: "Berhasil fetch pembayaran!", data });
    } catch (error) {
        console.error("Get payments error:", error);
        res.status(500).json({ message: "Gagal mengambil riwayat pembayaran" });
    }
});

router.post("/payments", async (req, res) => {
    const parsed = CreatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Data pembayaran tidak valid",
            errors: parsed.error.flatten(),
        });
        return;
    }

    try {
        const ownerId = res.locals.user!.id;
        const data = await subscriptionsService.createPayment(ownerId, parsed.data);
        res.status(201).json({ message: "Tagihan dibuat!", data });
    } catch (error) {
        console.error("Create payment error:", error);
        const msg = error instanceof Error ? error.message : "Gagal membuat tagihan";
        res.status(400).json({ message: msg });
    }
});

router.post("/payments/:id/confirm", async (req, res) => {
    try {
        const ownerId = res.locals.user!.id;
        const result = await subscriptionsService.confirmPayment(
            ownerId,
            Number(req.params.id)
        );
        res.status(200).json({ message: "Pembayaran berhasil!", data: result });
    } catch (error) {
        console.error("Confirm payment error:", error);
        const msg = error instanceof Error ? error.message : "Gagal konfirmasi pembayaran";
        res.status(400).json({ message: msg });
    }
});

export default router;
