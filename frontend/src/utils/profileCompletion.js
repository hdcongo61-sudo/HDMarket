/**
 * Pure profile-completion model — single source of truth for the "Profil
 * complété à X%" score and the per-field checklist.
 *
 * Criteria differ by account type:
 * - Common: name, phone, email, profile photo, city, gender.
 * - Shop adds: shop name, shop description, shop logo.
 *
 * Mirrors the backend onboarding notion of "completed" (optional fields
 * beyond the mandatory signup ones: photo + email) — see
 * notificationConditionEvaluator.hasCompletedProfile.
 */

const commonChecks = (user, form) => [
  {
    id: 'name',
    label: 'Nom',
    hint: 'Votre nom complet',
    done: Boolean(String(form.name || user?.name || '').trim())
  },
  {
    id: 'phone',
    label: 'Téléphone',
    hint: 'Numéro WhatsApp / mobile',
    done: Boolean(String(form.phone || user?.phone || '').trim())
  },
  {
    id: 'email',
    label: 'Email',
    hint: 'Sécurise votre compte et sa récupération',
    done: Boolean(String(form.email || user?.email || '').trim())
  },
  {
    id: 'profileImage',
    label: 'Photo de profil',
    hint: 'Aide les acheteurs à vous reconnaître',
    done: Boolean(user?.profileImage)
  },
  {
    id: 'city',
    label: 'Ville / commune',
    hint: 'Localisation pour la livraison et le retrait',
    done: Boolean(String(form.city || user?.city || '').trim())
  },
  {
    id: 'gender',
    label: 'Genre',
    hint: 'Champ de profil de base',
    done: Boolean(String(form.gender || user?.gender || '').trim())
  }
];

const shopChecks = (user, form) => [
  {
    id: 'shopName',
    label: 'Nom de la boutique',
    hint: 'Votre enseigne publique',
    done: Boolean(String(form.shopName || user?.shopName || '').trim())
  },
  {
    id: 'shopDescription',
    label: 'Description boutique',
    hint: 'Présentez votre activité aux clients',
    done: Boolean(String(form.shopDescription || user?.shopDescription || '').trim())
  },
  {
    id: 'shopLogo',
    label: 'Logo boutique',
    hint: 'Votre identité visuelle',
    done: Boolean(user?.shopLogo)
  }
];

export const getProfileCompletion = ({ user = {}, form = {} } = {}) => {
  const isShop = user?.accountType === 'shop';
  const checks = isShop ? [...commonChecks(user, form), ...shopChecks(user, form)] : commonChecks(user, form);
  const doneCount = checks.filter((check) => check.done).length;
  const percent = checks.length ? Math.round((doneCount / checks.length) * 100) : 0;
  return {
    checks,
    doneCount,
    total: checks.length,
    percent,
    isComplete: percent >= 100,
    remaining: checks.filter((check) => !check.done)
  };
};
