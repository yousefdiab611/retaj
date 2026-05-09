import {
  Camera,
  CreditCard,
  Languages,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { List } from "react-window";

import type { Product } from "@/types/product";

import { BarcodeScannerDialog } from "@/components/BarcodeScannerDialog";
import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  createCustomerRequest,
  createSaleRequest,
  fetchProducts,
  fetchTransactionInvoice,
  fetchWarehouses,
  getSelectedBranchId,
  getUser,
  lookupProductByCode,
  searchCustomers,
  type CustomerBrief,
  type PaymentMethod as ApiPaymentMethod,
  type WarehouseBrief,
} from "@/lib/api";
import { TAX_RATE } from "@/lib/constants";
import { loadCartState, saveCartState } from "@/lib/offline/cartRecovery";
import { saveOfflineCustomer } from "@/lib/offline/customersDb";
import { flushOfflineSalesQueue } from "@/lib/offline/flushOfflineQueue";
import { enqueuePendingSale } from "@/lib/offline/pendingSalesDb";
import { getCachedProducts } from "@/lib/offline/productsDb";
import { useOfflineSyncStatus } from "@/lib/offline/syncStatus";
import { useOnlineStatus } from "@/lib/offline/useOnlineStatus";
import { printThermalReceipt, printThermalReceiptOffline } from "@/lib/printThermalReceipt";
import { uniqueCategories } from "@/lib/productUtils";
import { cn } from "@/lib/utils";

type Locale = "en" | "ar";

type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type PaymentMethod = ApiPaymentMethod;

const copy: Record<
  Locale,
  {
    pos: string;
    cart: string;
    products: string;
    search: string;
    category: string;
    allCategories: string;
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    checkout: string;
    emptyCart: string;
    paymentTitle: string;
    paymentHint: string;
    confirmPay: string;
    cash: string;
    card: string;
    wallet: string;
    split: string;
    add: string;
    rtl: string;
    ltr: string;
    customer: string;
    customerSearch: string;
    newCustomer: string;
    newCustomerTitle: string;
    ncName: string;
    ncPhone: string;
    ncEmail: string;
    saveCustomer: string;
    clearCustomer: string;
    customerSearching: string;
    scan: string;
    scanTitle: string;
    scanDescription: string;
    scanManualLabel: string;
    scanManualPlaceholder: string;
    scanAdd: string;
    scanClose: string;
    scanCameraHelp: string;
    codeQuickPlaceholder: string;
    scanHint: string;
    loadingProducts: string;
    productError: string;
    retry: string;
    stock: string;
    outOfStock: string;
    processing: string;
    saleComplete: string;
    warehouse: string;
    warehouseHint: string;
  }
