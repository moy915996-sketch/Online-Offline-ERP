/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  Settings, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight, 
  LogOut, 
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  X,
  Menu,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Truck,
  UserCircle,
  MapPin,
  Moon,
  Sun,
  Globe,
  CreditCard,
  Trash2,
  Printer,
  Eye,
  FileText,
  Paperclip,
  Calendar,
  ChevronDown,
  Edit2,
  ChevronLeft,
  TrendingDown,
  Download,
  ArrowLeftRight,
  ClipboardCheck,
  Lock,
  Shield,
  Camera,
  Upload,
  ImageIcon,
  ScanLine,
  Keyboard,
  Volume2,
  Loader2,
  Share2
} from 'lucide-react';
import BarcodeScanner from './components/BarcodeScanner';
import SyncStatusIndicator from './components/SyncStatusIndicator';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs,
  where,
  query, 
  orderBy, 
  Timestamp,
  increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, storage, handleFirestoreError, OperationType } from './firebase';
import { useTranslation, LanguageContext, translations } from './i18n';
import { 
  offlineCreate, 
  offlineUpdate, 
  offlineDelete,
  getOfflineRecord,
  generateId 
} from './offline/offlineRepository';
import { useOfflineCollection } from './offline/useOfflineCollection';
import { syncEngine } from './offline/syncEngine'; // Initialize sync engine
import { 
  Product, 
  Warehouse,
  Supplier, 
  Customer, 
  Purchase, 
  Sale, 
  Transaction, 
  UserProfile,
  UserPermissions,
  ScreenCredential,
  Category,
  SystemSettings,
  WarehouseTransfer,
  Return,
  ReturnItem
} from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants ---
const getUnits = (t: (s: string) => string) => [
  t('piece'), 
  t('kg'), 
  t('liter'), 
  t('meter'), 
  t('box'), 
  t('bag'), 
  t('carton')
];

// --- Components ---

class ErrorBoundary extends React.Component<any, any> {
  static contextType = LanguageContext;
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    const { t, dir } = ((this as any).context as any) || { t: (k: string) => k, dir: 'rtl' };
    if ((this as any).state.hasError) {
      let message = t('somethingWentWrong');
      try {
        const errInfo = JSON.parse((this as any).state.error?.message || "{}");
        if (errInfo.error && errInfo.error.includes("permission-denied")) {
          message = t('permissionDenied');
        }
      } catch (e) {
        // Not JSON
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center dark:bg-slate-900" dir={dir}>
          <Card className="p-8 max-w-md w-full">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2 dark:text-white">{t('errorOccurred')}</h2>
            <p className="text-slate-600 mb-6 dark:text-slate-400">{message}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              {t('reloadPage')}
            </Button>
          </Card>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm dark:bg-indigo-500 dark:hover:bg-indigo-600',
      secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm dark:bg-emerald-500 dark:hover:bg-emerald-600',
      outline: 'border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
      ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 dark:text-slate-300 dark:hover:bg-slate-800',
      danger: 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700', className)} {...props}>
    {children}
  </div>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-400 dark:ring-offset-slate-900',
        className
      )}
      {...props}
    />
  )
);

const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-slate-900/60"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={cn("relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden dark:bg-slate-800", maxWidth)}
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Modules ---

