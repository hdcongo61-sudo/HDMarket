import React, { useState } from 'react';
import api from '../services/api';

export default function ProductForm({ onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', price: '', category: '' });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      files.forEach((f) => data.append('images', f));
      const res = await api.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      onCreated?.(res.data);
      setForm({ title: '', description: '', price: '', category: '' });
      setFiles([]);
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input className="w-full border p-2" placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea className="w-full border p-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <input className="w-full border p-2" placeholder="Catégorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
      <input type="number" className="w-full border p-2" placeholder="Prix (FCFA)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
      <input type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
      <button disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded">{loading ? "Envoi..." : "Créer l'annonce"}</button>
    </form>
  );
}
