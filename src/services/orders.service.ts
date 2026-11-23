import { pool } from "../config/db.ts";
import type { CreateOrderInput } from "../models/schema.ts";

export async function createOrder(staffId: number, data: CreateOrderInput) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        let total = 0;
        const itemsWithPrice: Array<{
            productId: number;
            quantity: number;
            unitPrice: number;
            subtotal: number;
        }> = [];

        for (const item of data.items) {
            // Lock baris produk ini biar gak ada transaksi lain yang baca stok bareng
            const productResult = await client.query(
                "SELECT id, sell_price, stock_qty FROM products WHERE id = $1 FOR UPDATE",
                [item.product_id]
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
                quantity: item.quantity,
                unitPrice,
                subtotal,
            });
        }

        const orderResult = await client.query(
            "INSERT INTO orders (staff_id, total_amount) VALUES ($1, $2) RETURNING *",
            [staffId, total]
        );
        const order = orderResult.rows[0];

        for (const item of itemsWithPrice) {
            await client.query(
                "INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5)",
                [order.id, item.productId, item.quantity, item.unitPrice, item.subtotal]
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

// Semua order dari semua staff, untuk dashboard owner
export async function getAllOrders() {
    const result = await pool.query(
        `SELECT o.*, u.name AS staff_name
         FROM orders o
         JOIN users u ON u.id = o.staff_id
         ORDER BY o.created_at DESC`
    );
    return result.rows;
}
