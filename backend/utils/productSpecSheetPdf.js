import PDFDocument from 'pdfkit';

// Same layout helpers/conventions as generateSellerAnalyticsPdfBuffer in
// sellerAnalyticsService.js — keep the two PDF generators visually
// consistent (HDMarket palette, Helvetica, section rules).
const ensureSpace = (doc, neededHeight = 60) => {
  if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
};

const writeSectionTitle = (doc, title) => {
  ensureSpace(doc, 36);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text(title);
  doc.moveDown(0.2);
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.4);
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

const resolveAttributeValue = (attribute) => {
  if (Array.isArray(attribute?.options) && attribute.options.length) {
    return attribute.options
      .map((option) => (typeof option === 'string' ? option : option?.value))
      .filter(Boolean)
      .join(', ');
  }
  if (attribute?.defaultValue != null && attribute.defaultValue !== '') return String(attribute.defaultValue);
  if (attribute?.value != null && attribute.value !== '') return String(attribute.value);
  return '';
};

/**
 * Builds a "fiche produit" PDF straight from the product form fields — no
 * external tool needed. Deliberately doesn't touch the DB or Cloudinary;
 * callers decide what to do with the returned buffer (see
 * productController.generateProductSpecSheet, which hands it back to the
 * client as if it were a manually-picked file).
 */
export const generateProductSpecSheetPdfBuffer = async ({
  title,
  description,
  price,
  discount,
  category,
  brand,
  condition,
  attributes,
  imageBuffer,
  sellerName,
  sellerCity,
  sellerPhone
}) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];

  const finished = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text('HDMarket');
  doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('Fiche produit');
  doc.moveDown(0.8);

  if (imageBuffer) {
    try {
      doc.image(imageBuffer, { fit: [200, 200], align: 'left' });
      doc.moveDown(0.6);
    } catch {
      // Unsupported/corrupt image buffer — skip it, the rest of the sheet still generates.
    }
  }

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827').text(title || 'Produit sans titre');
  doc.moveDown(0.2);

  const priceValue = Number(price || 0);
  const discountValue = Number(discount || 0);
  const finalPrice = discountValue > 0 ? priceValue - (priceValue * discountValue) / 100 : priceValue;
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#e85d00').text(formatMoney(finalPrice));
  if (discountValue > 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#94a3b8').text(`Prix initial: ${formatMoney(priceValue)} (-${discountValue}%)`);
  }
  doc.moveDown(0.4);

  const metaParts = [category, brand, condition].map((part) => String(part || '').trim()).filter(Boolean);
  if (metaParts.length) {
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(metaParts.join(' · '));
  }

  const descriptionText = String(description || '').trim();
  if (descriptionText) {
    writeSectionTitle(doc, 'Description');
    doc.font('Helvetica').fontSize(10).fillColor('#1f2937').text(descriptionText);
  }

  const specs = Array.isArray(attributes) ? attributes : [];
  const specRows = specs
    .map((attribute) => ({ name: String(attribute?.name || '').trim(), value: resolveAttributeValue(attribute) }))
    .filter((row) => row.name && row.value);
  if (specRows.length) {
    writeSectionTitle(doc, 'Caractéristiques');
    specRows.forEach((row) => {
      ensureSpace(doc, 20);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text(`${row.name}: `, { continued: true });
      doc.font('Helvetica').fillColor('#1f2937').text(row.value);
    });
  }

  writeSectionTitle(doc, 'Vendeur');
  doc.font('Helvetica').fontSize(10).fillColor('#475569').text(sellerName || 'Boutique HDMarket');
  if (sellerCity) doc.text(`Ville: ${sellerCity}`);
  if (sellerPhone) doc.text(`Contact: ${sellerPhone}`);

  doc.moveDown(1);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#94a3b8')
    .text(`Fiche générée automatiquement via HDMarket le ${new Date().toLocaleDateString('fr-FR')}`);

  doc.end();
  return finished;
};
