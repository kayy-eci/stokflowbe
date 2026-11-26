import { pool } from "../config/db.ts";
import type {
    CreateUserInput,
    CreateStaffInput,
    UpdateStaffInput,
} from "../models/schema.ts";
import { hashPassword } from "../utils/password.ts";

/** Kolom user yang aman dikirim ke klien — tidak pernah `password_hash`. */
const SAFE_COLUMNS =
    "id, name, email, role, is_active, created_at, updated_at";

/**
 * Daftar akun yang boleh dilihat pemegang token. Owner melihat dirinya dan
 * staff yang ia buat; staff hanya melihat dirinya. Role yang tidak dikenal
 * sengaja jatuh ke cabang paling sempit, bukan mengembalikan semua akun.
 */
export const getVisibleUsers = async (
    viewerId: number,
    role?: string
) => {
    if (role === "owner") {
        const result = await pool.query(
            `SELECT ${SAFE_COLUMNS} FROM users
             WHERE id = $1 OR (role = 'staff' AND owner_id = $1)
             ORDER BY created_at ASC`,
            [viewerId]
        );
        return result.rows;
    }

    const result = await pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`,
        [viewerId]
    );
    return result.rows;
};

/** Akun staff milik satu owner saja — dipakai layar Manajemen Staff. */
export const getStaffUsers = async (ownerId: number) => {
    const result = await pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users
         WHERE role = 'staff' AND owner_id = $1
         ORDER BY name ASC`,
        [ownerId]
    );
    return result.rows;
};

/** Ambil owner dari akun staff — dipakai route POS supaya staf hanya melihat toko induknya. */
export const getOwnerIdForUser = async (userId: number) => {
    const result = await pool.query(
        "SELECT owner_id FROM users WHERE id = $1",
        [userId]
    );
    const value = result.rows[0]?.owner_id;
    return value == null ? null : Number(value);
};

export const getUserById = async (id: number) => {
    const result = await pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`,
        [id]
    );
    return result.rows[0] ?? null;
};

export const getUserByEmail = async (email: string) => {
    const result = await pool.query(
        "SELECT id, name, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE email = $1",
        [email]
    );
    return result.rows[0] ?? null;
};

export const createUser = async (data: CreateUserInput) => {
    const passwordHash = await hashPassword(data.password);

    const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING ${SAFE_COLUMNS}`,
        [data.name, data.email, passwordHash, data.role]
    );
    return result.rows[0];
};

/**
 * Buat akun staff untuk owner tertentu. Owner selalu diisi dari token,
 * bukan dari body request, supaya klien tidak bisa menitipkan staff ke
 * owner lain.
 */
export const createStaffUser = async (
    ownerId: number,
    data: CreateStaffInput
) => {
    const passwordHash = await hashPassword(data.password);

    const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, owner_id)
         VALUES ($1, $2, $3, 'staff', $4)
         RETURNING ${SAFE_COLUMNS}`,
        [data.name, data.email, passwordHash, ownerId]
    );
    return result.rows[0];
};

/**
 * Update staff oleh owner: nama, reset password, dan/atau status aktif.
 * Role tidak bisa diubah lewat sini, dan owner lain tidak bisa menyentuh
 * staff yang bukan miliknya.
 */
export const updateStaff = async (
    id: number,
    ownerId: number,
    data: UpdateStaffInput
) => {
    const fields: string[] = [];
    const values: unknown[] = [];

    const addField = (column: string, value: unknown) => {
        if (value !== undefined) {
            values.push(value);
            fields.push(`${column} = $${values.length}`);
        }
    };

    addField("name", data.name);
    addField("is_active", data.is_active);
    if (data.password !== undefined) {
        values.push(await hashPassword(data.password));
        fields.push(`password_hash = $${values.length}`);
    }

    if (fields.length === 0) {
        return getStaffForOwner(id, ownerId);
    }

    values.push(id, ownerId);
    fields.push("updated_at = now()");

    const result = await pool.query(
        `UPDATE users SET ${fields.join(", ")}
         WHERE id = $${values.length - 1}
           AND owner_id = $${values.length}
           AND role = 'staff'
         RETURNING ${SAFE_COLUMNS}`,
        values
    );
    return result.rows[0] ?? null;
};

/** Ambil satu staff hanya jika masih menjadi milik owner ini. */
export const getStaffForOwner = async (id: number, ownerId: number) => {
    const result = await pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users
         WHERE id = $1 AND owner_id = $2 AND role = 'staff'`,
        [id, ownerId]
    );
    return result.rows[0] ?? null;
};

export const getStaffById = async (id: number) => {
    const result = await pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1 AND role = 'staff'`,
        [id]
    );
    return result.rows[0] ?? null;
};
