import React, { useState } from 'react';
import api from '../services/api';

const operatorPhones = {
  MTN: '069822930',
  Airtel: '050237023'
};

export default function ProductForm({ onCreated }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'used',
    operator: 'MTN'
  });
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
      setForm({ title: '', description: '', price: '', category: '', condition: 'used', operator: 'MTN' });
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
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={form.condition === 'new'}
          onChange={(e) => setForm({ ...form, condition: e.target.checked ? 'new' : 'used' })}
        />
        <span>{form.condition === 'new' ? 'Produit neuf' : "Produit d'occasion"}</span>
      </label>
      <select
        className="w-full border p-2"
        value={form.operator}
        onChange={(e) => setForm({ ...form, operator: e.target.value })}
      >
        <option value="MTN">MTN</option>
        <option value="Airtel">Airtel</option>
      </select>
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-gray-700">
        <p className="font-semibold text-yellow-800">Important :</p>
        <p>
          Pour valider votre annonce, envoyez 3% du prix au numéro{' '}
          <span className="font-bold">{operatorPhones[form.operator]}</span> ({form.operator}).
        </p>
      </div>
      <input type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
      <button disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded">{loading ? "Envoi..." : "Créer l'annonce"}</button>
    </form>
  );
}
