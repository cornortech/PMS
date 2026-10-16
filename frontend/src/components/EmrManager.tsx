import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, User, Calendar, FileText, ClipboardList, Info,
  Pencil, Trash2, ChevronRight, ChevronLeft, Stethoscope, Pill,
  FlaskConical, ClipboardCheck, X, Clock, AlertOctagon, UserPlus, RefreshCw
} from 'lucide-react';

/* ============================================================================
   TYPES
   ============================================================================ */

interface Patient {
  id?: string;
  _id?: string;
  fullName?: string;
  name?: string;
  gender?: string;
  age?: number;
  phone?: string;
  phoneNumber?: string;
  address?: string;
  pharmacyId?: string;
}

interface EMRRecord {
  id?: string;
  _id?: string;
  patientId: string;
  pharmacyId: string;
  visitDate: string;
  chiefComplaint: string;
  diagnosis: string;
  symptoms: string[];
  vitals: {
    bp?: string;
    temp?: string;
    pulse?: string;
    weight?: string;
    spo2?: string;
  };
  prescription: string;
  labTests: string[];
  notes: string;
  followUpDate?: string;
  doctorName: string;
  createdAt: string;
}

interface EMRManagerProps {
  patients: Patient[];
  lang: 'en' | 'ne';
  onRefreshPatients?: () => void;
}

import { API_BASE as SERVER } from '../lib/api';
const EMR_API_BASE = `${SERVER}/api/emr`;

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

/* ============================================================================
   MAIN COMPONENT
   ============================================================================ */

