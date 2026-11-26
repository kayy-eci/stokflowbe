import { pool } from "../config/db.ts";

/**
 * Semua laporan dibatasi oleh owner. Transaksi dihubungkan ke owner lewat
 * staff yang membuatnya (`orders.staff_id -> users.owner_id`), dan produk
 * juga dibatasi langsung lewat `products.owner_id`.
 */

export async function getRevenueSummary(
    startDate: string,
    endDate: string,
    ownerId: number
) {
    const result = await pool.query(
        `SELECT COALESCE(SUM(o.total_amount), 0) AS total_revenue,
                COUNT(*)::int AS total_orders
         FROM orders o
         JOIN users u ON u.id = o.staff_id AND u.owner_id = $3
         WHERE o.created_at >= $1::date
           AND o.created_at < ($2::date + interval '1 day')`,
        [startDate, endDate, ownerId]
    );
    return result.rows[0];
}

export async function getTopProducts(
    startDate: string,
    endDate: string,
    ownerId: number,
    limit = 10
) {
    const result = await pool.query(
        `SELECT p.id, p.name, SUM(oi.quantity) AS total_sold, SUM(oi.subtotal) AS total_revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN users u ON u.id = o.staff_id AND u.owner_id = $4
         JOIN products p ON p.id = oi.product_id AND p.owner_id = $4
         WHERE o.created_at >= $1::date
           AND o.created_at < ($2::date + interval '1 day')
         GROUP BY p.id, p.name
         ORDER BY total_sold DESC
         LIMIT $3`,
        [startDate, endDate, limit, ownerId]
    );
    return result.rows;
}

export async function getMarginReport(
    startDate: string,
    endDate: string,
    ownerId: number
) {
    const result = await pool.query(
        `SELECT p.id, p.name,
            SUM(oi.quantity) AS total_sold,
            SUM(oi.subtotal) AS total_revenue,
            SUM(oi.quantity * p.cost_price) AS total_cost,
            SUM(oi.subtotal) - SUM(oi.quantity * p.cost_price) AS total_margin
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN users u ON u.id = o.staff_id AND u.owner_id = $3
         JOIN products p ON p.id = oi.product_id AND p.owner_id = $3
         WHERE o.created_at >= $1::date
           AND o.created_at < ($2::date + interval '1 day')
         GROUP BY p.id, p.name
         ORDER BY total_margin DESC`,
        [startDate, endDate, ownerId]
    );
    return result.rows;
}

export async function getLowStockProducts(ownerId: number) {
    const result = await pool.query(
        `SELECT * FROM products
         WHERE stock_qty <= low_stock_threshold
           AND is_active = true
           AND owner_id = $1`,
        [ownerId]
    );
    return result.rows;
}
