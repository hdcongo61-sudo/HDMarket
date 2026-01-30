import React, { useCallback, useState } from 'react';
import { FileText, Download, Calendar, TrendingUp, Users, Package, DollarSign, MessageSquare, AlertCircle, Store } from 'lucide-react';
import api from '../services/api';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Aujourd\'hui' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'year', label: 'Cette année' },
  { value: 'custom', label: 'Période personnalisée' }
];

export default function AdminReports() {
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ period });
      if (period === 'custom') {
        if (!startDate || !endDate) {
          setError('Veuillez sélectionner une date de début et de fin');
          setLoading(false);
          return;
        }
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }

      const { data } = await api.get(`/admin/reports?${params.toString()}`);
      setReport(data);
    } catch (err) {
      console.error('Generate report error:', err);
      setError(err.response?.data?.message || 'Erreur lors de la génération du rapport');
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  const exportPDF = useCallback(async () => {
    if (!report) return;

    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      let yPos = 20;

      // Title
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('Rapport HDMarket', 105, yPos, { align: 'center' });
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text(report.period.label, 105, yPos, { align: 'center' });
      yPos += 5;

      doc.setFontSize(10);
      doc.text(`Généré le ${new Date(report.generatedAt).toLocaleDateString('fr-FR')}`, 105, yPos, { align: 'center' });
      yPos += 15;

      // Users section
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Utilisateurs', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Métrique', 'Valeur']],
        body: [
          ['Total utilisateurs', report.users.total.toLocaleString()],
          ['Nouveaux utilisateurs', report.users.new.toLocaleString()],
          ['Convertis en boutique', report.users.convertedToShop.toLocaleString()],
          ['Utilisateurs suspendus', report.users.suspended.toLocaleString()],
          ['Utilisateurs vérifiés', report.users.verified.toLocaleString()]
        ],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14 }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Orders section
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Commandes', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Métrique', 'Valeur']],
        body: [
          ['Total commandes', report.orders.total.toLocaleString()],
          ['Nouvelles commandes', report.orders.new.toLocaleString()],
          ['Valeur totale', `${report.orders.totalValue.toLocaleString()} FCFA`],
          ['Valeur moyenne', `${Math.round(report.orders.averageValue).toLocaleString()} FCFA`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14 }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Products section
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Annonces', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Métrique', 'Valeur']],
        body: [
          ['Total annonces', report.products.total.toLocaleString()],
          ['Nouvelles annonces', report.products.new.toLocaleString()],
          ['Annonces approuvées', (report.products.byStatus.approved || 0).toLocaleString()],
          ['Annonces en attente', (report.products.byStatus.pending || 0).toLocaleString()],
          ['Annonces rejetées', (report.products.byStatus.rejected || 0).toLocaleString()]
        ],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14 }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Payments section
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Paiements', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Métrique', 'Valeur']],
        body: [
          ['Total paiements', report.payments.total.toLocaleString()],
          ['Nouveaux paiements', report.payments.new.toLocaleString()],
          ['Montant total', `${report.payments.totalValue.toLocaleString()} FCFA`],
          ['Montant moyen', `${Math.round(report.payments.averageValue).toLocaleString()} FCFA`],
          ['Taux de vérification', `${report.payments.verificationRate}%`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14 }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Growth Metrics section
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      if (report.growth) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Croissance', 14, yPos);
        yPos += 7;

        autoTable(doc, {
          startY: yPos,
          head: [['Métrique', 'Taux de croissance']],
          body: [
            ['Utilisateurs', `${report.growth.monthlyGrowthRate.users >= 0 ? '+' : ''}${report.growth.monthlyGrowthRate.users}%`],
            ['Annonces', `${report.growth.monthlyGrowthRate.products >= 0 ? '+' : ''}${report.growth.monthlyGrowthRate.products}%`],
            ['Commandes', `${report.growth.monthlyGrowthRate.orders >= 0 ? '+' : ''}${report.growth.monthlyGrowthRate.orders}%`],
            ['Paiements', `${report.growth.monthlyGrowthRate.payments >= 0 ? '+' : ''}${report.growth.monthlyGrowthRate.payments}%`]
          ],
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229] },
          margin: { left: 14 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Content Metrics section
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      if (report.content) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Métriques de contenu', 14, yPos);
        yPos += 7;

        const contentBody = [
          ['Photos moyennes par annonce', report.content.avgPhotosPerListing.toFixed(2)],
          ['Longueur moyenne des descriptions', `${report.content.avgDescriptionLength} caractères`]
        ];

        if (report.content.avgPriceByCategory && Object.keys(report.content.avgPriceByCategory).length > 0) {
          contentBody.push(['', '']);
          contentBody.push(['Prix moyen par catégorie', '']);
          Object.entries(report.content.avgPriceByCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .forEach(([category, avgPrice]) => {
              contentBody.push([category, `${Math.round(avgPrice).toLocaleString()} FCFA`]);
            });
        }

        autoTable(doc, {
          startY: yPos,
          head: [['Métrique', 'Valeur']],
          body: contentBody,
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229] },
          margin: { left: 14 }
        });
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(
          `Page ${i} sur ${pageCount} - HDMarket Admin`,
          105,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      doc.save(`rapport-hdmarket-${report.period.type}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Erreur lors de l\'export PDF');
    }
  }, [report]);

  const exportExcel = useCallback(async () => {
    if (!report) return;

    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();

      // Summary sheet
      const summarySheet = workbook.addWorksheet('Résumé');
      summarySheet.columns = [
        { header: 'Catégorie', key: 'category', width: 30 },
        { header: 'Métrique', key: 'metric', width: 30 },
        { header: 'Valeur', key: 'value', width: 20 }
      ];

      summarySheet.addRow({ category: 'Période', metric: report.period.label, value: '' });
      summarySheet.addRow({ category: 'Généré le', metric: new Date(report.generatedAt).toLocaleString('fr-FR'), value: '' });
      summarySheet.addRow({});

      // Users
      summarySheet.addRow({ category: 'UTILISATEURS', metric: '', value: '' });
      summarySheet.addRow({ category: '', metric: 'Total utilisateurs', value: report.users.total });
      summarySheet.addRow({ category: '', metric: 'Nouveaux utilisateurs', value: report.users.new });
      summarySheet.addRow({ category: '', metric: 'Convertis en boutique', value: report.users.convertedToShop });
      summarySheet.addRow({ category: '', metric: 'Utilisateurs suspendus', value: report.users.suspended });
      summarySheet.addRow({ category: '', metric: 'Utilisateurs vérifiés', value: report.users.verified });
      summarySheet.addRow({});

      // Orders
      summarySheet.addRow({ category: 'COMMANDES', metric: '', value: '' });
      summarySheet.addRow({ category: '', metric: 'Total commandes', value: report.orders.total });
      summarySheet.addRow({ category: '', metric: 'Nouvelles commandes', value: report.orders.new });
      summarySheet.addRow({ category: '', metric: 'Valeur totale (FCFA)', value: report.orders.totalValue });
      summarySheet.addRow({ category: '', metric: 'Valeur moyenne (FCFA)', value: Math.round(report.orders.averageValue) });
      summarySheet.addRow({});

      // Products
      summarySheet.addRow({ category: 'ANNONCES', metric: '', value: '' });
      summarySheet.addRow({ category: '', metric: 'Total annonces', value: report.products.total });
      summarySheet.addRow({ category: '', metric: 'Nouvelles annonces', value: report.products.new });
      summarySheet.addRow({ category: '', metric: 'Annonces approuvées', value: report.products.byStatus.approved || 0 });
      summarySheet.addRow({ category: '', metric: 'Annonces en attente', value: report.products.byStatus.pending || 0 });
      summarySheet.addRow({ category: '', metric: 'Annonces rejetées', value: report.products.byStatus.rejected || 0 });
      summarySheet.addRow({});

      // Payments
      summarySheet.addRow({ category: 'PAIEMENTS', metric: '', value: '' });
      summarySheet.addRow({ category: '', metric: 'Total paiements', value: report.payments.total });
      summarySheet.addRow({ category: '', metric: 'Nouveaux paiements', value: report.payments.new });
      summarySheet.addRow({ category: '', metric: 'Montant total (FCFA)', value: report.payments.totalValue });
      summarySheet.addRow({ category: '', metric: 'Montant moyen (FCFA)', value: Math.round(report.payments.averageValue) });
      summarySheet.addRow({ category: '', metric: 'Taux de vérification (%)', value: report.payments.verificationRate });
      summarySheet.addRow({});

      // Growth Metrics
      if (report.growth) {
        summarySheet.addRow({ category: 'CROISSANCE', metric: '', value: '' });
        summarySheet.addRow({ category: '', metric: 'Taux croissance utilisateurs (%)', value: report.growth.monthlyGrowthRate.users });
        summarySheet.addRow({ category: '', metric: 'Taux croissance annonces (%)', value: report.growth.monthlyGrowthRate.products });
        summarySheet.addRow({ category: '', metric: 'Taux croissance commandes (%)', value: report.growth.monthlyGrowthRate.orders });
        summarySheet.addRow({ category: '', metric: 'Taux croissance paiements (%)', value: report.growth.monthlyGrowthRate.payments });
        summarySheet.addRow({});
      }

      // Content Metrics
      if (report.content) {
        summarySheet.addRow({ category: 'CONTENU', metric: '', value: '' });
        summarySheet.addRow({ category: '', metric: 'Photos moyennes par annonce', value: report.content.avgPhotosPerListing.toFixed(2) });
        summarySheet.addRow({ category: '', metric: 'Longueur moyenne descriptions', value: report.content.avgDescriptionLength });
        summarySheet.addRow({});
        
        if (report.content.avgPriceByCategory && Object.keys(report.content.avgPriceByCategory).length > 0) {
          summarySheet.addRow({ category: 'PRIX MOYEN PAR CATÉGORIE', metric: '', value: '' });
          Object.entries(report.content.avgPriceByCategory)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, avgPrice]) => {
              summarySheet.addRow({ category: '', metric: category, value: Math.round(avgPrice) });
            });
        }
      }

      // Style header row
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }
      };
      summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      // Users by city sheet
      const citySheet = workbook.addWorksheet('Par Ville');
      citySheet.columns = [
        { header: 'Ville', key: 'city', width: 20 },
        { header: 'Utilisateurs', key: 'users', width: 15 }
      ];

      Object.entries(report.users.byCity).forEach(([city, count]) => {
        citySheet.addRow({ city, users: count });
      });

      citySheet.getRow(1).font = { bold: true };
      citySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }
      };
      citySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-hdmarket-${report.period.type}-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export error:', err);
      alert('Erreur lors de l\'export Excel');
    }
  }, [report]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/30 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Rapports Administratifs
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Générez des rapports détaillés sur l'activité de votre plateforme
          </p>
        </header>

        {/* Report Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Configuration du rapport</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Period selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Période
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom date range */}
            {period === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={generateReport}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
            >
              <Calendar className="w-4 h-4" />
              {loading ? 'Génération...' : 'Générer le rapport'}
            </button>

            {report && (
              <>
                <button
                  onClick={exportPDF}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Exporter PDF
                </button>

                <button
                  onClick={exportExcel}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Exporter Excel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Report Display */}
        {report && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                title="Utilisateurs"
                value={report.users.total}
                change={report.users.new}
                color="blue"
              />
              <StatCard
                icon={Package}
                title="Annonces"
                value={report.products.total}
                change={report.products.new}
                color="purple"
              />
              <StatCard
                icon={DollarSign}
                title="Paiements"
                value={`${Math.round(report.payments.totalValue).toLocaleString()} FCFA`}
                change={report.payments.new}
                color="green"
              />
              <StatCard
                icon={TrendingUp}
                title="Commandes"
                value={report.orders.total}
                change={report.orders.new}
                color="orange"
              />
            </div>

            {/* Detailed Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Users Section */}
              <ReportSection title="Utilisateurs" icon={Users}>
                <ReportRow label="Total" value={report.users.total.toLocaleString()} />
                <ReportRow label="Nouveaux" value={report.users.new.toLocaleString()} highlight />
                <ReportRow label="Convertis en boutique" value={report.users.convertedToShop.toLocaleString()} />
                <ReportRow label="Suspendus" value={report.users.suspended.toLocaleString()} />
                <ReportRow label="Vérifiés" value={report.users.verified.toLocaleString()} />
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Par genre</h4>
                  {Object.entries(report.users.byGender).map(([gender, count]) => (
                    <ReportRow key={gender} label={gender === 'homme' ? 'Hommes' : 'Femmes'} value={count.toLocaleString()} small />
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Par ville</h4>
                  {Object.entries(report.users.byCity).map(([city, count]) => (
                    <ReportRow key={city} label={city} value={count.toLocaleString()} small />
                  ))}
                </div>
              </ReportSection>

              {/* Orders Section */}
              <ReportSection title="Commandes" icon={TrendingUp}>
                <ReportRow label="Total" value={report.orders.total.toLocaleString()} />
                <ReportRow label="Nouvelles" value={report.orders.new.toLocaleString()} highlight />
                <ReportRow label="Valeur totale" value={`${Math.round(report.orders.totalValue).toLocaleString()} FCFA`} />
                <ReportRow label="Valeur moyenne" value={`${Math.round(report.orders.averageValue).toLocaleString()} FCFA`} />
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Par statut</h4>
                  {Object.entries(report.orders.byStatus).map(([status, count]) => (
                    <ReportRow key={status} label={status} value={count.toLocaleString()} small />
                  ))}
                </div>
              </ReportSection>

              {/* Products Section */}
              <ReportSection title="Annonces" icon={Package}>
                <ReportRow label="Total" value={report.products.total.toLocaleString()} />
                <ReportRow label="Nouvelles" value={report.products.new.toLocaleString()} highlight />
                <ReportRow label="Avec paiement" value={report.products.withPayment.toLocaleString()} />
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Par statut</h4>
                  <ReportRow label="Approuvées" value={(report.products.byStatus.approved || 0).toLocaleString()} small />
                  <ReportRow label="En attente" value={(report.products.byStatus.pending || 0).toLocaleString()} small />
                  <ReportRow label="Rejetées" value={(report.products.byStatus.rejected || 0).toLocaleString()} small />
                </div>
                {Object.keys(report.products.byCategory).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Par catégorie</h4>
                    {Object.entries(report.products.byCategory).slice(0, 5).map(([category, count]) => (
                      <ReportRow key={category} label={category} value={count.toLocaleString()} small />
                    ))}
                  </div>
                )}
              </ReportSection>

              {/* Payments Section */}
              <ReportSection title="Paiements" icon={DollarSign}>
                <ReportRow label="Total" value={report.payments.total.toLocaleString()} />
                <ReportRow label="Nouveaux" value={report.payments.new.toLocaleString()} highlight />
                <ReportRow label="Montant total" value={`${Math.round(report.payments.totalValue).toLocaleString()} FCFA`} />
                <ReportRow label="Montant moyen" value={`${Math.round(report.payments.averageValue).toLocaleString()} FCFA`} />
                <ReportRow label="Taux de vérification" value={`${report.payments.verificationRate}%`} />
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Par opérateur</h4>
                  {Object.entries(report.payments.byOperator).map(([operator, count]) => (
                    <ReportRow key={operator} label={operator} value={count.toLocaleString()} small />
                  ))}
                </div>
              </ReportSection>

              {/* Feedback Section */}
              <ReportSection title="Avis d'amélioration" icon={MessageSquare}>
                <ReportRow label="Total" value={report.feedback.total.toLocaleString()} />
                <ReportRow label="Nouveaux" value={report.feedback.new.toLocaleString()} highlight />
                <ReportRow label="Lus" value={report.feedback.read.toLocaleString()} />
                <ReportRow label="Non lus" value={report.feedback.unread.toLocaleString()} />
              </ReportSection>

              {/* Complaints Section */}
              <ReportSection title="Réclamations" icon={AlertCircle}>
                <ReportRow label="Total" value={report.complaints.total.toLocaleString()} />
                <ReportRow label="Nouvelles" value={report.complaints.new.toLocaleString()} highlight />
                {Object.keys(report.complaints.byStatus).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Par statut</h4>
                    {Object.entries(report.complaints.byStatus).map(([status, count]) => (
                      <ReportRow key={status} label={status} value={count.toLocaleString()} small />
                    ))}
                  </div>
                )}
              </ReportSection>

              {/* Shops Section */}
              <ReportSection title="Boutiques" icon={Store}>
                <ReportRow label="Total" value={report.shops.total.toLocaleString()} />
                <ReportRow label="Vérifiées" value={report.shops.verified.toLocaleString()} />
                <ReportRow label="Taux de conversion" value={`${report.shops.conversionRate}%`} />
                {report.shops.topShops.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Top boutiques</h4>
                    {report.shops.topShops.map((shop, i) => (
                      <ReportRow key={i} label={shop.name} value={`${shop.followers} followers`} small />
                    ))}
                  </div>
                )}
              </ReportSection>

              {/* Key Metrics */}
              <ReportSection title="Métriques clés" icon={TrendingUp}>
                <ReportRow label="Taux d'approbation" value={`${report.metrics.approvalRate}%`} />
                <ReportRow label="Taux de vérification" value={`${report.metrics.verificationRate}%`} />
                <ReportRow label="Taux de conversion boutique" value={`${report.metrics.shopConversionRate}%`} />
                <ReportRow label="Valeur moyenne commande" value={`${Math.round(report.metrics.averageOrderValue).toLocaleString()} FCFA`} />
                <ReportRow label="Valeur moyenne paiement" value={`${Math.round(report.metrics.averagePaymentValue).toLocaleString()} FCFA`} />
              </ReportSection>
            </div>

            {/* Growth Metrics Section */}
            {report.growth && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <ReportSection title="Croissance" icon={TrendingUp}>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Taux de croissance mensuel</h4>
                  <ReportRow label="Utilisateurs" value={`${report.growth.monthlyGrowthRate.users >= 0 ? '+' : ''}${report.growth.monthlyGrowthRate.users}%`} />
                  <ReportRow label="Annonces" value={`${report.growth.monthlyGrowthRate.products >= 0 ? '+' : ''}${report.growth.monthlyGrowthRate.products}%`} />
                  <ReportRow label="Commandes" value={`${report.growth.monthlyGrowthRate.orders >= 0 ? '+' : ''}${report.growth.monthlyGrowthRate.orders}%`} />
                  <ReportRow label="Paiements" value={`${report.growth.monthlyGrowthRate.payments >= 0 ? '+' : ''}${report.growth.monthlyGrowthRate.payments}%`} />
                  
                  {report.growth.growthByCity && Object.keys(report.growth.growthByCity).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Croissance par ville</h4>
                      {Object.entries(report.growth.growthByCity).slice(0, 5).map(([city, data]) => (
                        <div key={city} className="mb-2">
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{city}</div>
                          <ReportRow label="Utilisateurs" value={`${data.users >= 0 ? '+' : ''}${data.users}%`} small />
                          <ReportRow label="Annonces" value={`${data.products >= 0 ? '+' : ''}${data.products}%`} small />
                        </div>
                      ))}
                    </div>
                  )}
                </ReportSection>

                {report.growth.seasonalTrends && (
                  <ReportSection title="Tendances saisonnières" icon={Calendar}>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Évolution sur les 12 derniers mois
                    </p>
                    {report.growth.seasonalTrends.users && report.growth.seasonalTrends.users.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Utilisateurs</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {report.growth.seasonalTrends.users.slice(-6).map((trend, i) => (
                            <ReportRow key={i} label={trend.period} value={trend.count.toLocaleString()} small />
                          ))}
                        </div>
                      </div>
                    )}
                    {report.growth.seasonalTrends.products && report.growth.seasonalTrends.products.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Annonces</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {report.growth.seasonalTrends.products.slice(-6).map((trend, i) => (
                            <ReportRow key={i} label={trend.period} value={trend.count.toLocaleString()} small />
                          ))}
                        </div>
                      </div>
                    )}
                    {report.growth.seasonalTrends.orders && report.growth.seasonalTrends.orders.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Commandes</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {report.growth.seasonalTrends.orders.slice(-6).map((trend, i) => (
                            <ReportRow key={i} label={trend.period} value={`${trend.count} (${Math.round(trend.totalValue).toLocaleString()} FCFA)`} small />
                          ))}
                        </div>
                      </div>
                    )}
                  </ReportSection>
                )}
              </div>
            )}

            {/* Content Metrics Section */}
            {report.content && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <ReportSection title="Métriques de contenu" icon={Package}>
                  <ReportRow label="Photos moyennes par annonce" value={report.content.avgPhotosPerListing.toFixed(2)} />
                  <ReportRow label="Longueur moyenne des descriptions" value={`${report.content.avgDescriptionLength} caractères`} />
                  
                  {report.content.avgPriceByCategory && Object.keys(report.content.avgPriceByCategory).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prix moyen par catégorie</h4>
                      {Object.entries(report.content.avgPriceByCategory)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 8)
                        .map(([category, avgPrice]) => (
                          <ReportRow key={category} label={category} value={`${Math.round(avgPrice).toLocaleString()} FCFA`} small />
                        ))}
                    </div>
                  )}
                </ReportSection>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, title, value, change, color }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">{title}</h3>
      </div>
      <p className="text-2xl font-black text-gray-900 dark:text-white mb-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {change !== undefined && (
        <p className="text-sm text-green-600 dark:text-green-400">
          +{typeof change === 'number' ? change.toLocaleString() : change} nouveaux
        </p>
      )}
    </div>
  );
}

// Report Section Component
function ReportSection({ title, icon: Icon, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

// Report Row Component
function ReportRow({ label, value, highlight, small }) {
  return (
    <div className={`flex items-center justify-between ${small ? 'text-sm' : ''} ${highlight ? 'font-semibold' : ''}`}>
      <span className={`${highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400'}`}>
        {label}
      </span>
      <span className={`${highlight ? 'text-indigo-900 dark:text-indigo-300' : 'text-gray-900 dark:text-white'} font-semibold`}>
        {value}
      </span>
    </div>
  );
}
