import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { founderTools, isToolDue, readToolChecks } from '../services/founderTools';

export default function FounderToolsReminder() {
  const { user } = useContext(AuthContext);
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    window.addEventListener('founder-tools-updated', update);
    window.addEventListener('storage', update);
    const timer = setInterval(update, 60000);
    return () => {
      window.removeEventListener('founder-tools-updated', update);
      window.removeEventListener('storage', update);
      clearInterval(timer);
    };
  }, []);
  if (user?.role !== 'founder') return null;
  const checks = readToolChecks(`hdmarket:founder-tools:${user._id || user.id}`);
  const count = founderTools.filter(tool => isToolDue(checks[tool.id], tool.days)).length;
  return <Link to="/admin/founder-tools" className="m-4 block rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-100">
    <strong>Routine fondateur</strong> — {count ? `${count} vérification(s) à faire` : 'Vérifications à jour'} · Ouvrir mes outils
  </Link>;
}
