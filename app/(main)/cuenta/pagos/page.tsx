import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import Link from "next/link";
import UploadReceipt from "./UploadReceipt";

interface Payment {
  id: string;
  amount: string;
  currency: string;
  period_label: string;
  due_date: string;
  status: string;
  receipt_url: string | null;
  validated_at: string | null;
  admin_note: string | null;
  invoice_url: string | null;
  invoice_number: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  validated: { label: "Pagado", color: "#2D7D46", bg: "#E5F3DF", icon: "✓" },
  pending:   { label: "Por pagar", color: "#B45309", bg: "#FEF3C7", icon: "!" },
  reviewing: { label: "En revisión", color: "#1D4ED8", bg: "#DBEAFE", icon: "⏳" },
  upcoming:  { label: "Próximo", color: "#6B7280", bg: "#F3F4F6", icon: "○" },
  overdue:   { label: "Vencido", color: "#DC2626", bg: "#FEE2E2", icon: "!" },
};

export default async function PagosPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login?redirect=/cuenta/pagos");

  const result = await query<Payment>(
    `SELECT id, amount, currency, period_label, due_date, status,
            receipt_url, validated_at, admin_note, invoice_url, invoice_number
     FROM payments
     WHERE user_id = $1
     ORDER BY due_date DESC`,
    [session.userId]
  );
  const payments = result.rows;

  const totalPaid = payments
    .filter(p => p.status === "validated")
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const pendingCount = payments.filter(p => p.status === "pending" || p.status === "overdue").length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/cuenta" className="text-[#999999] hover:text-[#1B4FFF] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-3xl font-800 text-[#18191F]">Mis pagos</h1>
          <p className="text-sm text-[#666666]">Historial de facturación y comprobantes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4">
          <p className="text-xs text-[#999999] mb-1">Total pagado</p>
          <p className="text-2xl font-800 text-[#2D7D46]">${totalPaid.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4">
          <p className="text-xs text-[#999999] mb-1">Pagos pendientes</p>
          <p className="text-2xl font-800 text-[#B45309]">{pendingCount}</p>
        </div>
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-[#999999] mb-1">Total facturas</p>
          <p className="text-2xl font-800 text-[#18191F]">{payments.length}</p>
        </div>
      </div>

      {/* Bank info */}
      <div className="bg-[#F5F8FF] border border-[#DDEAFF] rounded-2xl p-6 mb-8">
        <h2 className="font-700 text-[#18191F] mb-3 flex items-center gap-2">
          <span className="text-xl">🏦</span> Datos para transferencia
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border border-[#E5E5E5]">
            <p className="text-xs text-[#999999] mb-1">Banco</p>
            <p className="font-700 text-[#18191F]">BCP — Banco de Crédito del Perú</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-[#E5E5E5]">
            <p className="text-xs text-[#999999] mb-1">Cuenta en dólares</p>
            <p className="font-700 text-[#18191F] font-mono">194-12345678-1-05</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-[#E5E5E5]">
            <p className="text-xs text-[#999999] mb-1">CCI (para interbancario)</p>
            <p className="font-700 text-[#18191F] font-mono text-sm">002-194-0012345678-1-05</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-[#E5E5E5]">
            <p className="text-xs text-[#999999] mb-1">Titular</p>
            <p className="font-700 text-[#18191F]">Tika Services S.A.C.</p>
            <p className="text-xs text-[#999999]">RUC: 20605702512</p>
          </div>
        </div>
        <p className="text-xs text-[#999999] mt-3">Después de transferir, sube tu comprobante abajo para que validemos tu pago.</p>
      </div>

      {/* Payments list */}
      <h2 className="font-700 text-[#18191F] mb-4">Historial de pagos</h2>

      {payments.length === 0 ? (
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center">
          <p className="text-[#999999]">No tienes pagos registrados aún.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map(payment => {
            const st = STATUS_MAP[payment.status] ?? STATUS_MAP.pending;
            return (
              <div key={payment.id} className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="font-700 text-[#18191F]">{payment.period_label}</p>
                    <p className="text-xs text-[#999999]">
                      Vence: {new Date(payment.due_date).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-800 text-[#18191F]">${parseFloat(payment.amount).toFixed(2)}</p>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-700"
                      style={{ color: st.color, background: st.bg }}>
                      {st.icon} {st.label}
                    </span>
                  </div>
                </div>

                {/* Actions based on status */}
                <div className="space-y-2">
                  {payment.status === "validated" && (
                    <div className="bg-[#E5F3DF] rounded-xl p-3 flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <p className="text-sm text-[#2D7D46] font-600">
                        Pago validado
                        {payment.validated_at && ` el ${new Date(payment.validated_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}`}
                      </p>
                    </div>
                  )}

                  {payment.status === "reviewing" && (
                    <div className="bg-[#DBEAFE] rounded-xl p-3 flex items-center gap-2">
                      <span>⏳</span>
                      <p className="text-sm text-[#1D4ED8] font-600">Estamos revisando tu comprobante. Te avisamos pronto.</p>
                    </div>
                  )}

                  {(payment.status === "pending" || payment.status === "overdue") && (
                    <UploadReceipt paymentId={payment.id} hasReceipt={!!payment.receipt_url} />
                  )}

                  {payment.status === "upcoming" && (
                    <div className="bg-[#F3F4F6] rounded-xl p-3">
                      <p className="text-sm text-[#666666]">Este pago aún no vence. Te avisaremos cuando sea momento.</p>
                    </div>
                  )}

                  {/* Invoice download — shown for ANY payment that has an invoice */}
                  {payment.invoice_url && (
                    <a href={payment.invoice_url} target="_blank" rel="noreferrer"
                      download={`${payment.invoice_number ?? "factura"}.pdf`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-[#1B4FFF] bg-[#F5F8FF] hover:bg-[#EEF2FF] transition-colors">
                      <div className="w-10 h-10 bg-[#1B4FFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">📄</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-700 text-[#18191F]">Descargar factura</p>
                        <p className="text-xs text-[#666666]">{payment.invoice_number}</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B4FFF" strokeWidth="2.5">
                        <path d="M12 4v16m0 0l-6-6m6 6l6-6"/>
                      </svg>
                    </a>
                  )}
                </div>

                {payment.admin_note && (
                  <p className="text-xs text-[#999999] mt-2">Nota: {payment.admin_note}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Help */}
      <div className="mt-8 bg-[#F7F7F7] rounded-2xl p-5 flex items-center gap-4">
        <span className="text-2xl">💬</span>
        <div>
          <p className="font-700 text-[#18191F] text-sm">¿Tienes dudas sobre un pago?</p>
          <p className="text-xs text-[#666666]">
            Escríbenos a{" "}
            <a href="https://wa.me/51932648702" className="text-[#1B4FFF] hover:underline">WhatsApp</a>
            {" "}o a{" "}
            <a href="mailto:hola@fluxperu.com" className="text-[#1B4FFF] hover:underline">hola@fluxperu.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
