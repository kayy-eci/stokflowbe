import { pool } from "../config/db.ts";
import type { CreateUserInput, UpdateStaffInput } from "../models/schema.ts";
import { hashPassword } from "../utils/password.ts";

/** Kolom user yang aman dikirim ke klien — tidak pernah `password_hash`. */
const SAFE_COLUMNS =
    "id, name, email, role, is_active, created_at, updated_at";

export const getAllUsers = async () => {
    const result = await pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users ORDER BY created_at ASC`
    );
    return result.rows;
};

/** Akun staff saja — dipakai layar Manajemen Staff milik owner. */
export const getStaffUsers = async () => {
    const result = await pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users WHERE role = 'staff' ORDER BY name ASC`
    );
    return result.rows;
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
 * Update staff oleh owner: nama, reset password, dan/atau status aktif.
 * Role tidak bisa diubah lewat sini.
 */
export const updateStaff = async (id: number, data: UpdateStaffInput) => {
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
        return getUserById(id);
    }

    values.push(id);
    fields.push("updated_at = now()");

    const result = await pool.query(
        `UPDATE users SET ${fields.join(", ")}
         WHERE id = $${values.length} AND role = 'staff'
         RETURNING ${SAFE_COLUMNS}`,
        values
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
