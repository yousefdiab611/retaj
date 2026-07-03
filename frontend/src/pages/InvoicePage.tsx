import { Download, Printer, ArrowLeft, Facebook, Instagram } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { fetchTransactionInvoice } from "@/lib/api";
import { BRAND_LOGO_PRIMARY_SRC, BRAND_LOGO_FALLBACK_SRC } from "@/lib/branding";
import { generateQrCodeDataUrl } from "@/lib/qr";

import type { InvoiceTransaction } from "@/types/invoice";

type Locale = "en" | "ar";

const translations: Record<Locale, Record<string, string>> = {
  en: {
    invoice: "Invoice",
    invoiceNumber: "Invoice Number",
    date: "Date",
    customer: "Customer",
    phone: "Phone",
    lastPayment: "Last Payment",
    previousInvoices: "Previous Invoices",
    invoiceTotal: "Invoice Total",
    paid: "Paid",
    remaining: "Remaining",
    previousBalance: "Previous Balance",
    totalOutstanding: "Total Outstanding",
    loyaltyPoints: "Loyalty Points",
    pointsEarned: "Points Earned",
    totalPoints: "Total Points",
    paymentMethod: "Payment Method",
    status: "Status",
    print: "Print",
    download: "Download PDF",
    share: "Share",
    back: "Back",
    status_paid: "Fully Paid ✓",
    status_partial: "Partially Paid",
    status_pending: "Pending",
    fullsPaid: "تم السداد بالكامل",
    debtWarning: "Balance Alert",
    hasOutstanding: "Customer has outstanding balance",
  },
  ar: {
    invoice: "الفاتورة",
    invoiceNumber: "رقم الفاتورة",
    date: "التاريخ",
    customer: "اسم العميل",
    phone: "الهاتف",
    lastPayment: "آخر سداد",
    previousInvoices: "عدد الفواتير",
    invoiceTotal: "إجمالي الفاتورة",
    paid: "المدفوع",
    remaining: "المتبقي",
    previousBalance: "الرصيد السابق",
    totalOutstanding: "الإجمالي المستحق",
    loyaltyPoints: "نقاط الولاء",
    pointsEarned: "نقاط مكتسبة",
    totalPoints: "إجمالي النقاط",
    paymentMethod: "طريقة الدفع",
    status: "الحالة",
    print: "طباعة",
    download: "تحميل PDF",
    share: "مشاركة",
    back: "رجوع",
    status_paid: "تم السداد بالكامل ✓",
    status_partial: "مدفوع جزئياً",
    status_pending: "قيد الانتظار",
    fullsPaid: "تم السداد بالكامل",
    debtWarning: "تنبيه الرصيد",
    hasOutstanding: "العميل لديه رصيد معلق",
  },
};

