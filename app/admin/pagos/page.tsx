import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";
import PaymentsReview from "./PaymentsReview";

export const metadata: Metadata = {
  title: "Pagos | Admin FLUX",
  robots: { index: false, follow: false },
};


interface PaymentRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  company: string | null;
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
  invoices: Array<{ id: string; invoice_number: string; invoice_url: string; amount: string | null; uploaded_at: string }>;
  invoices_total: string;
}

export default async function AdminPagosPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const result = await query<PaymentRow>(`
    SELECT p.id, p.user_id, u.name AS user_name, u.email AS user_email,
           u.company, p.amount, p.period_label, p.due_date, p.status,
           p.payment_method, p.receipt_url, p.receipt_uploaded_at, p.validated_at, p.admin_note,
           p.invoice_url, p.invoice_number,
           COALESCE(
             (SELECT json_agg(json_build_object(
               'id', pi.id,
               'invoice_number', pi.invoice_number,
               'invoice_url', pi.invoice_url,
               'amount', pi.amount,
               'uploaded_at', pi.uploaded_at
             ) ORDER BY pi.uploaded_at)
             FROM payment_invoices pi WHERE pi.payment_id = p.id),
             '[]'::json
           ) AS invoices,
           COALESCE(
             (SELECT SUM(pi.amount) FROM payment_invoices pi WHERE pi.payment_id = p.id),
             0
           ) AS invoices_total
    FROM payments p
    JOIN users u ON u.id = p.user_id
    ORDER BY
      CASE p.status
        WHEN 'reviewing' THEN 0
        WHEN 'pending' THEN 1
        WHEN 'overdue' THEN 2
        WHEN 'upcoming' THEN 3
        WHEN 'validated' THEN 4
      END,
      p.due_date DESC
  `);

  const payments = result.rows;
  const reviewing = payments.filter(p => p.status === "reviewing").length;
  const pending = payments.filter(p => p.status === "pending" || p.status === "overdue").length;
  const validated = payments.filter(p => p.status === "validated").length;
  const totalCollected = payments
    .filter(p => p.status === "validated")
    .reduce((s, p) => s + parseFloat(p.amount), 0);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
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

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-800 text-[#18191F]">Pagos</h1>
          <p className="text-sm text-[#999999] mt-0.5">Todos los pagos: transferencia y tarjeta (Culqi)</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
            <p className="text-xs text-[#999999]">Por revisar</p>
            <p className="text-2xl font-800 text-[#1D4ED8]">{reviewing}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
            <p className="text-xs text-[#999999]">Pendientes</p>
            <p className="text-2xl font-800 text-[#B45309]">{pending}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
            <p className="text-xs text-[#999999]">Validados</p>
            <p className="text-2xl font-800 text-[#2D7D46]">{validated}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
            <p className="text-xs text-[#999999]">Total cobrado</p>
            <p className="text-2xl font-800 text-[#18191F]">${totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <PaymentsReview payments={payments} />
      </div>
    </div>
  );
}