> = {
  en: {
    pos: "Point of Sale",
    cart: "Cart",
    products: "Products",
    search: "Search products…",
    category: "Category",
    allCategories: "All categories",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax (15%)",
    total: "Total",
    checkout: "Checkout",
    emptyCart: "No items yet. Add products from the grid.",
    paymentTitle: "Payment method",
    paymentHint: "Choose how the customer will pay.",
    confirmPay: "Complete payment",
    cash: "Cash",
    card: "Card",
    wallet: "Mobile wallet",
    split: "Split payment",
    add: "Add",
    rtl: "العربية",
    ltr: "English",
    customer: "Customer",
    customerSearch: "Search customers…",
    newCustomer: "New customer",
    newCustomerTitle: "Add customer",
    ncName: "Name",
    ncPhone: "Phone",
    ncEmail: "Email",
    saveCustomer: "Save",
    clearCustomer: "Clear",
    customerSearching: "Searching…",
    scan: "Scan",
    scanTitle: "Scan barcode",
    scanDescription: "Point the camera at a barcode or QR code. Use good lighting.",
    scanManualLabel: "Code",
    scanManualPlaceholder: "SKU or barcode",
    scanAdd: "Add",
    scanClose: "Close",
    scanCameraHelp: "If the camera does not start, type the code below.",
    codeQuickPlaceholder: "SKU / barcode…",
    scanHint: "Scan or enter a code to add a line.",
    loadingProducts: "Loading products…",
    productError: "Could not load products.",
    retry: "Retry",
    stock: "Stock",
    outOfStock: "Out of stock",
    processing: "Processing…",
    saleComplete: "Sale completed",
    warehouse: "Warehouse",
    warehouseHint: "Sale stock is deducted from this warehouse.",
  },
  ar: {
    pos: "نقطة البيع",
    cart: "السلة",
    products: "المنتجات",
    search: "ابحث عن منتج…",
    category: "التصنيف",
    allCategories: "كل التصنيفات",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    tax: "الضريبة (15%)",
    total: "الإجمالي",
    checkout: "إتمام الدفع",
    emptyCart: "لا توجد عناصر. أضف منتجات من الشبكة.",
    paymentTitle: "طريقة الدفع",
    paymentHint: "اختر كيفية دفع العميل.",
    confirmPay: "تأكيد الدفع",
    cash: "نقدي",
    card: "بطاقة",
    wallet: "محفظة إلكترونية",
    split: "دفع مقسّم",
    add: "إضافة",
    rtl: "العربية",
    ltr: "English",
    customer: "العميل",
    customerSearch: "ابحث عن عميل…",
    newCustomer: "عميل جديد",
    newCustomerTitle: "إضافة عميل",
    ncName: "الاسم",
    ncPhone: "الهاتف",
    ncEmail: "البريد",
    saveCustomer: "حفظ",
    clearCustomer: "إزالة",
    customerSearching: "جاري البحث…",
    scan: "مسح",
    scanTitle: "مسح الباركود",
    scanDescription: "وجّه الكاميرا نحو الباركود أو رمز QR.",
    scanManualLabel: "الرمز",
    scanManualPlaceholder: "SKU أو باركود",
    scanAdd: "إضافة",
    scanClose: "إغلاق",
    scanCameraHelp: "إذا لم تعمل الكاميرا، اكتب الرمز أدناه.",
    codeQuickPlaceholder: "SKU / باركود…",
    scanHint: "امسح أو أدخل الرمز لإضافة المنتج.",
    loadingProducts: "جاري تحميل المنتجات…",
    productError: "تعذر تحميل المنتجات.",
    retry: "إعادة المحاولة",
    stock: "المخزون",
    outOfStock: "غير متوفر",
    processing: "جاري المعالجة…",
    saleComplete: "تم إتمام البيع",
    warehouse: "المستودع",
    warehouseHint: "يُخصم المخزون لهذا المستودع عند البيع.",
  },
};

