export interface Product {
  id?: string;
  name: string;
  sku: string;
  category: string;
  subCategory?: string;
  brand?: string;
  color?: string;
  size?: string;
  price: number;
  cost: number;
  stock: number; // Total stock for backward compatibility or general use
  stockLeft: number;
  stockRight: number;
  unit: string;
  pieceType?: 'single' | 'pair'; // Added field to distinguish between shoes and others
  warehouseId: string;
  barcode?: string;
  piecesPerCarton?: number;
  cartonPrice?: number;
  cartonCost?: number;
  imageUrl?: string;
}

export interface WarehouseTransfer {
  id?: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: string;
  quantityLeft: number;
  quantityRight: number;
  date: string;
  note?: string;
}

export interface ReturnItem {
  productId: string;
  quantityLeft: number;
  quantityRight: number;
  reason?: string;
}

export interface Return {
  id?: string;
  saleId?: string;
  purchaseId?: string;
  customerId?: string;
  supplierId?: string;
  date: string;
  items: ReturnItem[];
  totalRefund: number;
  status: 'completed' | 'pending';
  type: 'sale' | 'purchase';
}

export interface Warehouse {
  id?: string;
  name: string;
  location?: string;
}

export interface Supplier {
  id?: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  taxId?: string;
  address?: string;
}

export interface Customer {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface PurchaseItem {
  productId: string;
  quantity: number; // Total quantity (pairs or total pieces)
  quantityLeft: number;
  quantityRight: number;
  cost: number;
  discount?: number; // percentage
  unitType?: 'piece' | 'carton';
}

export interface Purchase {
  id?: string;
  invoiceNumber?: string;
  supplierId: string;
  date: string;
  items: PurchaseItem[];
  total: number;
  totalDiscount?: number; // percentage
  discountType?: 'percentage' | 'fixed';
  invoiceUrl?: string;
}

export interface SaleItem {
  productId: string;
  quantity: number;
  quantityLeft: number;
  quantityRight: number;
  price: number;
  unitType?: 'piece' | 'carton';
}

export interface Sale {
  id?: string;
  invoiceNumber: string;
  customerId: string;
  date: string;
  items: SaleItem[];
  total: number;
  discount?: number;
  tax?: number;
  paymentMethod: 'cash' | 'card' | 'other';
}

export interface Transaction {
  id?: string;
  date: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  referenceId?: string;
  attachmentUrl?: string;
}

export interface Category {
  id?: string;
  name: string;
  parentId?: string | null;
}

export interface UserPermissions {
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface ScreenCredential {
  username: string;
  password?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  displayName?: string;
  isActive?: boolean;
  allowedScreens?: string[];
  permissions?: {
    [screenId: string]: UserPermissions;
  };
  screenCredentials?: {
    [screenId: string]: ScreenCredential;
  };
}

export interface SystemSettings {
  id?: string;
  companyName?: string;
  taxNumber?: string;
  taxRate?: number;
  invoiceHeader?: string;
  invoiceFooter?: string;
  primaryColor?: string;
}
