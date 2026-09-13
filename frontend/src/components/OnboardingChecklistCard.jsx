import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircleIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const dismissKey = (userId, sequenceId) => `hdmarket:onboarding-dismissed:${userId || 'anon'}:${sequenceId || ''}`;

const isDismissed = (key) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

/**
 * New-user welcome checklist (Taobao 新人礼包) — renders the admin-managed
 * onboarding sequence as an in-app progress card for the first steps.
 */
export default function OnboardingChecklistCard() {
  const { user } = React.useContext(AuthContext);
  const [state, setState] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?._id) return;
    let active = true;
    api
      .get('/onboarding/me')
      .then(({ data }) => {
        if (!active) return;
        const onboarding = data?.onboarding;
        if (!onboarding || !onboarding.nextStep || onboarding.doneSteps >= onboarding.totalSteps) {
          setState(null);
          return;
        }
        if (isDismissed(dismissKey(user._id, onboarding.sequenceId))) return;
        setState(onboarding);
      })
      .catch(() => {
        /* no enrollment or endpoint unavailable — hide silently */
      });
    return () => {
      active = false;
    };
  }, [user?._id]);

  if (!state?.nextStep) return null;
  if (dismissed) return null;

  const { nextStep, progressPercent, doneSteps, totalSteps } = state;
  const action = nextStep.action || {};
  const isInternalLink = action.type === 'internal_route' && action.target;

  const handleDismiss = () => {
    try {
      localStorage.setItem(dismissKey(user?._id, state.sequenceId), '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <section aria-label="Bienvenue sur HDMarket" className="rounded-[22px] border border-[#ffe2c8] bg-[#fff8f1] p-4 shadow-none">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#e85d00] text-white">
          <SparklesIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-black text-[#231f1b]">
              Bienvenue sur HDMarket 👋
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Masquer"
              className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 hover:text-neutral-700"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#6b5f52]">{nextStep.message || nextStep.title}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ffe2c8]">
            <div
              className="h-full rounded-full bg-[#e85d00] transition-all duration-500"
              style={{ width: `${Math.max(4, progressPercent)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-[#6b5f52]">
              {doneSteps}/{totalSteps} étapes complétées
            </p>
            {isInternalLink ? (
              <Link
                to={action.target}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#231f1b] px-3.5 py-1.5 text-[11px] font-black text-white active:scale-[0.97]"
              >
                {action.label || 'Commencer'} <CheckCircleIcon className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
