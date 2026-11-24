import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary.ts";

export type UploadedImage = {
    image_url: string;
    image_public_id: string;
};

/**
 * Upload buffer gambar ke Cloudinary dan kembalikan URL + public id.
 *
 * Gambar di-resize maksimal 800x800 (crop fill) supaya thumbnail katalog
 * tidak mengunduh file kamera berukuran penuh.
 */
export async function uploadProductImage(
    buffer: Buffer,
    productId: number
): Promise<UploadedImage> {
    if (!isCloudinaryConfigured) {
        throw new Error("Cloudinary belum dikonfigurasi di server");
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "stokflow/products",
                public_id: `product-${productId}-${Date.now()}`,
                resource_type: "image",
                transformation: [
                    { width: 800, height: 800, crop: "limit" },
                    { quality: "auto", fetch_format: "auto" },
                ],
            },
            (error, result) => {
                if (error || !result) {
                    reject(error ?? new Error("Upload gambar gagal"));
                    return;
                }
                resolve({
                    image_url: result.secure_url,
                    image_public_id: result.public_id,
                });
            }
        );
        stream.end(buffer);
    });
}

/**
 * Hapus gambar dari Cloudinary. Kegagalan di sini tidak boleh membatalkan
 * perubahan data produk — gambar yatim lebih ringan risikonya daripada
 * produk yang gagal disimpan.
 */
export async function destroyImage(publicId: string): Promise<void> {
    if (!isCloudinaryConfigured) return;
    try {
        await cloudinary.uploader.destroy(publicId, { invalidate: true });
    } catch (error) {
        console.error(`Gagal menghapus gambar ${publicId}:`, error);
    }
}
