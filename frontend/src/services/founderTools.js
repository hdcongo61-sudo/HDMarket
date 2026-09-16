export const founderTools = [
  { id: 'sentry', name: 'Sentry', days: 1, url: 'https://sentry.io/', status: 'SDK intégré · activation à vérifier', action: 'Examiner les nouvelles erreurs, leur fréquence et les utilisateurs touchés.', setup: 'Créer les projets React et Node. Configurer VITE_SENTRY_DSN au build frontend et SENTRY_DSN sur le backend, redéployer puis vérifier un événement. Garder SENTRY_AUTH_TOKEN uniquement dans les secrets CI.' },
  { id: 'uptime', name: 'UptimeRobot', days: 1, url: 'https://dashboard.uptimerobot.com/', status: 'Moniteurs à créer', action: 'Vérifier les interruptions et le temps de réponse.', setup: 'Créer deux moniteurs HTTPS : votre site et votre API /api/health. Configurer les alertes dans UptimeRobot et tester leur réception. Ce contrôle ne valide pas les paiements ou la base de données.' },
  { id: 'playwright', name: 'Playwright', days: 7, url: 'https://playwright.dev/docs/intro', status: 'Tests navigateur configurés', action: 'Consulter les résultats du workflow Quality tools dans GitHub Actions après chaque changement.', setup: 'Dans frontend : npm run test:e2e. Installer Chromium avec npx playwright install chromium. Les premiers tests vérifient la connexion et la protection de la page fondateur ; étendre aux parcours achat sur un environnement de test.' },
  { id: 'dependabot', name: 'Dependabot', days: 7, url: 'https://docs.github.com/en/code-security/dependabot', status: 'Configuration prête pour GitHub', action: 'Examiner les mises à jour de dépendances et les alertes de sécurité avant de fusionner.', setup: 'Pousser la configuration sur la branche principale. Dans GitHub > Settings > Code security, activer Dependency graph, Dependabot alerts et Security updates. Les PR ne sont pas fusionnées automatiquement.' },
  { id: 'lighthouse', name: 'Lighthouse', days: 7, url: 'https://developer.chrome.com/docs/lighthouse/overview', status: 'Audits locaux et CI configurés', action: 'Télécharger les rapports Lighthouse dans GitHub Actions et traiter les régressions de performance et accessibilité.', setup: 'Dans frontend : npm run build puis npm run audit:lighthouse. Chrome doit être installé. Les seuils initiaux sont informatifs ; les scores locaux ne représentent pas tous les appareils réels.' },
  { id: 'search', name: 'Google Search Console', days: 7, url: 'https://search.google.com/search-console', status: 'Propriété à vérifier', action: 'Consulter les pages indexées, les recherches et les erreurs d’exploration.', setup: 'Ajouter une propriété de domaine puis vérifier le DNS chez votre hébergeur. Soumettre uniquement un sitemap existant et accessible. Inspecter une URL produit publique. Les données apparaissent après vérification et exploration.' },
  { id: 'posthog', name: 'PostHog', days: 1, url: 'https://app.posthog.com/', status: 'SDK intégré · clé et consentement requis', action: 'Regarder les visiteurs, les pages populaires et les abandons du parcours achat.', setup: 'Configurer VITE_POSTHOG_KEY et VITE_POSTHOG_HOST puis redéployer. Créer le tableau de bord décrit dans docs/app-monitoring.md. Les visiteurs refusant les statistiques ne sont pas comptés.' }
];
export function isToolDue(lastChecked, days, now = Date.now()) {
  const time = Date.parse(lastChecked);
  return !Number.isFinite(time) || time > now || now - time >= days * 86400000;
}
export function readToolChecks(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