function formatMoney(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
  }).format(value);
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function POSPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountInput, setDiscountInput] = useState("0");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const debouncedCustomerQuery = useDebouncedValue(customerQuery, 320);
  const [customerHits, setCustomerHits] = useState<CustomerBrief[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerBrief | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [ncSaving, setNcSaving] = useState(false);
  const [ncError, setNcError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [codeQuick, setCodeQuick] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseBrief[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const online = useOnlineStatus();
  const { pendingSales, pendingCustomers, lastSyncAt } = useOfflineSyncStatus();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const lastScanRef = useRef({ code: "", time: 0 });
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(1200);
  const [lastAddedProductId, setLastAddedProductId] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadCartState();
    if (!saved) return;
    setCart(saved.cart);
    setDiscountInput(saved.discountInput);
    setSelectedWarehouseId(saved.selectedWarehouseId);
    setPaymentMethod(saved.paymentMethod);
    if (saved.selectedCustomerId) {
      setSelectedCustomer({
        id: saved.selectedCustomerId,
        name: saved.selectedCustomerName ?? "Customer",
        phone: null,
        email: null,
        localId: saved.selectedCustomerId,
      } as CustomerBrief);
    }
  }, []);

  useEffect(() => {
    saveCartState({
      cart,
      discountInput,
      selectedWarehouseId,
      paymentMethod,
      selectedCustomerId: selectedCustomer?.localId ?? selectedCustomer?.id ?? undefined,
      selectedCustomerName: selectedCustomer?.name,
      lastUpdated: Date.now(),
    });
  }, [cart, discountInput, selectedWarehouseId, paymentMethod, selectedCustomer]);

  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;
    const resize = () => setGridWidth(container.clientWidth);
    resize();
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const t = copy[locale];
  const categories = useMemo(() => uniqueCategories(products), [products]);

  const bootstrapCatalog = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const whList = await fetchWarehouses();
      setWarehouses(whList);
      let warehouseForProducts: string | undefined;
      const bid = getSelectedBranchId();
      if (whList.length > 0) {
        const saved = bid ? localStorage.getItem(`retaj-store_warehouse_${bid}`) : null;
        const picked =
          saved && whList.some((w) => w.id === saved)
            ? saved
            : (whList.find((w) => w.isDefault) ?? whList[0]).id;
        warehouseForProducts = picked;
        setSelectedWarehouseId(picked);
        if (bid) localStorage.setItem(`retaj-store_warehouse_${bid}`, picked);
      } else {
        setSelectedWarehouseId(null);
      }

      const cached = await getCachedProducts(warehouseForProducts);
      if (cached.length > 0) {
        setProducts(cached);
      }

      const list = await fetchProducts(warehouseForProducts);
      setProducts(list);
    } catch (e) {
      const cached = await getCachedProducts(selectedWarehouseId ?? undefined);
      if (cached.length > 0) {
        setProducts(cached);
      }
      setProductsError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setProductsLoading(false);
    }
  }, [selectedWarehouseId]);

  const refreshProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const list = await fetchProducts(selectedWarehouseId ?? undefined);
      setProducts(list);
    } catch (e) {
      const cached = await getCachedProducts(selectedWarehouseId ?? undefined);
      if (cached.length > 0) {
        setProducts(cached);
      }
      setProductsError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setProductsLoading(false);
    }
  }, [selectedWarehouseId]);

  useEffect(() => {
    void bootstrapCatalog();
  }, [bootstrapCatalog]);

  const handleWarehouseChange = useCallback((nextId: string) => {
    setSelectedWarehouseId(nextId);
    const bid = getSelectedBranchId();
    if (bid) localStorage.setItem(`retaj-store_warehouse_${bid}`, nextId);
    setCart([]);
    void (async () => {
      setProductsLoading(true);
      setProductsError(null);
      try {
        const list = await fetchProducts(nextId);
        setProducts(list);
      } catch (e) {
        setProductsError(e instanceof Error ? e.message : "Failed to load products");
      } finally {
        setProductsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale === "ar" ? "ar" : "en";
  }, [locale]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = debouncedCustomerQuery.trim();
    if (q.length < 2) {
      setCustomerHits([]);
      return;
    }
    let cancelled = false;
    setCustomerLoading(true);
    void searchCustomers(q)
      .then((rows) => {
        if (!cancelled) setCustomerHits(rows);
      })
      .catch(() => {
        if (!cancelled) setCustomerHits([]);
      })
      .finally(() => {
        if (!cancelled) setCustomerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedCustomerQuery]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = category === "all" || p.category === category;
      if (!q) return catOk;
      const hay = `${p.name} ${p.sku} ${p.category}`.toLowerCase();
      return catOk && hay.includes(q);
    });
  }, [search, category, products]);

  const columnCount = useMemo(() => {
    if (gridWidth >= 1300) return 4;
    if (gridWidth >= 1000) return 3;
    if (gridWidth >= 700) return 2;
    return 1;
  }, [gridWidth]);

  const rowCount = useMemo(
    () => Math.max(1, Math.ceil(filteredProducts.length / columnCount)),
    [filteredProducts.length, columnCount],
  );

  const addToCart = useCallback((product: Product) => {
    if (product.stockQty <= 0) return;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id);
      const currentQty = idx === -1 ? 0 : prev[idx].quantity;
      if (currentQty + 1 > product.stockQty) return prev;
      if (idx === -1) {
        return [
          ...prev,
          { productId: product.id, name: product.name, unitPrice: product.price, quantity: 1 },
        ];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
      return next;
    });
    setLastAddedProductId(product.id);
    setTimeout(() => setLastAddedProductId(null), 800);
    searchInputRef.current?.focus();
  }, []);

  const renderProductRow = useCallback(
    ({
      index,
      style,
    }: {
      ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
      index: number;
      style: React.CSSProperties;
    }) => {
      const start = index * columnCount;
      const items = filteredProducts.slice(start, start + columnCount);
      return (
        <div style={style} className="flex gap-3 px-4">
          {Array.from({ length: columnCount }, (_, columnIndex) => {
            const product = items[columnIndex];
            if (!product) {
              return <div key={columnIndex} className="flex-1" />;
            }
            const inCart = cart.find((l) => l.productId === product.id)?.quantity ?? 0;
            const canAdd = product.stockQty > inCart;
            return (
              <Card
                key={product.id}
                className={cn(
                  "overflow-hidden transition-shadow hover:shadow-md",
                  lastAddedProductId === product.id && "ring-2 ring-primary/70 shadow-xl",
                )}
              >
                <CardHeader className="space-y-1 p-4 pb-2">
                  <CardTitle className="line-clamp-2 text-base leading-snug">{product.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{product.category}</p>
                  {product.barcode ? (
                    <p className="font-mono text-[10px] text-muted-foreground/90">{product.barcode}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {t.stock}: {product.stockQty}
                    {product.stockQty <= 0 ? ` — ${t.outOfStock}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2 p-4 pt-0">
                  <p className="text-lg font-semibold tabular-nums">{formatMoney(product.price, locale)}</p>
                  <Button type="button" size="sm" disabled={!canAdd} onClick={() => addToCart(product)}>
                    {t.add}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    },
    [
      addToCart,
      cart,
      columnCount,
      filteredProducts,
      lastAddedProductId,
      locale,
      t.add,
      t.outOfStock,
      t.stock,
    ],
  );

  const listHeight = useMemo(
    () => Math.max(400, typeof window !== "undefined" ? window.innerHeight - 300 : 600),
    [],
  );

  const discount = useMemo(() => {
    const n = Number.parseFloat(discountInput.replace(/,/g, "."));
    if (Number.isNaN(n) || n < 0) return 0;
    return n;
  }, [discountInput]);

  const { subtotal, taxable, tax, total } = useMemo(() => {
    const sub = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const afterDiscount = Math.max(0, sub - discount);
    const tx = afterDiscount * TAX_RATE;
    const tot = afterDiscount + tx;
    return { subtotal: sub, taxable: afterDiscount, tax: tx, total: tot };
  }, [cart, discount]);

  const addByScannedCode = useCallback(
    async (raw: string) => {
      const code = raw.trim().replace(/\s+/g, "");
      if (!code) return;
      const now = Date.now();
      if (lastScanRef.current.code === code && now - lastScanRef.current.time < 700) {
        setScanMessage(locale === "ar" ? "تم المسح بالفعل" : "Duplicate scan detected");
        return;
      }
      lastScanRef.current = { code, time: now };
      setScanMessage(null);
      try {
        const p = await lookupProductByCode(code, selectedWarehouseId ?? undefined);
        addToCart(p);
        setCodeQuick("");
        setScanMessage(locale === "ar" ? "تمت الإضافة" : "Product added");
        await refreshProducts();
      } catch (e) {
        setScanMessage(e instanceof Error ? e.message : "Error");
      }
    },
    [addToCart, locale, refreshProducts, selectedWarehouseId],
  );

  const setQty = useCallback((productId: string, quantity: number, maxStock: number) => {
    setCart((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.productId !== productId);
      const capped = Math.min(quantity, maxStock);
      return prev.map((l) => (l.productId === productId ? { ...l, quantity: capped } : l));
    });
  }, []);

  const removeLine = useCallback((productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountInput("0");
  }, []);

  const completeCheckout = useCallback(async () => {
    setCheckoutError(null);
    setCheckoutLoading(true);
    const idempotencyKey = crypto.randomUUID();
    const customerLocalId =
      selectedCustomer?.localId ?? (selectedCustomer?.remoteId ? undefined : selectedCustomer?.id);
    const customerRemoteId =
      selectedCustomer?.remoteId ?? (selectedCustomer?.localId ? undefined : selectedCustomer?.id);
    const salePayload = {
      customerId: customerRemoteId ?? null,
      customerLocalId: customerLocalId ?? null,
      ...(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : {}),
      discount,
      paymentMethod,
      lineItems: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    };

    const user = getUser();
    const bid = getSelectedBranchId();
    const branchName = user?.branches.find((b) => b.id === bid)?.name ?? "Store";
    const cashierLabel = user?.username ?? user?.name ?? "—";

    const recoverable = (e: unknown) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return true;
      if (e instanceof TypeError) return true;
      const m = e instanceof Error ? e.message : String(e);
      return /failed to fetch|network|load failed|aborted/i.test(m);
    };

    const finishOfflineQueued = async () => {
      await enqueuePendingSale({
        idempotencyKey,
        createdAt: Date.now(),
        sale: {
          customerId: salePayload.customerId ?? undefined,
          customerLocalId: salePayload.customerLocalId ?? undefined,
          warehouseId: salePayload.warehouseId,
          discount: salePayload.discount,
          paymentMethod: salePayload.paymentMethod,
          lineItems: salePayload.lineItems,
        },
      });
      void flushOfflineSalesQueue();
      setCheckoutOpen(false);
      clearCart();
      setSelectedCustomer(null);
      setCustomerQuery("");
      setCustomerHits([]);
      const refShort = idempotencyKey.slice(0, 8).toUpperCase();
      printThermalReceiptOffline({
        reference: `OFF-${refShort}`,
        createdAt: new Date().toISOString(),
        storeName: branchName,
        currency: "SAR",
        thankYou: import.meta.env.VITE_STORE_THANK_YOU ?? "Thank you for shopping with us.",
        cashierLabel,
        customer: selectedCustomer
          ? { name: selectedCustomer.name, phone: selectedCustomer.phone ?? null }
          : null,
        lines: cart.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.unitPrice * l.quantity,
        })),
        subtotal,
        discount: Math.min(discount, subtotal),
        total,
        paid: total,
        remaining: 0,
      });
      await refreshProducts().catch(() => undefined);
    };

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await finishOfflineQueued();
        return;
      }
      const { transaction } = await createSaleRequest({
        ...salePayload,
        idempotencyKey,
      });
      setCheckoutOpen(false);
      clearCart();
      setSelectedCustomer(null);
      setCustomerQuery("");
      setCustomerHits([]);
      await refreshProducts();
      const refLabel = locale === "ar" ? "المرجع" : "Reference";
      try {
        const invoice = await fetchTransactionInvoice(transaction.id);
        printThermalReceipt(invoice);
      } catch {
        window.alert(`${t.saleComplete}\n${refLabel}: ${transaction.reference}`);
      }
    } catch (e) {
      if (recoverable(e)) {
        await finishOfflineQueued();
        return;
      }
      setCheckoutError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  }, [
    cart,
    clearCart,
    discount,
    locale,
    paymentMethod,
    refreshProducts,
    selectedCustomer,
    selectedWarehouseId,
    subtotal,
    tax,
    total,
    t.saleComplete,
  ]);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "F2") {
        if (cart.length > 0) {
          setCheckoutOpen(true);
        }
      }
      if (e.key === "F3") {
        if (cart.length > 0) {
          setCheckoutOpen(true);
          if (checkoutOpen) {
            void completeCheckout();
          }
        }
      }
      if (e.key === "F4") {
        e.preventDefault();
        clearCart();
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [cart.length, checkoutOpen, clearCart, completeCheckout]);

  async function saveNewCustomer() {
    setNcError(null);
    const name = ncName.trim();
    if (!name) {
      setNcError(locale === "ar" ? "الاسم مطلوب" : "Name is required");
      return;
    }
    setNcSaving(true);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const saved = await saveOfflineCustomer({
          name,
          phone: ncPhone.trim() || undefined,
          email: ncEmail.trim() || undefined,
          dirty: true,
        });
        setSelectedCustomer(saved as CustomerBrief);
      } else {
        const c = await createCustomerRequest({
          name,
          phone: ncPhone.trim() || undefined,
          email: ncEmail.trim() || undefined,
        });
        await saveOfflineCustomer({
          localId: c.id,
          remoteId: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          dirty: false,
        });
        setSelectedCustomer(c);
      }
      setNewCustomerOpen(false);
      setNcName("");
      setNcPhone("");
      setNcEmail("");
      setCustomerQuery("");
      setCustomerHits([]);
    } catch (e) {
      const recoverable = typeof navigator !== "undefined" && !navigator.onLine;
      if (recoverable) {
        const saved = await saveOfflineCustomer({
          name,
          phone: ncPhone.trim() || undefined,
          email: ncEmail.trim() || undefined,
          dirty: true,
        });
        setSelectedCustomer(saved as CustomerBrief);
        setNewCustomerOpen(false);
        setNcName("");
        setNcPhone("");
        setNcEmail("");
        setCustomerQuery("");
        setCustomerHits([]);
      } else {
        setNcError(e instanceof Error ? e.message : "Error");
      }
    } finally {
      setNcSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <MainNav
        endSlot={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setLocale((l) => (l === "en" ? "ar" : "en"))}
          >
            <Languages className="h-4 w-4" />
            {locale === "en" ? t.rtl : t.ltr}
          </Button>
        }
      />

      <div className="mx-auto flex min-h-0 max-w-[1600px] flex-1 flex-col lg:h-[calc(100dvh-53px)] lg:flex-row">
        <aside
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col border-b bg-muted/30 lg:h-full lg:w-[min(100%,400px)] lg:border-b-0 lg:border-e",
          )}
        >
          {warehouses.length > 0 ? (
            <div className="space-y-1 border-b px-4 py-3">
              <Label htmlFor="pos-warehouse" className="text-xs text-muted-foreground">
                {t.warehouse}
              </Label>
              <select
                id="pos-warehouse"
                value={selectedWarehouseId ?? ""}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.isDefault ? " ★" : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] leading-snug text-muted-foreground">{t.warehouseHint}</p>
            </div>
          ) : null}
          <div className="space-y-2 border-b px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t.customer}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                disabled={!online}
                title={!online ? (locale === "ar" ? "يتطلب اتصالاً" : "Requires network") : undefined}
                onClick={() => {
                  setNcError(null);
                  setNewCustomerOpen(true);
                }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t.newCustomer}
              </Button>
            </div>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{selectedCustomer.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSelectedCustomer(null)}
                  aria-label={t.clearCustomer}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 ps-8 text-sm"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder={t.customerSearch}
                    autoComplete="off"
                  />
                </div>
                {customerLoading ? (
                  <p className="text-xs text-muted-foreground">{t.customerSearching}</p>
                ) : null}
                {customerHits.length > 0 ? (
                  <ul className="max-h-36 overflow-y-auto rounded-md border bg-background text-sm shadow-sm">
                    {customerHits.map((c) => (
                      <li key={c.id} className="border-b border-border/50 last:border-b-0">
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-start hover:bg-muted/80"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerHits([]);
                            setCustomerQuery("");
                          }}
                        >
                          <span className="font-medium">{c.name}</span>
                          {c.phone ? (
                            <span className="block text-xs text-muted-foreground">{c.phone}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">{t.cart}</h2>
            {cart.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <ScrollArea className="h-[min(48vh,380px)] lg:h-auto lg:min-h-0 lg:flex-1">
            <ul className="space-y-2 p-4">
              {cart.length === 0 ? (
                <li className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t.emptyCart}
                </li>
              ) : (
                cart.map((line) => {
                  const stock = products.find((p) => p.id === line.productId)?.stockQty ?? line.quantity;
                  return (
                    <li key={line.productId}>
                      <Card>
                        <CardContent className="flex items-center gap-3 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{line.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatMoney(line.unitPrice, locale)} × {line.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setQty(line.productId, line.quantity - 1, stock)}
                              aria-label="Decrease"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setQty(line.productId, line.quantity + 1, stock)}
                              aria-label="Increase"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeLine(line.productId)}
                              aria-label="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })
              )}
            </ul>
          </ScrollArea>

          <div className="space-y-3 border-t bg-background p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t.subtotal}</span>
                <span className="tabular-nums font-medium">{formatMoney(subtotal, locale)}</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="discount">{t.discount}</Label>
                <Input
                  id="discount"
                  inputMode="decimal"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
                <span>{t.total}</span>
                <span className="tabular-nums">{formatMoney(total, locale)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {locale === "ar" ? "بعد الخصم" : "After discount"}: {formatMoney(taxable, locale)}
              </p>
            </div>
            <Button
              type="button"
              className="w-full"
              size="lg"
              disabled={cart.length === 0 || productsLoading}
              onClick={() => {
                setCheckoutError(null);
                setCheckoutOpen(true);
              }}
            >
              {t.checkout}
            </Button>
          </div>
        </aside>

        <main className="flex min-h-[50vh] flex-1 flex-col bg-muted/20 lg:min-h-0">
          <div className="space-y-4 border-b border-border/60 bg-background/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">{t.products}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void refreshProducts()}
                  disabled={productsLoading}
                >
                  <RefreshCw className={cn("h-4 w-4", productsLoading && "animate-spin")} />
                  {t.retry}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2 shadow-sm"
                  onClick={() => {
                    setScanMessage(null);
                    setScanOpen(true);
                  }}
                >
                  <Camera className="h-4 w-4" />
                  {t.scan}
                </Button>
                {(pendingSales > 0 || pendingCustomers > 0) && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-muted/30 bg-muted/80 px-3 py-2 text-xs text-muted-foreground">
                    <span>{pendingSales} sales</span>
                    <span>&bull;</span>
                    <span>{pendingCustomers} customers</span>
                    <span className="font-semibold text-foreground">pending</span>
                  </span>
                )}
                {lastSyncAt ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-muted/30 bg-muted/80 px-3 py-2 text-xs text-muted-foreground">
                    <span>Synced</span>
                    <time dateTime={new Date(lastSyncAt).toISOString()}>
                      {new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
                        new Date(lastSyncAt),
                      )}
                    </time>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 sm:flex-row sm:items-center">
              <p className="text-xs text-muted-foreground sm:me-2 sm:max-w-[140px]">{t.scanHint}</p>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={codeQuick}
                  onChange={(e) => {
                    setCodeQuick(e.target.value);
                    setScanMessage(null);
                  }}
                  placeholder={t.codeQuickPlaceholder}
                  className="font-mono text-sm sm:max-w-xs"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addByScannedCode(codeQuick);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void addByScannedCode(codeQuick)}
                >
                  {t.scanAdd}
                </Button>
              </div>
            </div>
            {scanMessage ? (
              <p className="text-sm text-destructive" role="alert">
                {scanMessage}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder={t.search}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filteredProducts.length > 0) {
                      e.preventDefault();
                      addToCart(filteredProducts[0]);
                    }
                  }}
                  className="h-10 bg-background ps-9"
                  aria-label={t.search}
                  disabled={productsLoading && products.length === 0}
                />
              </div>
              <div className="w-full sm:w-48">
                <Label htmlFor="category-filter" className="sr-only">
                  {t.category}
                </Label>
                <select
                  id="category-filter"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  disabled={products.length === 0}
                >
                  <option value="all">{t.allCategories}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {productsError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-destructive">{t.productError}</p>
              <p className="text-sm text-muted-foreground">{productsError}</p>
              <Button type="button" onClick={() => void bootstrapCatalog()}>
                {t.retry}
              </Button>
            </div>
          ) : productsLoading && products.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>{t.loadingProducts}</p>
            </div>
          ) : (
            <div ref={gridContainerRef} className="flex-1">
              <ScrollArea className="h-full">
                <List
                  rowComponent={renderProductRow}
                  rowCount={rowCount}
                  rowHeight={300}
                  rowProps={{}}
                  style={{ width: gridWidth || 800, height: listHeight }}
                />
              </ScrollArea>
            </div>
          )}
        </main>
      </div>

      <BarcodeScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        title={t.scanTitle}
        description={t.scanDescription}
        manualLabel={t.scanManualLabel}
        manualPlaceholder={t.scanManualPlaceholder}
        submitLabel={t.scanAdd}
        cancelLabel={t.scanClose}
        cameraErrorHint={t.scanCameraHelp}
        onScan={(code) => void addByScannedCode(code)}
      />

      <Dialog
        open={newCustomerOpen}
        onOpenChange={(o) => {
          setNewCustomerOpen(o);
          if (!o) setNcError(null);
        }}
      >
        <DialogContent dir={locale === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t.newCustomerTitle}</DialogTitle>
          </DialogHeader>
          {ncError ? (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {ncError}
            </p>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nc-name">{t.ncName}</Label>
              <Input id="nc-name" value={ncName} onChange={(e) => setNcName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nc-phone">{t.ncPhone}</Label>
              <Input id="nc-phone" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nc-email">{t.ncEmail}</Label>
              <Input
                id="nc-email"
                type="email"
                value={ncEmail}
                onChange={(e) => setNcEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewCustomerOpen(false)}
              disabled={ncSaving}
            >
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="button" onClick={() => void saveNewCustomer()} disabled={ncSaving}>
              {ncSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.saveCustomer}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md" dir={locale === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t.paymentTitle}</DialogTitle>
            <DialogDescription>{t.paymentHint}</DialogDescription>
          </DialogHeader>
          {selectedCustomer ? (
            <p className="text-sm text-muted-foreground">
              {t.customer}: <span className="font-medium text-foreground">{selectedCustomer.name}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {locale === "ar" ? "بدون عميل (زائر)" : "Walk-in (no customer linked)"}
            </p>
          )}
          {checkoutError ? (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {checkoutError}
            </p>
          ) : null}
          <div className="grid gap-2">
            <PaymentOption
              selected={paymentMethod === "cash"}
              onSelect={() => setPaymentMethod("cash")}
              icon={<Wallet className="h-5 w-5" />}
              label={t.cash}
            />
            <PaymentOption
              selected={paymentMethod === "card"}
              onSelect={() => setPaymentMethod("card")}
              icon={<CreditCard className="h-5 w-5" />}
              label={t.card}
            />
            <PaymentOption
              selected={paymentMethod === "wallet"}
              onSelect={() => setPaymentMethod("wallet")}
              icon={<Wallet className="h-5 w-5" />}
              label={t.wallet}
            />
            <PaymentOption
              selected={paymentMethod === "split"}
              onSelect={() => setPaymentMethod("split")}
              icon={<CreditCard className="h-5 w-5" />}
              label={t.split}
            />
          </div>
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.total}</span>
              <span className="font-semibold tabular-nums">{formatMoney(total, locale)}</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCheckoutOpen(false)}
              disabled={checkoutLoading}
            >
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="button" onClick={() => void completeCheckout()} disabled={checkoutLoading}>
              {checkoutLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.processing}
                </>
              ) : (
                t.confirmPay
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentOption({
  selected,
  onSelect,
  icon,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors",
        selected ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:bg-muted/60",
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
