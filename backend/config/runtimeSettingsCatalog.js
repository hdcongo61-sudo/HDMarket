const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const CONFIG_ENVIRONMENTS = Object.freeze(['all', 'production', 'staging', 'dev']);

export const normalizeConfigEnvironment = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'all';
  if (normalized === 'development') return 'dev';
  if (normalized === 'prod') return 'production';
  if (CONFIG_ENVIRONMENTS.includes(normalized)) return normalized;
  return 'all';
};

export const RUNTIME_SETTINGS_CATALOG = Object.freeze({
  commission_rate: {
    category: 'fees_rules',
    description: 'Commission plateforme (%) appliquée sur les ventes.',
    valueType: 'number',
    defaultValue: 3,
    isPublic: true,
    min: 0,
    max: 100
  },
  max_order_limit: {
    category: 'fees_rules',
    description: 'Montant maximum autorisé par commande.',
    valueType: 'number',
    defaultValue: 10000000,
    isPublic: false,
    min: 1
  },
  seller_min_payout: {
    category: 'fees_rules',
    description: 'Montant minimum de retrait vendeur.',
    valueType: 'number',
    defaultValue: 5000,
    isPublic: false,
    min: 0
  },
  review_required: {
    category: 'order_automation',
    description: 'Demander un avis avant clôture définitive.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true
  },
  review_delay_days: {
    category: 'order_automation',
    description: 'Délai avant relance avis client (jours).',
    valueType: 'number',
    defaultValue: 3,
    isPublic: false,
    min: 0,
    max: 30
  },
  order_auto_cancel_hours: {
    category: 'order_automation',
    description: 'Annulation automatique des commandes non validées (heures).',
    valueType: 'number',
    defaultValue: 48,
    isPublic: false,
    min: 1,
    max: 720
  },
  delivery_delay_threshold_days: {
    category: 'order_automation',
    description: 'Seuil de retard logistique (jours).',
    valueType: 'number',
    defaultValue: 2,
    isPublic: false,
    min: 1,
    max: 30
  },
  max_reminder_count: {
    category: 'order_automation',
    description: 'Nombre maximum de relances automatiques.',
    valueType: 'number',
    defaultValue: 2,
    isPublic: false,
    min: 0,
    max: 10
  },
  enable_platform_delivery: {
    category: 'delivery_platform',
    description: 'Activer la livraison opérée par la plateforme.',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: true
  },
  enable_delivery_requests: {
    category: 'delivery_platform',
    description: 'Activer les demandes de livraison plateforme depuis les vendeurs.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true
  },
  delivery_manager_roles: {
    category: 'delivery_platform',
    description: 'Rôles autorisés à traiter les demandes de livraison plateforme.',
    valueType: 'array',
    defaultValue: ['DELIVERY_MANAGER', 'ADMIN', 'FOUNDER'],
    isPublic: false
  },
  delivery_commune_filters_enabled: {
    category: 'delivery_platform',
    description: 'Active les filtres opérationnels par commune/ville pour la logistique.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: false
  },
  delivery_default_price_mode: {
    category: 'delivery_platform',
    description: 'Mode de résolution du prix de livraison plateforme.',
    valueType: 'string',
    defaultValue: 'HYBRID',
    isPublic: true,
    allowedValues: ['ADMIN_RULES', 'SELLER_DEFINED', 'BUYER_DEFINED', 'HYBRID']
  },
  delivery_price_admin_by_commune: {
    category: 'delivery_platform',
    description:
      'Règles admin de prix livraison par commune (clé source->destination ou default).',
    valueType: 'json',
    defaultValue: {},
    isPublic: false
  },
  delivery_request_expire_hours: {
    category: 'delivery_platform',
    description: 'Durée de validité max d’une demande de livraison (heures).',
    valueType: 'number',
    defaultValue: 24,
    isPublic: false,
    min: 1,
    max: 168
  },
  delivery_max_active_requests_per_shop: {
    category: 'delivery_platform',
    description: 'Nombre max de demandes livraison actives simultanées par boutique.',
    valueType: 'number',
    defaultValue: 20,
    isPublic: false,
    min: 1,
    max: 500
  },
  delivery_auto_reminder_enabled: {
    category: 'delivery_platform',
    description: 'Active les rappels auto pour demandes livraison en attente.',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: false
  },
  delivery_auto_reminder_hours: {
    category: 'delivery_platform',
    description: 'Délai en heures avant rappel auto d’une demande livraison.',
    valueType: 'number',
    defaultValue: 4,
    isPublic: false,
    min: 1,
    max: 72
  },
  delivery_require_invoice_attachment: {
    category: 'delivery_platform',
    description: 'Exiger une URL de facture lors d’une demande livraison plateforme.',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: true
  },
  enable_delivery_agents: {
    category: 'delivery_platform',
    description: 'Activer le mode livreur dédié (courier dashboard + endpoints).',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true
  },
  courier_must_accept_assignment: {
    category: 'delivery_platform',
    description: 'Exiger que le livreur accepte/refuse explicitement une affectation.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: false
  },
  courier_accept_timeout_minutes: {
    category: 'delivery_platform',
    description: 'Délai max (minutes) pour accepter une affectation livreur.',
    valueType: 'number',
    defaultValue: 30,
    isPublic: false,
    min: 5,
    max: 720
  },
  enable_proof_upload: {
    category: 'delivery_platform',
    description: 'Activer le dépôt de preuves pickup/livraison par les livreurs.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true
  },
  enable_delivery_pin_code: {
    category: 'delivery_platform',
    description: 'Exiger un code de confirmation client pour valider la livraison.',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: false
  },
  enable_live_location: {
    category: 'delivery_platform',
    description: 'Activer le suivi live du livreur (préparation future).',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: false
  },
  delivery_agent_must_accept: {
    category: 'delivery_platform',
    description: 'Alias runtime: exiger que le livreur accepte une mission (compatibilité API delivery).',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: false
  },
  delivery_location_lock_enabled: {
    category: 'delivery_platform',
    description: 'Activer le verrouillage de localisation côté livreur.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: false
  },
  delivery_location_lock_distance_m: {
    category: 'delivery_platform',
    description: 'Distance (m) en-dessous de laquelle la localisation est masquée pour le livreur.',
    valueType: 'number',
    defaultValue: 120,
    isPublic: false,
    min: 10,
    max: 5000
  },
  delivery_location_lock_on_status: {
    category: 'delivery_platform',
    description: 'Statut à partir duquel la localisation est verrouillée.',
    valueType: 'string',
    defaultValue: 'DELIVERED',
    isPublic: false,
    allowedValues: ['IN_TRANSIT', 'DELIVERED']
  },
  delivery_location_visibility_minutes_after_accept: {
    category: 'delivery_platform',
    description: 'Durée (minutes) de visibilité des coordonnées après acceptation.',
    valueType: 'number',
    defaultValue: 90,
    isPublic: false,
    min: 5,
    max: 1440
  },
  order_reminder_interval_hours: {
    category: 'order_automation',
    description: 'Intervalle minimum entre deux relances d’une même commande (heures).',
    valueType: 'number',
    defaultValue: 12,
    isPublic: false,
    min: 1,
    max: 168
  },
  seller_reminder_delay_hours: {
    category: 'order_automation',
    description: 'Délai avant première relance vendeur (heures).',
    valueType: 'number',
    defaultValue: 24,
    isPublic: false,
    min: 1,
    max: 720
  },
  buyer_confirmation_reminder_hours: {
    category: 'order_automation',
    description: 'Délai avant relance client pour confirmation livraison (heures).',
    valueType: 'number',
    defaultValue: 24,
    isPublic: false,
    min: 1,
    max: 720
  },
  experience_reminder_delay_days: {
    category: 'order_automation',
    description: 'Délai avant relance expérience boutique (jours).',
    valueType: 'number',
    defaultValue: 7,
    isPublic: false,
    min: 1,
    max: 90
  },
  order_escalation_delay_hours: {
    category: 'order_automation',
    description: 'Temps avant escalade admin si commande bloquée (heures).',
    valueType: 'number',
    defaultValue: 48,
    isPublic: false,
    min: 6,
    max: 720
  },
  high_value_order_threshold: {
    category: 'order_automation',
    description: 'Montant à partir duquel une commande est considérée à risque élevé.',
    valueType: 'number',
    defaultValue: 200000,
    isPublic: false,
    min: 50000
  },
  review_reminder_after_hours: {
    category: 'order_automation',
    description: 'Délai minimal après livraison avant relance avis (heures).',
    valueType: 'number',
    defaultValue: 1,
    isPublic: false,
    min: 1,
    max: 720
  },
  installment_reminder_lead_days: {
    category: 'order_automation',
    description: 'Nombre de jours avant échéance pour relance paiement en tranche.',
    valueType: 'number',
    defaultValue: 3,
    isPublic: false,
    min: 1,
    max: 30
  },
  delivery_proof_resubmission_limit: {
    category: 'order_automation',
    description: 'Nombre max de resoumissions de preuve de livraison.',
    valueType: 'number',
    defaultValue: 3,
    isPublic: false,
    min: 1,
    max: 10
  },
  dispute_window_hours: {
    category: 'order_automation',
    description: 'Fenêtre de temps pour ouvrir un litige après livraison (heures).',
    valueType: 'number',
    defaultValue: 72,
    isPublic: false,
    min: 24,
    max: 720
  },
  dispute_seller_response_hours: {
    category: 'order_automation',
    description: 'Délai laissé au vendeur pour répondre à un litige (heures).',
    valueType: 'number',
    defaultValue: 48,
    isPublic: false,
    min: 12,
    max: 720
  },
  dispute_client_monthly_limit: {
    category: 'order_automation',
    description: 'Nombre max de litiges ouverts par client et par mois.',
    valueType: 'number',
    defaultValue: 5,
    isPublic: false,
    min: 1,
    max: 50
  },
  dispute_suspicious_client_threshold: {
    category: 'order_automation',
    description: 'Seuil de fréquence litige client pour signal abus.',
    valueType: 'number',
    defaultValue: 4,
    isPublic: false,
    min: 1,
    max: 100
  },
  dispute_suspicious_seller_threshold: {
    category: 'order_automation',
    description: 'Seuil de fréquence litige vendeur pour signal risque.',
    valueType: 'number',
    defaultValue: 10,
    isPublic: false,
    min: 1,
    max: 200
  },
  dispute_deadline_reminder_hours: {
    category: 'order_automation',
    description: 'Fenêtre avant échéance litige pour envoyer un rappel vendeur (heures).',
    valueType: 'number',
    defaultValue: 6,
    isPublic: false,
    min: 1,
    max: 168
  },
  push_enabled: {
    category: 'notifications',
    description: 'Activer les push notifications globales.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true
  },
  push_when_online: {
    category: 'notifications',
    description: 'Envoyer aussi des push quand l’utilisateur est en ligne.',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: false
  },
  push_for_priority_high_only: {
    category: 'notifications',
    description: 'Limiter les push aux priorités HIGH/CRITICAL.',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: false
  },
  api_request_timeout_ms: {
    category: 'performance',
    description: 'Timeout API global côté backend (ms).',
    valueType: 'number',
    defaultValue: 30000,
    isPublic: false,
    min: 8000,
    max: 180000
  },
  api_checkout_timeout_ms: {
    category: 'performance',
    description: 'Timeout backend pour checkout (ms).',
    valueType: 'number',
    defaultValue: 60000,
    isPublic: false,
    min: 10000,
    max: 240000
  },
  api_payment_submit_timeout_ms: {
    category: 'performance',
    description: 'Timeout backend pour soumission paiement (ms).',
    valueType: 'number',
    defaultValue: 60000,
    isPublic: false,
    min: 10000,
    max: 240000
  },
  api_upload_timeout_ms: {
    category: 'performance',
    description: 'Timeout backend pour requêtes upload multipart (ms).',
    valueType: 'number',
    defaultValue: 60000,
    isPublic: false,
    min: 15000,
    max: 300000
  },
  api_slow_request_threshold_ms: {
    category: 'performance',
    description: 'Seuil de log des requêtes lentes backend (ms).',
    valueType: 'number',
    defaultValue: 2000,
    isPublic: false,
    min: 200,
    max: 60000
  },
  frontend_api_timeout_ms: {
    category: 'performance',
    description: 'Timeout API frontend global (ms).',
    valueType: 'number',
    defaultValue: 30000,
    isPublic: true,
    min: 8000,
    max: 180000
  },
  frontend_checkout_timeout_ms: {
    category: 'performance',
    description: 'Timeout frontend checkout (ms).',
    valueType: 'number',
    defaultValue: 60000,
    isPublic: true,
    min: 10000,
    max: 240000
  },
  frontend_payment_submit_timeout_ms: {
    category: 'performance',
    description: 'Timeout frontend soumission paiement (ms).',
    valueType: 'number',
    defaultValue: 60000,
    isPublic: true,
    min: 10000,
    max: 240000
  },
  frontend_courier_request_timeout_ms: {
    category: 'performance',
    description: 'Timeout frontend pour appels dashboard livreur (ms).',
    valueType: 'number',
    defaultValue: 30000,
    isPublic: true,
    min: 8000,
    max: 180000
  },
  enable_chat: {
    category: 'feature_flags',
    description: 'Activer la messagerie marketplace.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true
  },
  enable_wholesale: {
    category: 'feature_flags',
    description: 'Activer les modules vente en gros.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true
  },
  enable_boost: {
    category: 'feature_flags',
    description: 'Activer les boosts produits/boutiques.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true
  },
  allow_guest_checkout: {
    category: 'feature_flags',
    description: 'Autoriser les commandes invité.',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: false
  },
  maintenance_mode: {
    category: 'security',
    description: 'Maintenance globale: bloque les routes utilisateurs.',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: true
  },
  maintenance_message: {
    category: 'security',
    description: 'Message affiché pendant la maintenance.',
    valueType: 'string',
    defaultValue: 'Maintenance en cours. Merci de réessayer plus tard.',
    isPublic: true,
    maxLength: 200
  },
  max_image_upload: {
    category: 'security',
    description: 'Nombre max d’images par upload.',
    valueType: 'number',
    defaultValue: 5,
    isPublic: true,
    min: 1,
    max: 20
  },
  max_cart_items: {
    category: 'security',
    description: 'Nombre max de produits dans le panier.',
    valueType: 'number',
    defaultValue: 50,
    isPublic: false,
    min: 1,
    max: 500
  },
  max_login_attempts: {
    category: 'security',
    description: 'Nombre max de tentatives de connexion.',
    valueType: 'number',
    defaultValue: 10,
    isPublic: false,
    min: 3,
    max: 50
  },
  password_strength_level: {
    category: 'security',
    description: 'Niveau de complexité mot de passe (low|medium|high).',
    valueType: 'string',
    defaultValue: 'medium',
    isPublic: false,
    allowedValues: ['low', 'medium', 'high']
  },
  jwt_expiration_minutes: {
    category: 'security',
    description: 'Durée de validité JWT en minutes (référence admin).',
    valueType: 'number',
    defaultValue: 60 * 24,
    isPublic: false,
    min: 15,
    max: 60 * 24 * 30
  },
  otp_expiration_minutes: {
    category: 'security',
    description: 'Durée de validité OTP (minutes).',
    valueType: 'number',
    defaultValue: 15,
    isPublic: false,
    min: 1,
    max: 120
  },
  rate_limit_per_minute: {
    category: 'security',
    description: 'Limite indicative de requêtes par minute.',
    valueType: 'number',
    defaultValue: 120,
    isPublic: false,
    min: 30,
    max: 5000
  },
  api_rate_limit_max: {
    category: 'security',
    description: 'Nombre max de requêtes sur la fenêtre API globale.',
    valueType: 'number',
    defaultValue: 3000,
    isPublic: false,
    min: 100,
    max: 100000
  },
  rate_limit_window_minutes: {
    category: 'security',
    description: 'Durée de la fenêtre de rate limiting global (minutes).',
    valueType: 'number',
    defaultValue: 15,
    isPublic: false,
    min: 1,
    max: 120
  },
  shop_location_verified_accuracy_max_m: {
    category: 'security',
    description: 'Précision GPS max (mètres) pour marquer une position boutique comme vérifiée.',
    valueType: 'number',
    defaultValue: 150,
    isPublic: false,
    min: 10,
    max: 1000
  },
  shop_location_review_score_threshold: {
    category: 'security',
    description: 'Score de confiance minimum avant revue admin obligatoire.',
    valueType: 'number',
    defaultValue: 60,
    isPublic: false,
    min: 1,
    max: 100
  },
  shop_location_jump_review_km: {
    category: 'security',
    description: 'Distance (km) déclenchant une revue admin de la localisation boutique.',
    valueType: 'number',
    defaultValue: 30,
    isPublic: false,
    min: 1,
    max: 5000
  },
  shop_location_updates_24h_limit: {
    category: 'security',
    description: 'Nombre max de mises à jour localisation boutique sur 24h avant revue.',
    valueType: 'number',
    defaultValue: 5,
    isPublic: false,
    min: 1,
    max: 100
  },
  shop_location_history_limit: {
    category: 'security',
    description: 'Nombre max d’entrées conservées dans l’historique de localisation boutique.',
    valueType: 'number',
    defaultValue: 20,
    isPublic: false,
    min: 1,
    max: 200
  },
  registration_phone_cg_only: {
    category: 'security',
    description:
      'Limiter l’inscription aux numéros République du Congo (+242) uniquement.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: false
  },
  seller_max_product_limit: {
    category: 'role_limits',
    description: 'Nombre max de produits par vendeur.',
    valueType: 'number',
    defaultValue: 200,
    isPublic: false,
    min: 1,
    max: 100000
  },
  user_max_cart_limit: {
    category: 'role_limits',
    description: 'Nombre max d’articles panier pour un client.',
    valueType: 'number',
    defaultValue: 50,
    isPublic: false,
    min: 1,
    max: 500
  },
  founder_override_mode: {
    category: 'founder',
    description: 'Mode override fondateur (expérimental).',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: false,
    hidden: true
  },
  ui_primary_color: {
    category: 'ui',
    description: 'Couleur primaire UI (hex).',
    valueType: 'string',
    defaultValue: '#171717',
    isPublic: true
  },
  ui_banner_message: {
    category: 'ui',
    description: 'Bannière annonce globale.',
    valueType: 'string',
    defaultValue: '',
    isPublic: true,
    maxLength: 240
  },
  ui_announcement_text: {
    category: 'ui',
    description: 'Texte d’annonce homepage.',
    valueType: 'string',
    defaultValue: '',
    isPublic: true,
    maxLength: 240
  },
  app_name: {
    category: 'ui',
    description: 'Nom de l’application marketplace.',
    valueType: 'string',
    defaultValue: 'HDMarket',
    isPublic: true,
    maxLength: 60
  },
  footer_text: {
    category: 'ui',
    description: 'Texte footer global.',
    valueType: 'string',
    defaultValue: 'HDMarket',
    isPublic: true,
    maxLength: 120
  },
  map_provider: {
    category: 'ui',
    description: 'Fournisseur cartographique public (osm|google).',
    valueType: 'string',
    defaultValue: 'osm',
    isPublic: true,
    allowedValues: ['osm', 'google']
  },
  enable_long_press_image_preview: {
    category: 'ui',
    description: 'Activer l’aperçu image via appui long sur les cartes produit.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true
  },

  // Backward-compatible legacy keys currently used in existing business logic.
  commissionRate: {
    category: 'legacy',
    description: 'Legacy mirror of commission_rate.',
    valueType: 'number',
    defaultValue: 3,
    isPublic: false,
    hidden: true
  },
  boostEnabled: {
    category: 'legacy',
    description: 'Legacy mirror of enable_boost.',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: false,
    hidden: true
  },
  installmentMinPercent: {
    category: 'legacy',
    description: 'Legacy installment minimum percent.',
    valueType: 'number',
    defaultValue: 25,
    isPublic: false,
    hidden: true
  },
  installmentMaxDuration: {
    category: 'legacy',
    description: 'Legacy installment max duration.',
    valueType: 'number',
    defaultValue: 90,
    isPublic: false,
    hidden: true
  },
  shopConversionAmount: {
    category: 'legacy',
    description: 'Legacy shop conversion amount.',
    valueType: 'number',
    defaultValue: 50000,
    isPublic: false,
    hidden: true
  },
  analyticsViewWeight: {
    category: 'legacy',
    description: 'Legacy analytics view weight.',
    valueType: 'number',
    defaultValue: 0.1,
    isPublic: false,
    hidden: true
  },
  analyticsConversionWeight: {
    category: 'legacy',
    description: 'Legacy analytics conversion weight.',
    valueType: 'number',
    defaultValue: 2,
    isPublic: false,
    hidden: true
  },
  analyticsRevenueWeight: {
    category: 'legacy',
    description: 'Legacy analytics revenue weight.',
    valueType: 'number',
    defaultValue: 0.001,
    isPublic: false,
    hidden: true
  },
  analyticsRefundPenalty: {
    category: 'legacy',
    description: 'Legacy analytics refund penalty.',
    valueType: 'number',
    defaultValue: 5,
    isPublic: false,
    hidden: true
  },
  disputeWindowHours: {
    category: 'legacy',
    description: 'Legacy dispute window hours.',
    valueType: 'number',
    defaultValue: 72,
    isPublic: false,
    hidden: true
  },
  deliveryOTPExpirationMinutes: {
    category: 'legacy',
    description: 'Legacy delivery OTP expiration.',
    valueType: 'number',
    defaultValue: 15,
    isPublic: false,
    hidden: true
  },
  maxDisputesPerMonth: {
    category: 'legacy',
    description: 'Legacy monthly dispute cap.',
    valueType: 'number',
    defaultValue: 5,
    isPublic: false,
    hidden: true
  },
  maxUploadImages: {
    category: 'legacy',
    description: 'Legacy max upload images.',
    valueType: 'number',
    defaultValue: 5,
    isPublic: false,
    hidden: true
  }
});

