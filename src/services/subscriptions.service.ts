import { pool } from "../config/db.ts";
import type { CreatePaymentInput, PlanPaymentMethod } from "../models/schema.ts";

export type PlanRow = {
    id: number;
    code: string;
    name: string;
    tier: string;
    price: string;
    duration_days: number;
    is_active: boolean;
    created_at: string;
};

export type SubscriptionRow = {
    id: string;
    owner_id: string;
    plan_id: number;
    plan_name: string;
    plan_code: string;
    status: "active" | "expired" | "cancelled";
    started_at: string;
    expires_at: string;
    created_at: string;
};

export type PaymentRow = {
    id: string;
    plan_id: number;
    plan_name: string;
    reference: string;
    amount: string;
    method: PlanPaymentMethod;
    status: "pending" | "paid" | "failed" | "expired";
    paid_at: string | null;
    created_at: string;
};

export async function getActivePlans(): Promise<PlanRow[]> {
    const result = await pool.query(
        `SELECT id, code, name, tier, price, duration_days, is_active, created_at
         FROM plans
         WHERE is_active = true
         ORDER BY duration_days ASC`
    );
    return result.rows;
}

export async function getPlanById(id: number): Promise<PlanRow | null> {
    const result = await pool.query(
        "SELECT * FROM plans WHERE id = $1 AND is_active = true",
        [id]
    );
    return result.rows[0] ?? null;
}

/**
 * Langganan aktif = status `active` dan `expires_at` masih di depan.
 * Baris lama yang sudah lewat tanggal dianggap tidak aktif walaupun
 * statusnya belum diubah (tidak ada job scheduler di proyek ini).
 */
export async function getActiveSubscription(ownerId: number) {
    const result = await pool.query(
        `SELECT s.*, p.name AS plan_name, p.code AS plan_code
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.owner_id = $1
           AND s.status = 'active'
           AND s.expires_at > now()
         ORDER BY s.expires_at DESC
         LIMIT 1`,
        [ownerId]
    );
    return (result.rows[0] ?? null) as SubscriptionRow | null;
}

export async function getSubscriptionHistory(ownerId: number) {
    const result = await pool.query(
        `SELECT s.*, p.name AS plan_name, p.code AS plan_code
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.owner_id = $1
         ORDER BY s.created_at DESC`,
        [ownerId]
    );
    return result.rows as SubscriptionRow[];
}

export async function getPayments(ownerId: number) {
    const result = await pool.query(
        `SELECT pay.id, pay.plan_id, p.name AS plan_name, pay.reference,
                pay.amount, pay.method, pay.status, pay.paid_at, pay.created_at
         FROM payments pay
         JOIN plans p ON p.id = pay.plan_id
         WHERE pay.owner_id = $1
         ORDER BY pay.created_at DESC`,
        [ownerId]
    );
    return result.rows as PaymentRow[];
}

/** Nomor referensi simulasi, mis. `SF-1732500000000-4821`. */
function makeReference() {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `SF-${Date.now()}-${random}`;
}

/**
 * Buat tagihan `pending`. Tidak ada gateway: pembayaran dianggap lunas saat
 * klien memanggil endpoint konfirmasi, meniru alur sandbox.
 */
export async function createPayment(ownerId: number, data: CreatePaymentInput) {
    const plan = await getPlanById(data.plan_id);
    if (!plan) {
        throw new Error("Paket tidak ditemukan");
    }

    const result = await pool.query(
        `INSERT INTO payments (owner_id, plan_id, reference, amount, method, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [ownerId, plan.id, makeReference(), plan.price, data.method]
    );
    const payment = result.rows[0];

    return {
        ...payment,
        plan_name: plan.name,
        // Data "instruksi bayar" untuk ditampilkan layar bayar simulasi.
        instructions: paymentInstructions(data.method, payment.reference),
    };
}

function paymentInstructions(method: PlanPaymentMethod, reference: string) {
    switch (method) {
        case "qris":
            return { label: "QRIS", value: reference };
        case "va":
            return { label: "Virtual Account", value: `8808${reference.slice(-8)}` };
        case "ewallet":
            return { label: "E-wallet", value: `0812${reference.slice(-8)}` };
    }
}

/**
 * Tandai pembayaran lunas lalu buat/perpanjang langganan, dalam satu
 * transaksi. Pemanggilan ulang pada payment yang sudah `paid` tidak
 * menggandakan langganan.
 */
export async function confirmPayment(ownerId: number, paymentId: number) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const paymentResult = await client.query(
            "SELECT * FROM payments WHERE id = $1 AND owner_id = $2 FOR UPDATE",
            [paymentId, ownerId]
        );
        const payment = paymentResult.rows[0];
        if (!payment) {
            throw new Error("Pembayaran tidak ditemukan");
        }
        if (payment.status === "paid") {
            await client.query("COMMIT");
            const sub = await getActiveSubscription(ownerId);
            return { payment, subscription: sub, alreadyPaid: true };
        }
        if (payment.status !== "pending") {
            throw new Error(`Pembayaran berstatus ${payment.status}, tidak bisa dikonfirmasi`);
        }

        const planResult = await client.query(
            "SELECT * FROM plans WHERE id = $1",
            [payment.plan_id]
        );
        const plan = planResult.rows[0];
        if (!plan) {
            throw new Error("Paket pembayaran tidak ditemukan");
        }

        await client.query(
            "UPDATE payments SET status = 'paid', paid_at = now() WHERE id = $1",
            [paymentId]
        );

        // Perpanjang dari masa aktif yang tersisa bila ada, supaya sisa hari
        // tidak hangus saat membeli paket baru.
        const current = await client.query(
            `SELECT expires_at FROM subscriptions
             WHERE owner_id = $1 AND status = 'active' AND expires_at > now()
             ORDER BY expires_at DESC LIMIT 1`,
            [ownerId]
        );
        const base = current.rows[0]?.expires_at
            ? new Date(current.rows[0].expires_at)
            : new Date();

        const expiresAt = new Date(base);
        expiresAt.setDate(expiresAt.getDate() + Number(plan.duration_days));

        const subResult = await client.query(
            `INSERT INTO subscriptions (owner_id, plan_id, status, started_at, expires_at)
             VALUES ($1, $2, 'active', now(), $3)
             RETURNING *`,
            [ownerId, plan.id, expiresAt]
        );
        const subscription = subResult.rows[0];

        await client.query(
            "UPDATE payments SET subscription_id = $1 WHERE id = $2",
            [subscription.id, paymentId]
        );

        await client.query("COMMIT");

        return {
            payment: { ...payment, status: "paid", subscription_id: subscription.id },
            subscription: { ...subscription, plan_name: plan.name, plan_code: plan.code },
            alreadyPaid: false,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
