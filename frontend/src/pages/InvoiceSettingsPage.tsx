import { useState } from "react";

import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Locale = "en" | "ar";

const translations: Record<Locale, Record<string, string>> = {
  en: {
    invoiceSettings: "Invoice Settings",
    displaySettings: "Display Settings",
    brandingSettings: "Branding Settings",
    businessRules: "Business Rules",
    save: "Save Settings",
    saved: "Settings saved successfully",
    error: "Error saving settings",
    showQRCode: "Show QR Code",
    showBalance: "Show Customer Balance",
    showLoyalty: "Show Loyalty Points",
    showTaxBreakdown: "Show Tax Breakdown",
    printerWidth: "Thermal Printer Width",
    printWidth80: "80mm",
    printWidth58: "58mm",
    logoUrl: "Store Logo URL",
    thankYou: "Thank You Message",
    footer: "Invoice Footer Note",
    primaryColor: "Primary Color",
    secondaryColor: "Secondary Color",
    loyaltyRate: "Loyalty Point Rate",
    loyaltyRateHint: "Points earned per SAR spent",
    enableLoyalty: "Enable Loyalty Program",
    enableQR: "Enable QR Codes",
  },
  ar: {
    invoiceSettings: "إعدادات الفواتير",
    displaySettings: "إعدادات العرض",
    brandingSettings: "إعدادات العلامة التجارية",
    businessRules: "قواعد الأعمال",
    save: "حفظ الإعدادات",
    saved: "تم حفظ الإعدادات بنجاح",
    error: "خطأ في حفظ الإعدادات",
    showQRCode: "عرض رمز QR",
    showBalance: "عرض رصيد العميل",
    showLoyalty: "عرض نقاط الولاء",
    showTaxBreakdown: "عرض تفصيل الضريبة",
    printerWidth: "عرض طابعة الإيصالات",
    printWidth80: "80 ملم",
    printWidth58: "58 ملم",
    logoUrl: "عنوان شعار المتجر",
    thankYou: "رسالة شكر",
    footer: "ملاحظة تذييل الفاتورة",
    primaryColor: "اللون الأساسي",
    secondaryColor: "اللون الثانوي",
    loyaltyRate: "معدل نقاط الولاء",
    loyaltyRateHint: "النقاط المكتسبة لكل ريال واحد",
    enableLoyalty: "تفعيل برنامج الولاء",
    enableQR: "تفعيل رموز QR",
  },
};

export function InvoiceSettingsPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const t = translations[locale];

  const [settings, setSettings] = useState({
    showQRCode: true,
    showBalance: true,
    showLoyalty: true,
    showTaxBreakdown: false,
    printerWidth: "80",
    logoUrl: "",
    thankYou: "شكراً لك على تعاملك معنا",
    footer: "",
    primaryColor: "#1F2937",
    secondaryColor: "#3B82F6",
    loyaltyRate: 1,
    enableLoyalty: true,
    enableQR: true,
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/invoices/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error("Failed to save");

      setMessage({ type: "success", text: t.saved });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "error", text: t.error });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <MainNav />

      <div className="max-w-4xl mx-auto p-4 mt-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{t.invoiceSettings}</h1>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Display Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t.displaySettings}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t.showQRCode}</Label>
              <Switch
                checked={settings.showQRCode}
                onCheckedChange={(checked) => setSettings({ ...settings, showQRCode: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t.showBalance}</Label>
              <Switch
                checked={settings.showBalance}
                onCheckedChange={(checked) => setSettings({ ...settings, showBalance: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t.showLoyalty}</Label>
              <Switch
                checked={settings.showLoyalty}
                onCheckedChange={(checked) => setSettings({ ...settings, showLoyalty: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t.showTaxBreakdown}</Label>
              <Switch
                checked={settings.showTaxBreakdown}
                onCheckedChange={(checked) => setSettings({ ...settings, showTaxBreakdown: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Branding Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t.brandingSettings}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="logo">{t.logoUrl}</Label>
              <Input
                id="logo"
                value={settings.logoUrl}
                onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div>
              <Label htmlFor="thankYou">{t.thankYou}</Label>
              <Input
                id="thankYou"
                value={settings.thankYou}
                onChange={(e) => setSettings({ ...settings, thankYou: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="footer">{t.footer}</Label>
              <Input
                id="footer"
                value={settings.footer}
                onChange={(e) => setSettings({ ...settings, footer: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary">{t.primaryColor}</Label>
                <Input
                  id="primary"
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="secondary">{t.secondaryColor}</Label>
                <Input
                  id="secondary"
                  type="color"
                  value={settings.secondaryColor}
                  onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="printer">{t.printerWidth}</Label>
              <Select
                value={settings.printerWidth}
                onValueChange={(v) => setSettings({ ...settings, printerWidth: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80">{t.printWidth80}</SelectItem>
                  <SelectItem value="58">{t.printWidth58}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Business Rules */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t.businessRules}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="loyalty-rate">{t.loyaltyRate}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="loyalty-rate"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={settings.loyaltyRate}
                  onChange={(e) => setSettings({ ...settings, loyaltyRate: parseFloat(e.target.value) })}
                  className="w-20"
                />
                <span className="text-sm text-gray-600">{t.loyaltyRateHint}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>{t.enableLoyalty}</Label>
              <Switch
                checked={settings.enableLoyalty}
                onCheckedChange={(checked) => setSettings({ ...settings, enableLoyalty: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{t.enableQR}</Label>
              <Switch
                checked={settings.enableQR}
                onCheckedChange={(checked) => setSettings({ ...settings, enableQR: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "..." : t.save}
        </Button>
      </div>
    </div>
  );
}