export const RUNTIME_SETTING_ALIASES = Object.freeze({
  commissionRate: 'commission_rate',
  maxUploadImages: 'max_image_upload',
  boostEnabled: 'enable_boost',
  disputeWindowHours: 'dispute_window_hours',
  maxDisputesPerMonth: 'dispute_client_monthly_limit',
  deliveryOTPExpirationMinutes: 'otp_expiration_minutes'
});

export const RUNTIME_SETTING_LEGACY_MIRRORS = Object.freeze({
  commission_rate: 'commissionRate',
  max_image_upload: 'maxUploadImages',
  enable_boost: 'boostEnabled',
  dispute_window_hours: 'disputeWindowHours',
  dispute_client_monthly_limit: 'maxDisputesPerMonth',
  otp_expiration_minutes: 'deliveryOTPExpirationMinutes'
});

export const FEATURE_FLAG_DEFAULTS = Object.freeze({
  enable_wholesale: {
    enabled: true,
    rolesAllowed: ['user', 'shop', 'admin', 'manager', 'founder'],
    rolloutPercentage: 100,
    description: 'Active les modules vente en gros.'
  },
  enable_founder_mode: {
    enabled: true,
    rolesAllowed: ['founder'],
    rolloutPercentage: 100,
    description: 'Débloque les options founder avancées.'
  },
  enable_seller_analytics: {
    enabled: true,
    rolesAllowed: ['shop', 'admin', 'manager', 'founder'],
    rolloutPercentage: 100,
    description: 'Analytics vendeur avancées.'
  },
  enable_advanced_chat: {
    enabled: true,
    rolesAllowed: ['user', 'shop', 'admin', 'manager', 'founder'],
    rolloutPercentage: 100,
    description: 'Expérience chat premium en temps réel.'
  },
  enable_ai_recommendations: {
    enabled: false,
    rolesAllowed: ['admin', 'founder'],
    rolloutPercentage: 5,
    description: 'Recommendations pilotées IA (progressif).'
  }
});

