import { pool } from "../config/db.ts";
import type { CreateProductInput, UpdateProductInput } from "../models/schema.ts";

export async function getAllProducts() {
    const result = await pool.query(
        "SELECT * FROM products WHERE is_active = true ORDER BY name ASC"
    );
    return result.rows;
}

/**
 * Katalog untuk staff: stok, harga jual, dan kategori saja.
 *
 * `cost_price` sengaja tidak dipilih — staff tidak boleh melihat harga modal.
 * Jangan ganti ke `SELECT *`.
 */
export async function getActiveProductsForStaff() {
    const result = await pool.query(
        `SELECT id, sku, name, category_id, sell_price, stock_qty,
                low_stock_threshold, is_active, image_url, created_at, updated_at
         FROM products
         WHERE is_active = true
         ORDER BY name ASC`
    );
    return result.rows;
}

export async function getProductById(id: number) {
    const result = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    return result.rows[0] ?? null;
}

export async function createProduct(data: CreateProductInput) {
    const result = await pool.query(
        `INSERT INTO products (sku, name, category_id, cost_price, sell_price, stock_qty, low_stock_threshold, is_active, image_url, image_public_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
            data.sku,
            data.name,
            data.category_id ?? null,
            data.cost_price,
            data.sell_price,
            data.stock_qty ?? 0,
            data.low_stock_threshold ?? 5,
            data.is_active ?? true,
            data.image_url ?? null,
            data.image_public_id ?? null,
        ]
    );
    return result.rows[0];
}

export async function updateProduct(id: number, data: UpdateProductInput) {
    const fields: string[] = [];
    const values: unknown[] = [];

    const addField = (column: string, value: unknown) => {
        if (value !== undefined) {
            values.push(value);
            fields.push(`${column} = $${values.length}`);
        }
    };

    addField("sku", data.sku);
    addField("name", data.name);
    addField("category_id", data.category_id);
    addField("cost_price", data.cost_price);
    addField("sell_price", data.sell_price);
    addField("stock_qty", data.stock_qty);
    addField("low_stock_threshold", data.low_stock_threshold);
    addField("is_active", data.is_active);
    addField("image_url", data.image_url);
    addField("image_public_id", data.image_public_id);

    if (fields.length === 0) {
        return getProductById(id);
    }

    values.push(id);
    fields.push("updated_at = now()");

    const result = await pool.query(
        `UPDATE products SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values
    );
    return result.rows[0] ?? null;
}

export async function deactivateProduct(id: number) {
    const result = await pool.query(
        "UPDATE products SET is_active = false, updated_at = now() WHERE id = $1 RETURNING *",
        [id]
    );
    return result.rows[0] ?? null;
}
