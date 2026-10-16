
export interface Patient {
  pharmacyId:string;
  id: string;
  _id?: string;
  name?: string;
  phoneNumber?: string;
  fullName: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string; // YYYY-MM-DD
  age: number;
  weight:string,
  isAgeEstimated: boolean;
  phone: string; // 10-digit mobile, e.g., 98xxxxxxxx
  address: string;
  nationalId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown';
  allergies: string[];
  chronicConditions: string[];
  preferredLanguage: 'Nepali' | 'English' | 'Maithili' | 'Bhojpuri' | 'Other';
  createdAt: string;
}

export interface Medicine {
  id: string;
  pharmacyId: string;
  name: string;
  genericName: string;
  category: 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Ointment' | 'Other';
  dosage: string; // e.g., "500mg", "10ml"
  stock: number;
  reorderLevel: number;
  unitPrice: number; // NPR (retail price)
  costPrice: number; // NPR (purchase price)
  sku: string; // simulated barcode
  expiryDate: string; // YYYY-MM-DD
  supplierId: string;
}

export interface StockMovement {
  id: string;
  medicineId: string;
  medicineName: string;
  type: 'Initial' | 'Sale' | 'Adjustment' | 'Purchase' | 'Refund';
  quantityChange: number; // + for Stock In, - for Stock Out
  reason: string;
  timestamp: string;
  userRole: 'Receptionist' | 'Pharmacist' | 'Owner';
}

export interface SaleItem {
  medicineId: string;
  name: string;
  dosage: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Sale {
  id: string;
  patientId: string | null; // null if anonymous walk-in
  items: SaleItem[];
  subTotal: number;
  discount: number; // raw NPR amount
  vatRate: number; // e.g. 13% for Nepal VAT
  vatAmount: number; // VAT on post-discount amount
  grandTotal: number;
  paymentMethod: 'Cash' | 'eSewa' | 'Khalti' | 'IME Pay';
  createdAt: string;
  refundReason?: string;
  refundedAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  address: string;
}

export interface PurchaseOrderItem {
  medicineId: string;
  name: string;
  quantity: number;
  costPrice: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: PurchaseOrderItem[];
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
  createdAt: string;
  receivedAt?: string;
}

export interface SystemSettings {
  vatRate: number; // percentage, e.g. 13
}
