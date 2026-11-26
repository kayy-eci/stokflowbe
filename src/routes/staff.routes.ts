import { Router } from "express";
import { tokenMiddleWare, activeUserMiddleWare } from "../middleware/auth.middleware.ts";
import { staffMiddleware } from "../middleware/staff.middleware.ts";
import { CreateOrderSchema } from "../models/schema.ts";
import * as ordersService from "../services/orders.service.ts";
import * as productsService from "../services/products.service.ts";
import * as categoriesService from "../services/categories.service.ts";
import * as usersService from "../services/users.service.ts";

const router = Router();

/**
 * Owner dari staff yang sedang login. Staff tidak menyimpan toko sendiri —
 * toko adalah owner yang membuat akunnya. Tanpa ini, POS bisa menampilkan
 * dan menjual produk owner lain.
 */
const ownerIdForStaff = async (staffId: number) => {
    const ownerId = await usersService.getOwnerIdForUser(staffId);
    if (ownerId == null) {
        throw new Error("Akun staff belum terikat ke owner toko");
    }
    return ownerId;
};

// Token lama tetap valid sampai kedaluwarsa, jadi status aktif dicek tiap
// request supaya staff yang dinonaktifkan owner langsung kehilangan akses.
router.use(tokenMiddleWare, staffMiddleware, activeUserMiddleWare);

// Katalog produk untuk POS staff (hanya produk aktif, tanpa harga modal)
router.get("/products", async (req, res) => {
    try {
        const ownerId = await ownerIdForStaff(res.locals.user!.id);
        const data = await productsService.getActiveProductsForStaff(ownerId);
        res.status(200).json({ message: "Berhasil fetch products!", data });
    } catch (error) {
        console.error("Get products error:", error);
        res.status(500).json({ message: "Gagal mengambil data produk" });
    }
});

// Kategori untuk filter katalog staff
router.get("/categories", async (req, res) => {
    try {
        const ownerId = await ownerIdForStaff(res.locals.user!.id);
        const data = await categoriesService.getCategoriesForStaff(ownerId);
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
        const ownerId = await ownerIdForStaff(staffId);
        const data = await ordersService.createOrder(staffId, ownerId, parsed.data);
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

// Detail satu order. `staffId` membatasi ke order milik staff pemanggil,
// jadi order staff lain terbaca sebagai 404.
router.get("/orders/:id", async (req, res) => {
    try {
        const staffId = res.locals.user!.id;
        const data = await ordersService.getOrderWithItems(
            Number(req.params.id),
            staffId
        );
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

export default router;
