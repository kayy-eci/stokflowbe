import { pool } from "../config/db.ts";
import type { CreateProductInput, UpdateProductInput } from "../models/schema.ts";

/**
 * Semua fungsi di sini mewajibkan ownerId. Tidak ada varian "tanpa scope":
 * kalau ada, suatu hari ada route yang lupa mengirim owner dan membocorkan
 * produk owner lain.
 */

export async function getAllProducts(ownerId: number) {
    const result = await pool.query(
        "SELECT * FROM products WHERE is_active = true AND owner_id = $1 ORDER BY name ASC",
        [ownerId]
    );
    return result.rows;
}

/**
 * Katalog untuk staff milik owner ini: stok, harga jual, dan kategori saja.
 *
 * `cost_price` sengaja tidak dipilih — staff tidak boleh melihat harga modal.
 * Jangan ganti ke `SELECT *`.
 */
export async function getActiveProductsForStaff(ownerId: number) {
    const result = await pool.query(
        `SELECT id, sku, name, category_id, sell_price, stock_qty,
                low_stock_threshold, is_active, image_url, created_at, updated_at
         FROM products
         WHERE is_active = true AND owner_id = $1
         ORDER BY name ASC`,
        [ownerId]
    );
    return result.rows;
}

export async function getProductById(id: number, ownerId: number) {
    const result = await pool.query(
        "SELECT * FROM products WHERE id = $1 AND owner_id = $2",
        [id, ownerId]
    );
    return result.rows[0] ?? null;
}

/** Kategori boleh dipakai hanya jika dibuat oleh owner yang sama. */
export async function categoryBelongsToOwner(
    categoryId: number | null | undefined,
    ownerId: number
) {
    if (categoryId == null) return true;
    const result = await pool.query(
        "SELECT 1 FROM categories WHERE id = $1 AND owner_id = $2",
        [categoryId, ownerId]
    );
    return result.rowCount === 1;
}

export async function createProduct(data: CreateProductInput, ownerId: number) {
    const result = await pool.query(
        `INSERT INTO products
            (sku, name, category_id, cost_price, sell_price, stock_qty,
             low_stock_threshold, is_active, image_url, image_public_id, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
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
            ownerId,
        ]
    );
    return result.rows[0];
}

export async function updateProduct(
    id: number,
    data: UpdateProductInput,
    ownerId: number
) {
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
        return getProductById(id, ownerId);
    }

    values.push(id, ownerId);
    fields.push("updated_at = now()");

    const result = await pool.query(
        `UPDATE products SET ${fields.join(", ")}
         WHERE id = $${values.length - 1} AND owner_id = $${values.length}
         RETURNING *`,
        values
    );
    return result.rows[0] ?? null;
}

export async function deactivateProduct(id: number, ownerId: number) {
    const result = await pool.query(
        `UPDATE products SET is_active = false, updated_at = now()
         WHERE id = $1 AND owner_id = $2 RETURNING *`,
        [id, ownerId]
    );
    return result.rows[0] ?? null;
}
