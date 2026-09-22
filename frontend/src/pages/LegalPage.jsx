import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ArrowUturnLeftIcon, CakeIcon, CheckCircleIcon, DocumentTextIcon, ExclamationTriangleIcon, LockClosedIcon, ScaleIcon } from '@heroicons/react/24/outline';
import PrivacyControls from '../components/PrivacyControls';
import { LEGAL_VERSION as VERSION, LEGAL_SOURCES } from '../config/legalPolicy';
import { useAppSettings } from '../context/AppSettingsContext';

const ENV_OPERATOR = {
  name: import.meta.env.VITE_LEGAL_COMPANY_NAME || 'ETS HD Tech Filial',
  address: import.meta.env.VITE_LEGAL_ADDRESS || '',
  rccm: import.meta.env.VITE_LEGAL_RCCM || '',
  niu: import.meta.env.VITE_LEGAL_NIU || '',
  director: import.meta.env.VITE_LEGAL_DIRECTOR || '',
  host: import.meta.env.VITE_LEGAL_HOST || '',
  email: import.meta.env.VITE_LEGAL_EMAIL || 'support@hdmarket.cg'
};

const buildDocuments = (operator) => ({
  'conditions-utilisation': {
    title: "Conditions générales d’utilisation",
    summary: 'Règles applicables à l’accès à HDMarket et à l’utilisation des comptes acheteur, vendeur et livreur.',
    icon: DocumentTextIcon,
    sections: [
      ['1. Objet et acceptation', `HDMarket est une place de marché numérique opérée par ${operator.name}, en République du Congo (Congo-Brazzaville). À l’inscription, vous acceptez ces conditions et prenez connaissance de la Politique de confidentialité. L’acceptation ne vaut pas consentement aux statistiques, au diagnostic ou à la prospection. Les Conditions de vente s’appliquent aux transactions. Les droits impératifs applicables au consommateur dans son pays restent réservés.`],
      ['2. Rôle de HDMarket', 'HDMarket fournit des outils de publication, recherche, messagerie, commande, paiement suivi et livraison. Sauf indication expresse, le contrat de vente est conclu entre l’acheteur et le vendeur. HDMarket peut modérer, suspendre ou retirer un contenu ou un compte pour protéger les utilisateurs et respecter la loi.'],
      ['3. Compte et sécurité', 'Vous devez fournir des informations exactes, protéger vos identifiants et signaler rapidement tout accès non autorisé. Un utilisateur ne doit pas usurper une identité, contourner une suspension ou créer des comptes frauduleux.'],
      ['4. Règles de publication', 'Les annonces doivent décrire fidèlement le produit, son état, son prix, son stock, ses options et sa localisation. Sont interdits les produits illégaux, dangereux, contrefaits, volés, trompeurs, portant atteinte aux droits de tiers ou incompatibles avec les règles publiées par HDMarket.'],
      ['5. Conduite des utilisateurs', 'Le harcèlement, les menaces, la fraude, le spam, la collecte non autorisée de données, les faux avis, la manipulation des prix et le contournement abusif des mécanismes de sécurité sont interdits.'],
      ['6. Paiements et versements', 'Les montants, frais et étapes de validation sont affichés avant confirmation. Les fonds d’une vente peuvent être retenus pendant le délai de livraison, de contestation, de remboursement ou de contrôle antifraude. Toute opération suspecte peut être suspendue le temps des vérifications nécessaires.'],
      ['7. Propriété intellectuelle', 'Vous conservez vos droits sur vos contenus, mais accordez à HDMarket une licence non exclusive nécessaire pour les héberger, adapter techniquement et afficher dans le cadre du service. Vous garantissez disposer des droits requis.'],
      ['8. Suspension et fermeture', 'HDMarket peut restreindre un compte en cas de risque, fraude présumée, violation des règles ou obligation légale. Vous pouvez demander la fermeture de votre compte, sous réserve des données devant être conservées pour les commandes, litiges, paiements ou obligations légales.'],
      ['9. Responsabilité', 'HDMarket met en œuvre des moyens raisonnables pour assurer la disponibilité et la sécurité du service, sans garantir une disponibilité permanente. Aucune clause ne limite une responsabilité qui ne peut légalement être exclue.'],
      ['10. Droit applicable et réclamations', `Les présentes conditions sont régies par le droit de la République du Congo et les textes OHADA applicables. Contact préalable : ${operator.email}. À défaut de résolution amiable, les juridictions compétentes sont déterminées selon les règles impératives applicables.`]
    ]
  },
  'conditions-vente': {
    title: 'Conditions générales de vente de la marketplace',
    summary: 'Cadre des commandes conclues entre acheteurs et vendeurs par l’intermédiaire de HDMarket.',
    icon: ScaleIcon,
    sections: [
      ['1. Formation de la commande', 'Avant validation, l’acheteur voit les caractéristiques essentielles, le vendeur, le prix, les frais, le mode de remise ou de livraison et le total. La commande devient ferme selon l’étape de confirmation affichée dans l’application.'],
      ['2. Obligations du vendeur', 'Le vendeur garantit la disponibilité, l’authenticité, la conformité, la sécurité et la description exacte du produit. Il communique les conditions de garantie, prépare la commande et respecte le délai annoncé.'],
      ['3. Prix et frais', 'En République du Congo, les prix sont exprimés en francs CFA (XAF). Une conversion d’affichage ne change pas la devise annoncée pour le paiement. Le prix de l’option sélectionnée et les frais de livraison, de service ou de publication applicables doivent être indiqués avant confirmation. Les promotions doivent être réelles, datées et limitées aux stocks disponibles.'],
      ['4. Paiement', 'Les paiements Mobile Money proposés dans l’application sont traités par PawaPay. La confirmation est automatisée. HDMarket peut retarder la validation ou le versement en cas d’anomalie, contestation ou contrôle antifraude.'],
      ['5. Livraison et retrait', 'Le vendeur, le livreur et l’acheteur doivent utiliser les preuves de remise prévues. L’acheteur vérifie l’état et la conformité dès que possible et signale tout problème depuis la commande ou le support.'],
      ['6. Rétractation, retour et conformité', 'Les droits impératifs du consommateur restent applicables. Pour une vente à distance, les délais et exceptions sont décrits dans la Politique de retours et remboursements. Un produit non conforme doit être signalé avec les justificatifs disponibles.'],
      ['7. Annulation et remboursement', 'Les boutons disponibles dépendent du statut de la commande ; leur absence ne supprime pas un droit de rétractation, de retour ou de recours. Utilisez la procédure de la page Retours et remboursements. Les délais techniques du prestataire de paiement ne remplacent pas les délais légaux.'],
      ['8. Litiges', 'Les parties doivent d’abord utiliser la messagerie et le mécanisme de réclamation HDMarket. HDMarket peut demander des photos, preuves de paiement, preuves de remise et échanges, puis faciliter une solution sans se substituer aux autorités compétentes.'],
      ['9. Versement au vendeur', 'Après confirmation de la remise et expiration du délai de contestation, HDMarket calcule le produit net de la vente après remboursement éventuel et commission affichée. Lorsque le minimum de versement est atteint, PawaPay envoie ce montant au compte MTN MoMo ou Airtel Money vérifié du vendeur. Un litige, un remboursement, une anomalie ou un compte non vérifié suspend le versement.']
    ]
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    summary: 'Comment HDMarket collecte, utilise, conserve et protège vos données personnelles.',
    icon: LockClosedIcon,
    sections: [
      ['1. Responsable du traitement', `${operator.name}, établi à Brazzaville, République du Congo, est responsable des traitements décrits ici. Contact données personnelles : ${operator.email}.`],
      ['2. Données nécessaires et facultatives', 'L’inscription nécessite un nom, un téléphone, un pays et un moyen d’authentification pour créer et sécuriser le compte. Sans ces informations, le compte ne peut pas être créé. L’adresse et les coordonnées de livraison sont demandées pour une livraison ; les informations professionnelles sont nécessaires à une boutique. Le genre n’est pas demandé dans le parcours d’inscription ou de modification du profil. Une photo de profil, la position GPS et les notifications sont facultatives. Vous pouvez saisir votre adresse sans autoriser le GPS.'],
      ['3. Utilisation de vos informations', 'Les annonces, photos et informations de boutique destinées au public sont visibles par les visiteurs. Les commandes, références de paiement, messages, réclamations et preuves de livraison servent à exécuter les opérations demandées et à résoudre les litiges. Évitez les données sensibles dans les annonces, images, messages ou demandes à l’assistant. Les statistiques et les rapports de plantage ne sont activés qu’après votre choix facultatif.'],
      ['4. Fondements et consentement', 'Selon l’article 5 de la loi n°29-2019, les traitements nécessaires au contrat demandé ou à une obligation légale ne reposent pas sur un accord aux cookies. Les usages facultatifs reposent sur votre consentement, retirable depuis la page Cookies et confidentialité. Le refus de ces usages n’empêche pas la connexion, l’achat ou la vente.'],
      ['5. Destinataires et prestataires', 'Seules les équipes habilitées et les parties concernées reçoivent les données nécessaires : vendeur, acheteur, livreur et prestataire de paiement PawaPay. Selon les fonctions activées, Cloudinary héberge les médias, Firebase assure l’authentification ou les notifications, PostHog et Google Analytics/Firebase mesurent l’utilisation avec accord, et Sentry reçoit les diagnostics avec un accord distinct. Les statistiques peuvent utiliser un identifiant de compte pseudonyme ; les diagnostics ne contiennent pas votre identifiant de compte. Si vous sollicitez l’assistant ou l’aide à la rédaction, le contenu saisi peut être transmis au fournisseur d’IA configuré (OpenAI ou DeepSeek).'],
      ['6. Transferts et hébergement', `Certains de ces services sont exploités hors du Congo. Le pays d’hébergement dépend du fournisseur et de la configuration du service. Vous pouvez demander à ${operator.email} les destinataires, pays et garanties applicables à vos données. Un choix de cookies ne dispense pas HDMarket des formalités de déclaration, des contrats de sous-traitance ou des garanties et autorisations de transfert prévues par la loi n°29-2019.`],
      ['7. Conservation', 'Le choix de confidentialité est valable 180 jours sur cet appareil, puis renouvelé. Le brouillon de commande local expire après deux heures. Le compte et son historique restent conservés tant que le service les nécessite ; la désactivation seule ne constitue pas un effacement. Les pièces nécessaires à une obligation comptable, à la preuve d’un paiement ou à un litige peuvent être conservées malgré une demande de suppression. Le support précise les catégories conservées et leur justification lors du traitement de votre demande.'],
      ['8. Vos droits', `Vous pouvez demander accès et copie, rectification, opposition pour motifs légitimes, verrouillage ou suppression dans les cas prévus par la loi, ainsi que la portabilité lorsque ses conditions sont réunies. Contact : ${operator.email}. Pour les demandes de rectification ou suppression relevant de l’article 60, la loi prévoit de justifier les opérations effectuées dans un délai d’un mois après enregistrement. Une vérification d’identité proportionnée peut être nécessaire ; ne joignez pas spontanément de pièce d’identité. Vous conservez le droit de saisir l’autorité congolaise compétente ou les juridictions.`],
      ['9. Sécurité', 'HDMarket utilise des contrôles d’accès, des communications chiffrées, des sauvegardes et une journalisation adaptée. Aucun système n’est infaillible ; signalez immédiatement toute activité suspecte.'],
      ['10. Mineurs', 'HDMarket n’est pas destiné aux personnes qui ne disposent pas de la capacité légale requise pour conclure les opérations proposées. Un représentant légal doit intervenir lorsque la loi l’exige.']
    ]
  },
  'mentions-legales': {
    title: 'Mentions légales',
    summary: 'Identification de l’éditeur, contacts et responsabilités de publication.',
    icon: ScaleIcon,
    legalNotice: true,
    sections: [
      ['Éditeur', `${operator.name} — siège ou établissement : ${operator.address || 'À compléter avant lancement'} — RCCM : ${operator.rccm || 'À compléter'} — NIU : ${operator.niu || 'À compléter'}.`],
      ['Direction de la publication', operator.director || 'À compléter avant lancement.'],
      ['Contact', `Email : ${operator.email} — Zone d’activité : République du Congo.`],
      ['Hébergement', operator.host || 'À compléter avant lancement avec la raison sociale et l’adresse de l’hébergeur principal.'],
      ['Statut de la plateforme', 'HDMarket est une marketplace mettant en relation des vendeurs et des acheteurs, et proposant des services associés de commande, paiement suivi, support et livraison selon les fonctionnalités actives.'],
      ['Signalement', `Pour signaler un contenu illicite, une fraude ou une atteinte à vos droits, utilisez le support intégré ou écrivez à ${operator.email} en indiquant l’URL, le motif et les justificatifs disponibles.`]
    ]
  },
  'retours-remboursements': {
    title: 'Retours, rétractation et remboursements',
    summary: 'Procédure commune pour annuler, retourner un produit non conforme ou demander un remboursement.',
    icon: ArrowUturnLeftIcon,
    sections: [
      ['1. Annulation avant remise', 'Utilisez le bouton d’annulation lorsqu’il est disponible. Après préparation, expédition ou remise, une annulation peut nécessiter l’accord du vendeur ou le traitement d’une réclamation.'],
      ['2. Rétractation à distance au Congo', 'Pour une vente entre professionnel et consommateur, l’article 27 de la loi n°36-2024 prévoit 14 jours ouvrables, à compter de la réception physique du bien ou de la conclusion du contrat de service. Informez le vendeur avant l’expiration du délai et gardez une preuve datée. Renvoyez le bien dans les 7 jours suivant votre décision (article 28).'],
      ['3. Exceptions et non-conformité', 'L’article 29 prévoit notamment des exceptions pour les biens personnalisés, périssables, certains biens descellés pour hygiène ou logiciels, et les services pleinement exécutés avec accord préalable. Pour un bien ne correspondant pas aux critères convenus, l’article 30 prévoit un retour sous 15 jours ouvrables après livraison. Les autres garanties applicables restent préservées.'],
      ['4. Frais de retour', 'Le renvoi est à la charge du consommateur selon l’article 28 ; aucune pénalité de rétractation n’est ajoutée. Les éventuels engagements plus favorables du vendeur restent applicables.'],
      ['5. Délai de remboursement', 'L’article 28 prévoit le remboursement sous 14 jours après réception du bien retourné, ou après la décision de rétractation pour les services.'],
      ['6. Suivi du paiement', 'Pour un paiement traité par HDMarket, le remboursement est suivi via PawaPay et le compte Mobile Money d’origine, sauf solution convenue avec vous. Une demande ou un statut « en cours » ne prouve pas que les fonds sont déjà reçus. Conservez la référence du paiement et contactez le support si le délai annoncé est dépassé.'],
      ['7. Demander un retour', `Prévenez le vendeur depuis la commande et écrivez à ${operator.email} avec sa référence, le produit concerné et votre décision de rétractation ou le problème rencontré. Un motif n’est pas exigé pour une simple rétractation. Gardez votre message et la preuve d’expédition. L’absence de bouton ou un délai technique interne ne supprime pas vos droits. Les ventes entre particuliers et les achats professionnels ont un cadre différent ; le support vous aide à identifier le vendeur et les conditions applicables.`]
    ]
  },
  cookies: {
    title: 'Cookies et technologies locales',
    summary: 'Autorisez ou refusez séparément les statistiques et le diagnostic sur votre appareil.',
    icon: CakeIcon,
    cookieControls: true,
    sections: [
      ['Technologies essentielles', 'HDMarket utilise le stockage local et des identifiants techniques nécessaires à la connexion, la sécurité, le panier, les préférences, le cache hors ligne et la synchronisation. Ils ne peuvent pas être désactivés depuis ce panneau sans empêcher certaines fonctions.'],
      ['Mesure d’audience facultative', 'Avec votre accord, PostHog et Google Analytics/Firebase, lorsqu’ils sont configurés, mesurent les catégories de pages et les étapes d’achat. Les paramètres de recherche, références de commande et jetons contenus dans les URL sont exclus des événements envoyés par l’application. Aucun enregistrement de session n’est activé par HDMarket.'],
      ['Diagnostic facultatif', 'Avec un accord distinct, Sentry, lorsqu’il est configuré, reçoit des rapports de plantage. Les informations de compte, le contenu des formulaires et les traces de clics sont exclus de ces rapports. Les journaux de sécurité indispensables au serveur restent nécessaires au fonctionnement du service.'],
      ['Durée et modification', 'Le choix (catégories, date et version de la politique) est mémorisé au maximum 180 jours. Ce délai est un choix de HDMarket. Une nouvelle version ou un choix expiré entraîne une nouvelle demande. Sans accord, les deux options restent désactivées. Le retrait ci-dessous s’applique aussi aux autres onglets de ce navigateur ; chaque appareil possède son propre choix. Il arrête les nouvelles collectes facultatives et ne supprime pas rétroactivement les données déjà transmises.'],
      ['Stockages utilisés', 'Le navigateur conserve le panier invité et les préférences jusqu’à leur suppression ou remplacement, un brouillon de commande pendant deux heures, et des caches nécessaires à la navigation. Les identifiants PostHog (ph_…) et Google Analytics (_ga…) servent uniquement aux statistiques autorisées ; leurs cookies sont configurés pour 180 jours au maximum. Le diagnostic Sentry n’active pas de replay. Effacer les données du site depuis le navigateur supprime aussi vos préférences et peut vous déconnecter.']
    ]
  },
  accessibilite: {
    title: 'Accessibilité et aide à la navigation',
    summary: 'Des améliorations progressives pour consulter HDMarket au clavier, avec un lecteur d’écran et sur mobile.',
    icon: CheckCircleIcon,
    sections: [
      ['Navigation', 'Le lien « Aller au contenu » permet de passer la navigation. Utilisez Tab et Maj + Tab pour parcourir les commandes, Entrée pour un lien ou un bouton, et Espace pour une case à cocher. Les commandes de confidentialité portent des libellés visibles.'],
      ['Lecture et mouvement', 'Les pages légales utilisent une variante plus foncée de l’orange HDMarket pour le texte et les boutons. Les sélecteurs d’images du produit annoncent le média choisi. Les animations de transition tiennent compte de la préférence de réduction des mouvements de votre appareil.'],
      ['Améliorations en cours', 'HDMarket n’a pas fait l’objet d’un audit complet de conformité WCAG ou RGAA. Certaines pages, les médias publiés par les vendeurs et les services tiers peuvent encore présenter des obstacles.'],
      ['Signaler une difficulté', `Écrivez à ${operator.email} avec la page concernée et la difficulté rencontrée. Vous pouvez préciser votre navigateur ou votre outil d’assistance si cela aide à reproduire le problème, sans fournir de données médicales.`]
    ]
  }
});

