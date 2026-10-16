import React, { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, User, Phone, MapPin, Heart, AlertOctagon, ClipboardList, Info, Pencil, Trash2 } from 'lucide-react';
import { Patient } from '../types';
import { TRANSLATIONS } from '../translations';

interface PatientManagerProps {
  patients: Patient[];
  onPatientsUpdated: () => void;
  lang: 'en' | 'ne';
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
  onStartSaleForPatient: (patient: Patient) => void;
}
import { API_BASE as SERVER } from '../lib/api';
const API_BASE = `${SERVER}/api/patients`;

// Helper to safely read the logged-in pharmacy's ID from localStorage.
// Adjust the key name below ('pharmacyId') if your login flow stores it under a different key.
const getLoggedInPharmacyId = (): string => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.id ? String(parsed.id) : '';
  } catch {
    return '';
  }
};

export default function PatientManager({ 
  patients, // NOTE: kept for prop compatibility, but no longer used as the source of truth for the list below
  onPatientsUpdated, 
  lang, 
  selectedPatient, 
  setSelectedPatient, 
  onStartSaleForPatient 
}: PatientManagerProps) {
  const t = TRANSLATIONS[lang];

  // ---- Logged-in pharmacy ID (from localStorage) ----
  const [loggedInPharmacyId, setLoggedInPharmacyId] = useState<string>(getLoggedInPharmacyId());

  // ---- LIVE MONGODB DATA (fetched directly by this component) ----
  const [livePatients, setLivePatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const fetchPatientsFromMongo = useCallback(async () => {
    setIsLoadingPatients(true);
    setFetchError('');

    const currentPharmacyId = getLoggedInPharmacyId();
    setLoggedInPharmacyId(currentPharmacyId);

    if (!currentPharmacyId) {
      setFetchError(
        lang === 'en'
          ? 'No pharmacy ID found. Please log in again.'
          : 'फार्मेसी आईडी फेला परेन। कृपया फेरि लगइन गर्नुहोस्।'
      );
      setLivePatients([]);
      setIsLoadingPatients(false);
      return;
    }

    try {
      const response = await fetch(API_BASE);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        // Only keep patients whose pharmacyId matches the logged-in pharmacy's ID
        const scopedPatients = result.data.filter((p: any) => {
  const patientPharmacyId = p.pharmacyId || '';
  return String(patientPharmacyId).trim() === String(currentPharmacyId).trim();
});
        setLivePatients(scopedPatients);
      } else {
        setFetchError('Server responded but returned no valid patient data.');
      }
    } catch (error) {
      console.error('🔴 Failed to fetch patients from MongoDB:', error);
      setFetchError('Cannot reach the server. Check your internet and try again.');
    } finally {
      setIsLoadingPatients(false);
    }
  }, [lang]);

  // Fetch from MongoDB as soon as the component mounts
  useEffect(() => {
    fetchPatientsFromMongo();
  }, [fetchPatientsFromMongo]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);

  // Form toggle & loading states
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // NEW: tracks whether the form is editing an existing patient (holds its id) or creating a new one (null)
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [isAgeEstimated, setIsAgeEstimated] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [bloodType, setBloodType] = useState<Patient['bloodType']>('Unknown');
  const [preferredLanguage, setPreferredLanguage] = useState<Patient['preferredLanguage']>('Nepali');
  const [pharmacyId, setPharmacyId] = useState('');
  const [weight, setWeight] = useState('');
  
  // Custom Allergies/Chronic Conditions input lists
  const [allergyInput, setAllergyInput] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [chronicInput, setChronicInput] = useState('');
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);

  // Form Validation & Warnings state
  const [phoneError, setPhoneError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<Patient | null>(null);

  // Live filtering of patients when query changes (uses livePatients from MongoDB, already scoped to this pharmacy)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPatients(livePatients);
    } else {
      const q = searchQuery.toLowerCase().trim();
      const filtered = livePatients.filter(p => 
        (p.fullName || (p as any).name || '').toLowerCase().includes(q) ||
        (p.phone || (p as any).phoneNumber || '').includes(q) ||
        (p.id || p._id || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q)
      );
      setFilteredPatients(filtered);
    }
  }, [searchQuery, livePatients]);

  // Handle live duplicate checking (uses livePatients from MongoDB, already scoped to this pharmacy)
  // Skipped while editing an existing patient so it doesn't warn "duplicate" against itself.
  useEffect(() => {
    if (editingPatientId) {
      setDuplicateWarning(null);
      return;
    }
    if (fullName.trim() && dob) {
      const match = livePatients.find(p => 
        (p.fullName || (p as any).name || '').toLowerCase().trim() === fullName.toLowerCase().trim() &&
        p.dob === dob
      );
      setDuplicateWarning(match || null);
    } else {
      setDuplicateWarning(null);
    }
  }, [fullName, dob, livePatients, editingPatientId]);

  // Sync Age with Date of Birth, or vice versa
  const handleDobChange = (value: string) => {
    setDob(value);
    if (value) {
      const birthYear = new Date(value).getFullYear();
      const currentYear = new Date().getFullYear();
      const calculatedAge = currentYear - birthYear;
      setAge(calculatedAge >= 0 ? calculatedAge : 0);
      setIsAgeEstimated(false);
    }
  };

  const handleAgeChange = (value: string) => {
    const num = value === '' ? '' : Number(value);
    setAge(num);
    if (typeof num === 'number' && num >= 0) {
      const currentYear = new Date().getFullYear();
      const calculatedYear = currentYear - num;
      setDob(`${calculatedYear}-01-01`);
      setIsAgeEstimated(true);
    } else {
      setDob('');
      setIsAgeEstimated(false);
    }
  };

  // Nepal phone number validation (10 digits, starts with 98 or 97)
  const validatePhone = (input: string) => {
    setPhone(input);
    const nepPhoneRegex = /^(98|97)\d{8}$/;
    if (!input) {
      setPhoneError('Phone number is required');
    } else if (!nepPhoneRegex.test(input)) {
      setPhoneError('Must be a valid 10-digit Nepal mobile number starting with 98 or 97');
    } else {
      setPhoneError('');
    }
  };

  // Allergy / Chronic Tags handling
  const handleAddAllergy = () => {
    if (allergyInput.trim() && !allergies.includes(allergyInput.trim())) {
      setAllergies([...allergies, allergyInput.trim()]);
      setAllergyInput('');
    }
  };

  const handleRemoveAllergy = (index: number) => {
    setAllergies(allergies.filter((_, i) => i !== index));
  };

  const handleAddChronic = () => {
    if (chronicInput.trim() && !chronicConditions.includes(chronicInput.trim())) {
      setChronicConditions([...chronicConditions, chronicInput.trim()]);
      setChronicInput('');
    }
  };

  const handleRemoveChronic = (index: number) => {
    setChronicConditions(chronicConditions.filter((_, i) => i !== index));
  };

  // Clears every form field back to its default state
  const clearFormFields = () => {
    // Pharmacy ID field is auto-filled from localStorage and not user-editable,
    // so we reset it back to the logged-in pharmacy's ID rather than blank.
    setPharmacyId(getLoggedInPharmacyId());
    setFullName('');
    setGender('Male');
    setDob('');
    setAge('');
    setWeight('');
    setIsAgeEstimated(false);
    setPhone('');
    setPhoneError('');
    setAddress('');
    setNationalId('');
    setEmergencyContactName('');
    setEmergencyContactPhone('');
    setBloodType('Unknown');
    setAllergies([]);
    setChronicConditions([]);
    setPreferredLanguage('Nepali');
    setDuplicateWarning(null);
  };

  // Fully resets the form and closes it (used after save/update or on cancel)
  const resetForm = () => {
    clearFormFields();
    setEditingPatientId(null);
    setIsRegistering(false);
  };

  // Opens a blank registration form for a brand-new patient
  const handleOpenNewPatientForm = () => {
    if (isRegistering) {
      resetForm();
    } else {
      clearFormFields();
      setEditingPatientId(null);
      setIsRegistering(true);
    }
  };

  // NEW: Populates the form with an existing patient's data and switches it into "edit" mode
  const handleStartEditPatient = (patient: Patient) => {
    const currentId = patient.id || patient._id || '';
    if (!currentId) return;

    // Always keep pharmacyId locked to the logged-in pharmacy, even while editing
    setPharmacyId(getLoggedInPharmacyId());
    setFullName(patient.fullName || (patient as any).name || '');
    setGender(((patient.gender as any) || 'Male'));
    setDob(patient.dob || '');
    setAge(patient.age ?? '');
    setWeight(patient.weight || '');
    setIsAgeEstimated(!!patient.isAgeEstimated);
    setPhone(patient.phone || (patient as any).phoneNumber || '');
    setPhoneError('');
    setAddress(patient.address || '');
    setNationalId(patient.nationalId || (patient as any).nationalIdentityNumber || '');
    setEmergencyContactName(patient.emergencyContactName || (patient as any).emergencyContactPerson || '');
    setEmergencyContactPhone(patient.emergencyContactPhone || '');
    setBloodType(((patient.bloodType || (patient as any).bloodGroup || 'Unknown') as any));
    setPreferredLanguage(((patient.preferredLanguage || (patient as any).language || 'Nepali') as any));

    const allergiesData = patient.allergies || (patient as any).drugSensitivities;
    const allergiesArr = Array.isArray(allergiesData)
      ? allergiesData
      : (allergiesData && allergiesData !== 'None' ? String(allergiesData).split(', ') : []);
    setAllergies(allergiesArr);

    const chronicData = patient.chronicConditions;
    const chronicArr = Array.isArray(chronicData)
      ? chronicData
      : (chronicData && chronicData !== 'None' ? String(chronicData).split(', ') : []);
    setChronicConditions(chronicArr);

    setDuplicateWarning(null);
    setEditingPatientId(String(currentId));
    setIsRegistering(true);
  };

  // Submit Patient Data to Live Express Backend (handles BOTH create and update)
  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !phone.trim() || phoneError || !dob) return;

    const currentPharmacyId = getLoggedInPharmacyId();
    if (!currentPharmacyId) {
      alert(
        lang === 'en'
          ? 'No pharmacy ID found in your session. Please log in again before registering a patient.'
          : 'तपाईंको सत्रमा फार्मेसी आईडी फेला परेन। कृपया फेरि लगइन गर्नुहोस्।'
      );
      return;
    }

    setIsSubmitting(true);

    const payload = {
      pharmacyId: currentPharmacyId, // always taken from localStorage, never from a free-text field
      name: fullName.trim(),
      gender,
      dob,
      age: age === '' ? 0 : Number(age),
      weight: weight.trim() || '',
      phoneNumber: phone.trim(),
      address: address.trim() || '',
      nationalIdentityNumber: nationalId.trim() || '',
      bloodGroup: bloodType,
      language: preferredLanguage,
      drugSensitivities: allergies.length > 0 ? allergies.join(', ') : 'None',
      chronicConditions: chronicConditions.length > 0 ? chronicConditions.join(', ') : 'None',
      emergencyContactPerson: emergencyContactName.trim() || '',
      emergencyContactPhone: emergencyContactPhone.trim() || ''
    };

    const isEditMode = !!editingPatientId;
    const url = isEditMode ? `${API_BASE}/${editingPatientId}` : API_BASE;
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success && result.data) {
        const savedPatient: Patient = {
          id: result.data._id,
          _id: result.data._id,
          pharmacyId: result.data.pharmacyId,
          fullName: result.data.name,
          gender: result.data.gender,
          dob: result.data.dob,
          age: result.data.age,
          weight: result.data.weight,
          isAgeEstimated: isAgeEstimated,
          phone: result.data.phoneNumber,
          address: result.data.address,
          nationalId: result.data.nationalIdentityNumber || undefined,
          emergencyContactName: result.data.emergencyContactPerson || undefined,
          emergencyContactPhone: result.data.emergencyContactPhone || undefined,
          bloodType: result.data.bloodGroup,
          allergies: Array.isArray(result.data.allergies) ? result.data.allergies : [],
          chronicConditions: Array.isArray(result.data.chronicConditions) ? result.data.chronicConditions : [],
          preferredLanguage: result.data.language,
          createdAt: result.data.createdAt || new Date().toISOString()
        };

        // Refresh the live MongoDB list immediately so the change shows up (re-applies pharmacy filter)
        await fetchPatientsFromMongo();

        // Also notify the parent in case it tracks patients separately
        onPatientsUpdated(); 
        setSelectedPatient(savedPatient);

        // Reset form + exit edit/create mode
        resetForm();
      } else {
        alert(`Error: ${result.message || (isEditMode ? 'Could not update record' : 'Could not save record')}`);
      }
    } catch (error) {
      console.error("Pipeline breakdown pushing data:", error);
      alert("Failed to communicate with API Server pipeline.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // NEW: Deletes a patient record after confirmation
  const handleDeletePatient = async (patient: Patient) => {
    const currentId = patient.id || patient._id;
    if (!currentId) return;

    const patientName = patient.fullName || (patient as any).name || (lang === 'en' ? 'this patient' : 'यो बिरामी');

    const confirmed = window.confirm(
      lang === 'en'
        ? `Are you sure you want to permanently delete ${patientName}'s record? This action cannot be undone.`
        : `के तपाईं ${patientName} को रेकर्ड स्थायी रूपमा मेटाउन निश्चित हुनुहुन्छ? यो कार्य पूर्ववत गर्न सकिँदैन।`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/${currentId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        await fetchPatientsFromMongo();
        onPatientsUpdated();

        // If the deleted patient was selected/being edited, clear that state
        if (selectedPatient && (selectedPatient.id === currentId || selectedPatient._id === currentId)) {
          setSelectedPatient(null);
        }
        if (editingPatientId === currentId) {
          resetForm();
        }
      } else {
        alert(`Error: ${result.message || 'Could not delete record'}`);
      }
    } catch (error) {
      console.error('🔴 Failed to delete patient:', error);
      alert('Failed to communicate with API Server while deleting the record.');
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="patient-manager-root">
      {/* Left section: Search & List */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-xs p-5 flex flex-col space-y-4" id="patient-search-card">
        <div className="flex justify-between items-center pb-2 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-teal-600" />
            {t.patientSearch}
          </h2>
          <button
            onClick={handleOpenNewPatientForm}
            className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isRegistering 
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                : 'bg-teal-600 text-white hover:bg-teal-700 shadow-xs'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            {isRegistering ? t.cancel : t.patientReg}
          </button>
        </div>

        {!isRegistering && (
          <div className="relative" id="patient-search-input-group">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
            />
          </div>
        )}

        <div className="overflow-y-auto max-h-[550px] space-y-2 pr-1 flex-1" id="patient-list">
          {isRegistering ? (
            <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100 text-xs text-teal-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Info className="h-4 w-4" />
                {editingPatientId
                  ? (lang === 'en' ? 'Editing Existing Record' : 'अवस्थित रेकर्ड सम्पादन गर्दै')
                  : (lang === 'en' ? 'Quick Intake Guide' : 'द्रुत दर्ता निर्देशिका')}
              </p>
              <p className="leading-relaxed">
                {editingPatientId
                  ? (lang === 'en'
                      ? 'You are updating an existing patient record. Saving will overwrite the previous details.'
                      : 'तपाईं अवस्थित बिरामी रेकर्ड अपडेट गर्दै हुनुहुन्छ। सुरक्षित गर्दा अघिल्लो विवरण अधिलेखन हुनेछ।')
                  : (lang === 'en' 
                      ? 'Fill out the demographic fields. Entering the Age will automatically estimate DOB. Allergies will be highlighted as vital warning tags across POS and invoices.' 
                      : 'बिरामीको जानकारी भर्नुहोस्। उमेर हाल्दा जन्ममिति आफै गणना हुनेछ। औषधि एलर्जीहरू पछि बिक्री गर्दा र बिल प्रिन्ट गर्दा ठूलो रातो चेतावनी चिन्हको रूपमा देखिनेछन्।')}
              </p>
            </div>
          ) : isLoadingPatients ? (
            <div className="text-center py-12 space-y-2 text-gray-400">
              <p className="text-xs">{lang === 'en' ? 'Loading patients from MongoDB…' : 'लोड हुँदैछ...'}</p>
            </div>
          ) : fetchError ? (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700 space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <AlertOctagon className="h-4 w-4" />
                {lang === 'en' ? 'Could not load patients' : 'बिरामी लोड गर्न सकिएन'}
              </p>
              <p>{fetchError}</p>
              <button
                type="button"
                onClick={fetchPatientsFromMongo}
                className="py-1 px-2.5 bg-red-100 hover:bg-red-200 text-red-900 font-bold rounded text-[10px] uppercase tracking-wider transition-colors border border-red-300"
              >
                {lang === 'en' ? 'Retry' : 'फेरि प्रयास गर्नुहोस्'}
              </button>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-12 space-y-2 text-gray-400">
              <User className="h-8 w-8 mx-auto stroke-1" />
              <p className="text-xs">{t.noPatientFound}</p>
            </div>
          ) : (
            filteredPatients.map((patient) => {
              const currentId = patient.id || patient._id || '';
              const patientName = patient.fullName || (patient as any).name || 'Unknown';
              const displayPhone = patient.phone || (patient as any).phoneNumber || 'N/A';
              const displayAllergies = Array.isArray(patient.allergies) ? patient.allergies : 
                                       ((patient as any).drugSensitivities && (patient as any).drugSensitivities !== 'None' ? (patient as any).drugSensitivities.split(', ') : []);
              const displayChronic = Array.isArray(patient.chronicConditions) ? patient.chronicConditions :
                                      ((patient as any).chronicConditions && (patient as any).chronicConditions !== 'None' ? [(patient as any).chronicConditions] : []);

              return (
                <button
                  key={currentId}
                  onClick={() => setSelectedPatient(patient)}
                  className={`w-full text-left p-3.5 rounded-lg border text-sm transition-all flex items-start justify-between group ${
                    (selectedPatient?.id === currentId || selectedPatient?._id === currentId)
                      ? 'bg-teal-50/40 border-teal-300 ring-1 ring-teal-300'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 group-hover:text-teal-700 transition-colors">
                        {patientName}
                      </span>
                      {currentId && (
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded font-medium">
                          {String(currentId).slice(-6).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-gray-400" />
                        {patient.gender || 'N/A'} • {patient.age ?? '0'} yrs
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-gray-400" />
                        {displayPhone}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 truncate max-w-[280px]">
                      {patient.address || 'N/A'}
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between h-full space-y-2">
                    <span className="text-[10px] text-gray-400">
                      {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : 'Recent'}
                    </span>
                    <div className="flex gap-1">
                      {displayAllergies.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[10px] font-bold">
                          {lang === 'en' ? 'Allergies' : 'एलर्जी'}
                        </span>
                      )}
                      {displayChronic.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-bold">
                          {displayChronic[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right section: Detail View OR Registration/Edit Form */}
      <div className="lg:col-span-7" id="patient-details-panel">
        {isRegistering ? (
          <form onSubmit={handleSavePatient} className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                {editingPatientId
                  ? (lang === 'en' ? 'Edit Patient Record' : 'बिरामी रेकर्ड सम्पादन गर्नुहोस्')
                  : t.patientReg}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {editingPatientId
                  ? (lang === 'en' ? 'Update this patient record' : 'बिरामी रेकर्ड अपडेट गर्नुहोस्')
                  : (lang === 'en' ? 'Register a regular or walk-in patient' : 'नयाँ बिरामी दर्ता दर्ता प्रक्रिया')}
              </p>
            </div>

            {duplicateWarning && (
              <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-3 text-xs text-amber-900" id="duplicate-warning">
                <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="font-bold">{t.possibleDuplicate}</p>
                  <p>
                    A patient named <strong>{duplicateWarning.fullName || (duplicateWarning as any).name}</strong> born on <strong>{duplicateWarning.dob}</strong> (Age {duplicateWarning.age}) already exists.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatient(duplicateWarning);
                      resetForm();
                    }}
                    className="py-1 px-2.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded text-[10px] uppercase tracking-wider transition-colors border border-amber-300"
                  >
                    {t.viewExisting}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="registration-form-grid">

               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Pharmacy User ID</label>
                   <input
                    type="text"
                    value={pharmacyId}
                    readOnly
                    disabled
                    title={lang === 'en' ? 'Automatically set from your logged-in pharmacy account' : 'तपाईंको लगइन गरिएको फार्मेसी खाताबाट स्वचालित रूपमा सेट गरिएको'}
                     className="w-full px-3.5 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                     />
                   </div>    
     
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                  {t.fullName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ram Bahadur Thapa"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {t.gender} <span className="text-red-500">*</span>
                </label>
                <select
                  value={gender}
                  onChange={(e: any) => setGender(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
                >
                  <option value="Male">{t.male}</option>
                  <option value="Female">{t.female}</option>
                  <option value="Other">{t.other}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {t.age} <span className="text-xs font-normal text-gray-400">({lang === 'en' ? 'Or Birth Date' : 'वा जन्ममिति'})</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="130"
                  value={age}
                  onChange={(e) => handleAgeChange(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  {t.dob} <span className="text-red-500">*</span>
                  {isAgeEstimated && (
                    <span className="text-[10px] font-normal text-amber-600 bg-amber-50 px-1.5 rounded border border-amber-100">
                      Estimated
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => handleDobChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors font-mono"
                />
              </div>

              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Weight (kg)</label>
                 <input
                   type="number"
                   value={weight}
                   onChange={(e) => setWeight(e.target.value)}
                   placeholder="e.g. 70"
                   className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                 />
               </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex justify-between">
                  <span>{t.phone} <span className="text-red-500">*</span></span>
                  {phoneError && <span className="text-[11px] font-normal text-red-600">{phoneError}</span>}
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => validatePhone(e.target.value)}
                  placeholder="e.g. 98570XXXXX"
                  className={`w-full px-3.5 py-2 bg-gray-50 border rounded-lg text-sm focus:outline-hidden focus:ring-1 transition-colors ${
                    phoneError 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500 focus:bg-red-50/20' 
                      : 'border-gray-200 focus:ring-teal-500 focus:border-teal-500 focus:bg-white'
                  }`}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {t.address}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Devinagar, Butwal-11, Rupandehi"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {t.nationalId}
                </label>
                <input
                  type="text"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="National identity card context"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {t.bloodType}
                </label>
                <select
                  value={bloodType}
                  onChange={(e: any) => setBloodType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
                >
                  <option value="Unknown">Unknown / Select</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {t.preferredLanguage}    
                </label>
                <select
                  value={preferredLanguage}
                  onChange={(e: any) => setPreferredLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
                >
                  <option value="Nepali">Nepali (नेपाली)</option>
                  <option value="English">English</option>
                  <option value="Maithili">Maithili (मैथिली)</option>
                  <option value="Bhojpuri">Bhojpuri (भोजपुरी)</option>
                  <option value="Other">Other (अन्य)</option>
                </select>
              </div>

              <div className="space-y-2 sm:col-span-2 border-t border-gray-100 pt-4 mt-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  {t.allergies}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={allergyInput}
                    onChange={(e) => setAllergyInput(e.target.value)}
                    placeholder="e.g. Penicillin, Aspirin"
                    className="flex-1 px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddAllergy}
                    className="px-4 py-1.5 bg-gray-100 text-gray-800 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
                  >
                    {lang === 'en' ? 'Add' : 'थप्नुहोस्'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {allergies.map((tag, index) => (
                    <span key={index} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveAllergy(index)}
                        className="hover:bg-red-200 text-red-900 rounded-full h-4.5 w-4.5 flex items-center justify-center font-bold text-[10px]"
                      >
                        ×
                      </button>
                    </span> 
                  ))}
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  {t.chronicConditions}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chronicInput}
                    onChange={(e) => setChronicInput(e.target.value)}
                    placeholder="e.g. Hypertension, Diabetes"
                    className="flex-1 px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddChronic}
                    className="px-4 py-1.5 bg-gray-100 text-gray-800 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
                  >
                    {lang === 'en' ? 'Add' : 'थप्नुहोस्'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {chronicConditions.map((tag, index) => (
                    <span key={index} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveChronic(index)}
                        className="hover:bg-indigo-200 text-indigo-900 rounded-full h-4.5 w-4.5 flex items-center justify-center font-bold text-[10px]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 border-t border-gray-100 pt-4 mt-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {t.emergencyContact}
                </label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="Contact Name"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5 border-t border-gray-100 pt-4 mt-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {t.emergencyPhone}
                </label>
                <input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="Contact Phone"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 transition-colors"
              >
                {t.cancel}
              </button> 
              <button
                type="submit"
                disabled={!fullName || !dob || !phone || !!phoneError || isSubmitting}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors shadow-xs"
              >
                {isSubmitting
                  ? (editingPatientId ? 'Updating...' : 'Saving...')
                  : (editingPatientId ? (lang === 'en' ? 'Update Patient' : 'अपडेट गर्नुहोस्') : t.savePatient)}
              </button>
            </div>
          </form>
        ) : selectedPatient ? (
          /* Live Patient Detail View Panel */
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-5 gap-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 border border-teal-100">
                  <User className="h-8 w-8" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                    {selectedPatient.fullName || (selectedPatient as any).name || 'Unknown'}
                  </h3>
                  <div className="flex gap-2 items-center text-xs text-gray-500">
                    <span className="font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                      {String(selectedPatient.id || selectedPatient._id || '').toUpperCase()}
                    </span>
                    <span>•</span> 
                    <span>{t.registeredOn}: {selectedPatient.createdAt ? new Date(selectedPatient.createdAt).toLocaleDateString() : 'Recent Log'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {/* NEW: Edit button */}
                <button
                  onClick={() => handleStartEditPatient(selectedPatient)}
                  disabled={isDeleting}
                  className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={lang === 'en' ? 'Edit patient details' : 'बिरामी विवरण सम्पादन गर्नुहोस्'}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {lang === 'en' ? 'Edit' : 'सम्पादन'}
                </button>

                {/* NEW: Delete button */}
                <button
                  onClick={() => handleDeletePatient(selectedPatient)}
                  disabled={isDeleting}
                  className="px-3 py-2 bg-white hover:bg-red-50 text-red-600 font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={lang === 'en' ? 'Delete patient record' : 'बिरामी रेकर्ड मेटाउनुहोस्'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isDeleting ? (lang === 'en' ? 'Deleting...' : 'मेटाउँदै...') : (lang === 'en' ? 'Delete' : 'मेटाउनुहोस्')}
                </button>

                <button 
                  onClick={() => onStartSaleForPatient(selectedPatient)}  
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 shadow-xs"
                > 
                  <ClipboardList className="h-4 w-4" />   
                  {lang === 'en' ? 'Dispense Medicine' : 'औषधि बिक्री (POS)'}
                </button>
              </div>
            </div>

            {/* Grid Data Container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="p-3.5 bg-gray-50 rounded-lg space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.gender} & {t.age}</span>
                <p className="font-semibold text-gray-800 text-base">
                  {selectedPatient.gender || 'N/A'} • {selectedPatient.age ?? '0'} Yrs
                </p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-lg space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.phone}</span>
                <p className="font-semibold text-gray-800 text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  {selectedPatient.phone || (selectedPatient as any).phoneNumber || 'N/A'}
                </p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-lg space-y-1 sm:col-span-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.address}</span>
                <p className="font-semibold text-gray-800 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {selectedPatient.address || 'N/A'}
                </p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-lg space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.bloodType}</span>
                <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                  {selectedPatient.bloodType || (selectedPatient as any).bloodGroup || 'Unknown'}
                </p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-lg space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.preferredLanguage}</span>
                <p className="font-semibold text-gray-800">
                  {selectedPatient.preferredLanguage || (selectedPatient as any).language || 'Nepali'}
                </p>
              </div>

              {(selectedPatient.nationalId || (selectedPatient as any).nationalIdentityNumber) && (
                <div className="p-3.5 bg-gray-50 rounded-lg space-y-1 sm:col-span-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.nationalId}</span>
                  <p className="font-mono text-gray-700">
                    {selectedPatient.nationalId || (selectedPatient as any).nationalIdentityNumber}
                  </p>
                </div>
              )}

              {/* Patient Alert / Allergy Strings and Arrays normalization rendering */}
              <div className="p-3.5 bg-red-50/40 rounded-lg border border-red-100 space-y-1.5 sm:col-span-2">
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">{t.allergies}</span>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const allergiesData = selectedPatient.allergies || (selectedPatient as any).drugSensitivities;
                    const items = Array.isArray(allergiesData) ? allergiesData : (allergiesData && allergiesData !== 'None' ? allergiesData.split(', ') : []);
                    return items.length > 0 ? items.map((allg: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-white text-red-700 border border-red-200 rounded text-xs font-medium">
                        {allg}
                      </span>
                    )) : <span className="text-xs text-gray-400 italic">None logged</span>;
                  })()}
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/40 rounded-lg border border-indigo-100 space-y-1.5 sm:col-span-2">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">{t.chronicConditions}</span>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const chronicData: any = selectedPatient.chronicConditions;
                    const items = Array.isArray(chronicData) ? chronicData : (chronicData && chronicData !== 'None' ? chronicData.split(', ') : []);
                    return items.length > 0 ? items.map((cond: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-white text-indigo-700 border border-indigo-200 rounded text-xs font-medium">
                        {cond}
                      </span>
                    )) : <span className="text-xs text-gray-400 italic">None logged</span>;
                  })()}
                </div>
              </div>

              {/* Emergency Contact Information Details Container */}
              {(selectedPatient.emergencyContactName || (selectedPatient as any).emergencyContactPerson || selectedPatient.emergencyContactPhone) && (
                <div className="p-3.5 bg-teal-50/20 rounded-lg border border-teal-100 space-y-2 sm:col-span-2">
                  <span className="text-xs font-bold text-teal-600 uppercase tracking-wider block">{t.emergencyContact}</span>
                  <div className="flex flex-col sm:flex-row sm:gap-6 justify-between text-sm text-gray-800">
                    <span className="font-semibold">{selectedPatient.emergencyContactName || (selectedPatient as any).emergencyContactPerson || 'N/A'}</span>
                    <span className="font-mono text-gray-600 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      {selectedPatient.emergencyContactPhone || 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Empty Context View Placeholder */
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-16 text-center space-y-4" id="empty-patient-details">
            <User className="h-16 w-16 mx-auto stroke-1 text-gray-300 bg-gray-50 p-4 rounded-full border border-gray-100" />
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-gray-900 tracking-tight">
                {lang === 'en' ? 'No Patient Selected' : 'कुनै बिरामी छानिएको छैन'}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {lang === 'en' 
                  ? 'Select a patient from the sidebar list to review demographic history, health alerts, and active prescriptions.' 
                  : 'बिरामीको मेडिकल रेकर्ड हेर्न बायाँ सूचीबाट छान्नुहोस्।'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}