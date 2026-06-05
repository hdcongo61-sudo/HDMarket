const formatAmount = (value, currency = 'FCFA') => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
};

const pickFirst = (...values) =>
  values.map((value) => String(value || '').trim()).find(Boolean) || '';

const resolveOrderLabel = (metadata = {}, snapshot = {}) => {
  const productTitle = pickFirst(
    snapshot.orderProductTitle,
    snapshot.productTitle,
    metadata.orderProductTitle,
    metadata.productTitle,
    metadata.primaryProductTitle,
    Array.isArray(metadata.productTitles) ? metadata.productTitles[0] : ''
  );
  return productTitle ? `la commande "${productTitle}"` : 'la commande';
};

const buildPaymentMessage = ({ metadata = {}, actorName = 'Un utilisateur', action = 'a soumis une preuve de paiement' }) => {
  const amount = formatAmount(metadata.amount || metadata.expectedAmount || metadata.amountPaid);
  const suffix = amount ? ` (${amount})` : '';
  return `${actorName} ${action}${suffix}.`;
};

const TEMPLATES = {
  // === ORDERS ===
  order_placed: ({ metadata, snapshot, actorName }) => ({
    title: 'Nouvelle commande reçue',
    message: `${actorName} a commandé ${resolveOrderLabel(metadata, snapshot)}. Préparez la commande pour expédition.`,
    actionLabel: 'Voir la commande'
  }),
  order_created: ({ metadata, snapshot, actorName }) => {
    const shopName = snapshot.shopName || metadata.shopName || 'le vendeur';
    return {
      title: 'Commande confirmée',
      message: `${shopName} a confirmé ${resolveOrderLabel(metadata, snapshot)}. Votre commande est en cours de préparation.`,
      actionLabel: 'Voir la commande'
    };
  },
  order_accepted: ({ metadata, snapshot }) => ({
    title: 'Commande acceptée',
    message: `${resolveOrderLabel(metadata, snapshot)} est en préparation. Le vendeur va bientôt l'expédier.`,
    actionLabel: 'Voir la commande'
  }),
  order_rejected: ({ metadata, snapshot }) => ({
    title: 'Commande refusée',
    message: `Le vendeur n'a pas pu accepter ${resolveOrderLabel(metadata, snapshot)}.${metadata.reason ? ` Motif: ${metadata.reason}` : ' Contactez le vendeur pour plus d\'informations.'}`,
    actionLabel: 'Voir la commande'
  }),
  order_received: ({ metadata, snapshot, actorName }) => ({
    title: 'Nouvelle commande',
    message: `${actorName} vient de passer ${resolveOrderLabel(metadata, snapshot)}. Vérifiez les détails et confirmez rapidement.`,
    actionLabel: 'Voir la commande'
  }),
  order_cancelled: ({ metadata, snapshot, actorName }) => ({
    title: 'Commande annulée',
    message: `${actorName} a annulé ${resolveOrderLabel(metadata, snapshot)}.${metadata.reason ? ` Motif: ${metadata.reason}` : ''}${metadata.refundRequested ? ' Un remboursement a été demandé.' : ''}`,
    actionLabel: 'Voir la commande'
  }),
  order_cancellation_window_skipped: ({ metadata, snapshot }) => ({
    title: 'Délai d\'annulation écourté',
    message: `Le client a renoncé au délai de rétractation pour ${resolveOrderLabel(metadata, snapshot)}. Vous pouvez traiter la commande immédiatement.`,
    actionLabel: 'Voir la commande'
  }),

  // === DELIVERY ===
  order_delivering: ({ metadata, snapshot }) => {
    const shopName = snapshot.shopName || metadata.shopName || 'Le vendeur';
    return {
      title: 'Colis en route',
      message: `${shopName} a expédié ${resolveOrderLabel(metadata, snapshot)}. Préparez-vous à recevoir votre colis${metadata.deliveryCity ? ` à ${metadata.deliveryCity}` : ''}.`,
      actionLabel: 'Suivre la livraison'
    };
  },
  order_delivered: ({ metadata, snapshot }) => {
    const shopName = snapshot.shopName || metadata.shopName || 'Le vendeur';
    const hasProof = metadata.deliveryProofSubmitted;
    return {
      title: hasProof ? 'Preuve de livraison soumise' : 'Commande livrée',
      message: hasProof
        ? `${shopName} a livré ${resolveOrderLabel(metadata, snapshot)} et soumis une preuve. Vérifiez et confirmez la réception.`
        : `${shopName} a marqué ${resolveOrderLabel(metadata, snapshot)} comme livrée. Confirmez que vous avez bien reçu le colis.`,
      actionLabel: 'Confirmer la réception'
    };
  },
  delivery_assigned: ({ metadata, snapshot }) => ({
    title: 'Livreur assigné',
    message: `La livraison de ${resolveOrderLabel(metadata, snapshot)} a été confiée${metadata.courierName ? ` à ${metadata.courierName}` : ' à un livreur'}.`,
    actionLabel: 'Suivre la livraison'
  }),
  delivery_in_progress: ({ metadata, snapshot }) => ({
    title: 'Livraison en cours',
    message: `Votre colis ${resolveOrderLabel(metadata, snapshot)} est en cours d'acheminement${metadata.courierName ? ` avec ${metadata.courierName}` : ''}. Soyez prêt à le réceptionner.`,
    actionLabel: 'Suivre la livraison'
  }),
  delivery_completed: ({ metadata, snapshot }) => ({
    title: 'Livraison terminée',
    message: `La livraison de ${resolveOrderLabel(metadata, snapshot)} est arrivée à destination. Merci de votre confiance !`,
    actionLabel: 'Voir la commande'
  }),
  delivery_request_created: ({ metadata }) => ({
    title: 'Demande de livraison créée',
    message: `Une nouvelle demande de livraison plateforme${metadata.deliveryCity ? ` pour ${metadata.deliveryCity}` : ''} est disponible.`,
    actionLabel: 'Voir la demande'
  }),
  delivery_request_accepted: ({ metadata, snapshot }) => ({
    title: 'Livraison acceptée',
    message: `La livraison de ${resolveOrderLabel(metadata, snapshot)} a été acceptée par la plateforme.`,
    actionLabel: 'Voir commande'
  }),
  delivery_request_assigned: ({ metadata, snapshot }) => ({
    title: 'Livreur assigné',
    message: `Un livreur a été assigné pour ${resolveOrderLabel(metadata, snapshot)}.`,
    actionLabel: 'Suivre livraison'
  }),
  delivery_request_in_progress: ({ metadata, snapshot }) => ({
    title: 'Livraison plateforme en cours',
    message: `La livraison de ${resolveOrderLabel(metadata, snapshot)} est en cours via la plateforme.`,
    actionLabel: 'Suivre livraison'
  }),
  delivery_request_delivered: ({ metadata, snapshot }) => ({
    title: 'Livraison plateforme terminée',
    message: `La livraison plateforme de ${resolveOrderLabel(metadata, snapshot)} est terminée.`,
    actionLabel: 'Voir commande'
  }),
  delivery_request_rejected: ({ metadata, snapshot }) => ({
    title: 'Livraison plateforme refusée',
    message: `La demande de livraison pour ${resolveOrderLabel(metadata, snapshot)} a été refusée.`,
    actionLabel: 'Voir commande'
  }),
  delivery_distance_warning: ({ metadata, snapshot }) => ({
    title: '⚠️ Livraison inter-ville',
    message: `Le vendeur de ${resolveOrderLabel(metadata, snapshot)} est dans une autre ville${metadata.buyerCity ? ` (${metadata.buyerCity})` : ''}. Vérifiez les conditions de livraison avant de confirmer.`,
    actionLabel: 'Voir commande'
  }),
  order_address_updated: ({ metadata, snapshot }) => ({
    title: 'Adresse modifiée',
    message: `Le client a changé l'adresse de livraison pour ${resolveOrderLabel(metadata, snapshot)}. Vérifiez la nouvelle adresse.`,
    actionLabel: 'Voir commande'
  }),
  order_delivery_fee_updated: ({ metadata, snapshot }) => ({
    title: 'Frais de livraison mis à jour',
    message: `Le vendeur a modifié les frais de livraison de ${resolveOrderLabel(metadata, snapshot)}${metadata.newFee ? ` à ${Number(metadata.newFee).toLocaleString('fr-FR')} FCFA` : ''}.`,
    actionLabel: 'Voir commande'
  }),

  // === PAYMENTS ===
  payment_pending: ({ metadata, actorName }) => {
    const amount = formatAmount(metadata.amount || metadata.expectedAmount);
    return {
      title: 'Paiement en attente',
      message: `${actorName} doit encore payer${amount ? ` ${amount}` : ''} pour sa commande. Vérifiez les preuves de paiement.`,
      actionLabel: 'Vérifier le paiement'
    };
  },
  payment_proof_submitted: ({ metadata, actorName }) => {
    const amount = formatAmount(metadata.amount || metadata.expectedAmount);
    return {
      title: 'Preuve de paiement reçue',
      message: `${actorName} a envoyé une preuve de paiement${amount ? ` de ${amount}` : ''}. Vérifiez-la dans le centre de validation.`,
      actionLabel: 'Valider le paiement'
    };
  },
  payment_validated: ({ metadata }) => {
    const amount = formatAmount(metadata.amount || metadata.amountPaid);
    return {
      title: 'Paiement confirmé',
      message: `Votre paiement${amount ? ` de ${amount}` : ''} a été validé avec succès. Votre commande peut maintenant être traitée.`,
      actionLabel: 'Voir la commande'
    };
  },
  order_full_payment_waived: ({ metadata }) => ({
    title: 'Livraison offerte',
    message: `Félicitations ! Votre commande est payée intégralement. Les frais de livraison sont offerts et verrouillés.`,
    actionLabel: 'Voir commande'
  }),
  order_full_payment_received: ({ metadata, snapshot, actorName }) => ({
    title: 'Paiement intégral reçu',
    message: `${actorName} a payé intégralement ${resolveOrderLabel(metadata, snapshot)}. Les frais de livraison sont verrouillés.`,
    actionLabel: 'Voir commande'
  }),
  order_full_payment_ready: ({ metadata, snapshot }) => ({
    title: 'Commande prête',
    message: `${resolveOrderLabel(metadata, snapshot)} est payée intégralement. Livraison offerte activée, vous pouvez la traiter.`,
    actionLabel: 'Voir commande'
  }),

  // === INSTALLMENTS ===
  installment_payment_submitted: ({ metadata, actorName }) => {
    const amount = formatAmount(metadata.amount);
    return {
      title: 'Tranche payée',
      message: `${actorName} a soumis une preuve de paiement de tranche${amount ? ` de ${amount}` : ''}. Vérifiez-la.`,
      actionLabel: 'Valider la tranche'
    };
  },
  installment_payment_validated: ({ metadata }) => {
    const amount = formatAmount(metadata.amount);
    return {
      title: 'Tranche validée',
      message: `Votre tranche${amount ? ` de ${amount}` : ''} a été validée. Continuez vos paiements pour finaliser la commande.`,
      actionLabel: 'Voir la commande'
    };
  },
  installment_due_reminder: ({ metadata, snapshot }) => {
    const amount = formatAmount(metadata.amount || metadata.nextInstallmentAmount);
    const dueDate = metadata.dueDate
      ? ` avant le ${new Date(metadata.dueDate).toLocaleDateString('fr-FR')}`
      : '';
    return {
      title: 'Échéance approche',
      message: `Votre prochaine tranche${amount ? ` de ${amount}` : ''} pour ${resolveOrderLabel(metadata, snapshot)} arrive à échéance${dueDate}. Ne tardez pas !`,
      actionLabel: 'Payer maintenant'
    };
  },
  installment_overdue_warning: ({ metadata, snapshot }) => ({
    title: '⚠️ Tranche en retard',
    message: `Vous avez une tranche en retard pour ${resolveOrderLabel(metadata, snapshot)}. Régularisez rapidement pour éviter les pénalités.`,
    actionLabel: 'Payer maintenant'
  }),
  installment_sale_confirmation_required: ({ metadata, snapshot, actorName }) => ({
    title: 'Validation de vente requise',
    message: `${actorName} souhaite acheter ${resolveOrderLabel(metadata, snapshot)} en plusieurs fois. Vérifiez la preuve de vente.`,
    actionLabel: 'Confirmer la vente'
  }),
  installment_sale_confirmed: ({ metadata, snapshot }) => ({
    title: 'Vente tranche confirmée',
    message: `Votre achat en plusieurs fois pour ${resolveOrderLabel(metadata, snapshot)} est confirmé. Votre échéancier est maintenant actif.`,
    actionLabel: 'Voir l\'échéancier'
  }),
  installment_completed: ({ metadata, snapshot }) => ({
    title: 'Paiement terminé',
    message: `Toutes les tranches de ${resolveOrderLabel(metadata, snapshot)} sont réglées. La livraison peut maintenant être effectuée.`,
    actionLabel: 'Voir la commande'
  }),
  installment_product_suspended: ({ metadata, snapshot }) => ({
    title: 'Produit suspendu',
    message: `Le produit de ${resolveOrderLabel(metadata, snapshot)} a été suspendu en raison d'un retard de paiement.`,
    actionLabel: 'Voir la commande'
  }),

  // === PRODUCT / SHOP ===
  product_approved: ({ snapshot }) => ({
    title: 'Annonce approuvée ✅',
    message: `Votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} est maintenant visible pour tous les acheteurs.`,
    actionLabel: 'Voir l\'annonce'
  }),
  product_approval: ({ snapshot }) => ({
    title: 'Annonce approuvée ✅',
    message: `Votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} est maintenant visible pour tous les acheteurs.`,
    actionLabel: 'Voir l\'annonce'
  }),
  product_rejected: ({ snapshot, metadata }) => ({
    title: 'Annonce refusée',
    message: `Votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} a été refusée.${metadata.reason ? ` Motif: ${metadata.reason}` : ' Contactez le support pour plus d\'informations.'}`,
    actionLabel: 'Modifier l\'annonce'
  }),
  product_rejection: ({ snapshot, metadata }) => ({
    title: 'Annonce refusée',
    message: `Votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} a été refusée.${metadata.reason ? ` Motif: ${metadata.reason}` : ' Contactez le support pour plus d\'informations.'}`,
    actionLabel: 'Modifier l\'annonce'
  }),
  product_certified: ({ snapshot }) => ({
    title: 'Produit certifié',
    message: `Votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} a été certifiée. Cela renforce la confiance des acheteurs.`,
    actionLabel: 'Voir l\'annonce'
  }),
  product_boosted: ({ snapshot }) => ({
    title: 'Produit boosté 🚀',
    message: `Votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} est maintenant boostée. Elle sera plus visible dans les recherches.`,
    actionLabel: 'Voir l\'annonce'
  }),
  boost_expired: ({ snapshot }) => ({
    title: 'Boost expiré',
    message: `Le boost de votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} a expiré. Renouvelez-le pour maintenir sa visibilité.`,
    actionLabel: 'Renouveler le boost'
  }),
  promo_expired: ({ snapshot }) => ({
    title: 'Promotion expirée',
    message: `La promotion sur votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} est terminée.`,
    actionLabel: 'Voir l\'annonce'
  }),
  promotional: ({ snapshot }) => ({
    title: 'Promotion appliquée',
    message: `Une promotion a été appliquée sur votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''}. Profitez de la visibilité accrue !`,
    actionLabel: 'Voir l\'annonce'
  }),
  shop_boosted: ({ snapshot }) => ({
    title: 'Boutique boostée',
    message: `Votre boutique${snapshot.shopName ? ` "${snapshot.shopName}"` : ''} est maintenant en avant. Plus de clients vont vous découvrir.`,
    actionLabel: 'Voir ma boutique'
  }),
  shop_verified: ({ snapshot }) => ({
    title: 'Boutique vérifiée ✅',
    message: `Votre boutique${snapshot.shopName ? ` "${snapshot.shopName}"` : ''} est maintenant vérifiée. Le badge de confiance est visible pour tous les acheteurs.`,
    actionLabel: 'Voir ma boutique'
  }),
  shop_conversion_approved: ({ snapshot }) => ({
    title: 'Conversion approuvée',
    message: `Votre compte a été converti en boutique${snapshot.shopName ? ` "${snapshot.shopName}"` : ''}. Vous pouvez maintenant gérer vos produits en tant que vendeur.`,
    actionLabel: 'Voir ma boutique'
  }),
  shop_conversion_rejected: ({ metadata }) => ({
    title: 'Conversion refusée',
    message: `Votre demande de conversion en boutique a été refusée.${metadata.reason ? ` Motif: ${metadata.reason}` : ''}`,
    actionLabel: 'Contactez le support'
  }),

  // === SOCIAL ===
  product_comment: ({ snapshot, actorName }) => ({
    title: 'Nouveau commentaire',
    message: `${actorName} a commenté votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''}.`,
    actionLabel: 'Voir le commentaire'
  }),
  reply: ({ snapshot, actorName }) => ({
    title: 'Réponse reçue',
    message: `${actorName} a répondu à votre commentaire${snapshot.productTitle ? ` sur "${snapshot.productTitle}"` : ''}.`,
    actionLabel: 'Voir la réponse'
  }),
  favorite: ({ snapshot, actorName }) => ({
    title: 'Ajout aux favoris',
    message: `${actorName} a ajouté votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} à ses favoris.`,
    actionLabel: 'Voir l\'annonce'
  }),
  rating: ({ metadata, snapshot, actorName }) => ({
    title: 'Nouvelle note',
    message: `${actorName} a noté votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} ${metadata.value ? `${metadata.value}/5 ⭐` : ''}.`,
    actionLabel: 'Voir l\'évaluation'
  }),
  shop_review: ({ metadata, snapshot, actorName }) => {
    const rating = Number(metadata.rating || 0);
    const stars = rating > 0 ? ` ${'⭐'.repeat(Math.min(5, Math.round(rating)))}` : '';
    return {
      title: 'Nouvel avis boutique',
      message: `${actorName} a laissé un avis${stars ? ` (${rating}/5${stars})` : ''} sur votre boutique${snapshot.shopName ? ` "${snapshot.shopName}"` : ''}.`,
      actionLabel: 'Voir l\'avis'
    };
  },
  shop_follow: ({ snapshot, actorName }) => ({
    title: 'Nouvel abonné',
    message: `${actorName} suit maintenant votre boutique${snapshot.shopName ? ` "${snapshot.shopName}"` : ''}.`,
    actionLabel: 'Voir ma boutique'
  }),
  order_message: ({ metadata, snapshot, actorName }) => ({
    title: 'Nouveau message',
    message: `${actorName} vous a envoyé un message concernant ${resolveOrderLabel(metadata, snapshot)}.`,
    actionLabel: 'Répondre'
  }),

  // === DISPUTES ===
  dispute_created: ({ metadata, snapshot, actorName }) => ({
    title: 'Litige ouvert',
    message: `${actorName} a ouvert un litige pour ${resolveOrderLabel(metadata, snapshot)}. Répondez avant l'expiration du délai.`,
    actionLabel: 'Répondre au litige'
  }),
  dispute_seller_responded: ({ metadata, snapshot }) => ({
    title: 'Réponse du vendeur',
    message: `Le vendeur a répondu au litige concernant ${resolveOrderLabel(metadata, snapshot)}.`,
    actionLabel: 'Voir le litige'
  }),
  dispute_deadline_near: ({ metadata, snapshot }) => ({
    title: '⏰ Litige — délai proche',
    message: `Il vous reste peu de temps pour répondre au litige de ${resolveOrderLabel(metadata, snapshot)}.${metadata.sellerDeadline ? ` Date limite: ${new Date(metadata.sellerDeadline).toLocaleString('fr-FR')}` : ''}`,
    actionLabel: 'Répondre maintenant'
  }),
  dispute_under_review: ({ metadata, snapshot }) => ({
    title: 'Litige en révision',
    message: `Le litige de ${resolveOrderLabel(metadata, snapshot)} est en cours d'examen par l'équipe HDMarket.`,
    actionLabel: 'Voir le litige'
  }),
  dispute_resolved: ({ metadata, snapshot }) => ({
    title: 'Litige résolu',
    message: `Le litige concernant ${resolveOrderLabel(metadata, snapshot)} a été clôturé.${metadata.resolutionType ? ` Résolution: ${metadata.resolutionType}` : ''}`,
    actionLabel: 'Voir les détails'
  }),

  // === ACCOUNT ===
  account_restriction: ({ metadata }) => ({
    title: '🔒 Restriction de compte',
    message: pickFirst(
      metadata.message,
      metadata.restrictionLabel
        ? `Restriction "${metadata.restrictionLabel}" appliquée à votre compte.`
        : 'Une restriction a été appliquée à votre compte.',
      'Votre compte a été restreint par un administrateur.'
    ),
    actionLabel: 'Contactez le support'
  }),
  account_restriction_lifted: ({ metadata }) => ({
    title: '🔓 Restriction levée',
    message: pickFirst(
      metadata.message,
      metadata.restrictionLabel
        ? `La restriction "${metadata.restrictionLabel}" a été levée. Vous pouvez à nouveau utiliser cette fonctionnalité.`
        : 'Une restriction a été levée sur votre compte.',
      'Votre compte a été réactivé.'
    ),
    actionLabel: 'Voir mon compte'
  }),

  // === ENGAGEMENT (Proposal 8) ===
  price_drop: ({ metadata, snapshot }) => {
    const saved = formatAmount(metadata.saved || metadata.oldPrice - metadata.newPrice);
    const pct = metadata.pctDown || Math.round(Number(metadata.pctDown || 10));
    const title = metadata.productTitle || snapshot.productTitle || 'Un article';
    return {
      title: '📉 Baisse de prix !',
      message: `Bonne nouvelle ! Le prix de "${title}" a baissé de ${pct}%${saved ? ` (soit ${saved} d'économie)` : ''}. Profitez-en vite !`,
      actionLabel: 'Voir le produit'
    };
  },
  back_in_stock: ({ metadata, snapshot }) => {
    const title = metadata.productTitle || snapshot.productTitle || 'Un article';
    return {
      title: '🔄 De retour en stock',
      message: `"${title}" est de nouveau disponible ! L'article que vous aviez en favoris est à nouveau en vente.`,
      actionLabel: 'Voir le produit'
    };
  },
  abandoned_cart: ({ metadata }) => {
    const count = Number(metadata.itemCount || 1);
    const label = metadata.firstProductTitle || 'articles';
    return {
      title: '🛒 Panier en attente',
      message: `Vous avez ${count} article${count > 1 ? 's' : ''} en attente dans votre panier${label !== 'articles' ? ` dont "${label}"` : ''}. Finalisez votre commande avant que ça ne parte !`,
      actionLabel: 'Voir mon panier'
    };
  },
  seller_new_product: ({ metadata }) => {
    const shopName = metadata.shopName || 'Une boutique';
    const title = metadata.firstProductTitle || 'un nouveau produit';
    const count = Number(metadata.newProductCount || 1);
    const price = metadata.firstProductPrice ? ` à ${Number(metadata.firstProductPrice).toLocaleString('fr-FR')} FCFA` : '';
    return {
      title: '🆕 Nouveau produit',
      message: `${shopName} a ajouté ${count > 1 ? `${count} nouveaux produits` : `"${title}"${price}`}${count > 1 ? ` dont "${title}"${price}` : ''}. Découvrez-le maintenant !`,
      actionLabel: 'Voir le produit'
    };
  },
  weekly_digest: ({ metadata }) => {
    const parts = [];
    if (metadata.dealCount > 0) parts.push(`${metadata.dealCount} bon(s) plan(s) en promotion`);
    if (metadata.newFromFollowedCount > 0) parts.push(`${metadata.newFromFollowedCount} nouveautés de vos boutiques`);
    if (metadata.popularCount > 0) parts.push(`${metadata.popularCount} articles populaires près de chez vous`);
    const summary = parts.length ? parts.join(', ') : 'des offres du moment';
    return {
      title: '📊 Votre récap de la semaine',
      message: `Découvrez ${summary}. Consultez vos recommandations personnalisées !`,
      actionLabel: 'Explorer'
    };
  },

  // === MISC ===
  review_reminder: ({ metadata, snapshot }) => ({
    title: 'Donnez votre avis',
    message: `Comment s'est passée ${resolveOrderLabel(metadata, snapshot)} ? Prenez 30 secondes pour noter votre expérience.`,
    actionLabel: 'Laisser un avis'
  }),
  order_reminder: ({ metadata, snapshot, actorName }) => ({
    title: 'Rappel de commande',
    message: `${actorName} vous rappelle de traiter ${resolveOrderLabel(metadata, snapshot)}.`,
    actionLabel: 'Voir la commande'
  }),
  admin_broadcast: ({ metadata }) => ({
    title: '📢 Message HDMarket',
    message: pickFirst(metadata.message, 'Message de l\'équipe HDMarket.'),
    actionLabel: 'Voir le message'
  }),
  complaint_created: ({ metadata, actorName }) => ({
    title: 'Réclamation déposée',
    message: `${actorName} a déposé une réclamation${metadata.subject ? ` : ${metadata.subject}` : ''}. Consultez la section Réclamations.`,
    actionLabel: 'Voir la réclamation'
  }),
  complaint_resolved: ({ metadata, actorName }) => ({
    title: 'Réclamation résolue',
    message: `${actorName} a marqué votre réclamation comme résolue.`,
    actionLabel: 'Voir la réclamation'
  }),
  feedback_read: ({ metadata }) => ({
    title: 'Avis d\'amélioration lu',
    message: `L'équipe a pris connaissance de votre avis d'amélioration${metadata.subject ? ` "${metadata.subject}"` : ''}. Merci pour votre contribution !`,
    actionLabel: 'Voir mes avis'
  }),
  improvement_feedback_created: ({ metadata, actorName }) => ({
    title: 'Avis d\'amélioration',
    message: `${actorName} a déposé un avis d'amélioration${metadata.subject ? ` : ${metadata.subject}` : ''}.`,
    actionLabel: 'Voir l\'avis'
  }),
  validation_required: ({ metadata }) => ({
    title: '🔔 Action requise',
    message: pickFirst(metadata.message, 'Une action de validation est requise dans le centre des tâches.'),
    actionLabel: pickFirst(metadata.actionLabel, 'Voir la tâche')
  })
};

export const buildNotificationSnapshot = ({
  actor = null,
  product = null,
  shop = null,
  metadata = {},
  snapshot = {}
} = {}) => ({
  actorName: pickFirst(snapshot.actorName, metadata.actorName, actor?.name, actor?.shopName),
  actorAvatar: pickFirst(snapshot.actorAvatar, metadata.actorAvatar, actor?.profileImage, actor?.shopLogo),
  productTitle: pickFirst(snapshot.productTitle, metadata.productTitle, metadata.orderProductTitle, product?.title),
  productSlug: pickFirst(snapshot.productSlug, metadata.productSlug, product?.slug),
  shopName: pickFirst(snapshot.shopName, metadata.shopName, shop?.shopName, shop?.name),
  shopSlug: pickFirst(snapshot.shopSlug, metadata.shopSlug, shop?.slug),
  orderCode: pickFirst(snapshot.orderCode, metadata.orderCode, metadata.orderNumber),
  orderProductTitle: pickFirst(
    snapshot.orderProductTitle,
    metadata.orderProductTitle,
    metadata.primaryProductTitle,
    Array.isArray(metadata.productTitles) ? metadata.productTitles[0] : ''
  )
});

export const buildNotificationDisplay = ({
  type,
  metadata = {},
  snapshot = {},
  title = '',
  message = '',
  actionLabel = ''
} = {}) => {
  const explicit = {
    title: pickFirst(title, metadata.title),
    message: pickFirst(message, metadata.message),
    actionLabel: pickFirst(actionLabel, metadata.actionLabel)
  };
  const actorName = snapshot.actorName || metadata.actorName || 'Un utilisateur';
  const template = TEMPLATES[String(type || '')];
  const generated = template ? template({ metadata, snapshot, actorName }) : {};
  return {
    title: pickFirst(explicit.title, generated.title, 'Notification HDMarket'),
    message: pickFirst(explicit.message, generated.message, `${actorName} a effectué une action sur votre compte. Consultez le détail pour en savoir plus.`),
    actionLabel: pickFirst(explicit.actionLabel, generated.actionLabel, 'Ouvrir')
  };
};

export const buildNotificationDedupeKey = ({
  userId,
  type,
  metadata = {},
  entityType = '',
  entityId = '',
  productId = '',
  shopId = '',
  dedupeKey = ''
} = {}) => {
  const explicit = pickFirst(dedupeKey, metadata.dedupeKey);
  if (explicit) return explicit.slice(0, 220);

  const resolvedEntityType = pickFirst(entityType, metadata.entityType);
  const resolvedEntityId = pickFirst(
    entityId,
    metadata.entityId,
    metadata.paymentId,
    metadata.orderId,
    metadata.deliveryRequestId,
    productId,
    shopId
  );
  const resolvedType = String(type || '').trim();
  const resolvedUser = String(userId || '').trim();
  if (!resolvedUser || !resolvedType || !resolvedEntityId) return '';

  return [resolvedUser, resolvedType, resolvedEntityType || 'entity', resolvedEntityId]
    .join(':')
    .slice(0, 220);
};