export default function EMRManager({ patients, lang, onRefreshPatients }: EMRManagerProps) {
  const isNe = lang === 'ne';

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [allRecords, setAllRecords] = useState<EMRRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [isRefreshingPatients, setIsRefreshingPatients] = useState(false);

  type PanelView = 'blogList' | 'blogDetail' | 'form' | 'pickPatient';
  const [panelView, setPanelView] = useState<PanelView>('blogList');
  const [activeRecord, setActiveRecord] = useState<EMRRecord | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ---- New-record patient picker search (used by left-side "New Record" button) ----
  const [pickerSearch, setPickerSearch] = useState('');

  // ---- Form fields ----
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [symptomInput, setSymptomInput] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [bp, setBp] = useState('');
  const [temp, setTemp] = useState('');
  const [pulse, setPulse] = useState('');
  const [weightVital, setWeightVital] = useState('');
  const [spo2, setSpo2] = useState('');
  const [prescription, setPrescription] = useState('');
  const [labInput, setLabInput] = useState('');
  const [labTests, setLabTests] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [doctorName, setDoctorName] = useState('');


  const [isRefreshingPicker, setIsRefreshingPicker] = useState(false);

const handleRefreshPickerPatients = async () => {
  setIsRefreshingPicker(true);
  try {
    if (onRefreshPatients) onRefreshPatients();
  } finally {
    setTimeout(() => setIsRefreshingPicker(false), 500);
  }
};


  const t = {
    emrTitle: isNe ? 'ईएमआर रेकर्ड' : 'EMR Records',
    searchPlaceholder: isNe ? 'बिरामीको नाम, फोन खोज्नुहोस्...' : 'Search patient name, phone...',
    noPatientFound: isNe ? 'कुनै बिरामी फेला परेन' : 'No patients found',
    selectPatient: isNe ? 'कुनै बिरामी छानिएको छैन' : 'No Patient Selected',
    selectPatientDesc: isNe
      ? 'भ्रमण इतिहास हेर्न बायाँबाट बिरामी छान्नुहोस्, वा नयाँ रेकर्ड सिर्जना गर्नुहोस्।'
      : 'Select a patient from the list to view their visit history, or create a new record.',
    newVisit: isNe ? 'नयाँ भ्रमण' : 'New Visit',
    newRecordBtn: isNe ? 'नयाँ रेकर्ड' : 'New Record',
    addRecord: isNe ? 'नयाँ रेकर्ड थप्नुहोस्' : 'Create EMR',
    visitsCount: isNe ? 'भ्रमणहरू' : 'visits',
    visitCount: isNe ? 'भ्रमण' : 'visit',
    firstVisit: isNe ? 'पहिलो भ्रमण' : 'First visit',
    noVisitsYet: isNe ? 'अहिलेसम्म कुनै भ्रमण रेकर्ड छैन' : 'No visit records yet',
    noVisitsDesc: isNe
      ? 'यो बिरामीको लागि पहिलो चिकित्सा रेकर्ड सिर्जना गर्नुहोस्।'
      : 'This patient hasn\u2019t had a recorded visit. Create their first EMR entry.',
    back: isNe ? 'फिर्ता' : 'Back',
    edit: isNe ? 'सम्पादन' : 'Edit',
    delete: isNe ? 'मेटाउनुहोस्' : 'Delete',
    save: isNe ? 'सुरक्षित गर्नुहोस्' : 'Save Record',
    update: isNe ? 'अपडेट गर्नुहोस्' : 'Update Record',
    cancel: isNe ? 'रद्द गर्नुहोस्' : 'Cancel',
    visitDate: isNe ? 'भ्रमण मिति' : 'Visit Date',
    chiefComplaint: isNe ? 'मुख्य गुनासो' : 'Chief Complaint',
    diagnosis: isNe ? 'निदान' : 'Diagnosis',
    symptoms: isNe ? 'लक्षणहरू' : 'Symptoms',
    vitals: isNe ? 'भाइटल्स' : 'Vitals',
    bp: isNe ? 'रक्तचाप' : 'Blood Pressure',
    temp: isNe ? 'तापक्रम' : 'Temperature',
    pulse: isNe ? 'नाडी' : 'Pulse',
    weight: isNe ? 'तौल' : 'Weight',
    spo2: 'SpO2',
    prescription: isNe ? 'प्रिस्क्रिप्सन' : 'Prescription',
    labTests: isNe ? 'ल्याब जाँच' : 'Lab Tests',
    notes: isNe ? 'थप टिप्पणी' : 'Additional Notes',
    followUp: isNe ? 'फलो-अप मिति' : 'Follow-up Date',
    doctor: isNe ? 'डाक्टरको नाम' : 'Doctor / Attended By',
    add: isNe ? 'थप्नुहोस्' : 'Add',
    creatingFor: isNe ? 'को लागि नयाँ रेकर्ड' : 'New record for',
    editingFor: isNe ? 'को रेकर्ड सम्पादन' : 'Editing record for',
    confirmDelete: isNe
      ? 'के तपाईं यो भ्रमण रेकर्ड स्थायी रूपमा मेटाउन चाहनुहुन्छ?'
      : 'Delete this visit record permanently? This cannot be undone.',
    loading: isNe ? 'लोड हुँदैछ...' : 'Loading records...',
    retry: isNe ? 'फेरि प्रयास गर्नुहोस्' : 'Retry',
    couldNotLoad: isNe ? 'रेकर्ड लोड गर्न सकिएन' : 'Could not load records',
    pickPatientTitle: isNe ? 'बिरामी छान्नुहोस्' : 'Select a Patient',
    pickPatientDesc: isNe
      ? 'नयाँ चिकित्सा रेकर्ड कुन बिरामीको लागि सिर्जना गर्ने हो छान्नुहोस्।'
      : 'Choose which patient this new medical record belongs to.',
    allRecordsTitle: isNe ? 'सबै रेकर्डहरू' : 'All Patient Records',
    noRecordsYet: isNe ? 'डाटाबेसमा कुनै रेकर्ड छैन' : 'No records in database yet',
  };

  /* --------------------------------------------------------------------
     Fetch all EMR records once, scoped to logged-in pharmacy
     -------------------------------------------------------------------- */
  const fetchRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    setFetchError('');
    const pharmacyId = getLoggedInPharmacyId();

    if (!pharmacyId) {
      setFetchError(isNe ? 'फार्मेसी आईडी फेला परेन। फेरि लगइन गर्नुहोस्।' : 'No pharmacy ID found. Please log in again.');
      setAllRecords([]);
      setIsLoadingRecords(false);
      return;
    }

    try {
    const response = await fetch(EMR_API_BASE);
const result = await response.json();
if (result.success && Array.isArray(result.data)) {
  const scoped = result.data.filter(
    (r: any) => String(r.pharmacyId || '').trim() === String(pharmacyId).trim()
  );
  setAllRecords(scoped);
} else {
        setFetchError('Server responded but returned no valid EMR data.');
      }
    } catch (error) {
      console.error('Failed to fetch EMR records:', error);
      setFetchError('Cannot reach the server. Check your internet and try again.');
    } finally {
      setIsLoadingRecords(false);
    }
  }, [isNe]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  /* --------------------------------------------------------------------
     Refresh handler — reloads patient list (via parent) AND EMR records
     -------------------------------------------------------------------- */
  const handleRefreshAll = async () => {
    setIsRefreshingPatients(true);
    try {
      if (onRefreshPatients) {
        onRefreshPatients();
      }
      await fetchRecords();
    } finally {
      setTimeout(() => setIsRefreshingPatients(false), 500);
    }
  };

  /* --------------------------------------------------------------------
     Derived data
     -------------------------------------------------------------------- */

  // Only patients belonging to the logged-in pharmacy (matched against
  // localStorage "user".id, which is the pharmacyId stored on each patient)
  const pharmacyScopedPatients = useMemo(() => {
    const pharmacyId = getLoggedInPharmacyId();
    if (!pharmacyId) return [];
    return patients.filter(
      (p: any) => String(p.pharmacyId || '').trim() === String(pharmacyId).trim()
    );
  }, [patients]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return pharmacyScopedPatients;
    const q = searchQuery.toLowerCase().trim();
    return pharmacyScopedPatients.filter(
      (p) =>
        (p.fullName || p.name || '').toLowerCase().includes(q) ||
        (p.phone || p.phoneNumber || '').includes(q)
    );
  }, [pharmacyScopedPatients, searchQuery]);

  const pickerFilteredPatients = useMemo(() => {
    if (!pickerSearch.trim()) return pharmacyScopedPatients;
    const q = pickerSearch.toLowerCase().trim();
    return pharmacyScopedPatients.filter(
      (p) =>
        (p.fullName || p.name || '').toLowerCase().includes(q) ||
        (p.phone || p.phoneNumber || '').includes(q)
    );
  }, [pharmacyScopedPatients, pickerSearch]);

  const recordsForSelectedPatient = useMemo(() => {
    if (!selectedPatient) return [];
    const pid = selectedPatient.id || selectedPatient._id || '';
    return allRecords
      .filter((r) => String(r.patientId) === String(pid))
      .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  }, [allRecords, selectedPatient]);

  const visitCountByPatientId = useMemo(() => {
    const map: Record<string, number> = {};
    allRecords.forEach((r) => {
      map[r.patientId] = (map[r.patientId] || 0) + 1;
    });
    return map;
  }, [allRecords]);

  // Patient lookup map, used by the "All Records" list under EMR Records
  const patientById = useMemo(() => {
    const map: Record<string, Patient> = {};
    pharmacyScopedPatients.forEach((p) => {
      const pid = p.id || p._id || '';
      if (pid) map[pid] = p;
    });
    return map;
  }, [pharmacyScopedPatients]);

  // ---- Group records by patient, one block per patient, sorted by
  // most-recent visit first. Used for the "All Patient Records" list.
  // Filters against searchQuery (same box used for patient search). ----
  const recordGroupsByPatient = useMemo(() => {
    const groups: Record<string, EMRRecord[]> = {};
    allRecords.forEach((r) => {
      const pid = String(r.patientId);
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push(r);
    });

    const q = searchQuery.toLowerCase().trim();

    const list = Object.entries(groups).map(([pid, records]) => {
      const sortedRecords = [...records].sort(
        (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
      );
      return {
        patientId: pid,
        patient: patientById[pid],
        records: sortedRecords,
        latestDate: sortedRecords[0]?.visitDate || '',
      };
    }).filter((item) => {
      // If search is empty, show all
      if (!q) return true;

      // Check against patient info
      const p = item.patient;
      if (!p) return false;

      const name = (p.fullName || p.name || '').toLowerCase();
      const phone = (p.phone || p.phoneNumber || '').toLowerCase();

      return name.includes(q) || phone.includes(q);
    });

    return list.sort(
      (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
    );
  }, [allRecords, patientById, searchQuery]);

  /* --------------------------------------------------------------------
     Selecting a patient -> always lands on the blog LIST, never a report
     -------------------------------------------------------------------- */
  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPanelView('blogList');
    setActiveRecord(null);
  };

  const handleOpenBlog = (record: EMRRecord) => {
    setActiveRecord(record);
    setPanelView('blogDetail');
  };
  
  // Opening a patient block from the "All Patient Records" list (left panel):
  // selects the owning patient. If they have exactly 1 record, jump straight
  // to that record's detail view. If more than 1, land on their blog list.
  const handleOpenPatientGroup = (pid: string, records: EMRRecord[]) => {
    const owner = patientById[pid];
    if (owner) setSelectedPatient(owner);

    if (records.length === 1) {
      setActiveRecord(records[0]);
      setPanelView('blogDetail');
    } else {
      setActiveRecord(null);
      setPanelView('blogList');
    }
  };

  const handleBackToBlogList = () => {
    setActiveRecord(null);
    setPanelView('blogList');
  };

  /* --------------------------------------------------------------------
     Form handling
     -------------------------------------------------------------------- */
  const clearForm = () => {
    setVisitDate(new Date().toISOString().slice(0, 10));
    setChiefComplaint('');
    setDiagnosis('');
    setSymptoms([]);
    setSymptomInput('');
    setBp('');
    setTemp('');
    setPulse('');
    setWeightVital('');
    setSpo2('');
    setPrescription('');
    setLabTests([]);
    setLabInput('');
    setNotes('');
    setFollowUpDate('');
    setDoctorName('');
  };

  const handleOpenNewRecordForm = () => {
    // Used from inside a patient's blog list ("New Visit")
    clearForm();
    setEditingRecordId(null);
    setPanelView('form');
  };

  // Left-side header button: "New Record" — opens a patient picker
  // first (since a record must belong to a specific, already-registered
  // patient). Selecting a patient there jumps straight into the form.
  const handleOpenCreateRecordFlow = () => {
    setPickerSearch('');
    setPanelView('pickPatient');
  };

  const handlePickPatientForNewRecord = (patient: Patient) => {
    setSelectedPatient(patient);
    clearForm();
    setEditingRecordId(null);
    setPanelView('form');
  };

  const handleStartEditRecord = (record: EMRRecord) => {
    const rid = record.id || record._id || '';
    setVisitDate(record.visitDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setChiefComplaint(record.chiefComplaint || '');
    setDiagnosis(record.diagnosis || '');
    setSymptoms(record.symptoms || []);
    setBp(record.vitals?.bp || '');
    setTemp(record.vitals?.temp || '');
    setPulse(record.vitals?.pulse || '');
    setWeightVital(record.vitals?.weight || '');
    setSpo2(record.vitals?.spo2 || '');
    setPrescription(record.prescription || '');
    setLabTests(record.labTests || []);
    setNotes(record.notes || '');
    setFollowUpDate(record.followUpDate?.slice(0, 10) || '');
    setDoctorName(record.doctorName || '');
    setEditingRecordId(String(rid));
    setPanelView('form');
  };

  const handleCancelForm = () => {
    clearForm();
    setEditingRecordId(null);
    setPanelView('blogList');
  };

  const handleAddSymptom = () => {
    if (symptomInput.trim() && !symptoms.includes(symptomInput.trim())) {
      setSymptoms([...symptoms, symptomInput.trim()]);
      setSymptomInput('');
    }
  };
  const handleRemoveSymptom = (i: number) => setSymptoms(symptoms.filter((_, idx) => idx !== i));

  const handleAddLabTest = () => {
    if (labInput.trim() && !labTests.includes(labInput.trim())) {
      setLabTests([...labTests, labInput.trim()]);
      setLabInput('');
    }
  };
  const handleRemoveLabTest = (i: number) => setLabTests(labTests.filter((_, idx) => idx !== i));

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !chiefComplaint.trim() || !visitDate) return;

    const pharmacyId = getLoggedInPharmacyId();
    const patientId = selectedPatient.id || selectedPatient._id || '';

    setIsSubmitting(true);
    const payload = {
      pharmacyId,
      patientId,
      visitDate,
      chiefComplaint: chiefComplaint.trim(),
      diagnosis: diagnosis.trim(),
      symptoms,
      vitals: { bp, temp, pulse, weight: weightVital, spo2 },
      prescription: prescription.trim(),
      labTests,
      notes: notes.trim(),
      followUpDate: followUpDate || undefined,
      doctorName: doctorName.trim(),
    };

    const isEdit = !!editingRecordId;
    const url = isEdit ? `${EMR_API_BASE}/${editingRecordId}` : EMR_API_BASE;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (result.success && result.data) {
        await fetchRecords();
        clearForm();
        setEditingRecordId(null);
        setPanelView('blogList');
      } else {
        alert(`Error: ${result.message || (isEdit ? 'Could not update record' : 'Could not save record')}`);
      }
    } catch (error) {
      console.error('Failed to save EMR record:', error);
      alert('Failed to communicate with the API server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (record: EMRRecord) => {
    const rid = record.id || record._id;
    if (!rid) return;
    const confirmed = window.confirm(t.confirmDelete);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${EMR_API_BASE}/${rid}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        await fetchRecords();
        setPanelView('blogList');
        setActiveRecord(null);
      } else {
        alert(`Error: ${result.message || 'Could not delete record'}`);
      }
    } catch (error) {
      console.error('Failed to delete EMR record:', error);
      alert('Failed to communicate with the API server.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return 'N/A';
    try {
      return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  };

  /* ========================================================================
     RENDER
     ======================================================================== */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="emr-manager-root">
      {/* ---------------- LEFT: Patient list + All records ---------------- */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-xs p-5 flex flex-col space-y-4" id="emr-patient-list-card">

        <div className="flex justify-between items-center pb-2 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            {t.emrTitle}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshAll}
              title={isNe ? 'ताजा गर्नुहोस्' : 'Refresh patient list'}
              className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all text-gray-500 hover:text-teal-600 shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshingPatients ? 'animate-spin text-teal-600' : ''}`} />
            </button>
            <button
              onClick={handleOpenCreateRecordFlow}
              className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.newRecordBtn}
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
          />
        </div>


        {/* ---- All records from the database, grouped ONE block per patient ---- */}
        <div className="border-t border-gray-100 pt-4 flex flex-col flex-1 min-h-0 space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <Clock className="h-3.5 w-3.5" />
            {t.allRecordsTitle}
          </p>

          <div className="overflow-y-auto max-h-[320px] space-y-2 pr-1">
            {isLoadingRecords ? (
              <div className="text-center py-8 text-gray-400 text-xs">{t.loading}</div>
            ) : fetchError ? (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-700 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertOctagon className="h-3.5 w-3.5" />
                  {t.couldNotLoad}
                </p>
                <p>{fetchError}</p>
                <button
                  onClick={fetchRecords}
                  className="py-1 px-2.5 bg-red-100 hover:bg-red-200 text-red-900 font-bold rounded text-[10px] uppercase tracking-wider transition-colors border border-red-300"
                >
                  {t.retry}
                </button>
              </div>
            ) : recordGroupsByPatient.length === 0 ? (
              <div className="text-center py-8 space-y-1 text-gray-400">
                <Stethoscope className="h-6 w-6 mx-auto stroke-1" />
                <p className="text-xs">{t.noRecordsYet}</p>
              </div>
            ) : (
              recordGroupsByPatient.map((group) => {
                const owner = group.patient;
                const ownerName = owner ? (owner.fullName || owner.name || 'Unknown') : 'Unknown patient';
                const visitCount = group.records.length;
                const latestRecord = group.records[0];

                return (
                  <button
                    key={group.patientId}
                    onClick={() => handleOpenPatientGroup(group.patientId, group.records)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50/20 transition-all group flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0 mt-0.5">
                        <Stethoscope className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-bold text-gray-900 group-hover:text-teal-700 transition-colors text-sm block truncate">
                          {ownerName}
                        </span>
                        <p className="text-xs text-gray-500 truncate max-w-[260px]">
                          {latestRecord.diagnosis || latestRecord.chiefComplaint}
                        </p>
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(latestRecord.visitDate)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          visitCount > 0
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : 'bg-gray-50 text-gray-400 border border-gray-200'
                        }`}
                      >
                        <ClipboardCheck className="h-3 w-3" />
                        {visitCount} {visitCount === 1 ? t.visitCount : t.visitsCount}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ---------------- RIGHT: Detail panel ---------------- */}
      <div className="lg:col-span-7 space-y-4" id="emr-details-panel">
        {panelView === 'pickPatient' ? (
          <PatientPicker
    t={t}
    isNe={isNe}
    patients={pickerFilteredPatients}
    visitCountByPatientId={visitCountByPatientId}
    search={pickerSearch}
    setSearch={setPickerSearch}
    onPick={handlePickPatientForNewRecord}
    onCancel={() => setPanelView(selectedPatient ? 'blogList' : 'blogList')}
    onRefresh={handleRefreshPickerPatients}
    isRefreshing={isRefreshingPicker}
  />
        ) : !selectedPatient ? (
          <EmptyState t={t} onRefresh={handleRefreshAll} isRefreshing={isRefreshingPatients} />
        ) : panelView === 'form' ? (
          <RecordForm
            t={t}
            isNe={isNe}
            patient={selectedPatient}
            isEdit={!!editingRecordId}
            isSubmitting={isSubmitting}
            visitDate={visitDate} setVisitDate={setVisitDate}
            chiefComplaint={chiefComplaint} setChiefComplaint={setChiefComplaint}
            diagnosis={diagnosis} setDiagnosis={setDiagnosis}
            symptomInput={symptomInput} setSymptomInput={setSymptomInput}
            symptoms={symptoms} onAddSymptom={handleAddSymptom} onRemoveSymptom={handleRemoveSymptom}
            bp={bp} setBp={setBp} temp={temp} setTemp={setTemp}
            pulse={pulse} setPulse={setPulse} weightVital={weightVital} setWeightVital={setWeightVital}
            spo2={spo2} setSpo2={setSpo2}
            prescription={prescription} setPrescription={setPrescription}
            labInput={labInput} setLabInput={setLabInput}
            labTests={labTests} onAddLabTest={handleAddLabTest} onRemoveLabTest={handleRemoveLabTest}
            notes={notes} setNotes={setNotes}
            followUpDate={followUpDate} setFollowUpDate={setFollowUpDate}
            doctorName={doctorName} setDoctorName={setDoctorName}
            onSubmit={handleSaveRecord}
            onCancel={handleCancelForm}
          />
        ) : panelView === 'blogDetail' && activeRecord ? (
          <RecordDetail
            t={t}
            record={activeRecord}
            patient={selectedPatient}
            isDeleting={isDeleting}
            formatDate={formatDate}
            onBack={handleBackToBlogList}
            onEdit={() => handleStartEditRecord(activeRecord)}
            onDelete={() => handleDeleteRecord(activeRecord)}
          />
        ) : (
          <BlogList
            t={t}
            isNe={isNe}
            patient={selectedPatient}
            records={recordsForSelectedPatient}
            isLoading={isLoadingRecords}
            fetchError={fetchError}
            onRetry={fetchRecords}
            formatDate={formatDate}
            onOpenBlog={handleOpenBlog}
            onCreateNew={handleOpenNewRecordForm}
          />
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   SUB-COMPONENTS
   ============================================================================ */

function EmptyState({ t, onRefresh, isRefreshing }: { t: any; onRefresh?: () => void; isRefreshing?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-16 text-center space-y-4">
      <FileText className="h-16 w-16 mx-auto stroke-1 text-gray-300 bg-gray-50 p-4 rounded-full border border-gray-100" />
      <div className="space-y-1 max-w-sm mx-auto">
        <h3 className="text-base font-bold text-gray-900 tracking-tight">{t.selectPatient}</h3>
        <p className="text-xs text-gray-500 leading-relaxed">{t.selectPatientDesc}</p>
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="mx-auto px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-200 transition-all flex items-center gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
          Refresh
        </button>
      )}
    </div>
  );
}

