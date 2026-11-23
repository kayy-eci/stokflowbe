import { pool } from "../config/db.ts";

export async function getRevenueSummary(startDate: string, endDate: string) {
    // Rentang inklusif sampai akhir hari `endDate`. `BETWEEN '2026-11-21'
    // AND '2026-11-21'` hanya mencakup pukul 00:00, jadi transaksi siang/sore
    // hilang dari laporan.
    const result = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue, COUNT(*) AS total_orders
         FROM orders
         WHERE created_at >= $1::date
           AND created_at < ($2::date + interval '1 day')`,
        [startDate, endDate]
    );
    return result.rows[0];
}

export async function getTopProducts(startDate: string, endDate: string, limit = 10) {
    const result = await pool.query(
        `SELECT p.id, p.name, SUM(oi.quantity) AS total_sold, SUM(oi.subtotal) AS total_revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
         WHERE o.created_at >= $1::date
           AND o.created_at < ($2::date + interval '1 day')
         GROUP BY p.id, p.name
         ORDER BY total_sold DESC
         LIMIT $3`,
        [startDate, endDate, limit]
    );
    return result.rows;
}

export async function getMarginReport(startDate: string, endDate: string) {
    const result = await pool.query(
        `SELECT p.id, p.name,
            SUM(oi.quantity) AS total_sold,
            SUM(oi.subtotal) AS total_revenue,
            SUM(oi.quantity * p.cost_price) AS total_cost,
            SUM(oi.subtotal) - SUM(oi.quantity * p.cost_price) AS total_margin
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
         WHERE o.created_at >= $1::date
           AND o.created_at < ($2::date + interval '1 day')
         GROUP BY p.id, p.name
         ORDER BY total_margin DESC`,
        [startDate, endDate]
    );
    return result.rows;
}

export async function getLowStockProducts() {
    const result = await pool.query(
        "SELECT * FROM products WHERE stock_qty <= low_stock_threshold AND is_active = true"
    );
    return result.rows;
}
