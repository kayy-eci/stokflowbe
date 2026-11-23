import { Router } from "express";
import { tokenMiddleWare } from "../middleware/auth.middleware.ts";
import { staffMiddleware } from "../middleware/staff.middleware.ts";
import { CreateOrderSchema } from "../models/schema.ts";
import * as ordersService from "../services/orders.service.ts";
import * as productsService from "../services/products.service.ts";
import * as categoriesService from "../services/categories.service.ts";

const router = Router();

router.use(tokenMiddleWare, staffMiddleware);

// Katalog produk untuk POS staff (hanya produk aktif)
router.get("/products", async (req, res) => {
    try {
        const data = await productsService.getAllProducts();
        res.status(200).json({ message: "Berhasil fetch products!", data });
    } catch (error) {
        console.error("Get products error:", error);
        res.status(500).json({ message: "Gagal mengambil data produk" });
    }
});

// Kategori untuk filter katalog staff
router.get("/categories", async (req, res) => {
    try {
        const data = await categoriesService.getAllCategories();
        res.status(200).json({ message: "Berhasil fetch categories!", data });
    } catch (error) {
        console.error("Get categories error:", error);
        res.status(500).json({ message: "Gagal mengambil data kategori" });
    }
});

router.post("/orders", async (req, res) => {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Data order tidak valid",
            errors: parsed.error.flatten(),
        });
        return;
    }

    try {
        const staffId = res.locals.user!.id;
        const data = await ordersService.createOrder(staffId, parsed.data);
        res.status(201).json({ message: "Berhasil membuat order!", data });
    } catch (error) {
        console.error("Create order error:", error);
        const msg = error instanceof Error ? error.message : "Gagal membuat order";
        res.status(400).json({ message: msg });
    }
});

router.get("/orders", async (req, res) => {
    try {
        const staffId = res.locals.user!.id;
        const data = await ordersService.getOrdersByStaff(staffId);
        res.status(200).json({ message: "Berhasil fetch riwayat order!", data });
    } catch (error) {
        console.error("Get orders error:", error);
        res.status(500).json({ message: "Gagal mengambil riwayat order" });
    }
});

export default router;