export const getRuntimeSettingMetadata = (key) => RUNTIME_SETTINGS_CATALOG[key] || null;

export const coerceSettingValue = (key, value) => {
  const metadata = getRuntimeSettingMetadata(key);
  if (!metadata) return value;

  if (metadata.valueType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['true', '1', 'yes', 'oui', 'on'].includes(normalized);
    }
    return Boolean(value);
  }

  if (metadata.valueType === 'number') {
    return toNumber(value, toNumber(metadata.defaultValue, 0));
  }

  if (metadata.valueType === 'array') {
    return Array.isArray(value) ? value : [];
  }

  if (metadata.valueType === 'json') {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    return {};
  }

  return String(value ?? metadata.defaultValue ?? '');
};

export const validateSettingValue = (key, value) => {
  const metadata = getRuntimeSettingMetadata(key);
  if (!metadata) {
    return { ok: false, message: `Unknown setting key: ${key}` };
  }

  const coerced = coerceSettingValue(key, value);

  if (metadata.valueType === 'number') {
    if (!Number.isFinite(Number(coerced))) {
      return { ok: false, message: `${key} must be a valid number.` };
    }
    const numericValue = Number(coerced);
    if (metadata.min !== undefined && numericValue < metadata.min) {
      return { ok: false, message: `${key} must be >= ${metadata.min}.` };
    }
    if (metadata.max !== undefined && numericValue > metadata.max) {
      return { ok: false, message: `${key} must be <= ${metadata.max}.` };
    }
  }

  if (metadata.allowedValues && !metadata.allowedValues.includes(coerced)) {
    return { ok: false, message: `${key} must be one of: ${metadata.allowedValues.join(', ')}.` };
  }

  if (metadata.maxLength && String(coerced || '').length > metadata.maxLength) {
    return { ok: false, message: `${key} length must be <= ${metadata.maxLength}.` };
  }

  return { ok: true, value: coerced, metadata };
};
