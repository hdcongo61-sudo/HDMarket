import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Users,
  Package,
  DollarSign,
  Truck,
  MessageSquare,
  Sparkles,
  ShieldAlert,
  Store,
  TrendingUp,
  RefreshCw,
  CheckSquare,
  Square,
  Save,
  Trash2,
  CopyPlus
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import api from '../services/api';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import AuthContext from '../context/AuthContext';

const PERIOD_OPTIONS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'year', label: 'Cette année' },
  { value: 'custom', label: 'Période personnalisée' }
];

const SECTION_CONFIG = [
  { id: 'users', label: 'Utilisateurs', icon: Users, description: 'Profils, villes et vérifications' },
  { id: 'orders', label: 'Commandes', icon: TrendingUp, description: 'Volumes, statuts et valeurs' },
  { id: 'products', label: 'Produits', icon: Package, description: 'Annonces, catégories et paiements' },
  { id: 'payments', label: 'Paiements', icon: DollarSign, description: 'Montants, opérateurs et vérification' },
  { id: 'delivery', label: 'Livraisons', icon: Truck, description: 'Demandes, agents et performance' },
  { id: 'messaging', label: 'Messages', icon: MessageSquare, description: 'Messages commande et non lus' },
  { id: 'boosts', label: 'Boosts', icon: Sparkles, description: 'Demandes, revenus et statuts' },
  { id: 'shopConversions', label: 'Conversions boutique', icon: Store, description: 'Demandes de conversion' },
  { id: 'feedback', label: "Avis d'amélioration", icon: MessageSquare, description: 'Feedback utilisateur' },
  { id: 'complaints', label: 'Réclamations', icon: ShieldAlert, description: 'Litiges et suivi' },
  { id: 'moderation', label: 'Modération & sécurité', icon: ShieldAlert, description: 'Signals, blacklist, actions admin' },
  { id: 'shops', label: 'Boutiques', icon: Store, description: 'Vérifications et top boutiques' },
  { id: 'metrics', label: 'Métriques clés', icon: TrendingUp, description: 'Taux globaux de performance' },
  { id: 'growth', label: 'Croissance', icon: TrendingUp, description: 'Evolution période vs précédente' },
  { id: 'content', label: 'Contenu', icon: FileText, description: 'Qualité des annonces et prix moyens' }
];

const CORE_SECTION_IDS = ['users', 'orders', 'products', 'payments', 'delivery', 'metrics'];
const REPORT_TEMPLATES_KEY = 'hdmarket:admin-report-templates';
const DEFAULT_TEMPLATE_ID_DELIVERY = 'template-delivery';
const DEFAULT_TEMPLATE_ID_FINANCE = 'template-finance';

const makeDefaultSelection = () =>
  SECTION_CONFIG.reduce((acc, section) => {
    acc[section.id] = true;
    return acc;
  }, {});

const formatCurrency = (value) => formatPriceWithStoredSettings(Number(value || 0));
const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');
const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;
const formatDateTime = (value) => new Date(value || Date.now()).toLocaleString('fr-FR');

const humanizeKey = (value) =>
  String(value || 'inconnu')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (s) => s.toUpperCase());

const topEntries = (map = {}, limit = 8) =>
  Object.entries(map || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit);

const buildTemplateStorageKey = (user) => {
  const scope = user?._id || user?.id || user?.email || 'anon';
  return `${REPORT_TEMPLATES_KEY}:${String(scope)}`;
};

const getDefaultTemplates = () => [
  {
    id: DEFAULT_TEMPLATE_ID_DELIVERY,
    name: 'Template Delivery',
    period: 'week',
    selectedSections: SECTION_CONFIG.reduce((acc, section) => {
      acc[section.id] = ['delivery', 'messaging', 'orders', 'payments', 'shopConversions', 'metrics'].includes(section.id);
      return acc;
    }, {})
  },
  {
    id: DEFAULT_TEMPLATE_ID_FINANCE,
    name: 'Template Finance',
    period: 'month',
    selectedSections: SECTION_CONFIG.reduce((acc, section) => {
      acc[section.id] = ['payments', 'orders', 'boosts', 'products', 'metrics', 'shops'].includes(section.id);
      return acc;
    }, {})
  }
];

