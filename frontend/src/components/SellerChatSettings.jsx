import React, { useEffect, useState } from 'react';
import { Save, Trash2, Loader2, Plus, X, Edit3, Clock, MessageCircle, Zap } from 'lucide-react';
import BaseModal, { ModalBody } from './modals/BaseModal';
import {
  fetchSellerAutoReply,
  saveSellerAutoReply,
  deleteSellerAutoReply,
  fetchSellerTemplates,
  createSellerTemplate,
  updateSellerTemplateApi,
  deleteSellerTemplateApi
} from '../queries/orderChatApi';

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const SellerAutoReplyPanel = () => {
  const [autoReply, setAutoReply] = useState(null);
  const [message, setMessage] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState([]);
  const [startHour, setStartHour] = useState('');
  const [endHour, setEndHour] = useState('');
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchSellerAutoReply()
      .then((reply) => {
        if (reply) {
          setAutoReply(reply);
          setMessage(reply.message || '');
          setIsActive(reply.isActive !== false);
          setScheduleEnabled(reply.schedule?.enabled || false);
          setDaysOfWeek(reply.schedule?.daysOfWeek || []);
          setStartHour(reply.schedule?.startHour != null ? String(reply.schedule.startHour) : '');
          setEndHour(reply.schedule?.endHour != null ? String(reply.schedule.endHour) : '');
          setCooldownMinutes(reply.cooldownMinutes || 30);
        }
      })
      .catch(() => setError('Impossible de charger la réponse automatique.'))
      .finally(() => setLoading(false));
  }, []);

  const toggleDay = (day) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!message.trim()) {
      setError('Le message est requis.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const schedule = scheduleEnabled
        ? {
            enabled: true,
            daysOfWeek,
            startHour: startHour !== '' ? Number(startHour) : null,
            endHour: endHour !== '' ? Number(endHour) : null
          }
        : { enabled: false, daysOfWeek: [], startHour: null, endHour: null };

      const reply = await saveSellerAutoReply({
        message: message.trim(),
        isActive,
        schedule,
        cooldownMinutes
      });
      setAutoReply(reply);
      setSuccess('Réponse automatique enregistrée.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!autoReply) return;
    setDeleting(true);
    setError('');
    try {
      await deleteSellerAutoReply();
      setAutoReply(null);
      setMessage('');
      setIsActive(true);
      setScheduleEnabled(false);
      setDaysOfWeek([]);
      setStartHour('');
      setEndHour('');
      setCooldownMinutes(30);
      setSuccess('Réponse automatique supprimée.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#e85d00]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-[#e85d00]" />
          <h3 className="text-sm font-black text-slate-950 dark:text-white">Réponse automatique</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#e85d00]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#e85d00]" />
        </label>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message envoyé automatiquement aux acheteurs..."
        rows={3}
        maxLength={500}
        disabled={!isActive}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-slate-950 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#e85d00]/30 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
      />

      {/* Schedule */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
            disabled={!isActive}
            className="rounded"
          />
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 dark:text-gray-400">
            Planifier (optionnel)
          </span>
        </label>

        {scheduleEnabled && (
          <div className="space-y-3 pl-6">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">Jours</p>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
                      daysOfWeek.includes(day)
                        ? 'bg-[#e85d00] text-white'
                        : 'bg-gray-100 text-slate-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500">De</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  placeholder="8"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold dark:border-neutral-800 dark:bg-neutral-900"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500">À</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  placeholder="18"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold dark:border-neutral-800 dark:bg-neutral-900"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cooldown */}
      <div>
        <label className="text-xs font-semibold text-slate-500">
          Délai entre deux réponses: {cooldownMinutes} min
        </label>
        <input
          type="range"
          min={5}
          max={120}
          value={cooldownMinutes}
          onChange={(e) => setCooldownMinutes(Number(e.target.value))}
          disabled={!isActive}
          className="w-full accent-[#e85d00]"
        />
      </div>

      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
      {success && <p className="text-xs font-semibold text-emerald-600">{success}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !message.trim()}
          className="flex items-center gap-1.5 rounded-full bg-[#e85d00] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#f45f00] disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
        {autoReply && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Templates Manager ────────────────────────────────────────────────────────

const SellerTemplatesManager = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadTemplates = () => {
    setLoading(true);
    fetchSellerTemplates()
      .then(setTemplates)
      .catch(() => setError('Impossible de charger les templates.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleAdd = async () => {
    if (!label.trim() || !message.trim()) {
      setError('Le libellé et le message sont requis.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createSellerTemplate({ label: label.trim(), message: message.trim() });
      setLabel('');
      setMessage('');
      setAdding(false);
      loadTemplates();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (templateId) => {
    if (!editLabel.trim() || !editMessage.trim()) {
      setError('Le libellé et le message sont requis.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateSellerTemplateApi(templateId, {
        label: editLabel.trim(),
        message: editMessage.trim()
      });
      setEditingId(null);
      loadTemplates();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la modification.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId) => {
    try {
      await deleteSellerTemplateApi(templateId);
      loadTemplates();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression.');
    }
  };

  const startEdit = (template) => {
    setEditingId(template._id);
    setEditLabel(template.label);
    setEditMessage(template.message);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#e85d00]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-[#e85d00]" />
        <h3 className="text-sm font-black text-slate-950 dark:text-white">Templates de messages</h3>
      </div>

      {templates.map((template) => (
        <div
          key={template._id}
          className="rounded-xl border border-gray-200 p-3 dark:border-neutral-800"
        >
          {editingId === template._id ? (
            <div className="space-y-2">
              <input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Libellé du bouton"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
              <textarea
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                placeholder="Message complet"
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-neutral-800 dark:bg-neutral-900 dark:text-white resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdate(template._id)}
                  disabled={saving}
                  className="rounded-full bg-[#e85d00] px-3 py-1.5 text-xs font-black text-white hover:bg-[#f45f00] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-gray-300"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-950 dark:text-white">{template.label}</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500 line-clamp-2 dark:text-gray-400">
                  {template.message}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(template)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-gray-100 hover:text-[#e85d00] dark:hover:bg-neutral-800"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(template._id)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="rounded-xl border border-[#e85d00]/20 bg-orange-50/50 p-3 dark:bg-orange-900/10">
          <div className="space-y-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Libellé du bouton"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message complet"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-neutral-800 dark:bg-neutral-900 dark:text-white resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving}
                className="rounded-full bg-[#e85d00] px-3 py-1.5 text-xs font-black text-white hover:bg-[#f45f00] disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Ajouter'}
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setLabel(''); setMessage(''); }}
                className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-gray-300"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-black text-slate-500 transition-colors hover:border-[#e85d00] hover:text-[#e85d00] dark:border-neutral-700 dark:text-gray-400"
        >
          <Plus className="w-4 h-4" />
          Nouveau template
        </button>
      )}

      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
    </div>
  );
};

// ─── Combined Modal ───────────────────────────────────────────────────────────

export default function SellerChatSettings({ isOpen, onClose }) {
  const [tab, setTab] = useState('auto-reply');

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      panelClassName="w-full sm:max-w-lg bg-white dark:bg-neutral-950 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-neutral-800"
      rootClassName="z-[140] p-4 sm:p-6"
      ariaLabel="Paramètres de messagerie"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-neutral-800">
        <h2 className="text-base font-black text-slate-950 dark:text-white">
          Messagerie automatique
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-neutral-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex border-b border-gray-200 px-5 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setTab('auto-reply')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            tab === 'auto-reply'
              ? 'border-[#e85d00] text-[#e85d00]'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400'
          }`}
        >
          Réponse auto
        </button>
        <button
          type="button"
          onClick={() => setTab('templates')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            tab === 'templates'
              ? 'border-[#e85d00] text-[#e85d00]'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400'
          }`}
        >
          Templates
        </button>
      </div>

      <ModalBody className="px-5 py-4">
        {tab === 'auto-reply' ? <SellerAutoReplyPanel /> : <SellerTemplatesManager />}
      </ModalBody>
    </BaseModal>
  );
}
