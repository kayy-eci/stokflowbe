import { Router } from "express";
import { tokenMiddleWare } from "../middleware/auth.middleware.ts";
import { ownerMiddleware } from "../middleware/owner.middleware.ts";
import {
    CreateCategorySchema,
    UpdateCategorySchema,
    CreateProductSchema,
    UpdateProductSchema,
    CreateStockAdjustmentSchema,
} from "../models/schema.ts";
import * as categoriesService from "../services/categories.service.ts";
import * as productsService from "../services/products.service.ts";
import * as stockAdjustmentsService from "../services/stockAdjustments.service.ts";
import * as reportsService from "../services/reports.service.ts";
import * as ordersService from "../services/orders.service.ts";

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

export default router;
