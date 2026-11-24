import multer from "multer";

/**
 * Upload gambar produk disimpan di memori dulu, lalu diteruskan ke
 * Cloudinary sebagai buffer. Tidak ada file yang menyentuh disk server,
 * jadi aman untuk platform yang filesystem-nya ephemeral (Railway).
 */
const storage = multer.memoryStorage();

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — sama dengan batas dokumentasi

export const imageUpload = multer({
    storage,
    limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
            return;
        }
        cb(new Error("File harus berupa gambar (JPG, PNG, atau WebP)"));
    },
});

/**
 * Bungkus `multer.single("image")` supaya error-nya jadi JSON 400, bukan
 * halaman HTML default Express. Field multipart yang diterima bernama `image`.
 */
export function uploadSingleImage(req: any, res: any, next: any) {
    imageUpload.single("image")(req, res, (error: unknown) => {
        if (!error) {
            next();
            return;
        }
        if (error instanceof multer.MulterError) {
            const message =
                error.code === "LIMIT_FILE_SIZE"
                    ? "Ukuran gambar maksimal 5 MB"
                    : `Upload gagal: ${error.message}`;
            res.status(400).json({ message });
            return;
        }
        res.status(400).json({
            message:
                error instanceof Error ? error.message : "Upload gambar gagal",
        });
    });
}