function PatientPicker({
  t, isNe, patients, visitCountByPatientId, search, setSearch, onPick, onCancel, onRefresh, isRefreshing,
}: {
  t: any; isNe: boolean; patients: Patient[]; visitCountByPatientId: Record<string, number>;
  search: string; setSearch: (v: string) => void; onPick: (p: Patient) => void; onCancel: () => void;
  onRefresh?: () => void; isRefreshing?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-5">
      <div className="border-b border-gray-100 pb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-teal-600" />
            {t.pickPatientTitle}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{t.pickPatientDesc}</p>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
          />
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            title={isNe ? 'ताजा गर्नुहोस्' : 'Refresh patient list'}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all text-gray-500 hover:text-teal-600 shrink-0"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
        {patients.length === 0 ? (
          <div className="text-center py-12 space-y-2 text-gray-400">
            <User className="h-8 w-8 mx-auto stroke-1" />
            <p className="text-xs">{t.noPatientFound}</p>
          </div>
        ) : (
          patients.map((patient) => {
            const currentId = patient.id || patient._id || '';
            const patientName = patient.fullName || patient.name || 'Unknown';
            const displayPhone = patient.phone || patient.phoneNumber || 'N/A';
            const visitCount = visitCountByPatientId[currentId] || 0;

            return (
              <button
                key={currentId}
                onClick={() => onPick(patient)}
                className="w-full text-left p-3.5 rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50/20 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-bold text-gray-900 group-hover:text-teal-700 transition-colors block">
                      {patientName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {patient.gender || 'N/A'} • {patient.age ?? '0'} yrs • {displayPhone}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                      visitCount > 0
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                    }`}
                  >
                    <ClipboardCheck className="h-3 w-3" />
                    {visitCount}
                  </span>
                  <ChevronRight className="h-4.5 w-4.5 text-gray-300 group-hover:text-teal-500 transition-colors" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function BlogList({
  t, isNe, patient, records, isLoading, fetchError, onRetry, formatDate, onOpenBlog, onCreateNew,
}: {
  t: any; isNe: boolean; patient: Patient; records: EMRRecord[]; isLoading: boolean; fetchError: string;
  onRetry: () => void; formatDate: (d?: string) => string; onOpenBlog: (r: EMRRecord) => void; onCreateNew: () => void;
}) {
  const patientName = patient.fullName || patient.name || 'Unknown';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-6">
      {/* Patient header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 border border-teal-100">
            <User className="h-8 w-8" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">{patientName}</h3>
            <div className="flex gap-2 items-center text-xs text-gray-500 flex-wrap">
              <span>{patient.gender || 'N/A'} • {patient.age ?? '0'} yrs</span>
              <span>•</span>
              <span>{patient.phone || patient.phoneNumber || 'N/A'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          {t.newVisit}
        </button>
      </div>

      {/* Visit blog list — loaded from the database (GET /api/emr) */}
      {isLoading ? (
        <div className="text-center py-14 text-gray-400 text-xs">{t.loading}</div>
      ) : fetchError ? (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700 space-y-2">
          <p className="font-bold flex items-center gap-1.5">
            <AlertOctagon className="h-4 w-4" />
            {t.couldNotLoad}
          </p>
          <p>{fetchError}</p>
          <button
            onClick={onRetry}
            className="py-1 px-2.5 bg-red-100 hover:bg-red-200 text-red-900 font-bold rounded text-[10px] uppercase tracking-wider transition-colors border border-red-300"
          >
            {t.retry}
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-14 space-y-3">
          <Stethoscope className="h-12 w-12 mx-auto stroke-1 text-gray-300" />
          <div className="space-y-1 max-w-xs mx-auto">
            <p className="text-sm font-bold text-gray-800">{t.noVisitsYet}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{t.noVisitsDesc}</p>
          </div>
          <button
            onClick={onCreateNew}
            className="mt-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg transition-colors shadow-xs inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t.addRecord}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {records.length} {records.length === 1 ? t.visitCount : t.visitsCount}
          </p>
          {records.map((record, idx) => {
            const rid = record.id || record._id || idx;
            const isFirst = idx === records.length - 1; // oldest = first visit
            return (
              <button
                key={rid}
                onClick={() => onOpenBlog(record)}
                className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50/20 transition-all group flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0 mt-0.5">
                    <Stethoscope className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 group-hover:text-teal-700 transition-colors text-sm">
                        {record.diagnosis || record.chiefComplaint || (isNe ? 'भ्रमण रेकर्ड' : 'Visit record')}
                      </span>
                      {isFirst && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[10px] font-bold uppercase tracking-wider">
                          {t.firstVisit}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate max-w-[380px]">{record.chiefComplaint}</p>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(record.visitDate)}
                      {record.doctorName ? ` • ${record.doctorName}` : ''}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-gray-300 group-hover:text-teal-500 transition-colors shrink-0 mt-2" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecordDetail({
  t, record, patient, isDeleting, formatDate, onBack, onEdit, onDelete,
}: {
  t: any; record: EMRRecord; patient: Patient; isDeleting: boolean; formatDate: (d?: string) => string;
  onBack: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const patientName = patient.fullName || patient.name || 'Unknown';

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-5 gap-4">
          <div className="space-y-2">
            <button
              onClick={onBack}
              className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t.back}
            </button>
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
              {record.diagnosis || record.chiefComplaint}
            </h3>
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <User className="h-4 w-4 text-gray-400" />
              {patientName}
              <span>•</span>
              <Calendar className="h-4 w-4 text-gray-400" />
              {formatDate(record.visitDate)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onEdit} disabled={isDeleting} className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-bold text-sm uppercase rounded-lg border border-gray-200 disabled:opacity-50 flex items-center gap-1.5">
              <Pencil className="h-4 w-4" /> {t.edit}
            </button>
            <button onClick={onDelete} disabled={isDeleting} className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 font-bold text-sm uppercase rounded-lg border border-red-200 disabled:opacity-50 flex items-center gap-1.5">
              <Trash2 className="h-4 w-4" /> {isDeleting ? '...' : t.delete}
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex flex-col gap-6 text-sm">
          {/* Complaint & Diagnosis */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.chiefComplaint}</span>
              <p className="font-semibold text-gray-800 text-base">{record.chiefComplaint || 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.diagnosis}</span>
              <p className="font-semibold text-gray-800 text-base">{record.diagnosis || 'N/A'}</p>
            </div>
          </div>

          {/* Symptoms */}
          {record.symptoms?.length > 0 && (
            <div className="p-4 bg-amber-50/40 rounded-lg border border-amber-100 space-y-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">{t.symptoms}</span>
              <div className="flex flex-wrap gap-2">
                {record.symptoms.map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-white text-amber-700 border border-amber-200 rounded text-sm font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Vitals */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">{t.vitals}</span>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <VitalItem label={t.bp} value={record.vitals?.bp} />
              <VitalItem label={t.temp} value={record.vitals?.temp} />
              <VitalItem label={t.pulse} value={record.vitals?.pulse} />
              <VitalItem label={t.weight} value={record.vitals?.weight} />
              <VitalItem label={t.spo2} value={record.vitals?.spo2} />
            </div>
          </div>

          {/* Prescription */}
          {record.prescription && (
            <div className="p-4 bg-teal-50/30 rounded-lg border border-teal-100 space-y-1">
              <span className="text-xs font-bold text-teal-600 uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="h-4 w-4" /> {t.prescription}
              </span>
              <p className="text-gray-800 whitespace-pre-wrap text-base">{record.prescription}</p>
            </div>
          )}

          {/* Lab Tests */}
          {record.labTests?.length > 0 && (
            <div className="p-4 bg-indigo-50/30 rounded-lg border border-indigo-100 space-y-2">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4" /> {t.labTests}
              </span>
              <div className="flex flex-wrap gap-2">
                {record.labTests.map((l, i) => (
                  <span key={i} className="px-3 py-1 bg-white text-indigo-700 border border-indigo-200 rounded text-sm font-medium">{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes & Doctor Info */}
          {record.notes && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.notes}</span>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{record.notes}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.doctor}</span>
              <p className="font-semibold text-gray-800">{record.doctorName || 'N/A'}</p>
            </div>
            {record.followUpDate && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.followUp}</span>
                <p className="font-semibold text-gray-800">{formatDate(record.followUpDate)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VitalItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value || '—'}</p>
    </div>
  );
}

function RecordForm(props: any) {
  const {
    t, isNe, patient, isEdit, isSubmitting,
    visitDate, setVisitDate, chiefComplaint, setChiefComplaint, diagnosis, setDiagnosis,
    symptomInput, setSymptomInput, symptoms, onAddSymptom, onRemoveSymptom,
    bp, setBp, temp, setTemp, pulse, setPulse, weightVital, setWeightVital, spo2, setSpo2,
    prescription, setPrescription, labInput, setLabInput, labTests, onAddLabTest, onRemoveLabTest,
    notes, setNotes, followUpDate, setFollowUpDate, doctorName, setDoctorName,
    onSubmit, onCancel,
  } = props;

  const patientName = patient.fullName || patient.name || 'Unknown';

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-6">
      <div className="border-b border-gray-100 pb-4">
        <h3 className="text-lg font-bold text-gray-900 tracking-tight">
          {isEdit ? (isNe ? 'रेकर्ड सम्पादन गर्नुहोस्' : 'Edit Visit Record') : t.addRecord}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {isEdit ? t.editingFor : t.creatingFor} <span className="font-semibold text-gray-700">{patientName}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
            {t.visitDate} <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t.doctor}</label>
          <input
            type="text"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="e.g. Dr. Sharma"
            className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
            {t.chiefComplaint} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="e.g. Fever and cough for 3 days"
            className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t.diagnosis}</label>
          <input
            type="text"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Acute Bronchitis"
            className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Symptoms tags */}
        <div className="space-y-2 sm:col-span-2 border-t border-gray-100 pt-4">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">{t.symptoms}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={symptomInput}
              onChange={(e) => setSymptomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddSymptom(); } }}
              placeholder="e.g. Fever, Headache"
              className="flex-1 px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white"
            />
            <button type="button" onClick={onAddSymptom} className="px-4 py-1.5 bg-gray-100 text-gray-800 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors border border-gray-200">
              {t.add}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {symptoms.map((tag: string, index: number) => (
              <span key={index} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold">
                {tag}
                <button type="button" onClick={() => onRemoveSymptom(index)} className="hover:bg-amber-200 text-amber-900 rounded-full h-4.5 w-4.5 flex items-center justify-center font-bold text-[10px]">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Vitals */}
        <div className="sm:col-span-2 border-t border-gray-100 pt-4 space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">{t.vitals}</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <input type="text" value={bp} onChange={(e) => setBp(e.target.value)} placeholder={t.bp} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white" />
            <input type="text" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder={t.temp} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white" />
            <input type="text" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder={t.pulse} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white" />
            <input type="text" value={weightVital} onChange={(e) => setWeightVital(e.target.value)} placeholder={t.weight} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white" />
            <input type="text" value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder={t.spo2} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white" />
          </div>
        </div>

        <div className="space-y-1.5 sm:col-span-2 border-t border-gray-100 pt-4">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5 text-gray-400" />
            {t.prescription}
          </label>
          <textarea
            value={prescription}
            onChange={(e) => setPrescription(e.target.value)}
            rows={3}
            placeholder="e.g. Paracetamol 500mg — 1 tab TDS x 3 days"
            className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors resize-none"
          />
        </div>

        {/* Lab tests tags */}
        <div className="space-y-2 sm:col-span-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-gray-400" />
            {t.labTests}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={labInput}
              onChange={(e) => setLabInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddLabTest(); } }}
              placeholder="e.g. CBC, Blood Sugar"
              className="flex-1 px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white"
            />
            <button type="button" onClick={onAddLabTest} className="px-4 py-1.5 bg-gray-100 text-gray-800 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors border border-gray-200">
              {t.add}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {labTests.map((tag: string, index: number) => (
              <span key={index} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold">
                {tag}
                <button type="button" onClick={() => onRemoveLabTest(index)} className="hover:bg-indigo-200 text-indigo-900 rounded-full h-4.5 w-4.5 flex items-center justify-center font-bold text-[10px]">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t.notes}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={isNe ? 'थप टिप्पणी...' : 'Any additional observations...'}
            className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors resize-none"
          />
        </div>

        <div className="space-y-1.5 border-t border-gray-100 pt-4">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t.followUp}</label>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 transition-colors"
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          disabled={!chiefComplaint.trim() || !visitDate || isSubmitting}
          className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors shadow-xs"
        >
          {isSubmitting ? (isEdit ? 'Updating...' : 'Saving...') : (isEdit ? t.update : t.save)}
        </button>
      </div>
    </form>
  );
}           