const getSectionChartConfig = (report, id) => {
  if (!report) return null;

  const makeBar = (rows, color = '#111827') => ({
    type: 'bar',
    data: rows.map(([label, value]) => ({ label, value: Number(value || 0) })),
    series: [{ key: 'value', color, name: 'Valeur' }]
  });

  const makeLine = (rows, color = '#111827') => ({
    type: 'line',
    data: rows.map(([label, value]) => ({ label, value: Number(value || 0) })),
    series: [{ key: 'value', color, name: 'Tendance' }]
  });

  switch (id) {
    case 'users': {
      const cityRows = topEntries(report.users?.byCity || {}, 6).map(([k, v]) => [humanizeKey(k), v]);
      const genderRows = topEntries(report.users?.byGender || {}, 4).map(([k, v]) => [humanizeKey(k), v]);
      return makeBar(cityRows.length ? cityRows : genderRows, '#374151');
    }
    case 'orders':
      return makeBar(topEntries(report.orders?.byStatus || {}, 8).map(([k, v]) => [humanizeKey(k), v]), '#1f2937');
    case 'products':
      return makeBar(topEntries(report.products?.byStatus || {}, 8).map(([k, v]) => [humanizeKey(k), v]), '#111827');
    case 'payments':
      return makeBar(topEntries(report.payments?.byStatus || {}, 8).map(([k, v]) => [humanizeKey(k), v]), '#059669');
    case 'delivery':
      return makeBar(topEntries(report.delivery?.byStatus || {}, 8).map(([k, v]) => [humanizeKey(k), v]), '#4338ca');
    case 'messaging':
      return makeBar(
        [
          ['Total', report.messaging?.totalMessages || 0],
          ['Nouveaux', report.messaging?.newMessages || 0],
          ['Non lus', report.messaging?.unreadMessages || 0],
          ['PJ', report.messaging?.messagesWithAttachments || 0]
        ],
        '#0f766e'
      );
    case 'boosts':
      return makeBar(topEntries(report.boosts?.byStatus || {}, 8).map(([k, v]) => [humanizeKey(k), v]), '#7c3aed');
    case 'shopConversions':
      return makeBar(topEntries(report.shopConversions?.byStatus || {}, 8).map(([k, v]) => [humanizeKey(k), v]), '#0369a1');
    case 'feedback':
      return makeBar(
        [
          ['Total', report.feedback?.total || 0],
          ['Nouveaux', report.feedback?.new || 0],
          ['Lus', report.feedback?.read || 0],
          ['Non lus', report.feedback?.unread || 0]
        ],
        '#475569'
      );
    case 'complaints':
      return makeBar(topEntries(report.complaints?.byStatus || {}, 8).map(([k, v]) => [humanizeKey(k), v]), '#b45309');
    case 'moderation':
      return makeBar(topEntries(report.moderation?.contentReports?.byStatus || {}, 8).map(([k, v]) => [humanizeKey(k), v]), '#be123c');
    case 'shops':
      return makeBar((report.shops?.topShops || []).slice(0, 6).map((shop) => [shop?.name || 'Boutique', shop?.followers || 0]), '#334155');
    case 'metrics':
      return makeLine(
        [
          ['Approval', report.metrics?.approvalRate || 0],
          ['Verify', report.metrics?.verificationRate || 0],
          ['Shop conv', report.metrics?.shopConversionRate || 0],
          ['Delivery', report.metrics?.deliveryCompletionRate || 0],
          ['Agents', report.metrics?.activeDeliveryGuysRate || 0],
          ['Moderation', report.metrics?.contentReportsResolutionRate || 0]
        ],
        '#0f172a'
      );
    case 'growth':
      return makeLine(
        [
          ['Users', report.growth?.monthlyGrowthRate?.users || 0],
          ['Products', report.growth?.monthlyGrowthRate?.products || 0],
          ['Orders', report.growth?.monthlyGrowthRate?.orders || 0],
          ['Payments', report.growth?.monthlyGrowthRate?.payments || 0]
        ],
        '#0f766e'
      );
    case 'content':
      return makeBar(topEntries(report.content?.avgPriceByCategory || {}, 8).map(([k, v]) => [humanizeKey(k), v]), '#4b5563');
    default:
      return null;
  }
};

