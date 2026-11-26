import { pool } from "../config/db.ts";
import type { CreateCategoryInput, UpdateCategoryInput } from "../models/schema.ts";

export async function getAllCategories(ownerId: number) {
    const result = await pool.query(
        "SELECT * FROM categories WHERE owner_id = $1 ORDER BY name ASC",
        [ownerId]
    );
    return result.rows;
}

/** Kategori untuk filter katalog staff — tanpa kolom internal owner_id. */
export async function getCategoriesForStaff(ownerId: number) {
    const result = await pool.query(
        "SELECT id, name FROM categories WHERE owner_id = $1 ORDER BY name ASC",
        [ownerId]
    );
    return result.rows;
}

export async function createCategory(
    data: CreateCategoryInput,
    ownerId: number
) {
    const result = await pool.query(
        "INSERT INTO categories (name, owner_id) VALUES ($1, $2) RETURNING *",
        [data.name, ownerId]
    );
    return result.rows[0];
}

export async function updateCategory(
    id: number,
    data: UpdateCategoryInput,
    ownerId: number
) {
    const result = await pool.query(
        `UPDATE categories SET name = COALESCE($1, name)
         WHERE id = $2 AND owner_id = $3 RETURNING *`,
        [data.name ?? null, id, ownerId]
    );
    return result.rows[0] ?? null;
}

export async function deleteCategory(id: number, ownerId: number) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Hanya produk milik owner ini yang boleh dilepas dari kategori.
        await client.query(
            "UPDATE products SET category_id = NULL WHERE category_id = $1 AND owner_id = $2",
            [id, ownerId]
        );
        const result = await client.query(
            "DELETE FROM categories WHERE id = $1 AND owner_id = $2 RETURNING *",
            [id, ownerId]
        );
        await client.query("COMMIT");
        return result.rows[0] ?? null;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
