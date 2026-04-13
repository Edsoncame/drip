import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";
import ClientsTable from "./ClientsTable";

export const metadata: Metadata = {
  title: "Clientes | Admin FLUX",
  robots: { index: false, follow: false },
};


interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  ruc: string | null;
  legal_representative: string | null;
  google_id: string | null;
  referral_code: string | null;
  identity_verified: boolean | null;
  created_at: string;
  total_subs: string;
  active_subs: string;
  total_spent: string;
  products: string | null;
  last_sub_date: string | null;
  delivery_address: string | null;
  delivery_distrito: string | null;
}

interface SubDetail {
  id: string;
  user_id: string;
  product_name: string;
  months: number;
  monthly_price: string;
  status: string;
  started_at: string;
  ends_at: string | null;
  apple_care: boolean | null;
  delivery_method: string | null;
  delivery_address: string | null;
  delivery_distrito: string | null;
  tracking_number: string | null;
  mp_subscription_id: string | null;
}

interface PaymentDetail {
  id: string;
  user_id: string;
  amount: string;
  period_label: string;
  due_date: string;
  status: string;
  payment_method: string | null;
  receipt_url: string | null;
  receipt_uploaded_at: string | null;
  validated_at: string | null;
  admin_note: string | null;
  invoice_url: string | null;
  invoice_number: string | null;
}

export default async function ClientesPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const [clientsResult, subsResult, paymentsResult] = await Promise.all([
    query<Client>(`
      SELECT u.id, u.name, u.email, u.phone, u.company, u.ruc, u.legal_representative,
             u.google_id, u.referral_code, u.identity_verified, u.created_at,
             COUNT(s.id) AS total_subs,
             COUNT(s.id) FILTER (WHERE s.status IN ('active','shipped','delivered')) AS active_subs,
             COALESCE(SUM(s.monthly_price::numeric * s.months) FILTER (WHERE s.status != 'cancelled'), 0) AS total_spent,
             STRING_AGG(DISTINCT s.product_name, ', ') AS products,
             MAX(s.started_at) AS last_sub_date,
             (SELECT s2.delivery_address FROM subscriptions s2 WHERE s2.user_id = u.id ORDER BY s2.started_at DESC LIMIT 1) AS delivery_address,
             (SELECT s2.delivery_distrito FROM subscriptions s2 WHERE s2.user_id = u.id ORDER BY s2.started_at DESC LIMIT 1) AS delivery_distrito
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id
      WHERE COALESCE(u.is_admin, false) = false
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `),
    query<SubDetail>(`
      SELECT id, user_id, product_name, months, monthly_price, status,
             started_at, ends_at, apple_care, delivery_method, delivery_address,
             delivery_distrito, tracking_number, mp_subscription_id
      FROM subscriptions
      WHERE user_id IS NOT NULL
      ORDER BY started_at DESC
    `),
    query<PaymentDetail>(`
      SELECT id, user_id, amount, period_label, due_date, status,
             payment_method, receipt_url, receipt_uploaded_at, validated_at,
             admin_note, invoice_url, invoice_number
      FROM payments
      ORDER BY due_date DESC
    `),
  ]);

  const clients = clientsResult.rows;
  const allSubs = subsResult.rows;
  const allPayments = paymentsResult.rows;

  // Stats
  const totalClients = clients.length;
  const withActiveSubs = clients.filter(c => parseInt(c.active_subs) > 0).length;
  const googleUsers = clients.filter(c => c.google_id).length;
  const totalRevenue = clients.reduce((sum, c) => sum + parseFloat(c.total_spent), 0);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#E5E5E5] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logoflux.svg" alt="FLUX" className="h-7 w-auto" />
          <span className="text-xs font-600 px-2 py-0.5 bg-[#1B4FFF] text-white rounded-full">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#999999] hidden sm:block">{session.email}</span>
          <a href="/" className="text-sm text-[#666666] hover:text-[#1B4FFF] transition-colors">← Sitio</a>
        </div>
      </div>

      <AdminNav />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-800 text-[#18191F]">Clientes</h1>
          <p className="text-sm text-[#999999] mt-0.5">Base de datos completa de usuarios registrados</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
            <p className="text-xs text-[#999999]">Total clientes</p>
            <p className="text-2xl font-800 text-[#18191F]">{totalClients}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
            <p className="text-xs text-[#999999]">Con renta activa</p>
            <p className="text-2xl font-800 text-[#2D7D46]">{withActiveSubs}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
            <p className="text-xs text-[#999999]">Login con Google</p>
            <p className="text-2xl font-800 text-[#1B4FFF]">{googleUsers}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
            <p className="text-xs text-[#999999]">Revenue total</p>
            <p className="text-2xl font-800 text-[#18191F]">${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}</p>
          </div>
        </div>

        <ClientsTable clients={clients} allSubs={allSubs} allPayments={allPayments} />
      </div>
    </div>
  );
}
