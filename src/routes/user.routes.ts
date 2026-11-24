import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import "dotenv/config";
import { CreateUserSchema, Credetials } from "../models/schema.ts";
import * as userService from "../services/users.service.ts";
import { tokenMiddleWare } from "../middleware/auth.middleware.ts";
import { comparePassword } from "../utils/password.ts";

const router = Router();

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
    throw new Error("JWT_SECRET belum diisi di .env");
}

const createToken = (user: { id: number; email: string; role: "owner" | "staff" }) => {
    const options: SignOptions = {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"],
    };
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, options);
};

router.get("/users", tokenMiddleWare, async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();

    res.status(200).json({
      message: "Berhasil fetch users!",
      data: users
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Gagal mengambil data users"
    });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Data user tidak valid",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const existingUser = await userService.getUserByEmail(parsed.data.email);
    if (existingUser) {
      res.status(409).json({ message: "Email sudah terdaftar" });
      return;
    }

    const user = await userService.createUser(parsed.data);
    const token = createToken(user);

    res.status(201).json({
      message: "Berhasil register!",
      data: { user, token },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Gagal register user" });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = Credetials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Credentials tidak valid",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const user = await userService.getUserByEmail(parsed.data.email);
    if (!user || !(await comparePassword(parsed.data.password, user.password_hash))) {
      res.status(401).json({ message: "Email atau password salah" });
      return;
    }

    // Akun yang dinonaktifkan owner tidak boleh login.
    if (user.is_active === false) {
      res.status(403).json({ message: "Akun ini sudah dinonaktifkan" });
      return;
    }

    const { password_hash, ...safeUser } = user;
    const token = createToken(user);

    res.status(200).json({
      message: "Berhasil login!",
      data: { user: safeUser, token },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Gagal login" });
  }
});

router.get("/profile", tokenMiddleWare, async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(res.locals.user!.id);
    if (!user) {
      res.status(404).json({ message: "User tidak ditemukan" });
      return;
    }

    res.status(200).json({
      message: "Berhasil fetch profile!",
      data: user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Gagal mengambil data profile" });
  }
});

export default router;
