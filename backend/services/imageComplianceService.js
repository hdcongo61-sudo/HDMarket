const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export class ImageComplianceService {
  inspect(file, analysis = {}) {
    const warnings = [];
    const violations = [];
    const fileName = String(file?.originalname || '').toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(file?.mimetype)) violations.push('Format d’image non autorisé.');
    if (Number(file?.size || 0) > 15 * 1024 * 1024) violations.push('Le fichier dépasse 15 Mo.');
    if (analysis?.dimensions?.width > 10000 || analysis?.dimensions?.height > 10000) violations.push('Les dimensions dépassent 10 000 px.');
    if (/screenshot|capture|whatsapp/.test(fileName)) warnings.push('Cette image semble être une capture d’écran.');
    if (/alibaba|taobao|amazon|jumia/.test(fileName)) warnings.push('Vérifiez la présence d’un filigrane d’une autre marketplace.');
    if (analysis?.score < 70) warnings.push('La qualité de l’image est insuffisante pour une fiche premium.');
    return { status: violations.length ? 'blocked' : warnings.length ? 'warning' : 'approved', warnings, violations };
  }
}

export default new ImageComplianceService();