const hasSectionData = (report, id) => {
  if (!report) return false;
  switch (id) {
    case 'users':
      return Boolean(report.users);
    case 'orders':
      return Boolean(report.orders);
    case 'products':
      return Boolean(report.products);
    case 'payments':
      return Boolean(report.payments);
    case 'delivery':
      return Boolean(report.delivery);
    case 'messaging':
      return Boolean(report.messaging);
    case 'boosts':
      return Boolean(report.boosts);
    case 'shopConversions':
      return Boolean(report.shopConversions);
    case 'feedback':
      return Boolean(report.feedback);
    case 'complaints':
      return Boolean(report.complaints);
    case 'moderation':
      return Boolean(report.moderation);
    case 'shops':
      return Boolean(report.shops);
    case 'metrics':
      return Boolean(report.metrics);
    case 'growth':
      return Boolean(report.growth);
    case 'content':
      return Boolean(report.content);
    default:
      return false;
  }
};

const getSectionRows = (report, id) => {
  if (!report) return [];

  switch (id) {
    case 'users': {
      const rows = [
        ['Total utilisateurs', formatNumber(report.users?.total)],
        ['Nouveaux sur période', formatNumber(report.users?.new)],
        ['Convertis en boutique', formatNumber(report.users?.convertedToShop)],
        ['Utilisateurs suspendus', formatNumber(report.users?.suspended)],
        ['Utilisateurs vérifiés', formatNumber(report.users?.verified)]
      ];
      topEntries(report.users?.byGender || {}, 4).forEach(([key, count]) => {
        rows.push([`Genre: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      topEntries(report.users?.byCity || {}, 6).forEach(([key, count]) => {
        rows.push([`Ville: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      return rows;
    }
    case 'orders': {
      const rows = [
        ['Total commandes', formatNumber(report.orders?.total)],
        ['Nouvelles sur période', formatNumber(report.orders?.new)],
        ['Valeur totale', formatCurrency(report.orders?.totalValue)],
        ['Valeur moyenne', formatCurrency(report.orders?.averageValue)]
      ];
      topEntries(report.orders?.byStatus || {}, 8).forEach(([key, count]) => {
        rows.push([`Statut: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      return rows;
    }
    case 'products': {
      const rows = [
        ['Total produits', formatNumber(report.products?.total)],
        ['Nouveaux sur période', formatNumber(report.products?.new)],
        ['Produits avec paiement', formatNumber(report.products?.withPayment)]
      ];
      topEntries(report.products?.byStatus || {}, 8).forEach(([key, count]) => {
        rows.push([`Statut: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      topEntries(report.products?.byCategory || {}, 8).forEach(([key, count]) => {
        rows.push([`Catégorie: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      return rows;
    }
    case 'payments': {
      const rows = [
        ['Total paiements', formatNumber(report.payments?.total)],
        ['Nouveaux sur période', formatNumber(report.payments?.new)],
        ['Montant total', formatCurrency(report.payments?.totalValue)],
        ['Montant moyen', formatCurrency(report.payments?.averageValue)],
        ['Taux de vérification', formatPercent(report.payments?.verificationRate)]
      ];
      topEntries(report.payments?.byOperator || {}, 8).forEach(([key, count]) => {
        rows.push([`Opérateur: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      topEntries(report.payments?.byStatus || {}, 8).forEach(([key, count]) => {
        rows.push([`Statut paiement: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      return rows;
    }
    case 'delivery': {
      const rows = [
        ['Total demandes livraison', formatNumber(report.delivery?.totalRequests)],
        ['Nouvelles sur période', formatNumber(report.delivery?.newRequests)],
        ['Demandes assignées', formatNumber(report.delivery?.assignedRequests)],
        ['Demandes livrées', formatNumber(report.delivery?.deliveredRequests)],
        ['Demandes échouées', formatNumber(report.delivery?.failedRequests)],
        ['Montant total livraison', formatCurrency(report.delivery?.totalDeliveryPrice)],
        ['Montant moyen livraison', formatCurrency(report.delivery?.averageDeliveryPrice)],
        ['Livreurs total', formatNumber(report.delivery?.agents?.total)],
        ['Livreurs actifs', formatNumber(report.delivery?.agents?.active)]
      ];
      topEntries(report.delivery?.byStatus || {}, 8).forEach(([key, count]) => {
        rows.push([`Statut livraison: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      topEntries(report.delivery?.byStage || {}, 8).forEach(([key, count]) => {
        rows.push([`Etape livraison: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      return rows;
    }
    case 'messaging': {
      return [
        ['Total messages commande', formatNumber(report.messaging?.totalMessages)],
        ['Nouveaux messages', formatNumber(report.messaging?.newMessages)],
        ['Messages non lus', formatNumber(report.messaging?.unreadMessages)],
        ['Messages avec pièces jointes', formatNumber(report.messaging?.messagesWithAttachments)]
      ];
    }
    case 'boosts': {
      const rows = [
        ['Total demandes boost', formatNumber(report.boosts?.totalRequests)],
        ['Nouvelles demandes', formatNumber(report.boosts?.newRequests)],
        ['Revenu total boosts', formatCurrency(report.boosts?.totalRevenue)],
        ['Revenu moyen boost', formatCurrency(report.boosts?.averageRevenue)]
      ];
      topEntries(report.boosts?.byStatus || {}, 8).forEach(([key, count]) => {
        rows.push([`Statut boost: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      return rows;
    }
    case 'shopConversions': {
      const rows = [
        ['Total demandes conversion', formatNumber(report.shopConversions?.totalRequests)],
        ['Nouvelles demandes', formatNumber(report.shopConversions?.newRequests)]
      ];
      topEntries(report.shopConversions?.byStatus || {}, 8).forEach(([key, count]) => {
        rows.push([`Statut conversion: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      return rows;
    }
    case 'feedback': {
      return [
        ["Total avis d'amélioration", formatNumber(report.feedback?.total)],
        ['Nouveaux avis', formatNumber(report.feedback?.new)],
        ['Avis lus', formatNumber(report.feedback?.read)],
        ['Avis non lus', formatNumber(report.feedback?.unread)]
      ];
    }
    case 'complaints': {
      const rows = [
        ['Total réclamations', formatNumber(report.complaints?.total)],
        ['Nouvelles réclamations', formatNumber(report.complaints?.new)]
      ];
      topEntries(report.complaints?.byStatus || {}, 8).forEach(([key, count]) => {
        rows.push([`Statut réclamation: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      return rows;
    }
    case 'moderation': {
      const rows = [
        ['Signals contenu total', formatNumber(report.moderation?.contentReports?.total)],
        ['Nouveaux signals contenu', formatNumber(report.moderation?.contentReports?.new)],
        ['Numéros blacklist actifs', formatNumber(report.moderation?.phoneBlacklist?.active)],
        ['Nouveaux numéros blacklist', formatNumber(report.moderation?.phoneBlacklist?.new)],
        ['Numéros débloqués', formatNumber(report.moderation?.phoneBlacklist?.unblocked)],
        ['Actions admin (période)', formatNumber(report.moderation?.adminActions?.total)]
      ];
      topEntries(report.moderation?.contentReports?.byStatus || {}, 8).forEach(([key, count]) => {
        rows.push([`Signal contenu: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      topEntries(report.moderation?.adminActions?.byType || {}, 8).forEach(([key, count]) => {
        rows.push([`Action admin: ${humanizeKey(key)}`, formatNumber(count)]);
      });
      return rows;
    }
    case 'shops': {
      const rows = [
        ['Total boutiques', formatNumber(report.shops?.total)],
        ['Boutiques vérifiées', formatNumber(report.shops?.verified)],
        ['Taux conversion boutique', formatPercent(report.shops?.conversionRate)]
      ];
      (report.shops?.topShops || []).slice(0, 5).forEach((shop, index) => {
        rows.push([`Top ${index + 1}: ${shop?.name || 'Boutique'}`, formatNumber(shop?.followers)]);
      });
      return rows;
    }
    case 'metrics': {
      return [
        ["Taux d'approbation", formatPercent(report.metrics?.approvalRate)],
        ['Taux de vérification', formatPercent(report.metrics?.verificationRate)],
        ['Taux conversion boutique', formatPercent(report.metrics?.shopConversionRate)],
        ['Taux livraison réussie', formatPercent(report.metrics?.deliveryCompletionRate)],
        ['Taux livreurs actifs', formatPercent(report.metrics?.activeDeliveryGuysRate)],
        ['Taux résolution signals', formatPercent(report.metrics?.contentReportsResolutionRate)],
        ['Panier moyen commande', formatCurrency(report.metrics?.averageOrderValue)],
        ['Montant moyen paiement', formatCurrency(report.metrics?.averagePaymentValue)]
      ];
    }
    case 'growth': {
      return [
        ['Croissance utilisateurs', formatPercent(report.growth?.monthlyGrowthRate?.users)],
        ['Croissance produits', formatPercent(report.growth?.monthlyGrowthRate?.products)],
        ['Croissance commandes', formatPercent(report.growth?.monthlyGrowthRate?.orders)],
        ['Croissance paiements', formatPercent(report.growth?.monthlyGrowthRate?.payments)]
      ];
    }
    case 'content': {
      const rows = [
        ['Photos moyennes / annonce', Number(report.content?.avgPhotosPerListing || 0).toFixed(2)],
        ['Longueur moyenne description', `${formatNumber(report.content?.avgDescriptionLength)} caractères`]
      ];
      topEntries(report.content?.avgPriceByCategory || {}, 8).forEach(([key, value]) => {
        rows.push([`Prix moyen ${humanizeKey(key)}`, formatCurrency(value)]);
      });
      return rows;
    }
    default:
      return [];
  }
};

export default function AdminReports() {
  const { user } = useContext(AuthContext);
  const templateStorageKey = useMemo(() => buildTemplateStorageKey(user), [user]);
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSections, setSelectedSections] = useState(() => makeDefaultSelection());
  const [templates, setTemplates] = useState(() => getDefaultTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(templateStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        setTemplates(parsed);
        return;
      }
      const defaults = getDefaultTemplates();
      setTemplates(defaults);
      window.localStorage.setItem(templateStorageKey, JSON.stringify(defaults));
    } catch (_error) {
      const defaults = getDefaultTemplates();
      setTemplates(defaults);
    }
  }, [templateStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(templateStorageKey, JSON.stringify(templates));
  }, [templateStorageKey, templates]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ period });
      if (period === 'custom') {
        if (!startDate || !endDate) {
          setError('Veuillez sélectionner une date de début et de fin.');
          setLoading(false);
          return;
        }
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }
      const { data } = await api.get(`/admin/reports?${params.toString()}`);
      setReport(data || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors de la génération du rapport.');
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  const toggleSection = useCallback((id) => {
    setSelectedSections((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const setCoreSelection = useCallback(() => {
    setSelectedSections(
      SECTION_CONFIG.reduce((acc, section) => {
        acc[section.id] = CORE_SECTION_IDS.includes(section.id);
        return acc;
      }, {})
    );
  }, []);

  const setAllSelection = useCallback(() => {
    setSelectedSections(makeDefaultSelection());
  }, []);

  const applyTemplate = useCallback(() => {
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    const baseSelection = SECTION_CONFIG.reduce((acc, section) => {
      acc[section.id] = Boolean(template.selectedSections?.[section.id]);
      return acc;
    }, {});
    setSelectedSections(baseSelection);
    if (template.period) {
      setPeriod(template.period);
      if (template.period !== 'custom') {
        setStartDate('');
        setEndDate('');
      }
    }
    setTemplateName(template.name || '');
  }, [selectedTemplateId, templates]);

  const saveTemplateAsNew = useCallback(() => {
    const cleanName = String(templateName || '').trim();
    if (!cleanName) {
      setError('Veuillez donner un nom au template.');
      return;
    }
    setError('');
    const nowIso = new Date().toISOString();
    const nextTemplate = {
      id: `template-${Date.now()}`,
      name: cleanName,
      period,
      selectedSections,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    setTemplates((current) => [nextTemplate, ...current]);
    setSelectedTemplateId(nextTemplate.id);
  }, [period, selectedSections, templateName]);

  const updateTemplate = useCallback(() => {
    const cleanName = String(templateName || '').trim();
    if (!selectedTemplateId) {
      setError('Sélectionnez un template à mettre à jour.');
      return;
    }
    if (!cleanName) {
      setError('Le nom du template est requis.');
      return;
    }
    setError('');
    setTemplates((current) =>
      current.map((item) =>
        item.id === selectedTemplateId
          ? {
              ...item,
              name: cleanName,
              period,
              selectedSections,
              updatedAt: new Date().toISOString()
            }
          : item
      )
    );
  }, [period, selectedSections, selectedTemplateId, templateName]);

  const deleteTemplate = useCallback(() => {
    if (!selectedTemplateId) return;
    setTemplates((current) => current.filter((item) => item.id !== selectedTemplateId));
    setSelectedTemplateId('');
    setTemplateName('');
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    setTemplateName(template.name || '');
  }, [selectedTemplateId, templates]);

  const activeSections = useMemo(
    () => SECTION_CONFIG.filter((section) => selectedSections[section.id] && hasSectionData(report, section.id)),
    [report, selectedSections]
  );

  const summaryCards = useMemo(() => {
    if (!report) return [];
    const cards = [];
    if (selectedSections.users && report.users) {
      cards.push({ title: 'Utilisateurs', value: formatNumber(report.users.total), sub: `+${formatNumber(report.users.new)}`, icon: Users });
    }
    if (selectedSections.orders && report.orders) {
      cards.push({ title: 'Commandes', value: formatNumber(report.orders.total), sub: `+${formatNumber(report.orders.new)}`, icon: TrendingUp });
    }
    if (selectedSections.payments && report.payments) {
      cards.push({ title: 'Paiements', value: formatCurrency(report.payments.totalValue), sub: `${formatPercent(report.payments.verificationRate)} vérifiés`, icon: DollarSign });
    }
    if (selectedSections.delivery && report.delivery) {
      cards.push({ title: 'Livraisons', value: formatNumber(report.delivery.totalRequests), sub: `${formatNumber(report.delivery.deliveredRequests)} livrées`, icon: Truck });
    }
    if (selectedSections.boosts && report.boosts) {
      cards.push({ title: 'Boosts', value: formatCurrency(report.boosts.totalRevenue), sub: `${formatNumber(report.boosts.totalRequests)} demandes`, icon: Sparkles });
    }
    if (selectedSections.messaging && report.messaging) {
      cards.push({ title: 'Messages', value: formatNumber(report.messaging.totalMessages), sub: `${formatNumber(report.messaging.unreadMessages)} non lus`, icon: MessageSquare });
    }
    return cards.slice(0, 6);
  }, [report, selectedSections]);

  const exportPDF = useCallback(async () => {
    if (!report || activeSections.length === 0) return;
    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      let yPos = 18;

      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('Rapport HDMarket', 14, yPos);
      yPos += 7;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Période: ${report?.period?.label || '-'}`, 14, yPos);
      yPos += 5;
      doc.text(`Généré le: ${formatDateTime(report?.generatedAt)}`, 14, yPos);
      yPos += 8;

      for (const section of activeSections) {
        const rows = getSectionRows(report, section.id);
        if (!rows.length) continue;
        if (yPos > 250) {
          doc.addPage();
          yPos = 16;
        }
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(section.label, 14, yPos);
        yPos += 3;
        autoTable(doc, {
          startY: yPos,
          head: [['Métrique', 'Valeur']],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [34, 34, 34] },
          styles: { fontSize: 9, cellPadding: 2.5 },
          margin: { left: 14, right: 14 }
        });
        yPos = (doc.lastAutoTable?.finalY || yPos) + 7;
      }

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i}/${pageCount}`, 196, 289, { align: 'right' });
      }

      doc.save(`rapport-hdmarket-${report.period?.type || 'custom'}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (_error) {
      setError("Erreur lors de l'export PDF.");
    }
  }, [activeSections, report]);

  const exportExcel = useCallback(async () => {
    if (!report || activeSections.length === 0) return;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Rapport');
      sheet.columns = [
        { header: 'Section', key: 'section', width: 28 },
        { header: 'Métrique', key: 'metric', width: 44 },
        { header: 'Valeur', key: 'value', width: 24 }
      ];

      sheet.addRow({
        section: 'Période',
        metric: report?.period?.label || '-',
        value: formatDateTime(report?.generatedAt)
      });
      sheet.addRow({});

      activeSections.forEach((section) => {
        const rows = getSectionRows(report, section.id);
        if (!rows.length) return;
        rows.forEach(([metric, value], index) => {
          sheet.addRow({
            section: index === 0 ? section.label : '',
            metric,
            value
          });
        });
        sheet.addRow({});
      });

      const header = sheet.getRow(1);
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      header.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF111827' }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-hdmarket-${report.period?.type || 'custom'}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (_error) {
      setError("Erreur lors de l'export Excel.");
    }
  }, [activeSections, report]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:py-8 space-y-6">
        <header className="rounded-2xl bg-white border border-gray-200 p-4 md:p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                <FileText className="w-3.5 h-3.5" />
                Report Builder
              </div>
              <h1 className="mt-3 text-2xl md:text-3xl font-black text-gray-900">Rapports Administratifs</h1>
              <p className="mt-1 text-sm text-gray-600">
                Sélectionnez les blocs à inclure, puis générez un rapport à jour avec les nouveaux modules.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Dernière génération: {report ? formatDateTime(report.generatedAt) : '—'}
            </div>
          </div>
        </header>

        <section className="rounded-2xl bg-white border border-gray-200 p-4 md:p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Période</label>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800/10"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {period === 'custom' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Date début</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Date fin</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800/10"
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 md:p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Templates de rapport</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800/10"
                >
                  <option value="">Choisir un template</option>
                  {templates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Nom</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Ex: Opérations hebdo"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-800/10"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={applyTemplate}
                  disabled={!selectedTemplateId}
                  className="w-full rounded-xl bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                  Appliquer template
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveTemplateAsNew}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                <CopyPlus className="w-3.5 h-3.5" />
                Sauvegarder nouveau
              </button>
              <button
                type="button"
                onClick={updateTemplate}
                disabled={!selectedTemplateId}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                Mettre à jour
              </button>
              <button
                type="button"
                onClick={deleteTemplate}
                disabled={!selectedTemplateId}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-sm font-semibold text-gray-900">Informations à inclure</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={setCoreSelection}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Pack essentiel
                </button>
                <button
                  type="button"
                  onClick={setAllSelection}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Tout sélectionner
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {SECTION_CONFIG.map((section) => {
                const Icon = section.icon;
                const selected = Boolean(selectedSections[section.id]);
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className={`text-left rounded-xl border p-3 transition-all ${
                      selected
                        ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-semibold">{section.label}</span>
                    </div>
                    <p className={`mt-1 text-xs ${selected ? 'text-gray-200' : 'text-gray-500'}`}>
                      {section.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateReport}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {loading ? 'Génération...' : 'Générer le rapport'}
            </button>
            <button
              type="button"
              onClick={exportPDF}
              disabled={!report || activeSections.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={exportExcel}
              disabled={!report || activeSections.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </section>

        {report ? (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.title}</p>
                      <Icon className="w-4 h-4 text-gray-500" />
                    </div>
                    <p className="mt-2 text-xl font-black text-gray-900">{card.value}</p>
                    <p className="text-xs text-gray-500">{card.sub}</p>
                  </div>
                );
              })}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeSections.map((section) => {
                const Icon = section.icon;
                const rows = getSectionRows(report, section.id);
                const chartConfig = getSectionChartConfig(report, section.id);
                if (!rows.length) return null;
                return (
                  <article key={section.id} className="rounded-2xl bg-white border border-gray-200 p-4 md:p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="rounded-lg bg-gray-100 p-2">
                        <Icon className="w-4 h-4 text-gray-700" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900">{section.label}</h3>
                    </div>
                    <div className="space-y-2">
                      {rows.map(([label, value]) => (
                        <div key={`${section.id}-${label}`} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2">
                          <span className="text-sm text-gray-600">{label}</span>
                          <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                    {chartConfig?.data?.length ? (
                      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Graphique
                        </p>
                        <ResponsiveContainer width="100%" height={220}>
                          {chartConfig.type === 'line' ? (
                            <LineChart data={chartConfig.data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="label" stroke="#6b7280" fontSize={11} />
                              <YAxis stroke="#6b7280" fontSize={11} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px'
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey={chartConfig.series?.[0]?.key || 'value'}
                                name={chartConfig.series?.[0]?.name || 'Valeur'}
                                stroke={chartConfig.series?.[0]?.color || '#111827'}
                                strokeWidth={2.5}
                                dot={{ r: 3 }}
                              />
                            </LineChart>
                          ) : (
                            <BarChart data={chartConfig.data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="label" stroke="#6b7280" fontSize={11} />
                              <YAxis stroke="#6b7280" fontSize={11} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px'
                                }}
                              />
                              <Bar
                                dataKey={chartConfig.series?.[0]?.key || 'value'}
                                name={chartConfig.series?.[0]?.name || 'Valeur'}
                                fill={chartConfig.series?.[0]?.color || '#111827'}
                                radius={[6, 6, 0, 0]}
                              />
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            Génère un rapport pour afficher les données.
          </section>
        )}
      </div>
    </div>
  );
}
