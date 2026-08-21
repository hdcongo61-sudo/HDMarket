import SocialConnection from '../../models/socialConnectionModel.js';
import { buildSmartUrl } from './smartUrlService.js';

// The WhatsApp *display* number (a dialable phone number for wa.me links) is
// distinct from WHATSAPP_PHONE_NUMBER_ID (the Meta Cloud API's internal
// numeric ID for sending messages) — configurable by admin via the platform
// WhatsApp SocialConnection's metadata, falling back to an env var. Never
// hardcoded in a React component (spec §13).
export const getWhatsAppDisplayNumber = async () => {
  const connection = await SocialConnection.findOne({ ownerType: 'PLATFORM', channel: 'WHATSAPP' })
    .select('metadata')
    .lean();
  return connection?.metadata?.displayPhoneNumber || process.env.SOCIAL_WHATSAPP_DISPLAY_NUMBER || '';
};

const sanitizePhone = (phone) => String(phone || '').replace(/[^\d+]/g, '');

/**
 * Builds every share text/link variant for one product's Social Commerce
 * card (spec §22/§23). Always uses the product's live socialCode/title —
 * nothing here is pre-rendered or cached.
 */
export const buildShareLinks = async (product, { source, campaign } = {}) => {
  const socialCode = product.socialCode;
  const smartUrl = buildSmartUrl(socialCode, { source, campaign });
  const whatsappSmartUrl = buildSmartUrl(socialCode, { source: 'whatsapp', campaign });
  const displayNumber = await getWhatsAppDisplayNumber();
  const sanitizedNumber = sanitizePhone(displayNumber);

  const whatsappMessage = `Bonjour HDMarket, je voudrais des informations sur le produit ${socialCode}.`;
  const whatsappLink = sanitizedNumber
    ? `https://wa.me/${sanitizedNumber}?text=${encodeURIComponent(whatsappMessage)}`
    : null;

  const tiktokCaption =
    `✨ ${product.title} disponible sur HDMarket\n\n` +
    `Pour connaître le prix et commander :\n` +
    `envoyez la référence ${socialCode} sur WhatsApp.\n\n` +
    `Lien dans la bio.`;

  const instagramMessage =
    `Pour connaître le prix et commander, envoyez-moi la référence ${socialCode} en DM, ` +
    `ou retrouvez le produit ici : ${smartUrl}`;

  const facebookPost =
    `${product.title} — disponible sur HDMarket 🛍\n\n` +
    `Référence : ${socialCode}\n` +
    `Commandez ici : ${buildSmartUrl(socialCode, { source: 'facebook', campaign })}`;

  return {
    socialCode,
    hdmarketLink: smartUrl,
    whatsappLink,
    whatsappSmartUrl,
    whatsappMessage,
    tiktokCaption,
    instagramMessage,
    facebookPost
  };
};
