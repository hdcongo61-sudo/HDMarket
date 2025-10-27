import React, { useContext, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';

export default function Register() {
  const { user, login } = useContext(AuthContext);
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    accountType: 'person',
    shopName: '',
    shopAddress: '',
    shopLogo: null
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = new FormData();
      payload.append('name', form.name);
      payload.append('email', form.email);
      payload.append('password', form.password);
      payload.append('phone', form.phone);
      payload.append('accountType', form.accountType);
      if (form.accountType === 'shop') {
        payload.append('shopName', form.shopName);
        payload.append('shopAddress', form.shopAddress);
        if (form.shopLogo) {
          payload.append('shopLogo', form.shopLogo);
        }
      }

      const { data } = await api.post('/auth/register', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      login(data);
      nav(from, { replace: true });
    } catch (error) {
      alert(error.response?.data?.message || error.message);
    }
  };

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Inscription</h2>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full border p-2"
          placeholder="Nom"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="w-full border p-2"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          type="password"
          className="w-full border p-2"
          placeholder="Mot de passe"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <input
          className="w-full border p-2"
          placeholder="Téléphone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Type de compte</label>
          <select
            className="w-full border p-2"
            value={form.accountType}
            onChange={(e) =>
              setForm({
                ...form,
                accountType: e.target.value,
                shopName: '',
                shopAddress: '',
                shopLogo: null
              })
            }
          >
            <option value="person">Particulier</option>
            <option value="shop">Boutique</option>
          </select>
        </div>
        {form.accountType === 'shop' && (
          <input
            className="w-full border p-2"
            placeholder="Nom de la boutique"
            value={form.shopName}
            onChange={(e) => setForm({ ...form, shopName: e.target.value })}
            required
          />
        )}
        {form.accountType === 'shop' && (
          <input
            className="w-full border p-2"
            placeholder="Adresse de la boutique"
            value={form.shopAddress}
            onChange={(e) => setForm({ ...form, shopAddress: e.target.value })}
            required
          />
        )}
        {form.accountType === 'shop' && (
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Logo de la boutique
            <input
              type="file"
              accept="image/*"
              className="mt-1"
              onChange={(e) =>
                setForm({
                  ...form,
                  shopLogo: e.target.files && e.target.files[0] ? e.target.files[0] : null
                })
              }
              required
            />
          </label>
        )}
        <button className="bg-indigo-600 text-white px-4 py-2 rounded">Créer un compte</button>
      </form>
    </div>
  );
}