export function InvoicePage() {
  const { invoiceId } = useParams();
  const [locale] = useState<Locale>("ar");
  const t = translations[locale];

  const [invoice, setInvoice] = useState<InvoiceTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoice() {
      try {
        if (!invoiceId) {
          setError("Invoice not found");
          return;
        }

        const data = await fetchTransactionInvoice(invoiceId);
        setInvoice(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    }

    loadInvoice();
  }, [invoiceId]);

  const qrDataUrl = useMemo(() => {
    if (!invoice) return "";
    const payload = JSON.stringify({
      invoice: invoice.reference,
      date: invoice.createdAt,
      total: invoice.total,
      customer: invoice.customer?.name ?? "",
    });
    return generateQrCodeDataUrl(payload);
  }, [invoice]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        method: "POST",
      });
      const data = await response.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Failed to download PDF:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{locale === "ar" ? "جاري التحميل..." : "Loading..."}</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const isFullyPaid = invoice.remaining === 0;
  const currency = invoice.store.currency ?? "SAR";
  const cashierName = invoice.cashier.name || invoice.cashier.username || "—";
  const customerName = invoice.customer?.name || "—";
  const customerPhone = invoice.customer?.phone || "—";

  return (
    <div className="min-h-screen bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="print:hidden">
        <MainNav />
      </div>

      <div className="max-w-5xl mx-auto p-4 mt-4">
        <div className="flex flex-col gap-4 print:hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t.invoice}</h1>
              <p className="text-muted-foreground">{invoice.reference}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" />
                {t.print}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="gap-2">
                <Download className="w-4 h-4" />
                {t.download}
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => window.history.back()}>
                <ArrowLeft className="w-4 h-4" />
                {t.back}
              </Button>
            </div>
          </div>
          <div className="rounded-3xl border border-border/60 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h2 className="text-2xl font-semibold">Retaj Store</h2>
                <p className="mt-1 text-base text-muted-foreground">ريتاج ستور</p>
              </div>
              <div className="flex items-center justify-center">
                <img
                  src={BRAND_LOGO_PRIMARY_SRC}
                  alt="Retaj Store"
                  className="h-16 w-16 object-contain"
                  onError={(event) => {
                    const target = event.currentTarget as HTMLImageElement;
                    target.src = BRAND_LOGO_FALLBACK_SRC;
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-border/60 bg-white p-6 shadow-sm print:shadow-none print:border-0">
          <div className="grid gap-6 print:grid-cols-1">
            <div className="grid gap-3 rounded-3xl border border-border/60 bg-muted/10 p-4 text-sm text-slate-700 print:border-0 print:bg-transparent">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">رقم الفاتورة</p>
                  <p className="font-semibold">{invoice.reference}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">التاريخ</p>
                  <p className="font-semibold">{new Date(invoice.createdAt).toLocaleDateString("ar-SA")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">الوقت</p>
                  <p className="font-semibold">
                    {new Date(invoice.createdAt).toLocaleTimeString("ar-SA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">اسم الكاشير</p>
                  <p className="font-semibold">{cashierName}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_260px]">
              <div className="grid gap-4 rounded-3xl border border-border/60 p-4">
                <div>
                  <p className="text-xs text-slate-500">اسم العميل</p>
                  <p className="text-lg font-semibold">{customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">رقم تليفون العميل</p>
                  <p className="text-lg font-semibold">{customerPhone}</p>
                </div>
              </div>
              <div className="rounded-3xl border border-border/60 p-4 text-center">
                <div className="mb-2 inline-flex items-center justify-center rounded-2xl bg-muted/80 px-3 py-1 text-xs uppercase tracking-[0.12em] text-slate-600">
                  امسح هنا
                </div>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR code" className="mx-auto h-36 w-36 object-contain" />
                ) : (
                  <div className="mx-auto h-36 w-36 rounded-3xl bg-muted/20" />
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-border/60">
              <table className="w-full border-collapse text-sm print:text-[12px]">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="border-b border-border px-3 py-3 text-right">الصنف</th>
                    <th className="border-b border-border px-3 py-3 text-center">الكمية</th>
                    <th className="border-b border-border px-3 py-3 text-center">السعر</th>
                    <th className="border-b border-border px-3 py-3 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.id} className="border-b border-border last:border-none">
                      <td className="px-3 py-3 text-right font-medium">{line.name}</td>
                      <td className="px-3 py-3 text-center">{line.quantity}</td>
                      <td className="px-3 py-3 text-center">
                        {line.unitPrice.toFixed(2)} {currency}
                      </td>
                      <td className="px-3 py-3 text-left font-semibold">
                        {line.lineTotal.toFixed(2)} {currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 rounded-3xl border border-border/60 bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">الإجمالي الفرعي</span>
                <span className="font-semibold">
                  {invoice.subtotal.toFixed(2)} {currency}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">الخصم</span>
                <span className="font-semibold">
                  -{invoice.discount.toFixed(2)} {currency}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3 text-lg font-semibold">
                <span>إجمالي الفاتورة</span>
                <span>
                  {invoice.total.toFixed(2)} {currency}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">المدفوع</span>
                <span className="font-semibold">
                  {invoice.paid.toFixed(2)} {currency}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">المتبقي</span>
                <span className="font-semibold">
                  {invoice.remaining.toFixed(2)} {currency}
                </span>
              </div>
              {isFullyPaid ? (
                <div className="rounded-2xl bg-emerald-100 p-3 text-center text-emerald-800">
                  تم السداد بالكامل
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-border/60 p-4 text-center text-sm text-slate-600">
              <p className="font-semibold">شكراً لتعاملك معنا</p>
              <p>نتمنى لكم يوماً سعيداً</p>
              <div className="mt-3 flex items-center justify-center gap-3 text-slate-500">
                <Facebook className="h-4 w-4" />
                <Instagram className="h-4 w-4" />
                <span>WhatsApp</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
