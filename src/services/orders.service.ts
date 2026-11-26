import { pool } from "../config/db.ts";
import type { CreateOrderInput } from "../models/schema.ts";

/**
 * Simpan order + item + potong stok dalam satu transaksi database.
 *
 * `payment_method` dan `cash_received` ditulis ke tabel `orders`; constraint
 * `orders_cash_received_check` menolak kas tunai yang kurang dari total, jadi
 * periksa dulu di sini supaya pesannya jelas bagi kasir.
 */
export async function createOrder(
    staffId: number,
    ownerId: number,
    data: CreateOrderInput
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        let total = 0;
        const itemsWithPrice: Array<{
            productId: number;
            productName: string;
            quantity: number;
            unitPrice: number;
            subtotal: number;
        }> = [];

        for (const item of data.items) {
            // Lock baris produk ini biar gak ada transaksi lain yang baca stok bareng
            const productResult = await client.query(
                `SELECT id, name, sell_price, stock_qty FROM products
                 WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
                [item.product_id, ownerId]
            );

            const product = productResult.rows[0];
            if (!product) {
                throw new Error(`Produk dengan id ${item.product_id} tidak ditemukan`);
            }
            if (Number(product.stock_qty) < item.quantity) {
                throw new Error(`Stok produk id ${item.product_id} tidak cukup`);
            }

            const unitPrice = Number(product.sell_price);
            const subtotal = unitPrice * item.quantity;
            total += subtotal;

            itemsWithPrice.push({
                productId: Number(item.product_id),
                productName: String(product.name),
                quantity: item.quantity,
                unitPrice,
                subtotal,
            });
        }

        const paymentMethod = data.payment_method ?? "tunai";
        const cashReceived =
            paymentMethod === "tunai" && data.cash_received != null
                ? data.cash_received
                : null;

        if (cashReceived !== null && cashReceived < total) {
            throw new Error(
                `Uang diterima kurang dari total (${total.toLocaleString("id-ID")})`
            );
        }

        const orderResult = await client.query(
            `INSERT INTO orders (staff_id, total_amount, payment_method, cash_received)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [staffId, total, paymentMethod, cashReceived]
        );
        const order = orderResult.rows[0];

        for (const item of itemsWithPrice) {
            await client.query(
                `INSERT INTO order_items
                     (order_id, product_id, product_name, quantity, unit_price, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    order.id,
                    item.productId,
                    item.productName,
                    item.quantity,
                    item.unitPrice,
                    item.subtotal,
                ]
            );

            await client.query(
                "UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2",
                [item.quantity, item.productId]
            );
        }

        await client.query("COMMIT");
        return { ...order, items: itemsWithPrice };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function getOrdersByStaff(staffId: number) {
    const result = await pool.query(
        "SELECT * FROM orders WHERE staff_id = $1 ORDER BY created_at DESC",
        [staffId]
    );
    return result.rows;
}

/**
 * Satu order lengkap dengan item-nya untuk layar detail.
 *
 * `staffId` membatasi akses: staff hanya bisa membuka order miliknya sendiri.
 * Owner memanggil versi tanpa batas lewat [getOrderByIdForOwner].
 */
export async function getOrderWithItems(
    orderId: number,
    staffId?: number,
    ownerId?: number
) {
    const conditions = ["o.id = $1"];
    const params: unknown[] = [orderId];
    if (staffId !== undefined) {
        params.push(staffId);
        conditions.push(`o.staff_id = $${params.length}`);
    }
    if (ownerId !== undefined) {
        params.push(ownerId);
        conditions.push(`u.owner_id = $${params.length}`);
    }

    const orderResult = await pool.query(
        `SELECT o.*, u.name AS staff_name
         FROM orders o
         JOIN users u ON u.id = o.staff_id
         WHERE ${conditions.join(" AND ")}`,
        params
    );
    const order = orderResult.rows[0];
    if (!order) return null;

    const itemsResult = await pool.query(
        `SELECT oi.id, oi.product_id,
                COALESCE(oi.product_name, p.name) AS product_name,
                oi.quantity, oi.unit_price, oi.subtotal
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1
         ORDER BY oi.id ASC`,
        [orderId]
    );

    return { ...order, items: itemsResult.rows };
}

/** Semua order milik staff dari owner ini, untuk dashboard owner. */
export async function getOrdersByOwner(ownerId: number) {
    const result = await pool.query(
        `SELECT o.*, u.name AS staff_name
         FROM orders o
         JOIN users u ON u.id = o.staff_id AND u.owner_id = $1
         ORDER BY o.created_at DESC`,
        [ownerId]
    );
    return result.rows;
}
