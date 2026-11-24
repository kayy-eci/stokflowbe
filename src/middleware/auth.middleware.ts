import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { pool } from "../config/db.ts";
import type { UserTokenPayload } from "../types/express.ts";

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
    throw new Error("JWT_SECRET belum diisi di .env");
}

/**
 * Token lama tetap valid sampai kedaluwarsa, jadi status aktif dicek ulang
 * ke database. Dipakai di route staff supaya akun yang dinonaktifkan owner
 * langsung kehilangan akses tanpa menunggu token habis.
 */
export const activeUserMiddleWare = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user?.id;
    if (!userId) {
        return res.status(401).json({ message: "Token tidak valid" });
    }

    try {
        const result = await pool.query(
            "SELECT is_active FROM users WHERE id = $1",
            [userId]
        );
        const row = result.rows[0];
        if (!row) {
            return res.status(401).json({ message: "User tidak ditemukan" });
        }
        if (row.is_active === false) {
            return res.status(403).json({ message: "Akun ini sudah dinonaktifkan" });
        }
        next();
    } catch (error) {
        console.error("Check active user error:", error);
        return res.status(500).json({ message: "Gagal memeriksa status akun" });
    }
};

export const tokenMiddleWare = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized. No token provided"
        })
    }
    try {
        const payload = jwt.verify(token, SECRET) as UserTokenPayload;

        if (!payload.id) {
            return res.status(401).json({
                message: "Invalid token payload" 
            })
        }
        res.locals.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid token"
        })
    }
}
