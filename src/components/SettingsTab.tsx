/**
 * SettingsTab — G and A Pods Manager
 * Sections:
 *   1. QR Codes  — upload GCash & Maya QR images to the payment-qr bucket
 *   2. Peak Seasons — CRUD for the peak_seasons table
 */

import { useState, useEffect, useRef, ChangeEvent, RefObject, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  QrCode, Upload, Calendar, Plus, Pencil, Trash2, X,
  Loader2, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PeakSeason {
  id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  payment_rule: 'standard' | 'deposit_only' | 'full_upfront';
  cancellation_rule: 'standard' | 'strict' | 'no_refund';
  rate_adjustment_pct: number | null;
  fixed_rate_override: number | null;
  hold_hours_override: number | null;
  is_active: boolean;
  created_at: string;
}

type QrType = 'gcash' | 'maya';

const PAYMENT_RULE_LABELS: Record<string, string> = {
  standard:     'Standard (deposit or full)',
  deposit_only: 'Deposit only',
  full_upfront: 'Full payment upfront',
};

const CANCEL_RULE_LABELS: Record<string, string> = {
  standard:  'Standard',
  strict:    'Strict',
  no_refund: 'No refund',
};

const emptyForm = (): Omit<PeakSeason, 'id' | 'created_at'> => ({
  season_name: '',
  start_date: '',
  end_date: '',
  payment_rule: 'full_upfront',
  cancellation_rule: 'strict',
  rate_adjustment_pct: null,
  fixed_rate_override: null,
  hold_hours_override: null,
  is_active: true,
});

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SettingsTab() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-label uppercase tracking-[0.2em] text-outline mb-1">Configuration</p>
        <h2 className="text-3xl font-bold font-headline tracking-tight">Settings</h2>
      </div>

      <QrCodesSection />
      <PeakSeasonsSection />
    </div>
  );
}

// ── QR Codes Section ──────────────────────────────────────────────────────────

