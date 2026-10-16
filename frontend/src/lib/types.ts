// Shapes of the data that comes from the backend

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  dosage: string;
  costPrice: number;
  unitPrice: number;
  stock: number;
  reorderLevel: number;
  sku: string;
  expiryDate: string; // "2027-05-30" or ""
  supplier: string;
  batchNo: string;
  rackLocation: string;
  unit: string;
  updatedAt?: string;
}

export interface SaleItem {
  medicineId: string;
  name: string;
  genericName?: string;
  dosage?: string;
  batchNo?: string;
  expiryDate?: string | null;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  total: number;
}

export type SaleStatus = 'paid' | 'pending' | 'cancelled';

export interface Sale {
  id: string;
  invoiceNo: string;
  dateBS: string;
  customerName: string;
  customerPhone: string;
  patientId: string;
  items: SaleItem[];
  subTotal: number;
  discount: number;
  taxableAmount: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
  profit: number;
  paymentMethod: string;
  status: SaleStatus;
  paidAt: string | null;
  note: string;
  soldBy: string;
  cancelReason: string;
  cancelledAt: string | null;
  creditNoteNo: string;
  createdAt: string;
  legacy: boolean;
}

export interface Settings {
  vatEnabled: boolean;
  vatRate: number;
  printSize: '58mm' | '80mm' | 'A4';
  billFooter: string;
  expiryAlertDays: number;
  allowDue: boolean;
}

export interface Supplier {
  _id: string;
  name: string;
  contactName: string;
  phone: string;
  address: string;
  panNo: string;
  note: string;
}

export interface StockMove {
  _id: string;
  medicineId: string;
  medicineName: string;
  type: 'Added' | 'Restock' | 'Sale' | 'Bill cancelled' | 'Correction';
  change: number;
  stockAfter: number;
  note: string;
  by: string;
  createdAt: string;
}

export const PAID_METHODS = ['Cash', 'eSewa', 'Khalti', 'Fonepay', 'Bank', 'Card'] as const;

export const DEFAULT_SETTINGS: Settings = {
  vatEnabled: true,
  vatRate: 13,
  printSize: '80mm',
  billFooter: 'Thank you! Get well soon.',
  expiryAlertDays: 90,
  allowDue: true,
};