const Dashboard = ({ 
  products, 
  sales, 
  purchases, 
  transactions,
  customers,
  suppliers,
  returns,
  onNavigate
}: { 
  products: Product[], 
  sales: Sale[], 
  purchases: Purchase[], 
  transactions: Transaction[],
  customers: Customer[],
  suppliers: Supplier[],
  returns: Return[],
  onNavigate: (tab: string) => void
}) => {
  const { t, dir, language } = useTranslation();
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const filteredSales = useMemo(() => {
    return sales.filter(s => s.date >= dateRange.start && s.date <= dateRange.end);
  }, [sales, dateRange]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => p.date >= dateRange.start && p.date <= dateRange.end);
  }, [purchases, dateRange]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date >= dateRange.start && t.date <= dateRange.end);
  }, [transactions, dateRange]);

  const filteredReturns = useMemo(() => {
    return returns.filter(r => r.date >= dateRange.start && r.date <= dateRange.end);
  }, [returns, dateRange]);

  const totalSales = useMemo(() => {
    const salesAmount = filteredSales.reduce((acc, s) => acc + s.total, 0);
    const returnsAmount = filteredReturns.filter(r => r.type === 'sale').reduce((acc, r) => acc + r.totalRefund, 0);
    return salesAmount - returnsAmount;
  }, [filteredSales, filteredReturns]);

  const totalPurchases = useMemo(() => {
    const purchaseAmount = filteredPurchases.reduce((acc, p) => acc + p.total, 0);
    const returnsAmount = filteredReturns.filter(r => r.type === 'purchase').reduce((acc, r) => acc + r.totalRefund, 0);
    return purchaseAmount - returnsAmount;
  }, [filteredPurchases, filteredReturns]);
  const totalStockValue = useMemo(() => products.reduce((acc, p) => acc + (p.stock * p.cost), 0), [products]);
  const netProfit = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return income - expense;
  }, [filteredTransactions]);

  const topCustomers = useMemo(() => {
    const customerSales = customers.map(c => {
      const salesAmount = filteredSales.filter(s => s.customerId === c.id).reduce((acc, s) => acc + s.total, 0);
      const returnsAmount = filteredReturns.filter(r => r.customerId === c.id && r.type === 'sale').reduce((acc, r) => acc + r.totalRefund, 0);
      return {
        ...c,
        totalVolume: salesAmount - returnsAmount
      };
    }).sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 5);
    return customerSales;
  }, [customers, filteredSales, filteredReturns]);

  const topSuppliers = useMemo(() => {
    const supplierPurchases = suppliers.map(s => {
      const purchaseAmount = filteredPurchases.filter(p => p.supplierId === s.id).reduce((acc, p) => acc + p.total, 0);
      const returnsAmount = filteredReturns.filter(r => r.supplierId === s.id && r.type === 'purchase').reduce((acc, r) => acc + r.totalRefund, 0);
      return {
        ...s,
        totalVolume: purchaseAmount - returnsAmount
      };
    }).sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 5);
    return supplierPurchases;
  }, [suppliers, filteredPurchases, filteredReturns]);

  const salesData = useMemo(() => {
    const days = eachDayOfInterval({
      start: new Date(dateRange.start),
      end: new Date(dateRange.end)
    }).slice(-7); // Keep last 7 days of the range for the chart if range is long, or just show the range

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const daySales = filteredSales.filter(s => s.date.startsWith(dateStr)).reduce((acc, s) => acc + s.total, 0);
      const dayReturns = filteredReturns.filter(r => r.date.startsWith(dateStr) && r.type === 'sale').reduce((acc, r) => acc + r.totalRefund, 0);
      return {
        date: format(day, 'MMM dd', { locale: language === 'ar' ? ar : enUS }),
        amount: daySales - dayReturns
      };
    });
  }, [filteredSales, filteredReturns, dateRange, language]);

  const stockData = useMemo(() => {
    return products
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 5)
      .map(p => ({ name: p.name, stock: p.stock }));
  }, [products]);

  return (
    <div className="space-y-8" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard')}</h2>
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input 
            type="date" 
            className="bg-transparent border-none text-sm focus:ring-0 dark:text-white"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          />
          <span className="text-slate-300">-</span>
          <input 
            type="date" 
            className="bg-transparent border-none text-sm focus:ring-0 dark:text-white"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-all border-2 border-slate-100 dark:border-slate-700/50" onClick={() => onNavigate('sales')}>
          <div className="flex items-center justify-between">
            <div className={language === 'ar' ? 'text-right' : 'text-left'}>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('totalSales')}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1 dark:text-white">{totalSales.toLocaleString()} {t('egp')}</h3>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-all border-2 border-slate-100 dark:border-slate-700/50" onClick={() => onNavigate('purchases')}>
          <div className="flex items-center justify-between">
            <div className={language === 'ar' ? 'text-right' : 'text-left'}>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('totalPurchases')}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1 dark:text-white">{totalPurchases.toLocaleString()} {t('egp')}</h3>
            </div>
            <div className="p-3 bg-red-50 rounded-xl text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <ShoppingCart className="w-6 h-6" />
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-all border-2 border-slate-100 dark:border-slate-700/50" onClick={() => onNavigate('inventory')}>
          <div className="flex items-center justify-between">
            <div className={language === 'ar' ? 'text-right' : 'text-left'}>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('stockValue')}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1 dark:text-white">{totalStockValue.toLocaleString()} {t('egp')}</h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Package className="w-6 h-6" />
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-all border-2 border-slate-100 dark:border-slate-700/50" onClick={() => onNavigate('accounting')}>
          <div className="flex items-center justify-between">
            <div className={language === 'ar' ? 'text-right' : 'text-left'}>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('netProfit')}</p>
              <h3 className={cn("text-2xl font-bold mt-1", netProfit >= 0 ? "text-slate-900 dark:text-white" : "text-red-600 dark:text-red-400")}>
                {netProfit.toLocaleString()} {t('egp')}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h4 className={cn("text-base font-semibold text-slate-900 mb-6 dark:text-white", language === 'ar' ? 'text-right' : 'text-left')}>{t('salesLast7Days')}</h4>
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} orientation={language === 'ar' ? 'right' : 'left'} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className={cn("text-base font-semibold text-slate-900 mb-6 dark:text-white", language === 'ar' ? 'text-right' : 'text-left')}>{t('topProductsInStock')}</h4>
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={stockData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="stock"
                >
                  {stockData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className={cn("text-base font-semibold text-slate-900 dark:text-white", language === 'ar' ? 'text-right' : 'text-left')}>{t('topCustomers')}</h4>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('customers')}>{t('viewAll')}</Button>
          </div>
          <div className="space-y-4">
            {topCustomers.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold dark:bg-indigo-900/30 dark:text-indigo-400">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{c.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{c.totalVolume.toLocaleString()} {t('egp')}</p>
                  <p className="text-[10px] text-slate-400">{t('totalVolume')}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className={cn("text-base font-semibold text-slate-900 dark:text-white", language === 'ar' ? 'text-right' : 'text-left')}>{t('topSuppliers')}</h4>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('suppliers')}>{t('viewAll')}</Button>
          </div>
          <div className="space-y-4">
            {topSuppliers.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold dark:bg-red-900/30 dark:text-red-400">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{s.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.companyName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">{s.totalVolume.toLocaleString()} {t('egp')}</p>
                  <p className="text-[10px] text-slate-400">{t('totalVolume')}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

const CashierModule = ({ products, customers, sales, settings, canDo, showToast, confirm }: { products: Product[], customers: Customer[], sales: Sale[], settings: SystemSettings | null, canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir, language } = useTranslation();
  const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
      c.phone.includes(customerSearch)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'other'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'searching' | 'success' | 'error'>('idle');
  const scannerBuffer = useRef<string>('');
  const lastScanTime = useRef<number>(0);

  const handleScan = (code: string) => {
    if (!code) return;
    
    // Duplicate scan protection (1 second)
    const now = Date.now();
    if (code === scannerBuffer.current && now - lastScanTime.current < 1000) {
      return;
    }

    setScanStatus('searching');
    lastScanTime.current = now;
    scannerBuffer.current = code;

    // Search logic: barcode > qrCode > sku
    const product = products.find(p => 
      p.barcode === code || 
      (p as any).qrCode === code || 
      p.sku === code ||
      (p as any).productCode === code
    );

    if (product) {
      addToCart(product);
      setScanStatus('success');
      showToast(t('productAdded'), 'success');
      // Play a subtle beep if possible (optional)
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } catch (e) { /* ignore audio errors */ }
      
      setTimeout(() => setScanStatus('idle'), 2000);
    } else {
      setScanStatus('error');
      showToast(t('productNotFound'), 'error');
      setTimeout(() => setScanStatus('idle'), 3000);
    }
  };

  // External Hardware Scanner Listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input (unless it's the search query input and we want to handle it there)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // If it's the search input, we might still want to catch the 'Enter'
        if (e.key === 'Enter' && target.classList.contains('scanner-input')) {
          // Handled by the input's own logic or we can catch it here
        } else {
          return;
        }
      }

      const now = Date.now();
      // Scanners usually send keys very fast (< 50ms)
      if (now - lastKeyTime > 100) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          handleScan(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  useEffect(() => {
    if (!searchQuery) return;
    const exactMatch = products.find(p => p.barcode === searchQuery);
    if (exactMatch) {
      addToCart(exactMatch);
      setSearchQuery('');
    }
  }, [searchQuery, products]);

  const filteredProducts = useMemo(() => {
    // Filter out products with no stock (pairs)
    const availableProducts = products.filter(p => Math.min(p.stockLeft, p.stockRight) > 0);
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return availableProducts.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.sku.toLowerCase().includes(query) ||
      (p.barcode && p.barcode.toLowerCase().includes(query))
    ).slice(0, 10);
  }, [products, searchQuery]);

  const addToCart = (product: Product) => {
    const availablePairs = Math.min(product.stockLeft, product.stockRight);
    if (availablePairs <= 0) {
      showToast(t('outOfStock'), 'error');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= availablePairs) {
          showToast(t('noMoreStock'), 'error');
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearchQuery('');
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const availablePairs = Math.min(item.product.stockLeft, item.product.stockRight);
        const newQty = Math.max(1, item.quantity + delta);
        if (newQty > availablePairs) {
          showToast(t('noMoreStock'), 'error');
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const total = useMemo(() => cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0), [cart]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!canDo('cashier', 'canAdd') && !canDo('sales', 'canAdd')) {
      showToast(t('permissionDenied'), 'error');
      return;
    }

    // Double check stock before processing
    for (const item of cart) {
      const availablePairs = Math.min(item.product.stockLeft, item.product.stockRight);
      if (item.quantity > availablePairs) {
        showToast(`${t('insufficientStockFor')} ${item.product.name}`, 'error');
        return;
      }
    }

    setIsProcessing(true);
    try {
      const tempId = generateId();
      const saleId = `SALE-${Date.now()}`;
      const saleData: Sale = {
        invoiceNumber: saleId,
        customerId: selectedCustomerId || 'walk-in',
        date: new Date().toISOString(),
        items: cart.map(item => ({
          productId: item.product.id!,
          quantity: item.quantity,
          quantityLeft: item.quantity,
          quantityRight: item.quantity,
          price: item.product.price,
        })),
        total,
        discount: 0,
        tax: 0,
        paymentMethod,
      };

      // Add sale
      await offlineCreate('sales', { ...saleData, id: tempId });

      // Update stock
      for (const item of cart) {
        await offlineUpdate('products', item.product.id!, {
          stockLeft: increment(-item.quantity),
          stockRight: increment(-item.quantity),
          stock: increment(-item.quantity)
        });
      }

      // Add accounting entry
      await offlineCreate('transactions', {
        date: new Date().toISOString(),
        type: 'income',
        amount: total,
        category: t('sales'),
        description: `${t('saleTo')} ${selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name : t('walkIn')} (${t(paymentMethod)})`,
        referenceId: tempId
      });

      setLastSale({ ...saleData, id: tempId });
      setCart([]);
      setSelectedCustomerId('');
      setPaymentMethod('cash');
      setIsPrintModalOpen(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sales');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canDo('cashier', 'canAdd') && !canDo('customers', 'canAdd')) {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
    };

    try {
      const id = await offlineCreate('customers', data);
      setSelectedCustomerId(id);
      setIsCustomerModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'customers');
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printable-invoice');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast(t('popupBlocked'), 'error');
      return;
    }

    printWindow.document.write(`
      <html dir="${dir}">
        <head>
          <title>Invoice ${lastSale?.invoiceNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border-bottom: 1px solid #eee; padding: 10px; text-align: ${dir === 'rtl' ? 'right' : 'left'}; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .mb-8 { margin-bottom: 2rem; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[calc(100vh-12rem)] lg:h-[calc(100vh-12rem)]" dir={dir}>
      <div className="lg:col-span-2 flex flex-col space-y-4">
        <Card className="p-4 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400", dir === 'rtl' ? 'right-4' : 'left-4')} />
              <Input 
                className={cn("h-12 text-lg scanner-input", dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4')}
                placeholder={t('searchProduct')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery) {
                    handleScan(searchQuery);
                    setSearchQuery('');
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setIsScannerOpen(true)}
                variant="outline"
                className="h-12 px-6 gap-2 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900 dark:hover:bg-indigo-900/20"
              >
                <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{t('scanWithCamera')}</span>
              </Button>
            </div>
          </div>

          {/* Scanner Status Indicator */}
          <div className="flex items-center gap-4 px-2 mb-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Keyboard className="w-4 h-4" />
              <span>{t('externalScannerReady')}</span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2 text-xs font-medium">
              {scanStatus === 'idle' && (
                <>
                  <ScanLine className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">{t('readyToScan')}</span>
                </>
              )}
              {scanStatus === 'searching' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span className="text-indigo-500">{t('searching')}</span>
                </>
              )}
              {scanStatus === 'success' && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-500">{t('productAdded')}</span>
                </>
              )}
              {scanStatus === 'error' && (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-red-500">{t('productNotFound')}</span>
                </>
              )}
            </div>
          </div>
          
          {searchQuery && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex items-center p-4 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-100 hover:border-indigo-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-indigo-900/20"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-lg object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center dark:bg-indigo-900/30">
                        <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    )}
                    <div className={cn("flex-1", dir === 'rtl' ? 'text-right' : 'text-left')}>
                      <h4 className="font-bold text-slate-900 dark:text-white">{product.name}</h4>
                      <div className="flex flex-wrap gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{product.price} {t('egp')}</span>
                        <span>|</span>
                        <span>{t('stock')}: {product.stock}</span>
                        {product.brand && (
                          <>
                            <span>|</span>
                            <span>{product.brand}</span>
                          </>
                        )}
                        {product.color && (
                          <>
                            <span>|</span>
                            <span>{product.color}</span>
                          </>
                        )}
                        {product.size && (
                          <>
                            <span>|</span>
                            <span>{t('size')}: {product.size}</span>
                          </>
                        )}
                        {product.barcode && (
                          <>
                            <span>|</span>
                            <span>{t('barcode')}: {product.barcode}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Plus className={cn("w-5 h-5 text-indigo-600 dark:text-indigo-400", dir === 'rtl' ? 'mr-4' : 'ml-4')} />
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.slice(0, 12).map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="flex flex-col items-center p-4 bg-white border border-slate-200 rounded-2xl hover:shadow-lg transition-all hover:border-indigo-300 dark:bg-slate-900 dark:border-slate-800"
              >
                <div className="w-full aspect-square mb-3 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                </div>
                <span className="text-sm font-bold text-slate-900 text-center line-clamp-2 dark:text-white">{product.name}</span>
                <span className="text-xs font-medium text-indigo-600 mt-1 dark:text-indigo-400">{product.price} {t('egp')}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1 flex flex-col h-full">
        <Card className="flex-1 flex flex-col p-6 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('cart')}</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCart([])} className="text-red-500 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex gap-2 relative">
              <div className="flex-1 relative">
                <div 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white cursor-pointer flex justify-between items-center"
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                >
                  <span className={selectedCustomer ? "text-slate-900 dark:text-white font-medium" : "text-slate-400"}>
                    {selectedCustomer ? selectedCustomer.name : t('walkIn')}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>

                {isCustomerDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          autoFocus
                          placeholder={t('searchCustomer')}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      <button 
                        className="w-full px-4 py-2.5 text-right hover:bg-slate-50 dark:hover:bg-slate-700 text-sm border-b border-slate-50 dark:border-slate-700"
                        onClick={() => {
                          setSelectedCustomerId('');
                          setIsCustomerDropdownOpen(false);
                          setCustomerSearch('');
                        }}
                      >
                        {t('walkIn')}
                      </button>
                      {filteredCustomers.map(c => (
                        <button 
                          key={c.id}
                          className="w-full px-4 py-2.5 text-right hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex flex-col"
                          onClick={() => {
                            setSelectedCustomerId(c.id!);
                            setIsCustomerDropdownOpen(false);
                            setCustomerSearch('');
                          }}
                        >
                          <span className="font-medium text-slate-900 dark:text-white">{c.name}</span>
                          <span className="text-[10px] text-slate-500">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsCustomerModalOpen(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'card', 'other'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    "py-2 px-1 rounded-lg border text-xs font-medium transition-all",
                    paymentMethod === method 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none" 
                      : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  )}
                >
                  {t(method)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 mb-6">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <ShoppingCart className="w-12 h-12 opacity-20" />
                <p>{t('emptyCart')}</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl dark:bg-slate-800">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white dark:bg-slate-900 flex-shrink-0">
                    {item.product.imageUrl ? (
                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.product.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.product.price} {t('egp')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.product.id!, -1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg dark:bg-slate-900 dark:border-slate-700">-</button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id!, 1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg dark:bg-slate-900 dark:border-slate-700">+</button>
                  </div>
                  <button onClick={() => removeFromCart(item.product.id!)} className="text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('totalAmount')}</span>
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{total.toLocaleString()} {t('egp')}</span>
            </div>
            <Button 
              className="w-full h-14 text-lg font-bold shadow-lg shadow-indigo-200 dark:shadow-none" 
              disabled={cart.length === 0 || isProcessing}
              onClick={handleCheckout}
            >
              {isProcessing ? t('saving') : (
                <>
                  <CreditCard className={`w-5 h-5 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                  {t('pay')}
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />

      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title={t('addCustomer')}>
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('name')}</label>
            <Input name="name" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('phone')}</label>
            <Input name="phone" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</label>
            <Input name="email" type="email" />
          </div>
          <Button type="submit" className="w-full">{t('save')}</Button>
        </form>
      </Modal>

      <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title={t('printInvoice')}>
        <div className="space-y-6">
          <div id="printable-invoice" className="bg-white p-6 border rounded-xl text-slate-900">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">{settings?.companyName || t('companyName')}</h2>
              <p className="text-xs text-slate-500">{settings?.invoiceHeader}</p>
            </div>
            <div className="flex justify-between text-xs mb-4 border-b pb-2">
              <div>
                <p className="font-bold">{t('invoiceNumber')}: {lastSale?.invoiceNumber}</p>
                <p>{t('date')}: {lastSale && new Date(lastSale.date).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{t('customer')}: {customers.find(c => c.id === lastSale?.customerId)?.name || t('walkIn')}</p>
                <p>{t('paymentMethod')}: {lastSale && t(lastSale.paymentMethod)}</p>
              </div>
            </div>
            <table className="w-full text-xs mb-4">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-1">{t('product')}</th>
                  <th className="text-center py-1">{t('quantity')}</th>
                  <th className="text-left py-1">{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {lastSale?.items.map((item, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-1">{products.find(p => p.id === item.productId)?.name}</td>
                    <td className="text-center py-1">{item.quantity}</td>
                    <td className="text-left py-1">{(item.price * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-bold text-sm">
              <span>{t('totalAmount')}</span>
              <span>{lastSale?.total.toLocaleString()} {t('egp')}</span>
            </div>
            <div className="text-center mt-6 pt-4 border-t text-[10px] text-slate-400 italic">
              {settings?.invoiceFooter}
            </div>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1" onClick={() => setIsPrintModalOpen(false)}>{t('close')}</Button>
            <Button className="flex-1" onClick={handlePrint}>
              <Printer className={cn("w-4 h-4", dir === 'rtl' ? 'ml-2' : 'mr-2')} />
              {t('print')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const InventoryModule = ({ products, warehouses, categories, canDo, showToast, confirm }: { products: Product[], warehouses: Warehouse[], categories: Category[], canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir, language } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedCategoryForProduct, setSelectedCategoryForProduct] = useState('');
  const [selectedPieceType, setSelectedPieceType] = useState<'single' | 'pair'>('single');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const UNITS = getUnits(t);

  const handleExport = () => {
    const exportData = products.map(p => ({
      [t('productName')]: p.name,
      [t('sku')]: p.sku,
      [t('category')]: p.category,
      [t('subCategory')]: p.subCategory || '',
      [t('brand')]: p.brand || '',
      [t('color')]: p.color || '',
      [t('size')]: p.size || '',
      [t('price')]: p.price,
      [t('cost')]: p.cost,
      [t('stockLeft')]: p.stockLeft,
      [t('stockRight')]: p.stockRight,
      [t('stock')]: p.stock,
      [t('unit')]: p.unit,
      [t('barcode')]: p.barcode || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('inventory'));
    XLSX.writeFile(wb, `inventory_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        // Helper to get value by checking multiple possible header translations
        const getValue = (row: any, key: string) => {
          const arHeader = (translations as any)[key]?.ar;
          const enHeader = (translations as any)[key]?.en;
          return row[arHeader] ?? row[enHeader] ?? row[key] ?? '';
        };

        let count = 0;
        for (const row of data) {
          const name = String(getValue(row, 'productName') || '').trim().substring(0, 490);
          const sku = String(getValue(row, 'sku') || '').trim().substring(0, 45);
          
          if (!name || !sku) continue;

          const productData: any = {
            name,
            sku,
            category: String(getValue(row, 'category') || '').trim(),
            subCategory: String(getValue(row, 'subCategory') || '').trim(),
            brand: String(getValue(row, 'brand') || '').trim(),
            color: String(getValue(row, 'color') || '').trim(),
            size: String(getValue(row, 'size') || '').trim(),
            price: Math.max(0, Number(getValue(row, 'price')) || 0),
            cost: Math.max(0, Number(getValue(row, 'cost')) || 0),
            stockLeft: Number(getValue(row, 'stockLeft')) || 0,
            stockRight: Number(getValue(row, 'stockRight')) || 0,
            unit: String(getValue(row, 'unit') || t('piece')).trim(),
            barcode: String(getValue(row, 'barcode') || '').trim(),
            warehouseId: warehouses[0]?.id || 'default',
          };
          
          productData.stock = Math.min(productData.stockLeft, productData.stockRight);

          const existing = products.find(p => p.sku === sku);
          if (existing) {
            await offlineUpdate('products', existing.id!, productData);
          } else {
            await offlineCreate('products', productData);
          }
          count++;
          
          if (count >= 490) break; 
        }

        if (count > 0) {
          showToast(t('importSuccess'), 'success');
        } else {
          showToast(t('noValidDataFound'), 'error');
        }
        setIsImportModalOpen(false);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'products/batch-import');
      }
    };
    reader.readAsBinaryString(file);
  };

  useEffect(() => {
    if (editingProduct) {
      setSelectedUnit(editingProduct.unit);
      setSelectedCategoryForProduct(editingProduct.category);
      setSelectedPieceType(editingProduct.pieceType || 'single');
    } else {
      setSelectedUnit('');
      setSelectedCategoryForProduct('');
      setSelectedPieceType('single');
    }
  }, [editingProduct]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const name = String(p.name || '');
      const sku = String(p.sku || '');
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const action = editingProduct ? 'canEdit' : 'canAdd';
    if (!canDo('inventory', action)) {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const imageFile = formData.get('imageFile') as File;
    let imageUrl = editingProduct?.imageUrl || '';

    if (imageFile && imageFile.size > 0) {
      if (imageFile.size > 500 * 1024) {
        showToast(t('fileTooLarge'), 'error');
        return;
      }
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(imageFile);
        });
        imageUrl = await base64Promise;
      } catch (err) {
        console.error('Image read failed:', err);
        showToast(t('fileReadFailed'), 'error');
      }
    }

    const stockLeft = Number(formData.get('stockLeft') || formData.get('stock') || 0);
    const stockRight = Number(formData.get('stockRight') || formData.get('stock') || 0);

    const data: any = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      category: formData.get('category') as string,
      subCategory: formData.get('subCategory') as string,
      brand: formData.get('brand') as string,
      color: formData.get('color') as string,
      size: formData.get('size') as string,
      price: Number(formData.get('price')),
      cost: Number(formData.get('cost')),
      stockLeft,
      stockRight,
      stock: Math.min(stockLeft, stockRight),
      unit: formData.get('unit') as string,
      pieceType: selectedPieceType,
      warehouseId: formData.get('warehouseId') as string,
      barcode: formData.get('barcode') as string,
      imageUrl: imageUrl,
    };

    if (data.unit === t('carton') || data.unit === t('box')) {
      data.piecesPerCarton = Number(formData.get('piecesPerCarton'));
      data.cartonPrice = Number(formData.get('cartonPrice'));
      data.cartonCost = Number(formData.get('cartonCost'));
    }

    try {
      if (editingProduct?.id) {
        await offlineUpdate('products', editingProduct.id, data);
      } else {
        await offlineCreate('products', data);
      }
      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, editingProduct?.id ? `products/${editingProduct.id}` : 'products');
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('inventory')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400", language === 'ar' ? 'right-3' : 'left-3')} />
            <Input 
              placeholder={t('searchProduct')} 
              className={cn("w-64", language === 'ar' ? 'pr-10' : 'pl-10')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">{t('allCategories')}</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          {canDo('inventory', 'canAdd') && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport}>
                <Download className={cn("w-4 h-4", language === 'ar' ? 'ml-2' : 'mr-2')} />
                {t('exportToExcel')}
              </Button>
              <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                <Upload className={cn("w-4 h-4", language === 'ar' ? 'ml-2' : 'mr-2')} />
                {t('importFromExcel')}
              </Button>
              <Button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>
                <Plus className={cn("w-4 h-4", language === 'ar' ? 'ml-2' : 'mr-2')} />
                {t('addProduct')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className={cn("w-full", language === 'ar' ? 'text-right' : 'text-left')}>
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900/50 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('product')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('brand')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('color')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('size')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('category')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('subCategory')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('warehouse')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('sellingPrice')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('stock')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.imageUrl && (
                        <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{product.name}</div>
                        <div className="text-xs text-slate-500">{product.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{product.brand || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{product.color || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{product.size || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{product.category}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{product.subCategory || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {warehouses.find(w => w.id === product.warehouseId)?.name || t('notSpecified')}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{product.price.toLocaleString()} {t('egp')}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {product.pieceType === 'pair' ? (
                        <>
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-medium w-fit bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                          )}>
                            {t('pairs')}: {product.stock}
                          </span>
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-medium w-fit',
                            product.stockLeft < 5 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          )}>
                            {t('stockLeft')}: {product.stockLeft}
                          </span>
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-medium w-fit',
                            product.stockRight < 5 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          )}>
                            {t('stockRight')}: {product.stockRight}
                          </span>
                        </>
                      ) : (
                        <span className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-medium w-fit',
                          product.stock < 5 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                        )}>
                          {t('stock')}: {product.stock}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {canDo('inventory', 'canEdit') && (
                        <Button variant="ghost" size="sm" onClick={() => { setEditingProduct(product); setIsModalOpen(true); }}>
                          {t('edit')}
                        </Button>
                      )}
                      {canDo('inventory', 'canDelete') && (
                        <Button variant="danger" size="sm" onClick={async () => {
                          confirm(t('confirmDelete'), t('confirmDeleteProduct'), async () => {
                            try {
                              await offlineDelete('products', product.id!);
                            } catch (err) {
                              handleFirestoreError(err, OperationType.DELETE, `products/${product.id}`);
                            }
                          });
                        }}>
                          {t('delete')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProduct ? t('editProduct') : t('addNewProduct')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('productImage')}</label>
            <Input name="imageFile" type="file" accept="image/*" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('productName')}</label>
              <Input name="name" defaultValue={editingProduct?.name} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('sku')}</label>
              <Input name="sku" defaultValue={editingProduct?.sku} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('category')}</label>
              <select 
                name="category" 
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                value={selectedCategoryForProduct}
                onChange={(e) => setSelectedCategoryForProduct(e.target.value)}
                required
              >
                <option value="">{t('selectCategory')}</option>
                {categories.filter(c => !c.parentId).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('subCategory')}</label>
              <select 
                name="subCategory" 
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                defaultValue={editingProduct?.subCategory}
              >
                <option value="">{t('selectCategory')}</option>
                {categories.filter(c => {
                  if (!c.parentId) return false;
                  const parent = categories.find(pc => pc.id === c.parentId);
                  return parent?.name === selectedCategoryForProduct;
                }).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('pieceType')}</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="radio" 
                  name="pieceType" 
                  value="single" 
                  checked={selectedPieceType === 'single'} 
                  onChange={() => setSelectedPieceType('single')}
                />
                {t('singlePiece')}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="radio" 
                  name="pieceType" 
                  value="pair" 
                  checked={selectedPieceType === 'pair'} 
                  onChange={() => setSelectedPieceType('pair')}
                />
                {t('pairPiece')}
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('brand')}</label>
              <Input name="brand" defaultValue={editingProduct?.brand} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('color')}</label>
              <Input name="color" defaultValue={editingProduct?.color} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('size')}</label>
              <Input name="size" defaultValue={editingProduct?.size} />
            </div>
          </div>
          {selectedPieceType === 'pair' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('stockLeft')}</label>
                <Input name="stockLeft" type="number" defaultValue={editingProduct?.stockLeft || 0} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('stockRight')}</label>
                <Input name="stockRight" type="number" defaultValue={editingProduct?.stockRight || 0} required />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('stock')}</label>
              <Input name="stock" type="number" defaultValue={editingProduct?.stock || 0} required />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('sellingPrice')}</label>
              <Input name="price" type="number" defaultValue={editingProduct?.price} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('cost')}</label>
              <Input name="cost" type="number" defaultValue={editingProduct?.cost} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('warehouse')}</label>
              <select 
                name="warehouseId" 
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                defaultValue={editingProduct?.warehouseId}
                required
              >
                <option value="">{t('selectWarehouse')}</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('unit')}</label>
              <select 
                name="unit" 
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                required
              >
                <option value="">{t('selectUnit')}</option>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {(selectedUnit === t('carton') || selectedUnit === t('box')) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 dark:bg-slate-900/50 dark:border-slate-700">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('piecesCount')}</label>
                <Input name="piecesPerCarton" type="number" defaultValue={editingProduct?.piecesPerCarton} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('cartonPrice')}</label>
                <Input name="cartonPrice" type="number" defaultValue={editingProduct?.cartonPrice} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('cartonCost')}</label>
                <Input name="cartonCost" type="number" defaultValue={editingProduct?.cartonCost} required />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('barcode')}</label>
            <Input name="barcode" defaultValue={editingProduct?.barcode} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('currentStock')}</label>
            <Input name="stock" type="number" defaultValue={editingProduct?.stock} required />
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full">{t('saveProduct')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title={t('importFromExcel')}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('selectExcelFile')}
          </p>
          <Input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={handleImport}
          />
          <div className="pt-4">
            <Button variant="outline" className="w-full" onClick={() => setIsImportModalOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const PurchasesModule = ({ purchases, suppliers, products, warehouses, canDo, showToast, confirm }: { purchases: Purchase[], suppliers: Supplier[], products: Product[], warehouses: Warehouse[], canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir, language } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [items, setItems] = useState<{ 
    productId: string; 
    quantity: number; 
    cost: number; 
    discount: number;
    sellingPrice: number;
    warehouseId: string;
    unitType?: 'piece' | 'carton';
  }[]>([]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const supplier = suppliers.find(s => s.id === p.supplierId);
      const supplierName = supplier?.name || t('unknownSupplier');
      const companyName = supplier?.companyName || '';
      
      const matchesSearch = !searchQuery || 
                           supplierName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           companyName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = !dateFilter || p.date.startsWith(dateFilter);
      return matchesSearch && matchesDate;
    });
  }, [purchases, suppliers, searchQuery, dateFilter, t]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [purchaseToView, setPurchaseToView] = useState<Purchase | null>(null);

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, cost: 0, discount: 0, sellingPrice: 0, warehouseId: '', unitType: 'piece' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    
    const product = products.find(p => p.id === newItems[index].productId);
    if (product) {
      if (field === 'productId') {
        const isCarton = product.unit === t('carton') || product.unit === t('box');
        newItems[index].unitType = isCarton ? 'carton' : 'piece';
        newItems[index].cost = isCarton ? (product.cartonCost || product.cost) : product.cost;
        newItems[index].sellingPrice = isCarton ? (product.cartonPrice || product.price) : product.price;
        newItems[index].warehouseId = product.warehouseId;
      } else if (field === 'unitType') {
        newItems[index].cost = value === 'carton' ? (product.cartonCost || product.cost) : product.cost;
        newItems[index].sellingPrice = value === 'carton' ? (product.cartonPrice || product.price) : product.price;
      }
    }
    setItems(newItems);
  };

  const calculateItemTotal = (item: any) => {
    const base = item.quantity * item.cost;
    const discount = (base * (item.discount || 0)) / 100;
    return base - discount;
  };

  const calculateGrandTotal = () => {
    const subtotal = items.reduce((acc, item) => acc + calculateItemTotal(item), 0);
    if (discountType === 'percentage') {
      return subtotal - (subtotal * totalDiscount) / 100;
    }
    return subtotal - totalDiscount;
  };

  const handleOpenInvoice = (url: string) => {
    if (url.startsWith('data:')) {
      try {
        const arr = url.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } catch (error) {
        console.error("Error opening base64 invoice:", error);
        showToast(t('errorOpeningInvoice'), 'error');
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDo('purchases', 'canAdd')) {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    setIsUploading(true);
    let invoiceUrl = '';
    
    try {
      if (invoiceFile) {
        if (invoiceFile.size > 500 * 1024) {
        showToast(t('fileTooLarge'), 'error');
          setIsUploading(false);
          return;
        }
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(invoiceFile);
          });
          invoiceUrl = await base64Promise;
        } catch (uploadError) {
          console.error("File read failed:", uploadError);
        showToast(t('fileReadFailed'), 'error');
        }
      }

      const grandTotal = calculateGrandTotal();
      const purchaseData: any = {
        supplierId: selectedSupplier,
        date: new Date().toISOString(),
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          quantityLeft: item.quantity,
          quantityRight: item.quantity,
          cost: item.cost,
          discount: item.discount,
          unitType: item.unitType
        })),
        total: grandTotal,
        totalDiscount,
        discountType
      };

      if (invoiceUrl) {
        purchaseData.invoiceUrl = invoiceUrl;
      }

      const tempId = generateId();
      
      await offlineCreate('purchases', { ...purchaseData, id: tempId });

      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        let stockAddition = item.quantity;
        let updateData: any = {
          warehouseId: item.warehouseId,
        };
        
        if (product && (product.unit === t('carton') || product.unit === t('box'))) {
          if (item.unitType === 'piece') {
            stockAddition = item.quantity / (product.piecesPerCarton || 1);
            updateData.cost = item.cost;
            updateData.price = item.sellingPrice;
          } else {
            updateData.cartonCost = item.cost;
            updateData.cartonPrice = item.sellingPrice;
          }
        } else {
          updateData.cost = item.cost;
          updateData.price = item.sellingPrice;
        }
        
        updateData.stockLeft = increment(stockAddition);
        updateData.stockRight = increment(stockAddition);
        updateData.stock = increment(stockAddition);
        
        await offlineUpdate('products', item.productId, updateData);
      }

      await offlineCreate('transactions', {
        date: new Date().toISOString(),
        description: `${t('purchaseFrom')} ${suppliers.find(s => s.id === selectedSupplier)?.name}`,
        type: 'expense',
        amount: grandTotal,
        category: t('purchases'),
        referenceId: tempId
      });
      setIsModalOpen(false);
      setItems([]);
      setSelectedSupplier('');
      setTotalDiscount(0);
      setInvoiceFile(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'purchases');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      companyName: formData.get('companyName') as string,
      taxId: formData.get('taxId') as string,
      address: formData.get('address') as string,
    };

    try {
      const id = await offlineCreate('suppliers', data);
      setSelectedSupplier(id);
      setIsSupplierModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'suppliers');
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('purchases')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <Input 
              placeholder={t('searchSupplier')} 
              className={`${dir === 'rtl' ? 'pr-10' : 'pl-10'} w-64`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Input 
            type="date"
            className="w-40"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {canDo('purchases', 'canAdd') && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('newPurchaseInvoice')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('date')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('supplier')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('itemsCount')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('total')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('invoice')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPurchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {format(new Date(purchase.date), 'yyyy/MM/dd HH:mm', { locale: language === 'ar' ? undefined : enUS })}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                    {suppliers.find(s => s.id === purchase.supplierId)?.name || t('unknownSupplier')}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{purchase.items.length}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{purchase.total.toLocaleString()} {t('egp')}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {purchase.invoiceUrl ? (
                      <button 
                        onClick={() => handleOpenInvoice(purchase.invoiceUrl)} 
                        className="text-indigo-600 hover:underline cursor-pointer dark:text-indigo-400"
                      >
                        {t('attachment')}
                      </button>
                    ) : (
                      <span className="text-slate-400">{t('none')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    <Button variant="outline" size="sm" onClick={() => setPurchaseToView(purchase)}>
                      {t('viewDetails')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('newPurchaseInvoice')} maxWidth="max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('supplier')}</label>
              <button 
                type="button" 
                onClick={() => setIsSupplierModalOpen(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                <Plus className="w-3 h-3" />
                {t('newSupplier')}
              </button>
            </div>
            <select 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              required
            >
              <option value="">{t('selectSupplier')}</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{t('items')}</h4>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                {t('addItem')}
              </Button>
            </div>
            
            {items.map((item, index) => {
              const product = products.find(p => p.id === item.productId);
              const isCartonProduct = product && (product.unit === 'كرتونة' || product.unit === 'صندوق');
              
              return (
              <div key={index} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 relative dark:bg-slate-900/50 dark:border-slate-800">
                <button type="button" onClick={() => removeItem(index)} className={`absolute top-2 ${dir === 'rtl' ? 'left-2' : 'right-2'} text-red-500 hover:text-red-700 bg-white rounded-full p-1 shadow-sm dark:bg-slate-800`}>
                  <X className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('product')}</label>
                    <select 
                      className="w-full h-9 rounded border border-slate-200 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      value={item.productId}
                      onChange={(e) => updateItem(index, 'productId', e.target.value)}
                      required
                    >
                      <option value="">{t('selectProduct')}</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} - {p.category} - {p.subCategory} - {p.brand} - {p.color}
                        </option>
                      ))}
                    </select>
                    {product && (
                      <div className="flex flex-wrap gap-2 mt-1 px-1">
                        <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                          {t('stock')}: {product.stock}
                        </span>
                        <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                          {t('cost')}: {product.cost}
                        </span>
                        <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                          {t('price')}: {product.price}
                        </span>
                        <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                          {t('brand')}: {product.brand || '-'}
                        </span>
                        <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                          {t('color')}: {product.color || '-'}
                        </span>
                        <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                          {t('category')}: {product.category}
                        </span>
                        <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                          {t('subCategory')}: {product.subCategory || '-'}
                        </span>
                      </div>
                    )}
                  </div>
                  {isCartonProduct && (
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('unitType')}</label>
                      <select 
                        className="w-full h-9 rounded border border-slate-200 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                        value={item.unitType || 'carton'}
                        onChange={(e) => updateItem(index, 'unitType', e.target.value)}
                      >
                        <option value="carton">{t('carton')}</option>
                        <option value="piece">{t('piece')}</option>
                      </select>
                    </div>
                  )}
                  <div className={isCartonProduct ? "md:col-span-3 space-y-1" : "md:col-span-4 space-y-1"}>
                    <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('quantity')}</label>
                    <Input 
                      type="number" 
                      className="h-9 text-xs"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className={isCartonProduct ? "md:col-span-3 space-y-1" : "md:col-span-4 space-y-1"}>
                    <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('cost')}</label>
                    <Input 
                      type="number" 
                      className="h-9 text-xs"
                      value={item.cost}
                      onChange={(e) => updateItem(index, 'cost', Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('itemDiscountPercent')}</label>
                    <Input 
                      type="number" 
                      className="h-9 text-xs"
                      value={item.discount}
                      onChange={(e) => updateItem(index, 'discount', Number(e.target.value))}
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('newSellingPrice')}</label>
                    <Input 
                      type="number" 
                      className="h-9 text-xs"
                      value={item.sellingPrice}
                      onChange={(e) => updateItem(index, 'sellingPrice', Number(e.target.value))}
                    />
                  </div>
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('directToWarehouse')}</label>
                    <select 
                      className="w-full h-9 rounded border border-slate-200 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      value={item.warehouseId}
                      onChange={(e) => updateItem(index, 'warehouseId', e.target.value)}
                    >
                      <option value="">{t('selectWarehouse')}</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )})}
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">{t('invoiceDiscountType')}</label>
                <select 
                  className="w-full h-9 rounded border border-slate-200 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                >
                  <option value="percentage">{t('percentage')}</option>
                  <option value="fixed">{t('fixedAmount')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">{t('discountValue')}</label>
                <Input 
                  type="number" 
                  className="h-9 text-xs"
                  value={totalDiscount}
                  onChange={(e) => setTotalDiscount(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">{t('finalTotalLabel')}</span>
              <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                {calculateGrandTotal().toLocaleString()} {t('egp')}
              </span>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500 dark:text-slate-400">{t('uploadInvoiceOptional')}</label>
              <Input 
                type="file" 
                className="h-9 text-xs"
                accept="image/*,.pdf"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={items.length === 0 || isUploading}>
              {isUploading ? t('saving') : t('saveInvoice')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title={t('quickAddSupplier')}>
        <form onSubmit={handleAddSupplier} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('name')}</label>
              <Input name="name" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('companyName')}</label>
              <Input name="companyName" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('taxId')}</label>
              <Input name="taxId" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('phone')}</label>
              <Input name="phone" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</label>
            <Input name="email" type="email" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('address')}</label>
            <Input name="address" />
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full">{t('saveSupplier')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!purchaseToView} onClose={() => setPurchaseToView(null)} title={t('purchaseInvoiceDetails')}>
        {purchaseToView && (
          <div className="space-y-6" dir={dir}>
            <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('supplier')}</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{suppliers.find(s => s.id === purchaseToView.supplierId)?.name || t('unknownSupplier')}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('date')}</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{format(new Date(purchaseToView.date), 'yyyy/MM/dd HH:mm', { locale: language === 'ar' ? undefined : enUS })}</p>
                </div>
              </div>
              
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">{t('items')}</h4>
              <div className="overflow-x-auto">
                <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                  <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className={`py-2 px-3 ${dir === 'rtl' ? 'rounded-r-lg' : 'rounded-l-lg'}`}>{t('product')}</th>
                      <th className="py-2 px-3">{t('quantity')}</th>
                      <th className="py-2 px-3">{t('cost')}</th>
                      <th className="py-2 px-3">{t('discount')}</th>
                      <th className={`py-2 px-3 ${dir === 'rtl' ? 'rounded-l-lg' : 'rounded-r-lg'}`}>{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {purchaseToView.items.map((item, idx) => {
                      const base = item.quantity * item.cost;
                      const discountVal = (base * (item.discount || 0)) / 100;
                      const itemTotal = base - discountVal;
                      return (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-slate-900 dark:text-white">{products.find(p => p.id === item.productId)?.name || t('unknownProduct')}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{item.quantity} {item.unitType === 'carton' ? t('carton') : t('piece')}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{item.cost.toLocaleString()} {t('egp')}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{item.discount || 0}%</td>
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{itemTotal.toLocaleString()} {t('egp')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-6 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                {purchaseToView.totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>{t('invoiceDiscountLabel')}</span>
                    <span>{purchaseToView.totalDiscount.toLocaleString()} {purchaseToView.discountType === 'percentage' ? '%' : t('egp')}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg text-slate-900 dark:text-white">
                  <span>{t('finalTotalLabel')}</span>
                  <span>{purchaseToView.total.toLocaleString()} {t('egp')}</span>
                </div>
              </div>
            </div>
            <div className={`flex ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
              <Button variant="outline" onClick={() => setPurchaseToView(null)}>{t('close')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const SalesModule = ({ sales, customers, products, settings, canDo, showToast, confirm }: { sales: Sale[], customers: Customer[], products: Product[], settings: SystemSettings, canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir, language } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: number; price: number; unitType?: 'piece' | 'carton' }[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(settings.taxRate || 0);
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);

  useEffect(() => {
    if (isModalOpen && items.length === 0) {
      setTaxRate(settings.taxRate || 0);
    }
  }, [isModalOpen, settings.taxRate]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const customer = customers.find(c => c.id === s.customerId);
      const customerName = customer?.name || (s.customerId === 'walk-in' ? t('walkIn') : t('unknownCustomer'));
      const customerPhone = customer?.phone || '';
      
      const matchesSearch = !searchQuery || 
                           customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           customerPhone.includes(searchQuery);
      const matchesDate = !dateFilter || s.date.startsWith(dateFilter);
      return matchesSearch && matchesDate;
    });
  }, [sales, customers, searchQuery, dateFilter, t]);

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, price: 0, unitType: 'piece' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    
    const product = products.find(p => p.id === newItems[index].productId);
    if (product) {
      if (field === 'productId') {
        const isCarton = product.unit === 'كرتونة' || product.unit === 'صندوق';
        newItems[index].unitType = isCarton ? 'carton' : 'piece';
        newItems[index].price = isCarton ? (product.cartonPrice || product.price) : product.price;
      } else if (field === 'unitType') {
        newItems[index].price = value === 'carton' ? (product.cartonPrice || product.price) : product.price;
      }
    }
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDo('sales', 'canAdd')) {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const afterDiscount = Math.max(0, subtotal - discount);
    const taxAmount = (afterDiscount * taxRate) / 100;
    const total = afterDiscount + taxAmount;
    
    const saleData = {
      customerId: selectedCustomer,
      date: new Date().toISOString(),
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        quantityLeft: item.quantity,
        quantityRight: item.quantity,
        price: item.price,
        unitType: item.unitType
      })),
      total,
      discount,
      tax: taxAmount
    };

    try {
      const tempId = generateId();
      await offlineCreate('sales', { ...saleData, id: tempId });

      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        let stockDeduction = item.quantity;
        if (product && (product.unit === t('carton') || product.unit === t('box')) && item.unitType === 'piece') {
          stockDeduction = item.quantity / (product.piecesPerCarton || 1);
        }
        
        await offlineUpdate('products', item.productId, { 
          stockLeft: increment(-stockDeduction),
          stockRight: increment(-stockDeduction),
          stock: increment(-stockDeduction) 
        });
      }

      await offlineCreate('transactions', {
        date: new Date().toISOString(),
        description: `${t('saleTo')} ${customers.find(c => c.id === selectedCustomer)?.name}`,
        type: 'income',
        amount: total,
        category: t('sales'),
        referenceId: tempId
      });

      setIsModalOpen(false);
      setItems([]);
      setSelectedCustomer('');
      setDiscount(0);
      setSaleToPrint({ id: tempId, ...saleData });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sales');
    }
  };

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
    };

    try {
      const id = await offlineCreate('customers', data);
      setSelectedCustomer(id);
      setIsCustomerModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'customers');
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('sales')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <Input 
              placeholder={t('searchCustomer')} 
              className={`${dir === 'rtl' ? 'pr-10' : 'pl-10'} w-64`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Input 
            type="date"
            className="w-40"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {canDo('sales', 'canAdd') && (
            <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
              <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('newSaleInvoice')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('date')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('customer')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('itemsCount')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('total')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {format(new Date(sale.date), 'yyyy/MM/dd HH:mm', { locale: language === 'ar' ? undefined : enUS })}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                    {customers.find(c => c.id === sale.customerId)?.name || (sale.customerId === 'walk-in' ? t('walkIn') : t('unknownCustomer'))}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{sale.items.length}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{sale.total.toLocaleString()} {t('egp')}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    <Button variant="outline" size="sm" onClick={() => setSaleToPrint(sale)}>
                      {t('viewDetails')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('newSaleInvoice')} maxWidth="max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('customer')}</label>
              <button 
                type="button" 
                onClick={() => setIsCustomerModalOpen(true)}
                className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                <Plus className="w-3 h-3" />
                {t('newCustomer')}
              </button>
            </div>
            <select 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              required
            >
              <option value="">{t('selectCustomer')}</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{t('items')}</h4>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                {t('addItem')}
              </Button>
            </div>
            
            {items.map((item, index) => {
              const product = products.find(p => p.id === item.productId);
              const isCartonProduct = product && (product.unit === t('carton') || product.unit === t('box'));
              
              return (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end bg-slate-50 p-3 rounded-lg relative dark:bg-slate-900/50 dark:border-slate-800">
                <button type="button" onClick={() => removeItem(index)} className={`absolute top-2 ${dir === 'rtl' ? 'left-2' : 'right-2'} text-red-500 hover:text-red-700 bg-white rounded-full p-1 shadow-sm md:hidden dark:bg-slate-800`}>
                  <X className="w-4 h-4" />
                </button>
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('product')}</label>
                  <select 
                    className="w-full h-9 rounded border border-slate-200 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                    value={item.productId}
                    onChange={(e) => updateItem(index, 'productId', e.target.value)}
                    required
                  >
                    <option value="">{t('selectProduct')}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                        {p.name} ({p.stock} {t('available')})
                      </option>
                    ))}
                  </select>
                </div>
                {isCartonProduct && (
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('unitType')}</label>
                    <select 
                      className="w-full h-9 rounded border border-slate-200 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      value={item.unitType || 'carton'}
                      onChange={(e) => updateItem(index, 'unitType', e.target.value)}
                    >
                      <option value="carton">{t('carton')}</option>
                      <option value="piece">{t('piece')}</option>
                    </select>
                  </div>
                )}
                <div className={isCartonProduct ? "md:col-span-2 space-y-1" : "md:col-span-3 space-y-1"}>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('quantity')}</label>
                  <Input 
                    type="number" 
                    className="h-9 text-xs"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                    max={product?.stock}
                    required
                  />
                </div>
                <div className={isCartonProduct ? "md:col-span-3 space-y-1" : "md:col-span-4 space-y-1"}>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400">{t('price')}</label>
                  <Input 
                    type="number" 
                    className="h-9 text-xs"
                    value={item.price}
                    onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                    required
                  />
                </div>
                <div className="hidden md:flex md:col-span-1 items-center justify-center pb-2">
                  <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )})}
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">{t('subtotal')}:</span>
              <span className="text-lg font-medium text-slate-900 dark:text-white">
                {items.reduce((acc, item) => acc + (item.quantity * item.price), 0).toLocaleString()} {t('egp')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">{t('discount')} ({t('fixedAmount')}):</span>
              <Input 
                type="number" 
                className={`w-32 ${dir === 'rtl' ? 'text-right' : 'text-left'}`} 
                value={discount} 
                onChange={(e) => setDiscount(Number(e.target.value))} 
                min="0"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">{t('tax')} (%):</span>
              <Input 
                type="number" 
                className={`w-32 ${dir === 'rtl' ? 'text-right' : 'text-left'}`} 
                value={taxRate} 
                onChange={(e) => setTaxRate(Number(e.target.value))} 
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex justify-between items-center border-t border-slate-100 pt-4 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">{t('finalTotalLabel')}</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {(() => {
                  const sub = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
                  const afterD = Math.max(0, sub - discount);
                  const tax = (afterD * taxRate) / 100;
                  return (afterD + tax).toLocaleString();
                })()} {t('egp')}
              </span>
            </div>
            <Button type="submit" variant="secondary" className="w-full" disabled={items.length === 0}>{t('saveInvoice')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!saleToPrint} onClose={() => setSaleToPrint(null)} title="تفاصيل الفاتورة">
        {saleToPrint && (
          <div className="space-y-6">
            <div id="invoice-print-area" className="p-8 bg-white text-slate-900 border border-slate-200 rounded-lg" dir="rtl">
              {settings.invoiceHeader && (
                <div className="mb-6 pb-4 border-b border-slate-200 whitespace-pre-wrap text-center" style={{ color: settings.primaryColor || '#4f46e5' }}>
                  {settings.invoiceHeader}
                </div>
              )}
              <div className="text-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold" style={{ color: settings.primaryColor || '#4f46e5' }}>فاتورة مبيعات</h2>
                {settings.companyName && <p className="text-lg font-semibold mt-2">{settings.companyName}</p>}
                {settings.taxNumber && <p className="text-sm text-slate-500">الرقم الضريبي: {settings.taxNumber}</p>}
                <p className="text-sm text-slate-500 mt-2">التاريخ: {format(new Date(saleToPrint.date), 'yyyy/MM/dd HH:mm')}</p>
                <p className="text-sm text-slate-500">العميل: {customers.find(c => c.id === saleToPrint.customerId)?.name}</p>
              </div>
              <table className="w-full mb-6 text-right">
                <thead>
                  <tr className="border-b" style={{ borderBottomColor: settings.primaryColor || '#4f46e5' }}>
                    <th className="py-2">المنتج</th>
                    <th className="py-2">الكمية</th>
                    <th className="py-2">السعر</th>
                    <th className="py-2">المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {saleToPrint.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="py-2">{products.find(p => p.id === item.productId)?.name}</td>
                      <td className="py-2">{item.quantity}</td>
                      <td className="py-2">{item.price}</td>
                      <td className="py-2">{item.quantity * item.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{(() => {
                    const sub = saleToPrint.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
                    return sub.toLocaleString();
                  })()} ج.م</span>
                </div>
                {saleToPrint.discount ? (
                  <div className="flex justify-between text-red-600">
                    <span>الخصم:</span>
                    <span>{saleToPrint.discount.toLocaleString()} ج.م</span>
                  </div>
                ) : null}
                {saleToPrint.tax ? (
                  <div className="flex justify-between text-slate-600">
                    <span>الضريبة:</span>
                    <span>{saleToPrint.tax.toLocaleString()} ج.م</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-lg pt-2 border-t" style={{ color: settings.primaryColor || '#4f46e5' }}>
                  <span>الإجمالي:</span>
                  <span>{saleToPrint.total.toLocaleString()} ج.م</span>
                </div>
              </div>
              {settings.invoiceFooter && (
                <div className="mt-8 pt-4 border-t border-slate-200 whitespace-pre-wrap text-center text-sm text-slate-500">
                  {settings.invoiceFooter}
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <Button 
                className="flex-1"
                onClick={() => {
                  const printContent = document.getElementById('invoice-print-area');
                  const windowPrint = window.open('', '', 'width=900,height=650');
                  if (windowPrint && printContent) {
                    windowPrint.document.write(`
                      <html dir="rtl">
                        <head>
                          <title>طباعة الفاتورة</title>
                          <style>
                            body { font-family: system-ui, sans-serif; padding: 20px; }
                            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                            th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: right; }
                            .text-center { text-align: center; }
                            .flex { display: flex; }
                            .justify-between { justify-content: space-between; }
                            .font-bold { font-weight: bold; }
                            .text-lg { font-size: 1.125rem; }
                            .text-2xl { font-size: 1.5rem; }
                            .border-b { border-bottom: 1px solid #eee; }
                            .border-t { border-top: 1px solid #eee; }
                            .pb-4 { padding-bottom: 1rem; }
                            .pt-4 { padding-top: 1rem; }
                            .mb-6 { margin-bottom: 1.5rem; }
                            .mt-1 { margin-top: 0.25rem; }
                          </style>
                        </head>
                        <body>
                          ${printContent.innerHTML}
                        </body>
                      </html>
                    `);
                    windowPrint.document.close();
                    windowPrint.focus();
                    windowPrint.print();
                    windowPrint.close();
                  }
                }}
              >
                طباعة
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setSaleToPrint(null)}>إغلاق</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title={t('quickAddCustomer')}>
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('name')}</label>
            <Input name="name" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</label>
            <Input name="email" type="email" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('phone')}</label>
            <Input name="phone" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('address')}</label>
            <Input name="address" />
          </div>
          <div className="pt-4">
            <Button type="submit" variant="secondary" className="w-full">{t('saveCustomer')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const AccountingModule = ({ transactions, sales, purchases, canDo, showToast, confirm }: { transactions: Transaction[], sales: Sale[], purchases: Purchase[], canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir, language } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [attachment, setAttachment] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(trans => {
      const matchesSearch = trans.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          trans.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || trans.type === typeFilter;
      const matchesDate = !dateFilter || trans.date.startsWith(dateFilter);
      return matchesSearch && matchesType && matchesDate;
    });
  }, [transactions, searchQuery, typeFilter, dateFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canDo('accounting', 'canAdd')) {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const data: any = {
      date: new Date().toISOString(),
      description: formData.get('description') as string,
      type: formData.get('type') as 'income' | 'expense',
      amount: Number(formData.get('amount')),
      category: formData.get('category') as string,
    };
    if (attachment) {
      data.attachmentUrl = attachment;
    }

    try {
      const id = await offlineCreate('transactions', data);
      setIsModalOpen(false);
      setAttachment(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
    }
  };

  const relatedInvoice = useMemo(() => {
    if (!selectedTransaction?.referenceId) return null;
    if (selectedTransaction.type === 'income') {
      return sales.find(s => s.id === selectedTransaction.referenceId);
    } else {
      return purchases.find(p => p.id === selectedTransaction.referenceId);
    }
  }, [selectedTransaction, sales, purchases]);

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('accounting')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <Input 
              placeholder={t('searchTransactions')} 
              className={`${dir === 'rtl' ? 'pr-10' : 'pl-10'} w-64`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">{t('allTypes')}</option>
            <option value="income">{t('income')}</option>
            <option value="expense">{t('expense')}</option>
          </select>
          <Input 
            type="date"
            className="w-40"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {canDo('accounting', 'canAdd') && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('addManualEntry')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('date')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('description')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('category')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('amount')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransactions.map((trans) => (
                <tr key={trans.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-900/50">
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {format(new Date(trans.date), 'yyyy/MM/dd')}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{trans.description}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{trans.category}</td>
                  <td className={cn(
                    'px-6 py-4 text-sm font-bold',
                    trans.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                  )}>
                    {trans.type === 'income' ? '+' : '-'}{trans.amount.toLocaleString()} {t('egp')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(trans)}>
                      <Eye className="w-4 h-4 ml-1" />
                      {t('viewDetails')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('addAccountingEntry')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('description')}</label>
            <Input name="description" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('type')}</label>
              <select name="type" className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white" required>
                <option value="income">{t('income')} (+)</option>
                <option value="expense">{t('expense')} (-)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('amount')}</label>
              <Input name="amount" type="number" required />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('category')}</label>
            <Input name="category" placeholder={t('categoryPlaceholder')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('attachment')}</label>
            <Input type="file" onChange={handleFileChange} className="text-xs" />
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full">{t('saveEntry')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!selectedTransaction} onClose={() => setSelectedTransaction(null)} title={t('transactionDetails')}>
        {selectedTransaction && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">{t('date')}</p>
                <p className="text-sm font-medium">{format(new Date(selectedTransaction.date), 'yyyy/MM/dd HH:mm')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('type')}</p>
                <p className={cn("text-sm font-bold", selectedTransaction.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                  {selectedTransaction.type === 'income' ? t('income') : t('expense')}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('amount')}</p>
                <p className="text-sm font-bold">{selectedTransaction.amount.toLocaleString()} {t('egp')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('category')}</p>
                <p className="text-sm font-medium">{selectedTransaction.category}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('description')}</p>
              <p className="text-sm font-medium">{selectedTransaction.description}</p>
            </div>

            {relatedInvoice && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
                <h4 className="text-sm font-bold mb-2">{t('relatedInvoice')}</h4>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-500">{t('invoiceNumber')}</p>
                    <p className="text-sm font-medium">{(relatedInvoice as any).invoiceNumber || relatedInvoice.id?.slice(0, 8)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{t('total')}</p>
                    <p className="text-sm font-bold">{relatedInvoice.total.toLocaleString()} {t('egp')}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    // This is a bit tricky since we don't have a direct way to open the invoice modal from here easily without lifting state
                    // But we can at least show the info
                  }}>
                    <FileText className="w-4 h-4 ml-1" />
                    {t('viewInvoice')}
                  </Button>
                </div>
              </div>
            )}

            {selectedTransaction.attachmentUrl && (
              <div>
                <p className="text-xs text-slate-500 mb-2">{t('attachment')}</p>
                <div className="border rounded-lg overflow-hidden">
                  {selectedTransaction.attachmentUrl.startsWith('data:image') ? (
                    <img src={selectedTransaction.attachmentUrl} alt="Attachment" className="max-w-full h-auto" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">{t('fileAttachment')}</span>
                      </div>
                      <a href={selectedTransaction.attachmentUrl} download="attachment" className="text-indigo-600 text-sm hover:underline">
                        {t('download')}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const WarehousesModule = ({ warehouses, products, canDo, showToast, confirm }: { warehouses: Warehouse[], products: Product[], canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir, language } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canDo('warehouses', 'canAdd')) {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      location: formData.get('location') as string,
    };

    try {
      await offlineCreate('warehouses', data);
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'warehouses');
    }
  };

  const selectedWarehouseProducts = useMemo(() => {
    if (!selectedWarehouseId) return [];
    return products.filter(p => p.warehouseId === selectedWarehouseId);
  }, [products, selectedWarehouseId]);

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('warehouseStructure')}</h2>
        {canDo('warehouses', 'canAdd') && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {t('addNewWarehouse')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.map(w => (
          <Card 
            key={w.id} 
            className={cn(
              "p-6 cursor-pointer transition-all border-2 dark:bg-slate-900 dark:border-slate-800",
              selectedWarehouseId === w.id ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/20" : "border-transparent"
            )}
            onClick={() => setSelectedWarehouseId(selectedWarehouseId === w.id ? null : w.id)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center dark:bg-indigo-900/30">
                <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs font-medium text-slate-400 font-mono">#{w.id?.slice(0, 6)}</span>
                {canDo('warehouses', 'canDelete') && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      confirm(t('confirmDelete'), t('confirmDeleteWarehouse'), async () => {
                        try {
                          await offlineDelete('warehouses', w.id!);
                          if (selectedWarehouseId === w.id) setSelectedWarehouseId(null);
                        } catch (err) {
                          handleFirestoreError(err, OperationType.DELETE, `warehouses/${w.id}`);
                        }
                      });
                    }}
                    className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1 dark:text-white">{w.name}</h3>
            <p className="text-sm text-slate-500 flex items-center dark:text-slate-400">
              <MapPin className={`w-3 h-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
              {w.location}
            </p>
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {selectedWarehouseId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="p-6 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('warehouseProducts')}: {warehouses.find(w => w.id === selectedWarehouseId)?.name}
                </h3>
                <span className="text-sm text-slate-500 dark:text-slate-400">{selectedWarehouseProducts.length} {t('itemsCount')}</span>
              </div>
              
              {selectedWarehouseProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                      <tr>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('product')}</th>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">SKU</th>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('stock')}</th>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedWarehouseProducts.map((product) => (
                        <tr key={product.id}>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{product.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{product.sku}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{product.stock} {product.unit}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{(product.stock * product.cost).toLocaleString()} {t('egp')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  {t('noProductsInWarehouse')}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('addNewWarehouse')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('warehouseName')}</label>
            <Input name="name" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('locationAddress')}</label>
            <Input name="location" required />
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full">{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const StocktakingModule = ({ products, warehouses, canDo, showToast, confirm, currentUserProfile }: { products: Product[], warehouses: Warehouse[], canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void, currentUserProfile: UserProfile | undefined }) => {
  const { t, dir, language } = useTranslation();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [counts, setCounts] = useState<{ [productId: string]: { left: number, right: number } }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');

  const isAdmin = currentUserProfile?.role === 'admin';

  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))), [products]);
  const colors = useMemo(() => Array.from(new Set(products.map(p => p.color).filter(Boolean))), [products]);
  const sizes = useMemo(() => Array.from(new Set(products.map(p => p.size).filter(Boolean))), [products]);

  const filteredProducts = useMemo(() => {
    if (!selectedWarehouseId) return [];
    return products.filter(p => {
      const matchesWarehouse = p.warehouseId === selectedWarehouseId;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBrand = !selectedBrand || p.brand === selectedBrand;
      const matchesColor = !selectedColor || p.color === selectedColor;
      const matchesSize = !selectedSize || p.size === selectedSize;
      return matchesWarehouse && matchesSearch && matchesBrand && matchesColor && matchesSize;
    });
  }, [products, selectedWarehouseId, searchQuery, selectedBrand, selectedColor, selectedSize]);

  const handleCountChange = (productId: string, side: 'left' | 'right', value: number) => {
    const safeValue = isNaN(value) ? 0 : value;
    setCounts(prev => ({ 
      ...prev, 
      [productId]: { 
        ...(prev[productId] || { left: products.find(p => p.id === productId)?.stockLeft || 0, right: products.find(p => p.id === productId)?.stockRight || 0 }),
        [side]: safeValue 
      } 
    }));
  };

  const handleSubmit = async () => {
    if (!selectedWarehouseId) return;
    if (!isAdmin) {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();

      const reportData = (await Promise.all(Object.entries(counts).map(async ([productId, count]) => {
        const product = products.find(p => p.id === productId);
        if (!product) return null;

        const newStock = (count as { left: number, right: number }).left + (count as { left: number, right: number }).right;
        await offlineUpdate('products', productId, { 
          stockLeft: (count as { left: number, right: number }).left, 
          stockRight: (count as { left: number, right: number }).right,
          stock: newStock 
        });

        return {
          name: product.name,
          sku: product.sku,
          oldLeft: product.stockLeft,
          oldRight: product.stockRight,
          newLeft: (count as { left: number, right: number }).left,
          newRight: (count as { left: number, right: number }).right
        };
      }))).filter(Boolean);
      
      // Simulate sending email to admin
      console.log(`Sending stocktaking report to ${currentUserProfile?.email || 'admin'}:`, reportData);
      showToast(t('stocktakingReportSent'), 'success');
      
      setCounts({});
      setSelectedWarehouseId('');
    } catch (err) {
      console.error(err);
      showToast(t('errorSavingStocktaking'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('stocktakingProcess')}</h2>
      </div>

      <Card className="p-6 dark:bg-slate-900 dark:border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('selectWarehouseForStocktaking')}</label>
            <select 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              value={selectedWarehouseId}
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                setCounts({});
              }}
            >
              <option value="">{t('selectWarehouse')}</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('search')}</label>
            <Input 
              placeholder={t('searchProduct')} 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('brand')}</label>
            <select 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              <option value="">{t('allBrands') || 'All Brands'}</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('color')}</label>
            <select 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
            >
              <option value="">{t('allColors') || 'All Colors'}</option>
              {colors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('size')}</label>
            <select 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
            >
              <option value="">{t('allSizes') || 'All Sizes'}</option>
              {sizes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {selectedWarehouseId && (
        <Card className="p-6 dark:bg-slate-900 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('product')}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('productAccounts') || 'Product Accounts'}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('stockLeft')}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('stockRight')}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('difference')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map((product) => {
                  const currentCount = counts[product.id!] || { left: product.stockLeft, right: product.stockRight };
                  const diffLeft = currentCount.left - product.stockLeft;
                  const diffRight = currentCount.right - product.stockRight;
                  
                  return (
                    <tr key={product.id}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{product.name}</div>
                        <div className="text-xs text-slate-500">{product.sku}</div>
                        <div className="text-[10px] text-slate-400 flex gap-2">
                          <span>{product.brand}</span>
                          <span>{product.color}</span>
                          <span>{product.size}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">{t('cost')}:</span>
                            <span className="font-medium">{product.cost} {t('egp')}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">{t('price')}:</span>
                            <span className="font-medium">{product.price} {t('egp')}</span>
                          </div>
                          <div className="flex justify-between gap-4 border-t border-slate-100 pt-1 dark:border-slate-800">
                            <span className="text-slate-500">{t('stockValue')}:</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{(product.stock * product.cost).toLocaleString()} {t('egp')}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">({product.stockLeft})</span>
                          <Input 
                            type="number" 
                            className="w-20 h-8 text-xs"
                            value={currentCount.left}
                            onChange={(e) => handleCountChange(product.id!, 'left', Number(e.target.value))}
                            disabled={!isAdmin}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">({product.stockRight})</span>
                          <Input 
                            type="number" 
                            className="w-20 h-8 text-xs"
                            value={currentCount.right}
                            onChange={(e) => handleCountChange(product.id!, 'right', Number(e.target.value))}
                            disabled={!isAdmin}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-[10px]">
                          <span className={diffLeft === 0 ? "text-slate-400" : diffLeft > 0 ? "text-emerald-600" : "text-red-600"}>
                            L: {diffLeft > 0 ? '+' : ''}{diffLeft}
                          </span>
                          <span className={diffRight === 0 ? "text-slate-400" : diffRight > 0 ? "text-emerald-600" : "text-red-600"}>
                            R: {diffRight > 0 ? '+' : ''}{diffRight}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end dark:border-slate-800">
            {isAdmin && (
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || filteredProducts.length === 0}
                className="px-8 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {isSubmitting ? t('saving') : t('saveStocktakingResults')}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

const WarehouseTransferModule = ({ products, warehouses, transfers, canDo, showToast, confirm }: { products: Product[], warehouses: Warehouse[], transfers: WarehouseTransfer[], canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFromWarehouse, setSelectedFromWarehouse] = useState('');
  const [selectedToWarehouse, setSelectedToWarehouse] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityLeft, setQuantityLeft] = useState(0);
  const [quantityRight, setQuantityRight] = useState(0);

  const fromProducts = useMemo(() => {
    return products.filter(p => p.warehouseId === selectedFromWarehouse);
  }, [products, selectedFromWarehouse]);

  const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFromWarehouse || !selectedToWarehouse || !selectedProductId) return;
    if (selectedFromWarehouse === selectedToWarehouse) {
      showToast(t('cannotTransferToSameWarehouse'), 'error');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    if (product.stockLeft < quantityLeft || product.stockRight < quantityRight) {
      showToast(t('insufficientStock'), 'error');
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const transferId = generateId();

      // Update source product stock
      await offlineUpdate('products', product.id!, {
        stockLeft: product.stockLeft - quantityLeft,
        stockRight: product.stockRight - quantityRight,
        stock: Math.min(product.stockLeft - quantityLeft, product.stockRight - quantityRight)
      });

      // Find or create destination product
      const destProduct = products.find(p => p.sku === product.sku && p.warehouseId === selectedToWarehouse);
      if (destProduct) {
        await offlineUpdate('products', destProduct.id!, {
          stockLeft: increment(quantityLeft),
          stockRight: increment(quantityRight),
          stock: increment(Math.min(quantityLeft, quantityRight))
        });
      } else {
        const { id, ...productData } = product;
        await offlineCreate('products', {
          ...productData,
          warehouseId: selectedToWarehouse,
          stockLeft: quantityLeft,
          stockRight: quantityRight,
          stock: Math.min(quantityLeft, quantityRight)
        });
      }

      // Record transfer
      await offlineCreate('transfers', {
        id: transferId,
        date: timestamp,
        fromWarehouseId: selectedFromWarehouse,
        toWarehouseId: selectedToWarehouse,
        productId: selectedProductId,
        quantityLeft,
        quantityRight,
        status: 'completed'
      });

      showToast(t('transferCompletedSuccessfully'), 'success');
      setIsModalOpen(false);
      setQuantityLeft(0);
      setQuantityRight(0);
    } catch (err) {
      console.error(err);
      showToast(t('errorDuringTransfer'), 'error');
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('warehouseTransfer')}</h2>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Truck className="w-4 h-4" />
          {t('newTransfer')}
        </Button>
      </div>

      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('date')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('product')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('fromWarehouse')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('toWarehouse')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('quantity')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transfers.map((transfer) => {
                const product = products.find(p => p.id === transfer.productId);
                return (
                  <tr key={transfer.id}>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{new Date(transfer.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{product?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{warehouses.find(w => w.id === transfer.fromWarehouseId)?.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{warehouses.find(w => w.id === transfer.toWarehouseId)?.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      L: {transfer.quantityLeft} | R: {transfer.quantityRight}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('newTransfer')}>
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('fromWarehouse')}</label>
            <select 
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 dark:bg-slate-900 dark:border-slate-700"
              value={selectedFromWarehouse}
              onChange={(e) => setSelectedFromWarehouse(e.target.value)}
              required
            >
              <option value="">{t('selectWarehouse')}</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('toWarehouse')}</label>
            <select 
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 dark:bg-slate-900 dark:border-slate-700"
              value={selectedToWarehouse}
              onChange={(e) => setSelectedToWarehouse(e.target.value)}
              required
            >
              <option value="">{t('selectWarehouse')}</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('product')}</label>
            <select 
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 dark:bg-slate-900 dark:border-slate-700"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              required
            >
              <option value="">{t('selectProduct')}</option>
              {fromProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>

          {selectedProduct && (
            <div className="p-4 bg-slate-50 rounded-lg dark:bg-slate-800 space-y-2 text-sm">
              <h4 className="font-bold border-b pb-1 mb-2">{t('productDetails')}</h4>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-500">{t('category')}:</span> {selectedProduct.category}</div>
                <div><span className="text-slate-500">{t('subCategory')}:</span> {selectedProduct.subCategory}</div>
                <div><span className="text-slate-500">{t('brand')}:</span> {selectedProduct.brand}</div>
                <div><span className="text-slate-500">{t('color')}:</span> {selectedProduct.color}</div>
                <div><span className="text-slate-500">{t('size')}:</span> {selectedProduct.size}</div>
                <div><span className="text-slate-500">{t('sku')}:</span> {selectedProduct.sku}</div>
                <div className="col-span-2 font-medium text-blue-600 dark:text-blue-400">
                  {t('currentStock')}: L: {selectedProduct.stockLeft} | R: {selectedProduct.stockRight}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('stockLeft')}</label>
              <Input 
                type="number" 
                value={isNaN(quantityLeft) ? '' : quantityLeft} 
                onChange={(e) => setQuantityLeft(e.target.value === '' ? 0 : Number(e.target.value))} 
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('stockRight')}</label>
              <Input 
                type="number" 
                value={isNaN(quantityRight) ? '' : quantityRight} 
                onChange={(e) => setQuantityRight(e.target.value === '' ? 0 : Number(e.target.value))} 
                required 
              />
            </div>
          </div>
          <Button type="submit" className="w-full">{t('transfer')}</Button>
        </form>
      </Modal>
    </div>
  );
};

const ReturnsModule = ({ returns, sales, purchases, products, customers, suppliers, canDo, showToast, confirm }: { returns: Return[], sales: Sale[], purchases: Purchase[], products: Product[], customers: Customer[], suppliers: Supplier[], canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [returnType, setReturnType] = useState<'sale' | 'purchase'>('sale');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInvoices = useMemo(() => {
    if (returnType === 'sale') {
      return sales.filter(s => {
        const customer = customers.find(c => c.id === s.customerId);
        const customerName = customer?.name || (s.customerId === 'walk-in' ? t('walkIn') : t('unknownCustomer'));
        return !searchQuery || 
               s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
               customerName.toLowerCase().includes(searchQuery.toLowerCase());
      });
    } else {
      return purchases.filter(p => {
        const supplier = suppliers.find(s => s.id === p.supplierId);
        const supplierName = supplier?.name || t('unknownSupplier');
        return !searchQuery || 
               p.id?.toLowerCase().includes(searchQuery.toLowerCase()) || 
               supplierName.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }
  }, [returnType, sales, purchases, customers, suppliers, searchQuery, t]);

  const selectedInvoice = useMemo(() => {
    if (returnType === 'sale') return sales.find(s => s.id === selectedInvoiceId);
    return purchases.find(p => p.id === selectedInvoiceId);
  }, [returnType, sales, purchases, selectedInvoiceId]);

  const totalRefundPreview = useMemo(() => {
    if (!selectedInvoice) return 0;
    return returnItems.reduce((acc, item) => {
      const invoiceItem = selectedInvoice.items.find(si => si.productId === item.productId);
      if (!invoiceItem) return acc;
      const price = (invoiceItem as any).price || (invoiceItem as any).cost;
      return acc + ((item.quantityLeft + item.quantityRight) / 2) * price;
    }, 0);
  }, [selectedInvoice, returnItems]);

  const handleInvoiceSelect = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const invoice = returnType === 'sale' ? sales.find(s => s.id === invoiceId) : purchases.find(p => p.id === invoiceId);
    if (invoice) {
      setReturnItems(invoice.items.map(item => ({
        productId: item.productId,
        quantityLeft: 0,
        quantityRight: 0,
        reason: ''
      })));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !selectedInvoice || returnItems.every(i => i.quantityLeft === 0 && i.quantityRight === 0)) return;

    try {
      const timestamp = new Date().toISOString();
      let totalRefund = 0;

      const updatedInvoiceItems = [...selectedInvoice.items];

      for (const item of returnItems) {
        if (item.quantityLeft === 0 && item.quantityRight === 0) continue;
        
        const itemIdx = updatedInvoiceItems.findIndex(si => si.productId === item.productId);
        if (itemIdx !== -1) {
          const invoiceItem = updatedInvoiceItems[itemIdx];
          const price = (invoiceItem as any).price || (invoiceItem as any).cost;
          const itemRefund = ((item.quantityLeft + item.quantityRight) / 2) * price;
          totalRefund += itemRefund;
          
          updatedInvoiceItems[itemIdx] = {
            ...invoiceItem,
            quantityLeft: invoiceItem.quantityLeft - item.quantityLeft,
            quantityRight: invoiceItem.quantityRight - item.quantityRight,
          };

          const product = products.find(p => p.id === item.productId);
          if (product) {
            // Increase stock for sales return, decrease for purchase return
            const stockChange = returnType === 'sale' ? 1 : -1;
            // Since it's a pair, we use the average or just assume balance is maintained
            const pairs = (item.quantityLeft + item.quantityRight) / 2;
            await offlineUpdate('products', product.id!, {
              stockLeft: increment(item.quantityLeft * stockChange),
              stockRight: increment(item.quantityRight * stockChange),
              stock: increment(pairs * stockChange)
            });
          }
        }
      }

      await offlineUpdate(returnType === 'sale' ? 'sales' : 'purchases', selectedInvoiceId, { items: updatedInvoiceItems });

      const returnData: any = {
        date: timestamp,
        items: returnItems.filter(i => i.quantityLeft > 0 || i.quantityRight > 0),
        totalRefund,
        status: 'completed',
        type: returnType
      };

      if (returnType === 'sale') {
        returnData.saleId = selectedInvoiceId;
        returnData.customerId = (selectedInvoice as any).customerId || '';
      } else {
        returnData.purchaseId = selectedInvoiceId;
        returnData.supplierId = (selectedInvoice as any).supplierId || '';
      }

      const returnId = await offlineCreate('returns', returnData);

      await offlineCreate('transactions', {
        date: timestamp,
        description: `${t(returnType === 'sale' ? 'saleReturn' : 'purchaseReturn')} #${(selectedInvoice as any).invoiceNumber || selectedInvoiceId.slice(-6)}`,
        type: returnType === 'sale' ? 'expense' : 'income', // Sales return is expense, Purchase return is income (money back)
        amount: totalRefund,
        category: t('returns'),
        referenceId: returnId
      });

      showToast(t('returnProcessedSuccessfully'), 'success');
      setIsModalOpen(false);
      setSelectedInvoiceId('');
      setReturnItems([]);
    } catch (err) {
      console.error(err);
      showToast(t('errorProcessingReturn'), 'error');
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('returns')}</h2>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <LogOut className="w-4 h-4" />
          {t('newReturn')}
        </Button>
      </div>

      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('date')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('type')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('invoice')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('totalRefund')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {returns.map((ret) => (
                <tr key={ret.id}>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{new Date(ret.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium",
                      ret.type === 'sale' ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {t(ret.type === 'sale' ? 'saleReturn' : 'purchaseReturn')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                    #{(ret.saleId || ret.purchaseId || '').slice(-6)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{ret.totalRefund.toLocaleString()} {t('egp')}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs">{t('completed')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('newReturn')}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('returnType')}</label>
            <div className="flex gap-2">
              <Button 
                type="button"
                variant={returnType === 'sale' ? 'primary' : 'outline'}
                className="flex-1"
                onClick={() => {
                  setReturnType('sale');
                  setSelectedInvoiceId('');
                  setReturnItems([]);
                }}
              >
                {t('saleReturn')}
              </Button>
              <Button 
                type="button"
                variant={returnType === 'purchase' ? 'primary' : 'outline'}
                className="flex-1"
                onClick={() => {
                  setReturnType('purchase');
                  setSelectedInvoiceId('');
                  setReturnItems([]);
                }}
              >
                {t('purchaseReturn')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t(returnType === 'sale' ? 'selectSaleInvoice' : 'selectPurchaseInvoice')}</label>
            <div className="relative mb-2">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400", dir === 'rtl' ? 'right-3' : 'left-3')} />
              <Input 
                className={cn("h-9 text-sm", dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3')}
                placeholder={t('searchInvoice')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select 
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 dark:bg-slate-900 dark:border-slate-700"
              value={selectedInvoiceId}
              onChange={(e) => handleInvoiceSelect(e.target.value)}
              required
            >
              <option value="">{t('selectInvoice')}</option>
              {filteredInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  #{(inv as any).invoiceNumber || inv.id?.slice(-6)} - {new Date(inv.date).toLocaleDateString()} - {inv.total} {t('egp')}
                </option>
              ))}
            </select>
          </div>

          {selectedInvoice && (
            <div className="p-4 bg-slate-50 rounded-lg dark:bg-slate-800 space-y-2 text-sm">
              <h4 className="font-bold border-b pb-1 mb-2">{t('invoiceDetails')}</h4>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-500">{t('invoiceNumber')}:</span> #{(selectedInvoice as any).invoiceNumber || selectedInvoice.id?.slice(-6)}</div>
                <div>
                  <span className="text-slate-500">{t(returnType === 'sale' ? 'customer' : 'supplier')}:</span> 
                  {returnType === 'sale' 
                    ? (customers.find(c => c.id === (selectedInvoice as any).customerId)?.name || t('walkIn'))
                    : (suppliers.find(s => s.id === (selectedInvoice as any).supplierId)?.name || t('unknownSupplier'))
                  }
                </div>
                <div><span className="text-slate-500">{t('date')}:</span> {new Date(selectedInvoice.date).toLocaleDateString()}</div>
                <div><span className="text-slate-500">{t('total')}:</span> {selectedInvoice.total} {t('egp')}</div>
                {returnType === 'sale' && <div><span className="text-slate-500">{t('paymentMethod')}:</span> {t((selectedInvoice as any).paymentMethod)}</div>}
              </div>
            </div>
          )}

          {selectedInvoice && (
            <div className="space-y-4">
              <h4 className="font-medium text-sm border-b pb-2">{t('itemsToReturn')}</h4>
              {returnItems.map((item, idx) => {
                const product = products.find(p => p.id === item.productId);
                const invoiceItem = selectedInvoice.items.find(si => si.productId === item.productId);
                const price = (invoiceItem as any).price || (invoiceItem as any).cost;
                return (
                  <div key={item.productId} className="p-4 bg-slate-50 rounded-lg dark:bg-slate-800 space-y-3">
                    <div className="flex justify-between text-sm font-medium">
                      <span>{product?.name}</span>
                      <span>{price} {t('egp')}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {product?.pieceType === 'pair' ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">{t('stockLeft')} (Max: {invoiceItem?.quantityLeft || 0})</label>
                            <Input 
                              type="number" 
                              className="h-8 text-xs"
                              value={isNaN(item.quantityLeft) ? '' : item.quantityLeft}
                              onChange={(e) => {
                                const inputVal = e.target.value === '' ? 0 : Number(e.target.value);
                                const val = isNaN(inputVal) ? 0 : Math.min(inputVal, invoiceItem?.quantityLeft || 0);
                                const newItems = [...returnItems];
                                newItems[idx].quantityLeft = val;
                                if (product?.pieceType === 'pair') {
                                  newItems[idx].quantityRight = val;
                                }
                                setReturnItems(newItems);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">{t('stockRight')} (Max: {invoiceItem?.quantityRight || 0})</label>
                            <Input 
                              type="number" 
                              className="h-8 text-xs"
                              value={isNaN(item.quantityRight) ? '' : item.quantityRight}
                              onChange={(e) => {
                                const inputVal = e.target.value === '' ? 0 : Number(e.target.value);
                                const val = isNaN(inputVal) ? 0 : Math.min(inputVal, invoiceItem?.quantityRight || 0);
                                const newItems = [...returnItems];
                                newItems[idx].quantityRight = val;
                                if (product?.pieceType === 'pair') {
                                  newItems[idx].quantityLeft = val;
                                }
                                setReturnItems(newItems);
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">{t('quantity')} (Max: {invoiceItem?.quantityLeft || invoiceItem?.quantity || 0})</label>
                          <Input 
                            type="number" 
                            className="h-8 text-xs"
                            value={isNaN(item.quantityLeft) ? '' : item.quantityLeft}
                            onChange={(e) => {
                              const inputVal = e.target.value === '' ? 0 : Number(e.target.value);
                              const val = isNaN(inputVal) ? 0 : Math.min(inputVal, invoiceItem?.quantityLeft || invoiceItem?.quantity || 0);
                              const newItems = [...returnItems];
                              newItems[idx].quantityLeft = val;
                              newItems[idx].quantityRight = val;
                              setReturnItems(newItems);
                            }}
                          />
                        </div>
                      )}
                    </div>
                    {product?.pieceType === 'pair' && (
                      <p className="text-[10px] text-amber-600 font-medium">{t('forcedReturnBoth')}</p>
                    )}
                    <Input 
                      placeholder={t('reason')}
                      className="h-8 text-xs"
                      value={item.reason}
                      onChange={(e) => {
                        const newItems = [...returnItems];
                        newItems[idx].reason = e.target.value;
                        setReturnItems(newItems);
                      }}
                    />
                  </div>
                );
              })}

              <div className="p-4 bg-indigo-50 rounded-lg dark:bg-indigo-900/20 flex justify-between items-center">
                <span className="font-bold text-indigo-900 dark:text-indigo-100">{t('totalRefund')}</span>
                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{totalRefundPreview.toLocaleString()} {t('egp')}</span>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!selectedInvoiceId}>{t('processReturn')}</Button>
        </form>
      </Modal>
    </div>
  );
};

const CustomersModule = ({ customers, sales, returns, canDo, showToast, confirm }: { customers: Customer[], sales: Sale[], returns: Return[], canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir, language } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.phone?.includes(searchQuery) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(c => ({
      ...c,
      totalVolume: sales.filter(s => s.customerId === c.id).reduce((acc, s) => acc + s.total, 0) - returns.filter(r => r.customerId === c.id && r.type === 'sale').reduce((acc, r) => acc + r.totalRefund, 0),
      salesCount: sales.filter(s => s.customerId === c.id).length,
      returnsCount: returns.filter(r => r.customerId === c.id && r.type === 'sale').length
    }));
  }, [customers, searchQuery, sales, returns]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canDo('customers', 'canAdd')) {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
    };

    try {
      await offlineCreate('customers', data);
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'customers');
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('customerManagement')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <Input 
              placeholder={t('searchCustomer')} 
              className={`${dir === 'rtl' ? 'pr-10' : 'pl-10'} w-64`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {canDo('customers', 'canAdd') && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('addNewCustomer')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('name')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('phone')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('sales')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('returns')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('totalVolume')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-900/50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{c.phone || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{c.salesCount}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{c.returnsCount}</td>
                  <td className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400">{c.totalVolume.toLocaleString()} {t('egp')}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(c)}>
                        <Eye className="w-4 h-4 ml-1" />
                        {t('viewDetails')}
                      </Button>
                      {canDo('customers', 'canDelete') && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            confirm(t('confirmDelete'), t('confirmDeleteCustomer'), async () => {
                              try {
                                await offlineDelete('customers', c.id!);
                              } catch (err) {
                                handleFirestoreError(err, OperationType.DELETE, `customers/${c.id}`);
                              }
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('addNewCustomer')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('name')}</label>
            <Input name="name" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</label>
            <Input name="email" type="email" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('phone')}</label>
            <Input name="phone" />
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full">{t('save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title={t('customerDetails')}>
        {selectedCustomer && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl dark:bg-slate-900/50">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-2xl font-bold dark:bg-indigo-900/30 dark:text-indigo-400">
                {selectedCustomer.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedCustomer.phone}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 bg-indigo-50/30 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30">
                <p className="text-xs text-slate-500 mb-1">{t('totalVolume')}</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{(selectedCustomer as any).totalVolume.toLocaleString()} {t('egp')}</p>
              </Card>
              <Card className="p-4 bg-emerald-50/30 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30">
                <p className="text-xs text-slate-500 mb-1">{t('salesCount')}</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{(selectedCustomer as any).salesCount}</p>
              </Card>
              <Card className="p-4 bg-red-50/30 border-red-100 dark:bg-red-900/10 dark:border-red-900/30">
                <p className="text-xs text-slate-500 mb-1">{t('returns')}</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{(selectedCustomer as any).returnsCount}</p>
              </Card>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-slate-900 dark:text-white">{t('recentTransactions')}</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {sales.filter(s => s.customerId === selectedCustomer.id).map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl dark:bg-slate-800/50">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{t('sale')} #{s.id.slice(-6)}</p>
                      <p className="text-xs text-slate-500">{format(new Date(s.date), 'yyyy-MM-dd HH:mm')}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600">+{s.total.toLocaleString()} {t('egp')}</p>
                  </div>
                ))}
                {returns.filter(r => r.customerId === selectedCustomer.id).map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl dark:bg-red-900/10">
                    <div>
                      <p className="text-sm font-medium text-red-900 dark:text-red-400">{t('return')} #{r.id?.slice(-6)}</p>
                      <p className="text-xs text-red-500/60">{format(new Date(r.date), 'yyyy-MM-dd HH:mm')}</p>
                    </div>
                    <p className="text-sm font-bold text-red-600">-{r.totalRefund.toLocaleString()} {t('egp')}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold">{t('customerInfo')}</p>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between py-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">{t('email')}</span>
                  <span className="font-medium">{selectedCustomer.email || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">{t('address')}</span>
                  <span className="font-medium">{(selectedCustomer as any).address || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const SuppliersModule = ({ suppliers, purchases, returns, canDo, showToast, confirm }: { suppliers: Supplier[], purchases: Purchase[], returns: Return[], canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir, language } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone?.includes(searchQuery)
    ).map(s => ({
      ...s,
      totalVolume: purchases.filter(p => p.supplierId === s.id).reduce((acc, p) => acc + p.total, 0) - returns.filter(r => r.supplierId === s.id && r.type === 'purchase').reduce((acc, r) => acc + r.totalRefund, 0),
      purchasesCount: purchases.filter(p => p.supplierId === s.id).length
    }));
  }, [suppliers, searchQuery, purchases, returns]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canDo('suppliers', 'canAdd')) {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      companyName: formData.get('companyName') as string,
      taxId: formData.get('taxId') as string,
      address: formData.get('address') as string,
    };

    try {
      await offlineCreate('suppliers', data);
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'suppliers');
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('suppliersManagement')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <Input 
              placeholder={t('searchSupplier')} 
              className={`${dir === 'rtl' ? 'pr-10' : 'pl-10'} w-64`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {canDo('suppliers', 'canAdd') && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('addNewSupplier')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('name')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('company')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('email')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('totalVolume')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-900/50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{s.companyName || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{s.email || '-'}</td>
                  <td className="px-6 py-4 text-sm font-bold text-red-600 dark:text-red-400">{s.totalVolume.toLocaleString()} {t('egp')}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSupplier(s)}>
                        <Eye className="w-4 h-4 ml-1" />
                        {t('viewDetails')}
                      </Button>
                      {canDo('suppliers', 'canDelete') && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            confirm(t('confirmDelete'), t('confirmDeleteSupplier'), async () => {
                              try {
                                await offlineDelete('suppliers', s.id!);
                              } catch (err) {
                                handleFirestoreError(err, OperationType.DELETE, `suppliers/${s.id}`);
                              }
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('addNewSupplier')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('name')}</label>
              <Input name="name" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('companyName')}</label>
              <Input name="companyName" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('taxId')}</label>
              <Input name="taxId" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('phone')}</label>
              <Input name="phone" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</label>
            <Input name="email" type="email" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('address')}</label>
            <Input name="address" />
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full">{t('save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!selectedSupplier} onClose={() => setSelectedSupplier(null)} title={t('supplierDetails')}>
        {selectedSupplier && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl dark:bg-slate-900/50">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-2xl font-bold dark:bg-red-900/30 dark:text-red-400">
                {selectedSupplier.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedSupplier.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedSupplier.companyName}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 bg-red-50/30 border-red-100 dark:bg-red-900/10 dark:border-red-900/30">
                <p className="text-xs text-slate-500 mb-1">{t('totalVolume')}</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{(selectedSupplier as any).totalVolume.toLocaleString()} {t('egp')}</p>
              </Card>
              <Card className="p-4 bg-amber-50/30 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30">
                <p className="text-xs text-slate-500 mb-1">{t('purchasesCount')}</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{(selectedSupplier as any).purchasesCount}</p>
              </Card>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold">{t('supplierInfo')}</p>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between py-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">{t('email')}</span>
                  <span className="font-medium">{selectedSupplier.email || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">{t('phone')}</span>
                  <span className="font-medium">{selectedSupplier.phone || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">{t('taxId')}</span>
                  <span className="font-medium">{selectedSupplier.taxId || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">{t('address')}</span>
                  <span className="font-medium">{selectedSupplier.address || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};


const CategoriesModule = ({ categories, canDo, showToast, confirm }: { categories: Category[], canDo: (s: string, a: 'canAdd' | 'canEdit' | 'canDelete') => boolean, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir, language } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const parentCategories = useMemo(() => categories.filter(c => !c.parentId), [categories]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const action = editingCategory ? 'canEdit' : 'canAdd';
    if (!canDo('categories', action)) {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const parentId = formData.get('parentId') as string;
    const data = {
      name: formData.get('name') as string,
      parentId: parentId || null
    };

    try {
      if (editingCategory?.id) {
        await offlineUpdate('categories', editingCategory.id, data);
      } else {
        await offlineCreate('categories', data);
      }
      setIsModalOpen(false);
      setEditingCategory(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, editingCategory?.id ? `categories/${editingCategory.id}` : 'categories');
    }
  };

  const handleDelete = async (id: string) => {
    confirm(t('confirmDelete'), t('confirmDeleteCategory'), async () => {
      try {
        await offlineDelete('categories', id);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
      }
    });
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('categoriesManagement')}</h2>
        {canDo('categories', 'canAdd') && (
          <Button onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}>
            <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {t('addNewCategory')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {parentCategories.map(parent => (
          <div key={parent.id} className="space-y-4">
            <Card className="p-6 flex items-center justify-between bg-indigo-50/30 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center dark:bg-indigo-900/30">
                  <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white">{parent.name}</span>
              </div>
              <div className="flex gap-2">
                {canDo('categories', 'canEdit') && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingCategory(parent); setIsModalOpen(true); }}>{t('edit')}</Button>
                )}
                {canDo('categories', 'canDelete') && (
                  <Button variant="danger" size="sm" onClick={() => parent.id && handleDelete(parent.id)}>{t('delete')}</Button>
                )}
              </div>
            </Card>
            
            <div className={`space-y-2 ${dir === 'rtl' ? 'pr-8' : 'pl-8'}`}>
              {categories.filter(sub => sub.parentId === parent.id).map(sub => (
                <Card key={sub.id} className="p-4 flex items-center justify-between dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <ChevronRight className={`w-3 h-3 text-slate-400 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{sub.name}</span>
                  </div>
                  <div className="flex gap-2">
                    {canDo('categories', 'canEdit') && (
                      <Button variant="ghost" size="xs" onClick={() => { setEditingCategory(sub); setIsModalOpen(true); }}>{t('edit')}</Button>
                    )}
                    {canDo('categories', 'canDelete') && (
                      <Button variant="danger" size="xs" onClick={() => sub.id && handleDelete(sub.id)}>{t('delete')}</Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
        {/* Isolated categories (with parentId that doesn't exist or null parentId that is meant to be parent) are mostly covered.
            Wait, let's also show orphan categories if any. 
        */}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCategory ? t('editCategory') : t('addNewCategory')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('categoryName')}</label>
            <Input name="name" defaultValue={editingCategory?.name} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('parentCategory')}</label>
            <select 
              name="parentId" 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              defaultValue={editingCategory?.parentId || ''}
            >
              <option value="">{t('mainCategory')}</option>
              {parentCategories.filter(p => p.id !== editingCategory?.id).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full">{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const InvoicesModule = ({ 
  sales, 
  purchases, 
  returns, 
  customers, 
  suppliers,
  products
}: { 
  sales: Sale[], 
  purchases: Purchase[], 
  returns: Return[], 
  customers: Customer[], 
  suppliers: Supplier[],
  products: Product[]
}) => {
  const { t, dir, language } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'purchase'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Grouped Invoices
  const groupedInvoices = useMemo(() => {
    const combined: any[] = [];

    // Sales
    sales.forEach(s => {
      const relatedReturns = returns.filter(r => r.saleId === s.id && r.type === 'sale');
      const returnsTotal = relatedReturns.reduce((sum, r) => sum + r.totalRefund, 0);
      const customer = customers.find(c => c.id === s.customerId);
      
      combined.push({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        type: 'sale',
        date: s.date,
        partyName: customer?.name || (s.customerId === 'walk-in' ? t('walkIn') : t('unknownCustomer')),
        originalAmount: s.total,
        returnsAmount: returnsTotal,
        netAmount: s.total - returnsTotal,
        items: s.items,
        returns: relatedReturns,
        raw: s
      });
    });

    // Purchases
    purchases.forEach(p => {
      const relatedReturns = returns.filter(r => r.purchaseId === p.id && r.type === 'purchase');
      const returnsTotal = relatedReturns.reduce((sum, r) => sum + r.totalRefund, 0);
      const supplier = suppliers.find(sup => sup.id === p.supplierId);

      combined.push({
        id: p.id,
        invoiceNumber: p.invoiceNumber || p.id?.slice(0, 8),
        type: 'purchase',
        date: p.date,
        partyName: supplier?.name || t('unknownSupplier'),
        originalAmount: p.total,
        returnsAmount: returnsTotal,
        netAmount: p.total - returnsTotal,
        items: p.items,
        returns: relatedReturns,
        raw: p
      });
    });

    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, purchases, returns, customers, suppliers, t]);

  const filteredInvoices = groupedInvoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.partyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || inv.type === filterType;
    return matchesSearch && matchesType;
  });

  const handlePrint = (invoice: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(t('popupBlocked'));
      return;
    }

    const isSale = invoice.type === 'sale';
    
    // Construct HTML for printing
    let html = `
      <html dir="${dir}">
        <head>
          <title>${t('invoice')} - ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; }
            .info { margin-bottom: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f8fafc; text-align: ${dir === 'rtl' ? 'right' : 'left'}; padding: 12px; border-bottom: 1px solid #e2e8f0; }
            td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
            .total-section { margin-${dir === 'rtl' ? 'right' : 'left'}: auto; width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #f1f5f9; margin-top: 10px; padding-top: 10px; }
            .returns-title { margin-top: 40px; color: #ef4444; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">${t('appName')}</div>
              <div>${t('invoiceNumber')}: ${invoice.invoiceNumber}</div>
            </div>
            <div style="text-align: ${dir === 'rtl' ? 'left' : 'right'}">
              <div class="title">${isSale ? t('salesInvoice') : t('purchaseInvoice')}</div>
              <div>${format(new Date(invoice.date), 'yyyy-MM-dd HH:mm')}</div>
            </div>
          </div>

          <div class="info">
            <div>
              <strong>${isSale ? t('customer') : t('supplier')}:</strong> ${invoice.partyName}
            </div>
          </div>

          <h3>${t('items')}</h3>
          <table>
            <thead>
              <tr>
                <th>${t('product')}</th>
                <th>${t('quantity')}</th>
                <th>${t('price')}</th>
                <th>${t('total')}</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map((item: any) => {
                const p = products.find(prod => prod.id === item.productId);
                return `
                  <tr>
                    <td>${p?.name || t('unknownProduct')}</td>
                    <td>${item.quantity} ${item.unitType === 'carton' ? t('carton') : t('piece')}</td>
                    <td>${(item.price || item.cost).toLocaleString()}</td>
                    <td>${((item.price || item.cost) * item.quantity).toLocaleString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          ${invoice.returns.length > 0 ? `
            <h3 class="returns-title">${t('relatedReturns')}</h3>
            <table>
              <thead>
                <tr>
                  <th>${t('date')}</th>
                  <th>${t('items')}</th>
                  <th>${t('refundAmount')}</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.returns.map((ret: any) => `
                  <tr>
                    <td>${format(new Date(ret.date), 'yyyy-MM-dd')}</td>
                    <td>${ret.items.length} ${t('items')}</td>
                    <td>${ret.totalRefund.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <div class="total-section">
            <div class="total-row">
              <span>${t('originalAmount')}</span>
              <span>${invoice.originalAmount.toLocaleString()} ${t('egp')}</span>
            </div>
            ${invoice.returnsAmount > 0 ? `
              <div class="total-row" style="color: #ef4444">
                <span>${t('returnsAmount')}</span>
                <span>-${invoice.returnsAmount.toLocaleString()} ${t('egp')}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>${t('netAmount')}</span>
              <span>${invoice.netAmount.toLocaleString()} ${t('egp')}</span>
            </div>
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('invoices')}</h2>
      </div>

      <Card className="p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
          <Input 
            placeholder={t('searchInvoice')} 
            className={dir === 'rtl' ? 'pl-10 text-right' : 'pr-10'} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white min-w-[150px]"
        >
          <option value="all">{t('allInvoices')}</option>
          <option value="sale">{t('sales')}</option>
          <option value="purchase">{t('purchases')}</option>
        </select>
      </Card>

      <Card className="dark:bg-slate-900 dark:border-slate-800 overflow-visible">
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('invoiceNumber')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('type')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('date')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('name')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('originalAmount')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('returnsAmount')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('netAmount')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-900/50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{inv.invoiceNumber}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      inv.type === 'sale' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    )}>
                      {inv.type === 'sale' ? t('sale') : t('purchase')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {format(new Date(inv.date), 'yyyy-MM-dd')}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{inv.partyName}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{inv.originalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-red-600 dark:text-red-400">{inv.returnsAmount > 0 ? `-${inv.returnsAmount.toLocaleString()}` : '0'}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{inv.netAmount.toLocaleString()} {t('egp')}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(inv); setIsInvoiceModalOpen(true); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handlePrint(inv)}>
                        <Printer className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title={t('invoiceDetails')} maxWidth="max-w-3xl">
        {selectedInvoice && (
          <div className="space-y-6">
            <div className="flex justify-between items-start border-b pb-4 dark:border-slate-800">
              <div>
                <p className="text-sm text-slate-500">{t('invoiceNumber')}</p>
                <p className="text-lg font-bold">{selectedInvoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">{t('date')}</p>
                <p className="font-medium text-slate-900 dark:text-white">{format(new Date(selectedInvoice.date), 'yyyy-MM-dd HH:mm')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg dark:bg-slate-900/50">
                <p className="text-sm text-slate-500 mb-1">{selectedInvoice.type === 'sale' ? t('customer') : t('supplier')}</p>
                <p className="font-bold text-slate-900 dark:text-white">{selectedInvoice.partyName}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg dark:bg-slate-900/50">
                <p className="text-sm text-slate-500 mb-1">{t('type')}</p>
                <p className="font-bold text-slate-900 dark:text-white">{selectedInvoice.type === 'sale' ? t('sale') : t('purchase')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white">{t('items')}</h3>
              <div className="border rounded-lg overflow-hidden dark:border-slate-800">
                <table className={`w-full text-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-2">{t('product')}</th>
                      <th className="px-4 py-2 text-center">{t('quantity')}</th>
                      <th className="px-4 py-2 text-center">{t('price')}</th>
                      <th className="px-4 py-2 text-center">{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {selectedInvoice.items.map((item: any, idx: number) => {
                      const p = products.find(prod => prod.id === item.productId);
                      return (
                        <tr key={idx}>
                          <td className="px-4 py-2 font-medium">{p?.name || t('unknownProduct')}</td>
                          <td className="px-4 py-2 text-center">{item.quantity}</td>
                          <td className="px-4 py-2 text-center">{(item.price || item.cost).toLocaleString()}</td>
                          <td className="px-4 py-2 text-center">{((item.price || item.cost) * item.quantity).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedInvoice.returns.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-red-600 dark:text-red-400">{t('relatedReturns')}</h3>
                <div className="border border-red-100 rounded-lg overflow-hidden dark:border-red-900/30">
                  <table className={`w-full text-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <thead className="bg-red-50 dark:bg-red-950/20">
                      <tr>
                        <th className="px-4 py-2 text-red-700 dark:text-red-300">{t('date')}</th>
                        <th className="px-4 py-2 text-red-700 dark:text-red-300 text-center">{t('items')}</th>
                        <th className="px-4 py-2 text-red-700 dark:text-red-300 text-center">{t('refundAmount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50 dark:divide-red-950/10">
                      {selectedInvoice.returns.map((ret: any) => (
                        <tr key={ret.id}>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{format(new Date(ret.date), 'yyyy-MM-dd')}</td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-400 text-center">{ret.items.length}</td>
                          <td className="px-4 py-2 font-bold text-red-600 dark:text-red-300 text-center">{ret.totalRefund.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className={`p-4 bg-indigo-50 rounded-xl dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 flex flex-col gap-2 ${dir === 'rtl' ? 'mr-auto' : 'ml-auto'} w-full md:w-64`}>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t('originalAmount')}</span>
                <span className="font-medium">{selectedInvoice.originalAmount.toLocaleString()} {t('egp')}</span>
              </div>
              {selectedInvoice.returnsAmount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>{t('returnsAmount')}</span>
                  <span>-{selectedInvoice.returnsAmount.toLocaleString()} {t('egp')}</span>
                </div>
              )}
              <div className="border-t border-indigo-200 dark:border-indigo-800 pt-2 flex justify-between font-bold text-lg text-indigo-700 dark:text-indigo-400">
                <span>{t('netAmount')}</span>
                <span>{selectedInvoice.netAmount.toLocaleString()} {t('egp')}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <Button className="flex-1" onClick={() => handlePrint(selectedInvoice)}>
                <Printer className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                {t('printInvoice')}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setIsInvoiceModalOpen(false)}>
                {t('close')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const SettingsModule = ({ settings, users, currentUserProfile, showToast, confirm }: { settings: SystemSettings, users: UserProfile[], currentUserProfile: UserProfile | null, showToast: (m: string, t?: 'success' | 'error') => void, confirm: (title: string, message: string, onConfirm: () => void) => void }) => {
  const { t, dir, language } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [userPermissions, setUserPermissions] = useState<{ [screenId: string]: UserPermissions }>({});
  const [screenCredentials, setScreenCredentials] = useState<{ [screenId: string]: ScreenCredential }>({});

  const availableScreens = [
    { id: 'dashboard', label: t('dashboard') },
    { id: 'cashier', label: t('cashier') },
    { id: 'inventory', label: t('inventory') },
    { id: 'warehouses', label: t('warehouses') },
    { id: 'transfers', label: t('warehouseTransfer') },
    { id: 'stocktaking', label: t('stocktaking') },
    { id: 'purchases', label: t('purchases') },
    { id: 'sales', label: t('sales') },
    { id: 'returns', label: t('returns') },
    { id: 'accounting', label: t('accounting') },
    { id: 'customers', label: t('customers') },
    { id: 'suppliers', label: t('suppliers') },
    { id: 'invoices', label: t('invoices') },
    { id: 'categories', label: t('categories') },
    { id: 'settings', label: t('systemSettings') },
  ];

  useEffect(() => {
    if (editingUser) {
      setSelectedScreens(editingUser.allowedScreens || []);
      setUserPermissions(editingUser.permissions || {});
      setScreenCredentials(editingUser.screenCredentials || {});
    } else {
      setSelectedScreens([]);
      setUserPermissions({});
      setScreenCredentials({});
    }
  }, [editingUser]);

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentUserProfile?.role !== 'admin') {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const data = {
      companyName: formData.get('companyName') as string,
      taxNumber: formData.get('taxNumber') as string,
      taxRate: Number(formData.get('taxRate')),
      invoiceHeader: formData.get('invoiceHeader') as string,
      invoiceFooter: formData.get('invoiceFooter') as string,
      primaryColor: formData.get('primaryColor') as string,
    };

    try {
      await offlineUpdate('settings', 'system', data);
      showToast('تم حفظ الإعدادات بنجاح', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/system');
    }
  };

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentUserProfile?.role !== 'admin') {
      showToast(t('permissionDenied'), 'error');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      displayName: formData.get('displayName') as string,
      role: formData.get('role') as string,
      isActive: formData.get('isActive') === 'true',
      allowedScreens: selectedScreens,
      permissions: userPermissions,
      screenCredentials: screenCredentials,
    };

    try {
      if (editingUser?.uid) {
        await offlineUpdate('users', editingUser.uid, data);
      } else {
        // Use email as ID for new users added by admin, will be migrated to UID on login
        await offlineUpdate('users', data.email, data);
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, editingUser?.uid ? `users/${editingUser.uid}` : 'users');
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('systemSettings')}</h2>
      </div>

      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto whitespace-nowrap dark:border-slate-800">
        <button
          className={cn("pb-3 px-1 border-b-2 font-medium text-sm transition-colors", activeTab === 'general' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300")}
          onClick={() => setActiveTab('general')}
        >
          {t('generalSettings')}
        </button>
        <button
          className={cn("pb-3 px-1 border-b-2 font-medium text-sm transition-colors", activeTab === 'invoice' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300")}
          onClick={() => setActiveTab('invoice')}
        >
          {t('invoiceDesign')}
        </button>
        {currentUserProfile?.role === 'admin' && (
          <button
            className={cn("pb-3 px-1 border-b-2 font-medium text-sm transition-colors", activeTab === 'users' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300")}
            onClick={() => setActiveTab('users')}
          >
            {t('usersAndPermissions')}
          </button>
        )}
      </div>

      {activeTab === 'general' && (
        <Card className="p-6 max-w-2xl dark:bg-slate-900 dark:border-slate-800">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <input type="hidden" name="invoiceHeader" value={settings.invoiceHeader || ''} />
            <input type="hidden" name="invoiceFooter" value={settings.invoiceFooter || ''} />
            <input type="hidden" name="primaryColor" value={settings.primaryColor || '#4f46e5'} />
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('companyName')}</label>
              <Input name="companyName" defaultValue={settings.companyName} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('taxId')}</label>
              <Input name="taxNumber" defaultValue={settings.taxNumber} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('defaultTaxRate')} (%)</label>
              <Input name="taxRate" type="number" step="0.01" defaultValue={settings.taxRate} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('systemLanguage')}</label>
              <select 
                name="language" 
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                defaultValue={localStorage.getItem('language') || 'ar'}
                onChange={(e) => {
                  localStorage.setItem('language', e.target.value);
                  window.location.reload();
                }}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            {currentUserProfile?.role === 'admin' && (
              <div className="pt-4">
                <Button type="submit">{t('saveSettings')}</Button>
              </div>
            )}
          </form>
        </Card>
      )}

      {activeTab === 'invoice' && (
        <Card className="p-6 max-w-2xl dark:bg-slate-900 dark:border-slate-800">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <input type="hidden" name="companyName" value={settings.companyName || ''} />
            <input type="hidden" name="taxNumber" value={settings.taxNumber || ''} />
            <input type="hidden" name="taxRate" value={settings.taxRate || 0} />
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('invoiceHeader')}</label>
              <textarea 
                name="invoiceHeader" 
                defaultValue={settings.invoiceHeader}
                className="flex min-h-[100px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                placeholder={t('invoiceHeaderPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('invoiceFooter')}</label>
              <textarea 
                name="invoiceFooter" 
                defaultValue={settings.invoiceFooter}
                className="flex min-h-[100px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                placeholder={t('invoiceFooterPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('invoicePrimaryColor')}</label>
              <Input name="primaryColor" type="color" defaultValue={settings.primaryColor || '#4f46e5'} className="h-12 w-24 p-1" />
            </div>
            {currentUserProfile?.role === 'admin' && (
              <div className="pt-4">
                <Button type="submit">{t('saveInvoiceDesign')}</Button>
              </div>
            )}
          </form>
        </Card>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className={`flex ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
            <Button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}>
              <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {t('addUser')}
            </Button>
          </div>
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('name')}</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('email')}</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('role')}</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('status')}</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-900/50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{u.displayName || t('notSet')}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{u.email}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {u.role === 'admin' ? t('admin') : t('user')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", u.isActive !== false ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400")}>
                          {u.isActive !== false ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }}>{t('edit')}</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={editingUser ? t('editUser') : t('addNewUser')}>
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('name')}</label>
            <Input name="displayName" defaultValue={editingUser?.displayName} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</label>
            <Input name="email" type="email" defaultValue={editingUser?.email} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('role')}</label>
            <select 
              name="role" 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              defaultValue={editingUser?.role || 'user'}
            >
              <option value="user">{t('user')}</option>
              <option value="admin">{t('admin')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('status')}</label>
            <select 
              name="isActive" 
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              defaultValue={editingUser?.isActive !== false ? 'true' : 'false'}
            >
              <option value="true">{t('active')}</option>
              <option value="false">{t('inactive')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('screensAndPermissions')}</label>
            <div className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
              <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-xs`}>
                <thead className="bg-slate-100 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-400">{t('screen')}</th>
                    <th className="px-2 py-2 font-semibold text-slate-600 text-center dark:text-slate-400">{t('access')}</th>
                    <th className="px-2 py-2 font-semibold text-slate-600 text-center dark:text-slate-400">{t('add')}</th>
                    <th className="px-2 py-2 font-semibold text-slate-600 text-center dark:text-slate-400">{t('edit')}</th>
                    <th className="px-2 py-2 font-semibold text-slate-600 text-center dark:text-slate-400">{t('delete')}</th>
                    <th className="px-2 py-2 font-semibold text-slate-600 text-center dark:text-slate-400">{t('username')}</th>
                    <th className="px-2 py-2 font-semibold text-slate-600 text-center dark:text-slate-400">{t('password')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {availableScreens.map(screen => (
                    <tr key={screen.id} className="hover:bg-white transition-colors dark:hover:bg-slate-950">
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{t(screen.id)}</td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800"
                          checked={selectedScreens.includes(screen.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedScreens([...selectedScreens, screen.id]);
                              if (!userPermissions[screen.id]) {
                                setUserPermissions({
                                  ...userPermissions,
                                  [screen.id]: { canAdd: true, canEdit: true, canDelete: true }
                                });
                              }
                            } else {
                              setSelectedScreens(selectedScreens.filter(id => id !== screen.id));
                            }
                          }}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          disabled={!selectedScreens.includes(screen.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30 dark:bg-slate-950 dark:border-slate-800"
                          checked={userPermissions[screen.id]?.canAdd || false}
                          onChange={(e) => {
                            setUserPermissions({
                              ...userPermissions,
                              [screen.id]: { ...userPermissions[screen.id], canAdd: e.target.checked }
                            });
                          }}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          disabled={!selectedScreens.includes(screen.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30 dark:bg-slate-950 dark:border-slate-800"
                          checked={userPermissions[screen.id]?.canEdit || false}
                          onChange={(e) => {
                            setUserPermissions({
                              ...userPermissions,
                              [screen.id]: { ...userPermissions[screen.id], canEdit: e.target.checked }
                            });
                          }}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          disabled={!selectedScreens.includes(screen.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30 dark:bg-slate-950 dark:border-slate-800"
                          checked={userPermissions[screen.id]?.canDelete || false}
                          onChange={(e) => {
                            setUserPermissions({
                              ...userPermissions,
                              [screen.id]: { ...userPermissions[screen.id], canDelete: e.target.checked }
                            });
                          }}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input 
                          placeholder={t('username')}
                          className="h-8 text-[10px]"
                          disabled={!selectedScreens.includes(screen.id)}
                          value={screenCredentials[screen.id]?.username || ''}
                          onChange={(e) => {
                            setScreenCredentials({
                              ...screenCredentials,
                              [screen.id]: { ...screenCredentials[screen.id], username: e.target.value }
                            });
                          }}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input 
                          type="password"
                          placeholder={t('password')}
                          className="h-8 text-[10px]"
                          disabled={!selectedScreens.includes(screen.id)}
                          value={screenCredentials[screen.id]?.password || ''}
                          onChange={(e) => {
                            setScreenCredentials({
                              ...screenCredentials,
                              [screen.id]: { ...screenCredentials[screen.id], password: e.target.value }
                            });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full">{t('saveUser')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const { t, dir, language, setLanguage, theme, setTheme } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const isDarkMode = theme === 'dark';
  const setIsDarkMode = (dark: boolean) => setTheme(dark ? 'dark' : 'light');

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const handleFirestoreErrorEvent = (e: any) => {
      setToast({ message: e.detail, type: 'error' });
    };
    window.addEventListener('firestore-error', handleFirestoreErrorEvent);
    return () => window.removeEventListener('firestore-error', handleFirestoreErrorEvent);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Data States
  const { items: products } = useOfflineCollection<Product>('products', 'name');
  const { items: suppliers } = useOfflineCollection<Supplier>('suppliers', 'name');
  const { items: customers } = useOfflineCollection<Customer>('customers', 'name');
  const { items: purchases } = useOfflineCollection<Purchase>('purchases', 'date', 'desc');
  const { items: sales } = useOfflineCollection<Sale>('sales', 'date', 'desc');
  const { items: transactions } = useOfflineCollection<Transaction>('transactions', 'date', 'desc');
  const { items: warehouses } = useOfflineCollection<Warehouse>('warehouses', 'name');
  const { items: categories } = useOfflineCollection<Category>('categories', 'name');
  const { items: transfers } = useOfflineCollection<WarehouseTransfer>('transfers', 'date', 'desc');
  const { items: returns } = useOfflineCollection<Return>('returns', 'date', 'desc');
  const { items: settingsList } = useOfflineCollection<SystemSettings>('settings');
  const { items: users } = useOfflineCollection<UserProfile>('users');

  const settings = settingsList.find(s => s.id === 'system') || {};

  const [isUsersLoaded, setIsUsersLoaded] = useState(false);
  const [isProfileReady, setIsProfileReady] = useState(false);
  const [confirmData, setConfirmData] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  
  const [unlockedScreens, setUnlockedScreens] = useState<string[]>([]);
  const [isGateModalOpen, setIsGateModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [gateUsername, setGateUsername] = useState('');
  const [gatePassword, setGatePassword] = useState('');

  const handleTabChange = (tabId: string) => {
    if (currentUserProfile?.role === 'admin') {
      setActiveTab(tabId);
      if (isMobile) setIsSidebarOpen(false);
      return;
    }

    const creds = currentUserProfile?.screenCredentials?.[tabId];
    if (creds && creds.username && !unlockedScreens.includes(tabId)) {
      setPendingTab(tabId);
      setGateUsername('');
      setGatePassword('');
      setIsGateModalOpen(true);
    } else {
      setActiveTab(tabId);
      if (isMobile) setIsSidebarOpen(false);
    }
  };

  const handleGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTab) return;
    const creds = currentUserProfile?.screenCredentials?.[pendingTab];
    if (creds && gateUsername === creds.username && gatePassword === (creds.password || '')) {
      setUnlockedScreens([...unlockedScreens, pendingTab]);
      setActiveTab(pendingTab);
      setIsGateModalOpen(false);
      setPendingTab(null);
      if (isMobile) setIsSidebarOpen(false);
    } else {
      setToast({ message: t('invalidCredentials'), type: 'error' });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setIsProfileReady(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const ensureUserProfile = async () => {
      // 1. Try to find profile in local database first for speed and offline support
      const localProfile = await getOfflineRecord('users', user.uid);
      if (localProfile) {
        setIsProfileReady(true);
        setIsUsersLoaded(true);
        
        // If online, we can tentatively update from Firestore in background
        if (navigator.onLine) {
          try {
            const userRef = doc(db, 'users', user.uid);
            const docSnap = await Promise.race([
              getDoc(userRef),
              new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
            if (docSnap.exists()) {
              await offlineUpdate('users', user.uid, {
                email: user.email,
                displayName: user.displayName || docSnap.data().displayName || ''
              });
            }
          } catch (e) {
            console.warn('Background profile sync failed', e);
          }
        }
        return;
      }

      // 2. If not found locally, we must check Firestore
      if (navigator.onLine) {
        const userRef = doc(db, 'users', user.uid);
        try {
          const docSnap = await Promise.race([
            getDoc(userRef),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
          ]);
          
          if (!docSnap.exists()) {
            // Check if there's a profile with this email but different ID (e.g. email or random ID)
            const q = query(collection(db, 'users'), where('email', '==', user.email));
            const querySnap = await Promise.race([
              getDocs(q),
              new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);
            
            if (!querySnap.empty) {
              const existingDoc = querySnap.docs[0];
              const data = existingDoc.data();
              await offlineUpdate('users', user.uid, {
                role: 'user',
                isActive: false,
                allowedScreens: [],
                permissions: {},
                ...data,
                uid: user.uid,
                email: user.email
              });
              if (existingDoc.id !== user.uid) {
                await offlineDelete('users', existingDoc.id);
              }
            } else if (user.email === 'yahia167199@gmail.com' || user.email === 'moy915996@gmail.com') {
              await offlineUpdate('users', user.uid, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || '',
                role: 'admin',
                isActive: true,
                allowedScreens: [],
                permissions: {}
              });
            }
          } else {
            await offlineUpdate('users', user.uid, {
              email: user.email,
              displayName: user.displayName || docSnap.data().displayName || ''
            });
          }
          setIsProfileReady(true);
          setIsUsersLoaded(true);
        } catch (err) {
          console.error('Initial profile fetch failed', err);
          // If it fails (e.g. timeout), let's still set loaded so they aren't stuck
          // but we won't have a profile yet which will show "Unauthorized"
          setIsUsersLoaded(true);
        }
      } else {
        // Offline and no local profile - user is stuck until they go online at least once
        setIsUsersLoaded(true);
      }
    };
    
    ensureUserProfile();
  }, [user]);

  useEffect(() => {
    // Redundant effect removed, logic moved to ensureUserProfile
  }, [user, isUsersLoaded, users.length]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => signOut(auth);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const confirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmData({ title, message, onConfirm });
  };

  const currentUserProfile = users.find(u => u.uid === user?.uid || u.email === user?.email);

  const canDo = (screenId: string, action: 'canAdd' | 'canEdit' | 'canDelete') => {
    if (!user || !currentUserProfile) return false;
    if (currentUserProfile.role === 'admin') return true;
    if (currentUserProfile.isActive === false) return false;
    
    const allowedScreens = currentUserProfile.allowedScreens || [];
    if (!allowedScreens.includes(screenId)) {
      return false;
    }

    const permissions = currentUserProfile.permissions || {};
    if (permissions[screenId]) {
      return !!permissions[screenId][action];
    }

    return false;
  };

  const navItems = useMemo(() => {
    const allItems = [
      { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
      { id: 'cashier', label: t('cashier'), icon: CreditCard },
      { id: 'inventory', label: t('inventory'), icon: Package },
      { id: 'warehouses', label: t('warehouses'), icon: MapPin },
      { id: 'transfers', label: t('warehouseTransfer'), icon: Truck },
      { id: 'stocktaking', label: t('stocktaking'), icon: CheckCircle2 },
      { id: 'purchases', label: t('purchases'), icon: ShoppingCart },
      { id: 'sales', label: t('sales'), icon: TrendingUp },
      { id: 'invoices', label: t('invoices'), icon: FileText },
      { id: 'returns', label: t('returns'), icon: LogOut },
      { id: 'accounting', label: t('accounting'), icon: DollarSign },
      { id: 'customers', label: t('customers'), icon: UserCircle },
      { id: 'suppliers', label: t('suppliers'), icon: Truck },
      { id: 'categories', label: t('categories'), icon: Settings },
      { id: 'settings', label: t('systemSettings'), icon: Settings },
    ];

    if (!currentUserProfile) return [];
    if (currentUserProfile.role === 'admin') return allItems;

    return allItems.filter(item => 
      (currentUserProfile.allowedScreens && currentUserProfile.allowedScreens.includes(item.id))
    );
  }, [t, currentUserProfile]);

  // Ensure activeTab is valid
  useEffect(() => {
    if (navItems.length > 0 && !navItems.find(item => item.id === activeTab)) {
      setActiveTab(navItems[0].id);
    }
  }, [navItems, activeTab]);

  if (!user) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4" dir={dir}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full"
          >
            <Card className="p-8 text-center dark:bg-slate-800 dark:border-slate-700">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('erpSystem')}</h1>
              <p className="text-slate-500 dark:text-slate-400 mb-8">{t('loginDescription')}</p>
              <Button onClick={handleLogin} className="w-full h-12 text-base">
                {t('loginWithGoogle')}
              </Button>
            </Card>
          </motion.div>
        </div>
      </ErrorBoundary>
    );
  }

  if (!isUsersLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4" dir={dir}>
        <div className="text-slate-500 dark:text-slate-400">{t('loadingSystemData')}</div>
      </div>
    );
  }

  if (isUsersLoaded && !currentUserProfile) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4" dir={dir}>
        <Card className="p-8 max-w-md w-full text-center dark:bg-slate-800 dark:border-slate-700">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('unauthorizedAccess')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{t('unauthorizedDescription')}</p>
          <Button onClick={handleLogout} className="w-full">
            {t('logout')}
          </Button>
        </Card>
      </div>
    );
  }

  if (currentUserProfile && currentUserProfile.isActive === false) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4" dir={dir}>
        <Card className="p-8 max-w-md w-full text-center dark:bg-slate-800 dark:border-slate-700">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('accountSuspended')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{t('suspendedDescription')}</p>
          <Button onClick={handleLogout} className="w-full">
            {t('logout')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex font-sans text-slate-900 dark:text-slate-100" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      <Modal isOpen={!!confirmData} onClose={() => setConfirmData(null)} title={confirmData?.title || ''}>
        <div className="space-y-6">
          <p className="text-slate-600 dark:text-slate-400">{confirmData?.message}</p>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmData(null)}>{t('cancel')}</Button>
            <Button variant="danger" className="flex-1" onClick={() => { confirmData?.onConfirm(); setConfirmData(null); }}>{t('confirm')}</Button>
          </div>
        </div>
      </Modal>
      
      <Modal isOpen={isGateModalOpen} onClose={() => setIsGateModalOpen(false)} title={t('moduleAccessControl')}>
        <form onSubmit={handleGateSubmit} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {t('enterCredentialsFor')} <span className="font-bold text-indigo-600 dark:text-indigo-400">{pendingTab ? t(pendingTab) : ''}</span>
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('username')}</label>
            <Input 
              value={gateUsername} 
              onChange={(e) => setGateUsername(e.target.value)} 
              required 
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('password')}</label>
            <Input 
              type="password" 
              value={gatePassword} 
              onChange={(e) => setGatePassword(e.target.value)} 
            />
          </div>
          <div className="pt-4 flex gap-4">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setIsGateModalOpen(false)}>{t('cancel')}</Button>
            <Button className="flex-1" type="submit">{t('unlock')}</Button>
          </div>
        </form>
      </Modal>

      {/* Sidebar Overlay for mobile */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden dark:bg-slate-900/60"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isMobile ? 280 : (isSidebarOpen ? 280 : 80),
          x: isMobile ? (isSidebarOpen ? 0 : (dir === 'rtl' ? 280 : -280)) : 0
        }}
        className={cn(
          "fixed inset-y-0 z-40 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden",
          dir === 'rtl' ? "right-0 border-l" : "left-0 border-r"
        )}
      >
        <div className="h-32 flex flex-col items-center justify-center px-6 border-b border-slate-100 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative w-16 h-16 flex items-center justify-center overflow-hidden rounded-xl">
              {/* Replace the src with your actual logo URL */}
              <img 
                src="https://drive.google.com/uc?export=view&id=1FtoNq-bqoENlt_NdbN7Vdu-nBBWQgw54" 
                alt="MMK Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            {(isSidebarOpen || isMobile) && (
              <div className="flex flex-col">
                <span className="text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">
                  MMK
                </span>
                <span className="text-[7px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.1em] mt-1 whitespace-nowrap">
                  APP & WEB DEVELOPMENT
                </span>
              </div>
            )}
          </div>
          {(isSidebarOpen || isMobile) && (
            <div className="w-full border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
              <p className="text-[6px] text-slate-400 dark:text-slate-500 font-medium text-center uppercase tracking-widest">
                ENTERPRISE APP, WEB & ERP DEVELOPMENT
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={cn(
                'w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group',
                activeTab === item.id 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
              )}
            >
              <item.icon className={cn('w-5 h-5 shrink-0', activeTab === item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300')} />
              {(isSidebarOpen || isMobile) && <span className="mx-3 font-medium text-sm whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {(isSidebarOpen || isMobile) && <span className="mx-3 font-medium text-sm whitespace-nowrap">{t('logout')}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={cn(
        'flex-1 transition-all duration-300 min-w-0',
        isMobile ? 'mx-0' : (isSidebarOpen ? (dir === 'rtl' ? 'mr-[280px]' : 'ml-[280px]') : (dir === 'rtl' ? 'mr-[80px]' : 'ml-[80px]'))
      )}>
        <header className="h-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 px-4 md:px-8 flex items-center justify-between">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600"
            >
              {language === 'ar' ? 'English' : 'العربية'}
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className={cn("hidden sm:block", dir === 'rtl' ? 'text-left' : 'text-right')}>
              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none">{user.displayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{user.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-5 h-5 text-indigo-600" />
              )}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard products={products} sales={sales} purchases={purchases} transactions={transactions} customers={customers} suppliers={suppliers} returns={returns} onNavigate={setActiveTab} />}
              {activeTab === 'cashier' && <CashierModule products={products} customers={customers} sales={sales} settings={settings} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'inventory' && <InventoryModule products={products} warehouses={warehouses} categories={categories} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'warehouses' && <WarehousesModule warehouses={warehouses} products={products} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'transfers' && <WarehouseTransferModule products={products} warehouses={warehouses} transfers={transfers} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'stocktaking' && <StocktakingModule products={products} warehouses={warehouses} canDo={canDo} showToast={showToast} confirm={confirm} currentUserProfile={currentUserProfile} />}
              {activeTab === 'purchases' && <PurchasesModule purchases={purchases} suppliers={suppliers} products={products} warehouses={warehouses} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'sales' && <SalesModule sales={sales} customers={customers} products={products} settings={settings} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'returns' && <ReturnsModule returns={returns} sales={sales} purchases={purchases} products={products} customers={customers} suppliers={suppliers} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'invoices' && <InvoicesModule sales={sales} purchases={purchases} returns={returns} customers={customers} suppliers={suppliers} products={products} />}
              {activeTab === 'accounting' && <AccountingModule transactions={transactions} sales={sales} purchases={purchases} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'customers' && <CustomersModule customers={customers} sales={sales} returns={returns} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'suppliers' && <SuppliersModule suppliers={suppliers} purchases={purchases} returns={returns} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'categories' && <CategoriesModule categories={categories} canDo={canDo} showToast={showToast} confirm={confirm} />}
              {activeTab === 'settings' && <SettingsModule settings={settings} users={users} currentUserProfile={currentUserProfile} showToast={showToast} confirm={confirm} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      {toast && (
        <div className={cn(
          "fixed bottom-4 left-4 z-50 px-6 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          <div className="flex items-center gap-2">
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="p-1 hover:bg-white/20 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <SyncStatusIndicator />
    </div>
    </ErrorBoundary>
  );
}
