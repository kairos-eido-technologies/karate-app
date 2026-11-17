import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Shield,
  CreditCard,
  Award,
  Users,
  Eye,
  Database,
  Upload,
  Download,
  Trash2,
  Plus,
  X,
  KeyRound,
} from 'lucide-react';
import { db } from '@/lib/db/db';
import { inr } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { BeltBadge } from '@/components/BeltBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { toast } from 'sonner';
import type { Settings, BeltLevel, User } from '@/lib/db/types';

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const [, setTick] = useState(0);

  // Settings form state
  const [academyName, setAcademyName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [monthlyFeeDefault, setMonthlyFeeDefault] = useState(1500);
  const [feeDueDay, setFeeDueDay] = useState(1);
  const [lateFee, setLateFee] = useState(100);
  const [autoGenFees, setAutoGenFees] = useState(true);

  // Display state
  const [fontSize, setFontSize] = useState(15);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Users modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);

  useEffect(() => {
    const s = db.getSettings();
    if (s) {
      setAcademyName(s.academy_name || 'Dojo Master Academy');
      setAddress(s.address || '');
      setPhone(s.phone || '');
      setWhatsappNumber(s.whatsapp_number || '');
      setMonthlyFeeDefault(s.monthly_fee_default || 1500);
      setFeeDueDay(s.fee_due_day || 1);
    }
    return db.subscribe(() => setTick((t) => t + 1));
  }, []);

  const beltLevels = db.getBeltLevels();
  const store = db.getStore();
  const users = store.users || [];

  // Save Academy Profile & Fee Config
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.push([
        {
          type: 'UPDATE_SETTINGS',
          payload: {
            academy_name: academyName.trim() || 'Dojo Master Academy',
            address: address.trim(),
            phone: phone.trim(),
            whatsapp_number: whatsappNumber.trim(),
            monthly_fee_default: Number(monthlyFeeDefault),
            fee_due_day: Number(feeDueDay),
          },
        },
      ]);
      toast.success('Academy settings saved successfully!');
    } catch {
      toast.error('Failed to update settings.');
    }
  };

  // Zoom and font effect
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    (document.body.style as any).zoom = `${zoomLevel}%`;
  }, [fontSize, zoomLevel]);

  // Export JSON backup
  const handleExportBackup = () => {
    try {
      db.exportBackup();
      toast.success('Database backup exported to JSON!');
    } catch {
      toast.error('Failed to export backup');
    }
  };

  // Import JSON backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        toast.info('Restoring backup data...');
        const res = await db.importBackup(text);
        toast.success(
          `Backup restored! Loaded ${res.studentsCount} students, ${res.attendanceCount} attendance records, and ${res.feesCount} fee records.`
        );
      } catch (err: any) {
        toast.error(err.message || 'Failed to restore backup');
      }
    };
    reader.readAsText(file);
  };

  // Reset database confirm
  const handleResetDatabase = async () => {
    try {
      await db.resetDatabase();
      setIsResetConfirmOpen(false);
      toast.success('Database reset to clean state.');
    } catch {
      toast.error('Failed to reset database.');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in pb-16">
      <PageHeader
        title="Academy Settings"
        subtitle="Manage dojo profile, default tuition fees, belt syllabus, and system access"
      />

      {/* 1. Academy Profile */}
      <div className="bg-white rounded-2xl border p-6 shadow-2xs space-y-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary)', color: '#FFFFFF' }}>
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-stone-900">Academy Profile</h3>
            <p className="text-xs text-stone-500">Official karate academy details appearing on receipts and WhatsApp</p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-bold text-stone-700 mb-1">Academy Name *</label>
              <input
                type="text"
                required
                value={academyName}
                onChange={(e) => setAcademyName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border text-sm font-semibold"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-stone-700 mb-1">Dojo Address / Location</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Karate Street, Sports Complex"
                className="w-full h-10 px-3 rounded-xl border text-xs"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full h-10 px-3 rounded-xl border text-xs font-mono"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">WhatsApp Official Number</label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="919876543210"
                className="w-full h-10 px-3 rounded-xl border text-xs font-mono"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="h-10 px-5 rounded-xl text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition active:scale-95 shadow-xs"
              style={{ background: 'var(--primary)' }}
            >
              <Save className="h-4 w-4" />
              Save Academy Profile
            </button>
          </div>
        </form>
      </div>

      {/* 2. Fee Configuration */}
      <div className="bg-white rounded-2xl border p-6 shadow-2xs space-y-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-500 text-white">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-stone-900">Fee Configuration</h3>
            <p className="text-xs text-stone-500">Set tuition fee schedules and auto-generation defaults</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-stone-700 mb-1">Default Monthly Fee (₹)</label>
            <input
              type="number"
              value={monthlyFeeDefault}
              onChange={(e) => setMonthlyFeeDefault(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border text-sm font-mono font-bold"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Fee Due Day of Month</label>
            <input
              type="number"
              min={1}
              max={28}
              value={feeDueDay}
              onChange={(e) => setFeeDueDay(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border text-sm font-mono font-bold"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Late Fee Charge (₹)</label>
            <input
              type="number"
              value={lateFee}
              onChange={(e) => setLateFee(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border text-sm font-mono"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoGenFees}
              onChange={(e) => setAutoGenFees(e.target.checked)}
              className="h-4 w-4 rounded-sm text-emerald-600 cursor-pointer"
            />
            <span className="text-xs font-semibold text-stone-700">
              Auto-generate monthly fee records on the 1st of each month for all active students
            </span>
          </label>
        </div>
      </div>

      {/* 3. Belt Levels Reference Table */}
      <div className="bg-white rounded-2xl border p-6 shadow-2xs space-y-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-stone-800 text-white">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-stone-900">Belt Levels Syllabus</h3>
            <p className="text-xs text-stone-500">Official ranking progression system from White to Black belt</p>
          </div>
        </div>

        <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b text-stone-500 uppercase font-bold" style={{ borderColor: 'var(--border)' }}>
              <tr>
                <th className="py-2.5 px-4 w-16">Rank</th>
                <th className="py-2.5 px-4">Belt Title</th>
                <th className="py-2.5 px-4">Preview Badge</th>
                <th className="py-2.5 px-4 text-right">Color Hex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {beltLevels.map((b) => (
                <tr key={b.id} className="hover:bg-stone-50">
                  <td className="py-2.5 px-4 font-mono font-bold text-stone-400">#{b.rank}</td>
                  <td className="py-2.5 px-4 font-bold text-stone-900">{b.name} Belt</td>
                  <td className="py-2.5 px-4"><BeltBadge beltName={b.name} /></td>
                  <td className="py-2.5 px-4 font-mono text-stone-500 text-right">{b.color_hex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Admin Users */}
      <div className="bg-white rounded-2xl border p-6 shadow-2xs space-y-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-rose-800 text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900">Admin Users</h3>
              <p className="text-xs text-stone-500">Authorized personnel who can access and manage the system</p>
            </div>
          </div>
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="h-8 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-stone-50"
            style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add User
          </button>
        </div>

        <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b text-stone-500 uppercase font-bold" style={{ borderColor: 'var(--border)' }}>
              <tr>
                <th className="py-2.5 px-4">Username</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr className="hover:bg-stone-50">
                <td className="py-2.5 px-4 font-bold text-stone-900">admin</td>
                <td className="py-2.5 px-4">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-200">
                    MASTER ADMIN
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right">
                  <button
                    onClick={() => setIsChangePinOpen(true)}
                    className="text-xs font-bold text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <KeyRound className="h-3 w-3" /> Change PIN
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Display Preferences (Zoom & Font) */}
      <div className="bg-white rounded-2xl border p-6 shadow-2xs space-y-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-stone-600 text-white">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-stone-900">Display & Zoom</h3>
            <p className="text-xs text-stone-500">Fine-tune UI scale for large monitors or compact POS screens</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <div className="flex justify-between font-bold text-stone-700 mb-2">
              <span>Font Size</span>
              <span className="font-mono text-stone-900">{fontSize}px</span>
            </div>
            <input
              type="range"
              min={13}
              max={22}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full cursor-pointer accent-[var(--primary)]"
            />
            <div className="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>13px (Compact)</span>
              <span>22px (Large)</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between font-bold text-stone-700 mb-2">
              <span>Zoom Scale</span>
              <span className="font-mono text-stone-900">{zoomLevel}%</span>
            </div>
            <input
              type="range"
              min={75}
              max={140}
              step={5}
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-full cursor-pointer accent-[var(--primary)]"
            />
            <div className="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>75%</span>
              <span>100% (Default)</span>
              <span>140%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Data Management & Backup */}
      <div className="bg-white rounded-2xl border p-6 shadow-2xs space-y-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-emerald-700 text-white">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-stone-900">Data Management & Backup</h3>
            <p className="text-xs text-stone-500">
              Offline-ready SQLite & IndexedDB storage. Export backups before uninstalling or resetting.
            </p>
          </div>
        </div>

        {/* Database Record Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] uppercase font-bold text-stone-500 block">Students</span>
            <span className="text-lg font-mono font-black text-stone-800">{store.students.length}</span>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] uppercase font-bold text-stone-500 block">Attendance</span>
            <span className="text-lg font-mono font-black text-stone-800">{store.attendance.length}</span>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] uppercase font-bold text-stone-500 block">Fee Records</span>
            <span className="text-lg font-mono font-black text-stone-800">{store.fees.length}</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Storage Engine</span>
            <span className="text-xs font-bold text-emerald-800 block mt-1">Offline-First DB</span>
          </div>
        </div>

        <p className="text-xs text-stone-500 bg-stone-50 p-3 rounded-xl border border-stone-200 leading-relaxed">
          💡 <strong>Mobile / Reset Safety Tip:</strong> Before uninstalling the app or resetting your phone, tap <strong>Export Full Database Backup</strong> and save the file to your Files, Google Drive, or WhatsApp. When reinstalling, tap <strong>Restore from Backup</strong> on the Login screen or here to restore all records instantly.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition active:scale-95 shadow-2xs text-white"
            style={{ background: 'var(--primary)' }}
          >
            <Download className="h-4 w-4" />
            Export Full Database Backup (.json)
          </button>

          <label
            className="h-10 px-4 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer hover:bg-stone-50 transition active:scale-95 border-stone-300 text-stone-800"
          >
            <Upload className="h-4 w-4 text-emerald-700" />
            Restore from JSON Backup
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>

          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="h-10 px-4 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
            Reset Database
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <ConfirmModal
          title="Reset Academy Database?"
          message="This will clear all students, attendance records, and fees from local storage. Make sure you have exported a backup file first. Are you sure you want to proceed?"
          confirmLabel="Yes, Reset Database"
          destructive
          onConfirm={handleResetDatabase}
          onCancel={() => setIsResetConfirmOpen(false)}
        />
      )}

      {/* Change PIN Modal */}
      {isChangePinOpen && (
        <ChangePinModal onClose={() => setIsChangePinOpen(false)} />
      )}
    </div>
  );
}

// Modal for changing PIN
function ChangePinModal({ onClose }: { onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return toast.error('PIN must be at least 4 digits');
    if (pin !== confirmPin) return toast.error('PINs do not match');

    db.changeAdminPin(pin);
    toast.success('Admin PIN updated successfully!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border p-6 max-w-xs w-full" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-base font-black text-stone-900 mb-4">Change Admin PIN</h3>
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-stone-700 mb-1">New PIN (4–6 digits)</label>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border text-center font-mono text-xl"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              autoFocus
            />
          </div>
          <div>
            <label className="block font-bold text-stone-700 mb-1">Confirm New PIN</label>
            <input
              type="password"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border text-center font-mono text-xl"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-xl border font-semibold text-xs"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-9 rounded-xl text-white font-bold text-xs"
              style={{ background: 'var(--primary)' }}
            >
              Update PIN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
