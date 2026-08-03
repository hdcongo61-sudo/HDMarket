// Baseline product features. Records remain editable in MongoDB; this catalog
// simply makes built-in and future code-defined features visible to the admin
// before an operator creates a custom override.
export const FEATURE_CATALOG = Object.freeze({
  enable_buy_for_me: {
    displayName: 'Acheter pour moi',
    category: 'commerce',
    icon: 'ShoppingBasket',
    version: '1.0.0',
    description: 'Un livreur achète une liste d’articles pour le client.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100
  },
  enable_delivery: {
    displayName: 'Livraison',
    category: 'delivery',
    icon: 'Truck',
    version: '1.0.0',
    description: 'Livraison standard des commandes HDMarket.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100
  },
  enable_delivery_v2: {
    displayName: 'Livraison V2',
    category: 'delivery',
    icon: 'Route',
    version: '2.0.0',
    description: 'Expérience de livraison améliorée et orchestration avancée.',
    enabled: false,
    releaseStage: 'development',
    rolloutPercentage: 0
  },
  enable_installments: {
    displayName: 'Paiement par tranche',
    category: 'payments',
    icon: 'WalletCards',
    version: '1.0.0',
    description: 'Paiement progressif des achats éligibles.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100
  },
  enable_wholesale: {
    displayName: 'Vente en gros',
    category: 'commerce',
    icon: 'Boxes',
    version: '1.0.0',
    description: 'Modules de vente en gros.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100
  },
  enable_chat: {
    displayName: 'Chat',
    category: 'social',
    icon: 'MessageCircle',
    version: '1.0.0',
    description: 'Messagerie entre utilisateurs et boutiques.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100
  },
  enable_nearby_shops: {
    displayName: 'Boutiques à proximité',
    category: 'discovery',
    icon: 'MapPin',
    version: '1.0.0',
    description: 'Découverte de boutiques selon la position du client.',
    enabled: false,
    releaseStage: 'development',
    rolloutPercentage: 0
  },
  enable_reviews: {
    displayName: 'Avis',
    category: 'social',
    icon: 'Star',
    version: '1.0.0',
    description: 'Notes et avis sur les produits et boutiques.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100
  },
  enable_favorites: {
    displayName: 'Favoris',
    category: 'social',
    icon: 'Heart',
    version: '1.0.0',
    description: 'Sauvegarde de produits et boutiques.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100
  },
  enable_global_notifications: {
    displayName: 'Notifications',
    category: 'platform',
    icon: 'Bell',
    version: '1.0.0',
    description: 'Notifications globales de la plateforme.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100
  },
  enable_ai_assistant: {
    displayName: 'Assistant IA',
    category: 'ai',
    icon: 'Bot',
    version: '1.0.0',
    description: 'Assistant conversationnel et recommandations IA.',
    enabled: false,
    releaseStage: 'development',
    rolloutPercentage: 0
  },
  enable_ai_recommendations: {
    displayName: 'Recommandations IA',
    category: 'ai',
    icon: 'Sparkles',
    version: '1.0.0',
    description: 'Recommandations personnalisées sur l’accueil.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 5
  },
  enable_coupons: {
    displayName: 'Coupons',
    category: 'payments',
    icon: 'Ticket',
    version: '1.0.0',
    description: 'Coupons et codes promotionnels.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100
  },
  enable_pickup: {
    displayName: 'Retrait en boutique',
    category: 'delivery',
    icon: 'Store',
    version: '1.0.0',
    description: 'Retrait de commandes directement en boutique.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100
  },
  enable_express_delivery: {
    displayName: 'Livraison express',
    category: 'delivery',
    icon: 'Zap',
    version: '1.0.0',
    description: 'Livraison prioritaire avec dépendance à la livraison standard.',
    enabled: false,
    releaseStage: 'development',
    rolloutPercentage: 0,
    dependencies: ['enable_delivery', 'enable_global_notifications']
  },
  product_card_multi_image_preview: {
    displayName: 'Aperçu multi-images des produits',
    category: 'discovery',
    icon: 'Images',
    version: '1.0.0',
    description: 'Galerie performante et interactive directement dans les cartes produit.',
    enabled: true,
    releaseStage: 'released',
    rolloutPercentage: 100,
    remoteConfig: {}
  }
});

export const getCatalogFeature = (featureName) => FEATURE_CATALOG[String(featureName || '').trim()] || null;

export const catalogFeatureNames = () => Object.keys(FEATURE_CATALOG);