function QrCodesSection() {
  const [gcashPath, setGcashPath]     = useState<string | null>(null);
  const [mayaPath, setMayaPath]       = useState<string | null>(null);
  const [uploading, setUploading]     = useState<QrType | null>(null);
  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const gcashRef = useRef<HTMLInputElement>(null);
  const mayaRef  = useRef<HTMLInputElement>(null);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // Load current QR paths from settings
  useEffect(() => {
    supabase
      .from('settings')
      .select('key, value')
      .in('key', ['gcash_qr_path', 'maya_qr_path'])
      .then(({ data }) => {
        if (!data) return;
        for (const row of data) {
          if (row.key === 'gcash_qr_path') setGcashPath(row.value || null);
          if (row.key === 'maya_qr_path')  setMayaPath(row.value || null);
        }
      });
  }, []);

  function getPublicUrl(path: string | null) {
    if (!path) return null;
    const { data } = supabase.storage.from('payment-qr').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleUpload(type: QrType, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(type);
    try {
      const ext  = file.name.split('.').pop() ?? 'png';
      const path = `${type}-qr.${ext}`;

      // Upsert — overwrite existing file if present
      const { error: uploadError } = await supabase.storage
        .from('payment-qr')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Save path to settings
      const settingsKey = type === 'gcash' ? 'gcash_qr_path' : 'maya_qr_path';
      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({ key: settingsKey, value: path }, { onConflict: 'key' });

      if (settingsError) throw settingsError;

      if (type === 'gcash') setGcashPath(path);
      else                  setMayaPath(path);

      showToast('success', `${type === 'gcash' ? 'GCash' : 'Maya'} QR updated.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      showToast('error', msg);
    } finally {
      setUploading(null);
      // Reset input so same file can be re-uploaded
      if (type === 'gcash' && gcashRef.current) gcashRef.current.value = '';
      if (type === 'maya'  && mayaRef.current)  mayaRef.current.value  = '';
    }
  }

  const qrs: { type: QrType; label: string; color: string; path: string | null; ref: RefObject<HTMLInputElement> }[] = [
    { type: 'gcash', label: 'GCash',  color: 'from-blue-600 to-blue-400',   path: gcashPath, ref: gcashRef },
    { type: 'maya',  label: 'Maya',   color: 'from-violet-600 to-violet-400', path: mayaPath,  ref: mayaRef  },
  ];

  return (
    <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/35 shadow-card overflow-hidden">
      <div className="px-6 py-5 border-b border-outline-variant/30 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <QrCode size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-on-surface font-headline">Payment QR Codes</h3>
          <p className="text-xs text-outline mt-0.5">Shown to guests during the booking payment step</p>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {qrs.map(({ type, label, color, path, ref }) => {
          const publicUrl = getPublicUrl(path);
          const isLoading = uploading === type;

          return (
            <div key={type} className="flex flex-col gap-3">
              <p className="font-semibold text-sm text-on-surface">{label} QR</p>

              {/* Preview */}
              <div className="relative w-full aspect-square max-w-[200px] mx-auto rounded-2xl overflow-hidden border border-outline-variant/40 bg-surface-container-low flex items-center justify-center">
                {publicUrl ? (
                  <img
                    src={`${publicUrl}?t=${Date.now()}`}
                    alt={`${label} QR code`}
                    className="w-full h-full object-contain p-3"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${color} flex flex-col items-center justify-center gap-2 opacity-25`}>
                    <QrCode size={48} className="text-white" />
                    <span className="text-white text-xs font-medium">No QR yet</span>
                  </div>
                )}
                {isLoading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
                    <Loader2 className="text-white animate-spin" size={28} />
                  </div>
                )}
              </div>

              {/* Upload button */}
              <input
                ref={ref}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload(type, e)}
              />
              <button
                onClick={() => ref.current?.click()}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/18 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <><Loader2 size={15} className="animate-spin" /> Uploading…</>
                ) : (
                  <><Upload size={15} /> {path ? 'Replace QR' : 'Upload QR'}</>
                )}
              </button>
              {path && (
                <p className="text-[10px] text-outline text-center truncate font-mono">{path}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="qr-toast"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={`mx-6 mb-5 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {toast.type === 'success'
              ? <CheckCircle2 size={16} />
              : <AlertCircle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ── Peak Seasons Section ──────────────────────────────────────────────────────

function PeakSeasonsSection() {
  const [seasons, setSeasons]         = useState<PeakSeason[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState<PeakSeason | null>(null);
  const [form, setForm]               = useState(emptyForm());
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [expanded, setExpanded]       = useState<string | null>(null);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('peak_seasons')
      .select('*')
      .order('start_date', { ascending: true });
    setLoading(false);
    if (error) { showToast('error', error.message); return; }
    setSeasons(data ?? []);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(s: PeakSeason) {
    setEditing(s);
    setForm({
      season_name:         s.season_name,
      start_date:          s.start_date,
      end_date:            s.end_date,
      payment_rule:        s.payment_rule,
      cancellation_rule:   s.cancellation_rule,
      rate_adjustment_pct: s.rate_adjustment_pct,
      fixed_rate_override: s.fixed_rate_override,
      hold_hours_override: s.hold_hours_override,
      is_active:           s.is_active,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm());
  }

  function setField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.season_name.trim() || !form.start_date || !form.end_date) {
      showToast('error', 'Season name, start date, and end date are required.');
      return;
    }
    if (form.start_date >= form.end_date) {
      showToast('error', 'End date must be after start date.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        season_name:         form.season_name.trim(),
        start_date:          form.start_date,
        end_date:            form.end_date,
        payment_rule:        form.payment_rule,
        cancellation_rule:   form.cancellation_rule,
        rate_adjustment_pct: form.rate_adjustment_pct,
        fixed_rate_override: form.fixed_rate_override,
        hold_hours_override: form.hold_hours_override,
        is_active:           form.is_active,
      };

      if (editing) {
        const { error } = await supabase
          .from('peak_seasons')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editing.id);
        if (error) throw error;
        showToast('success', 'Peak season updated.');
      } else {
        const { error } = await supabase
          .from('peak_seasons')
          .insert(payload);
        if (error) throw error;
        showToast('success', 'Peak season created.');
      }

      closeForm();
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const { error } = await supabase.from('peak_seasons').delete().eq('id', id);
      if (error) throw error;
      showToast('success', 'Peak season deleted.');
      setSeasons(s => s.filter(x => x.id !== id));
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  async function toggleActive(s: PeakSeason) {
    const { error } = await supabase
      .from('peak_seasons')
      .update({ is_active: !s.is_active, updated_at: new Date().toISOString() })
      .eq('id', s.id);
    if (error) { showToast('error', error.message); return; }
    setSeasons(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x));
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isUpcoming(s: PeakSeason) {
    const today = new Date().toISOString().split('T')[0];
    return s.end_date >= today;
  }

  return (
    <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/35 shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-outline-variant/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Calendar size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-on-surface font-headline">Peak Seasons</h3>
            <p className="text-xs text-outline mt-0.5">Define high-demand periods with custom pricing and payment rules</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus size={15} /> Add Season
        </button>
      </div>

      {/* Season list */}
      <div className="divide-y divide-outline-variant/20">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 rounded-xl bg-surface-container-low animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : seasons.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar size={32} className="text-outline/40 mx-auto mb-3" />
            <p className="text-outline text-sm italic">No peak seasons defined yet</p>
            <p className="text-outline/60 text-xs mt-1">Add your first season to start applying peak rates and rules</p>
          </div>
        ) : (
          seasons.map(s => {
            const upcoming = isUpcoming(s);
            const isExpanded = expanded === s.id;

            return (
              <div key={s.id} className={`px-6 py-4 ${!s.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  {/* Active toggle */}
                  <button
                    onClick={() => toggleActive(s)}
                    className="mt-0.5 text-outline hover:text-primary transition-colors shrink-0"
                    title={s.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {s.is_active
                      ? <ToggleRight size={22} className="text-primary" />
                      : <ToggleLeft  size={22} />
                    }
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-on-surface font-body">{s.season_name}</span>
                      {!upcoming && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-label">Past</span>
                      )}
                      {s.is_active && upcoming && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-label">Active</span>
                      )}
                    </div>
                    <p className="text-xs text-outline mt-1">
                      {formatDate(s.start_date)} — {formatDate(s.end_date)}
                    </p>

                    {/* Expand / collapse details */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : s.id)}
                      className="mt-1 flex items-center gap-1 text-[11px] text-primary font-semibold"
                    >
                      {isExpanded ? <><ChevronUp size={13} /> Hide details</> : <><ChevronDown size={13} /> Show details</>}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                            <DetailRow label="Payment rule"   value={PAYMENT_RULE_LABELS[s.payment_rule]} />
                            <DetailRow label="Cancellation"   value={CANCEL_RULE_LABELS[s.cancellation_rule]} />
                            {s.rate_adjustment_pct != null && (
                              <DetailRow label="Rate adjustment" value={`+${s.rate_adjustment_pct}%`} />
                            )}
                            {s.fixed_rate_override != null && (
                              <DetailRow label="Fixed rate"   value={`₱${s.fixed_rate_override.toLocaleString()}/night`} />
                            )}
                            {s.hold_hours_override != null && (
                              <DetailRow label="Hold window"  value={`${s.hold_hours_override} hours`} />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-2 rounded-lg text-outline hover:text-primary hover:bg-primary/8 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      className="p-2 rounded-lg text-outline hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deleting === s.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Trash2 size={15} />
                      }
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="ps-toast"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={`mx-6 mb-5 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {toast.type === 'success'
              ? <CheckCircle2 size={16} />
              : <AlertCircle  size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="ps-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) closeForm(); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant/30">
                <h4 className="font-bold text-lg font-headline">
                  {editing ? 'Edit Peak Season' : 'Add Peak Season'}
                </h4>
                <button
                  onClick={closeForm}
                  className="p-2 rounded-full text-outline hover:bg-surface-container-low transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form body */}
              <div className="px-6 py-5 space-y-5">
                {/* Season name */}
                <FormField label="Season name *">
                  <input
                    type="text"
                    value={form.season_name}
                    onChange={e => setField('season_name', e.target.value)}
                    placeholder="e.g. Holy Week 2026"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </FormField>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Start date *">
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={e => setField('start_date', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                  </FormField>
                  <FormField label="End date *">
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={e => setField('end_date', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                  </FormField>
                </div>

                {/* Payment rule */}
                <FormField label="Payment rule">
                  <select
                    value={form.payment_rule}
                    onChange={e => setField('payment_rule', e.target.value as typeof form.payment_rule)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="standard">Standard (deposit or full)</option>
                    <option value="deposit_only">Deposit only</option>
                    <option value="full_upfront">Full payment upfront</option>
                  </select>
                </FormField>

                {/* Cancellation rule */}
                <FormField label="Cancellation rule">
                  <select
                    value={form.cancellation_rule}
                    onChange={e => setField('cancellation_rule', e.target.value as typeof form.cancellation_rule)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="standard">Standard</option>
                    <option value="strict">Strict</option>
                    <option value="no_refund">No refund</option>
                  </select>
                </FormField>

                {/* Rate adjustment */}
                <FormField label="Rate adjustment %" hint="e.g. 20 adds 20% to base price. Leave blank for no change.">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={0.5}
                    value={form.rate_adjustment_pct ?? ''}
                    onChange={e => setField('rate_adjustment_pct', e.target.value === '' ? null : parseFloat(e.target.value))}
                    placeholder="e.g. 20"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </FormField>

                {/* Fixed rate override */}
                <FormField label="Fixed rate override (₱/night)" hint="If set, overrides percentage adjustment. Leave blank to use percentage.">
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={form.fixed_rate_override ?? ''}
                    onChange={e => setField('fixed_rate_override', e.target.value === '' ? null : parseFloat(e.target.value))}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </FormField>

                {/* Hold hours override */}
                <FormField label="Hold window override (hours)" hint="How long guests have to pay. Default is 4 hours during peak. Leave blank for default.">
                  <input
                    type="number"
                    min={1}
                    max={72}
                    step={1}
                    value={form.hold_hours_override ?? ''}
                    onChange={e => setField('hold_hours_override', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                    placeholder="e.g. 4"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </FormField>

                {/* Active toggle */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Active</p>
                    <p className="text-xs text-outline">Inactive seasons won't affect booking rules</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setField('is_active', !form.is_active)}
                    className="transition-colors"
                  >
                    {form.is_active
                      ? <ToggleRight size={26} className="text-primary" />
                      : <ToggleLeft  size={26} className="text-outline" />
                    }
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={closeForm}
                  className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container-low transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving
                    ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                    : editing ? 'Save Changes' : 'Create Season'
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-on-surface">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-outline leading-snug">{hint}</p>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-outline">{label}: </span>
      <span className="font-medium text-on-surface">{value}</span>
    </div>
  );
}