export default function LegalPage({ type }) {
  const params = useParams();
  const { app } = useAppSettings();
  const operator = useMemo(() => {
    const information = app?.information || {};
    return {
      name: String(information.companyName || ENV_OPERATOR.name),
      address: String(information.address || ENV_OPERATOR.address),
      rccm: String(information.rccm || ENV_OPERATOR.rccm),
      niu: String(information.niu || ENV_OPERATOR.niu),
      director: String(information.director || ENV_OPERATOR.director),
      host: String(information.host || ENV_OPERATOR.host),
      email: String(information.legalEmail || information.supportEmail || ENV_OPERATOR.email)
    };
  }, [app?.information]);
  const documents = useMemo(() => buildDocuments(operator), [operator]);
  const key = type || params.type || 'conditions-utilisation';
  const document = documents[key] || documents['conditions-utilisation'];
  const Icon = document.icon;
  const missingLegalIdentity = document.legalNotice && (!operator.address || !operator.rccm || !operator.niu || !operator.director || !operator.host);
  const emailLink = (subject, body = '') => `mailto:${encodeURIComponent(operator.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="min-h-screen bg-[#f7f5f1] px-4 py-6 text-neutral-950 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-neutral-700"><ArrowLeftIcon className="h-4 w-4" />Retour à HDMarket</Link>
        <header className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-8">
          <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#c2410c]"><Icon aria-hidden="true" className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#c2410c]">République du Congo · Congo-Brazzaville</p><h1 className="mt-1 text-2xl font-black sm:text-4xl">{document.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">{document.summary}</p><p className="mt-3 text-xs font-semibold text-neutral-600">Version {VERSION} · Dernière mise à jour : 20 septembre 2026</p></div></div>
        </header>

        {missingLegalIdentity ? <div className="mt-4 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><ExclamationTriangleIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><p>Certaines informations sur l’éditeur ou l’hébergeur ne sont pas encore renseignées. Contact : <a className="underline" href={emailLink('Informations légales HDMarket')}>{operator.email}</a>.</p></div> : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr]">
          <nav className="h-fit rounded-xl border border-neutral-200 bg-white p-3 lg:sticky lg:top-28" aria-label="Documents légaux">
            {Object.entries(documents).map(([route, item]) => <Link key={route} to={`/${route}`} aria-current={route === key ? 'page' : undefined} className={`block min-h-11 rounded-lg px-3 py-2.5 text-sm font-bold ${route === key ? 'bg-orange-50 text-[#c2410c]' : 'text-neutral-600 hover:bg-neutral-50'}`}>{item.title}</Link>)}
          </nav>
          <article className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-8">
            {document.cookieControls ? <section id="mes-choix" className="mb-8 border-b border-neutral-200 pb-6"><h2 className="mb-3 text-lg font-black">Gérer mon choix</h2><PrivacyControls /></section> : null}
            <div className="space-y-7">{document.sections.map(([title, body]) => <section key={title}><h2 className="flex items-center gap-2 text-lg font-black"><CheckCircleIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-[#c2410c]" />{title}</h2><p className="mt-2 text-sm leading-7 text-neutral-700">{body}</p></section>)}</div>
            {key === 'confidentialite' ? <section id="mes-droits" className="mt-8 scroll-mt-32 rounded-xl bg-orange-50 p-4">
              <h2 className="text-lg font-black">Exercer mes droits</h2>
              <p className="mt-2 text-sm leading-6">Ces liens préparent un email que vous pouvez vérifier et envoyer. Indiquez le compte concerné ; aucun mot de passe, code SMS ou document d’identité n’est demandé ici.</p>
              <div className="mt-3 flex flex-wrap gap-2">{['Accès et copie de mes données', 'Rectification de mes données', 'Suppression de mes données', 'Opposition ou portabilité'].map(subject => <a key={subject} href={emailLink(subject, 'Bonjour,\n\nJe souhaite exercer le droit indiqué en objet pour mon compte HDMarket.\nCompte concerné : \nPrécisions utiles : \n\nMerci de confirmer la réception de ma demande.')} className="inline-flex min-h-11 items-center rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-[#9a3412] underline">{subject}</a>)}</div>
              <p className="mt-3 text-sm">Sans application email, écrivez à <a className="underline" href={emailLink('Mes données personnelles')}>{operator.email}</a>. Vous pouvez aussi <Link className="font-bold underline" to="/profile">modifier votre profil</Link> ou <Link className="font-bold underline" to="/cookies">retirer vos accords facultatifs</Link>.</p>
            </section> : null}
            {key === 'retours-remboursements' ? <section className="mt-8 rounded-xl bg-orange-50 p-4">
              <h2 className="text-lg font-black">Commencer ma demande</h2>
              <div className="mt-3 flex flex-wrap gap-3"><Link to="/orders" className="inline-flex min-h-11 items-center rounded-xl bg-[#c2410c] px-4 text-sm font-bold text-white">Voir mes commandes</Link><a href={emailLink('Demande de rétractation ou de retour', 'Bonjour,\n\nRéférence de commande : \nProduit et vendeur : \nDate de réception : \nJe vous informe de ma décision de rétractation / de ma demande de retour.\n\nMerci de confirmer la réception et les modalités de renvoi.')} className="inline-flex min-h-11 items-center rounded-xl border border-orange-300 bg-white px-4 text-sm font-bold text-[#9a3412] underline">Préparer un email au support</a></div>
              <p className="mt-3 text-sm leading-6">Envoyez votre décision au vendeur dans le délai applicable, même si vous attendez une réponse du support. Le modèle d’email est facultatif.</p>
            </section> : null}
            <section className="mt-8 border-t border-neutral-200 pt-5"><h2 className="text-sm font-bold">Textes de référence</h2><ul className="mt-2 space-y-2">{LEGAL_SOURCES.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#9a3412] underline">{source.title} (PDF, nouvel onglet)</a></li>)}</ul></section>
          </article>
        </div>
      </div>
    </div>
  );
}

export { VERSION as LEGAL_VERSION };
