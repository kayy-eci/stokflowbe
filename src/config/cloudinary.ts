import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

/**
 * Cloudinary hanya dikonfigurasi kalau ketiga variabel ada. Tanpa ini server
 * tetap boot (fitur lain tidak ikut mati), dan endpoint upload membalas 503
 * dengan pesan yang jelas, bukan crash saat import.
 */
export const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isCloudinaryConfigured) {
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });
} else {
    console.warn(
        "Cloudinary belum dikonfigurasi: set CLOUDINARY_CLOUD_NAME, " +
            "CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET di .env"
    );
}

export { cloudinary };
