// Shared app state: who is logged in, their role, the pharmacy's settings, and page navigation
import { createContext, useContext } from 'react';
import type { PharmacyUser, StaffUser } from './api';
import type { Settings } from './types';

export type Page =
  | 'dashboard' | 'sale' | 'pending' | 'sales' | 'medicines' | 'suppliers'
  | 'patients' | 'emr' | 'staff' | 'attendance' | 'settings' | 'audit';

// ✅ Which pages each staff role can open (the server checks the same rules again)
export const ROLE_PAGES: Record<string, Page[]> = {
  Manager: ['dashboard', 'sale', 'pending', 'sales', 'audit', 'medicines', 'suppliers', 'patients', 'emr', 'staff', 'attendance', 'settings'],
  Pharmacist: ['sale', 'pending', 'sales', 'medicines', 'suppliers', 'patients', 'emr'],
  'Accounts & Billing Officer': ['sale', 'pending', 'sales', 'audit', 'medicines', 'patients'],
  'Inventory Manager': ['medicines', 'suppliers'],
  Doctor: ['patients', 'emr', 'medicines'],
  Receptionist: ['patients', 'emr'],
};

export const ROLE_LABEL: Record<string, string> = {
  Manager: 'Manager',
  Pharmacist: 'Pharmacist',
  'Accounts & Billing Officer': 'Cashier / Billing',
  'Inventory Manager': 'Store keeper',
  Doctor: 'Doctor',
  Receptionist: 'Receptionist',
};

export type AppState = {
  pharmacy: PharmacyUser;
  staff: StaffUser;
  settings: Settings;
  reloadSettings: () => void;
  setPharmacy: (p: PharmacyUser) => void;
  can: (p: Page) => boolean;
  go: (p: Page, opts?: { search?: string }) => void;
  isManager: boolean;
  plan: { totalTime: number; remainingTime: number | null } | null;
};

export const AppCtx = createContext<AppState>(null as any);
export const useApp = () => useContext(AppCtx);
