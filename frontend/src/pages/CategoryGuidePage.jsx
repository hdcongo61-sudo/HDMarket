import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  LightBulbIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import GlassHeader from '../components/categories/GlassHeader';

const navSections = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'create', label: 'Créer des catégories' },
  { id: 'edit', label: 'Modifier une catégorie' },
  { id: 'organize', label: 'Organiser & réordonner' },
  { id: 'bulk', label: 'Actions groupées' },
  { id: 'delete', label: 'Suppression & restauration' },
  { id: 'import', label: 'Importer / exporter (JSON)' },
  { id: 'reassign', label: 'Réassigner les produits' },
  { id: 'audit', label: 'Activité & audit' },
  { id: 'preview', label: 'Aperçu storefront' },
  { id: 'tips', label: 'Bonnes pratiques & FAQ' }
];

function SectionTitle({ id, children }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
      {children}
    </h2>
  );
}

function StepList({ steps }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
            {index + 1}
          </span>
          <span className="text-xs leading-5 text-neutral-700 dark:text-neutral-300">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function InfoCallout({ tone = 'info', icon: Icon = InformationCircleIcon, title, children }) {
  const toneClasses = {
    info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
    warn: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    good: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
  };
  return (
    <div className={`rounded-2xl border p-3 ${toneClasses[tone] || toneClasses.info}`}>
      <p className="flex items-center gap-2 text-xs font-semibold">
        <Icon className="h-4 w-4 shrink-0" /> {title}
      </p>
      <div className="mt-1 text-xs leading-5">{children}</div>
    </div>
  );
}

export default function CategoryGuidePage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <GlassHeader
        title="Guide d'utilisation — Category Manager"
        subtitle="Comment créer, organiser, importer et auditer vos catégories en toute sécurité"
        actions={
          <>
            <Link
              to="/settings/categories"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" /> Retour au manager
            </Link>
          </>
        }
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        {/* Sommaire */}
        <aside className="lg:col-span-3">
          <nav className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg sticky top-4 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-100">
              <BookOpenIcon className="h-4 w-4" /> Sommaire
            </p>
            <ul className="space-y-1">
              {navSections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-lg px-2 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Contenu */}
        <div className="space-y-4 lg:col-span-9">
          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="overview">Vue d'ensemble</SectionTitle>
            <p className="mt-2 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
              Le <strong>Category Manager</strong> gère l'arborescence des catégories visibles sur la place de marché :
              catégories principales (niveau 0) et sous-catégories (niveau 1). Toute modification est{' '}
              <strong>auditée</strong> (qui a changé quoi, quand) et conçue pour être <strong>réversible</strong> : les
              suppressions sont douces (soft delete), et les imports se font d'abord en dry-run avant application réelle.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">Arbre dynamique</p>
                <p className="mt-1 text-xs text-neutral-500">Hiérarchie à 2 niveaux, ordonnée et filtrable.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">Migration safe</p>
                <p className="mt-1 text-xs text-neutral-500">Import JSON avec dry-run, export complet, réassignation de produits.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">Audit complet</p>
                <p className="mt-1 text-xs text-neutral-500">Historique filtrable de toutes les opérations.</p>
              </div>
            </div>
          </section>

          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="create">Créer des catégories</SectionTitle>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="ui-card-soft-separator rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="mb-2 text-xs font-semibold text-neutral-800 dark:text-neutral-100">Catégorie principale</p>
                <StepList
                  steps={[
                    'Dans le panneau « Éditeur catégorie », remplissez la zone « Créer une catégorie principale ».',
                    'Saisissez le nom. Le slug est optionnel : laissez vide pour une génération automatique.',
                    'Renseignez le pays (ex : CG) et les villes, séparées par des virgules, si la catégorie est locale.',
                    'Cliquez sur « Ajouter ». La catégorie apparaît en bas de l\'arbre avec l\'ordre suivant disponible.'
                  ]}
                />
              </div>
              <div className="ui-card-soft-separator rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="mb-2 text-xs font-semibold text-neutral-800 dark:text-neutral-100">Sous-catégorie</p>
                <StepList
                  steps={[
                    'Sélectionnez une catégorie principale dans l\'arborescence.',
                    'Utilisez le champ « Nouvelle sous-catégorie » de l\'éditeur (ou le bouton dédié dans l\'arbre).',
                    'Saisissez le nom puis validez : la sous-catégorie hérite du pays et des villes du parent.',
                    'Une sous-catégorie ne peut pas contenir d\'autres sous-niveaux.'
                  ]}
                />
              </div>
            </div>
          </section>

          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="edit">Modifier une catégorie</SectionTitle>
            <p className="mt-2 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
              Cliquez sur un nœud de l'arbre pour charger ses paramètres dans l'éditeur. Les champs disponibles :
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Champ</th>
                    <th className="px-3 py-2 font-medium">Rôle</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Nom', 'Libellé affiché aux clients dans la navigation et le dépôt d\'annonce.'],
                    ['Slug', 'Identifiant dans les URLs (/categories/…). Doit être unique et stable.'],
                    ['Icon key', 'Clé de l\'icône affichée sur le storefront (ex : Shirt).'],
                    ['Image URL', 'Visuel optionnel de la catégorie sur le storefront.'],
                    ['Description', 'Texte court présenté sous le nom de la catégorie.'],
                    ['Country / Villes', 'Ciblage géographique : la catégorie n\'apparaît que dans ces zones.'],
                    ['Active dans storefront', 'Active/désactive la visibilité client sans supprimer la catégorie.']
                  ].map(([field, role]) => (
                    <tr key={field} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-3 py-2 font-medium text-neutral-800 dark:text-neutral-100">{field}</td>
                      <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <InfoCallout title="Enregistrer" icon={CheckCircleIcon} tone="good">
                Cliquez sur « Sauvegarder » pour appliquer les changements. Un toast de confirmation s'affiche et
                l'entrée apparaît immédiatement dans le panneau Activité.
              </InfoCallout>
            </div>
          </section>

          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="organize">Organiser & réordonner</SectionTitle>
            <p className="mt-2 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
              L'ordre des nœuds détermine leur position sur le storefront : la première catégorie est la plus visible.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="ui-card-soft-separator rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="mb-2 text-xs font-semibold text-neutral-800 dark:text-neutral-100">Glisser-déposer</p>
                <p className="text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                  Déplacez un nœud sur un autre pour le réordonner. Déplacer une sous-catégorie vers un autre parent
                  déclenche une confirmation, car cela change sa hiérarchie.
                </p>
              </div>
              <div className="ui-card-soft-separator rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="mb-2 text-xs font-semibold text-neutral-800 dark:text-neutral-100">Recherche</p>
                <p className="text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                  Le champ de recherche filtre l'arbre par nom, slug ou chemin, y compris les catégories masquées et
                  supprimées. Videz la recherche pour revoir l'arbre complet.
                </p>
              </div>
            </div>
          </section>

          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="bulk">Actions groupées</SectionTitle>
            <p className="mt-2 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
              Cochez plusieurs nœuds dans l'arbre, puis utilisez la barre « Outils bulk » :
            </p>
            <ul className="mt-3 space-y-2">
              {[
                ['Activer', 'Rend visibles toutes les catégories sélectionnées.'],
                ['Désactiver', 'Masque les catégories sans les supprimer (produits conservés).'],
                ['Supprimer', 'Soft delete : retire du storefront mais reste restaurable.'],
                ['Restaurer', 'Réactive des catégories précédemment supprimées.'],
                ['Export JSON / CSV', 'Télécharge l\'arbre complet dans le format choisi.'],
                ['Import', 'Ouvre le wizard d\'import JSON (voir section dédiée).']
              ].map(([label, role]) => (
                <li key={label} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                  <span className="text-xs leading-5 text-neutral-700 dark:text-neutral-300">
                    <strong className="text-neutral-900 dark:text-neutral-100">{label}</strong> — {role}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="delete">Suppression & restauration</SectionTitle>
            <p className="mt-2 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
              HDMarket utilise la <strong>suppression douce</strong> : une catégorie supprimée disparaît du storefront
              mais reste en base et réapparaît dans l'arbre avec un badge « Supprimée ».
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <InfoCallout title="Restaurer une catégorie" icon={ArrowLeftIcon} tone="good">
                Sélectionnez le nœud supprimé dans l'arbre, puis cliquez sur « Restaurer » dans l'éditeur. Ses
                sous-catégories et liens produits sont conservés.
              </InfoCallout>
              <InfoCallout title="Suppression définitive" icon={ShieldCheckIcon} tone="warn">
                Les suppressions douces ne sont pas irréversibles immédiatement, mais évitez de supprimer une
                catégorie tant que des produits y sont rattachés : utilisez d'abord « Réassigner les produits ».
              </InfoCallout>
            </div>
          </section>

          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="import">Importer / exporter (JSON)</SectionTitle>
            <p className="mt-2 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
              L'import accepte un JSON <code>{'{ "tree": [ ... ] }'}</code> ou un tableau direct. Chaque nœud peut
              contenir : <code>name</code>, <code>slug</code>, <code>order</code>, <code>isActive</code>,{' '}
              <code>iconKey</code>, <code>description</code>, <code>children</code>.
            </p>
            <div className="mt-3">
              <StepList
                steps={[
                  'Cliquez sur « Import » (barre bulk) ou « Ouvrir dans import » depuis un modèle JSON.',
                  'Collez votre JSON ou chargez un fichier .json.',
                  'Lancez le dry-run : le wizard affiche le résumé (créations, mises à jour, erreurs) sans rien écrire.',
                  'Vérifiez le résumé, puis cliquez sur « Appliquer » pour importer réellement.'
                ]}
              />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <InfoCallout title="Modèle prêt à l'emploi" icon={LightBulbIcon}>
                La page du manager fournit un « Modèle d'import catégories » : copiez-le et remplissez vos entrées, ou
                ouvrez-le directement dans le wizard.
              </InfoCallout>
              <InfoCallout title="Catégories legacy" icon={LightBulbIcon}>
                La section « Exporter catégories hardcodées » génère un JSON importable des anciennes catégories de{' '}
                <code>src/data/categories.js</code>, pratique pour migrer vers la base dynamique.
              </InfoCallout>
            </div>
          </section>

          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="reassign">Réassigner les produits</SectionTitle>
            <p className="mt-2 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
              Depuis l'éditeur d'une catégorie, « Réassigner » ouvre une fenêtre permettant de déplacer tous les
              produits de cette catégorie vers une autre catégorie.
            </p>
            <div className="mt-3">
              <InfoCallout title="Quand l'utiliser ?" icon={ShieldCheckIcon} tone="warn">
                Avant de supprimer une catégorie qui contient des produits, ou lors d'une fusion de deux catégories.
                C'est ce qui rend la « migration safe » : aucun produit ne reste orphelin.
              </InfoCallout>
            </div>
          </section>

          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="audit">Activité & audit</SectionTitle>
            <p className="mt-2 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
              Le panneau « Activity » enregistre chaque opération avec sa date et l'administrateur concerné :
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['CREATE', 'UPDATE', 'REORDER', 'SOFT_DELETE', 'RESTORE', 'IMPORT', 'REASSIGN'].map((action) => (
                <span
                  key={action}
                  className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  {action}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
              Filtrez par type d'action et par plage de dates pour retracer un changement précis.
            </p>
          </section>

          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="preview">Aperçu storefront</SectionTitle>
            <p className="mt-2 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
              Le panneau « Preview storefront & form » montre les 6 premières catégories actives telles que les
              clients les verront (nom + premières sous-catégories). C'est le moyen le plus rapide de vérifier l'effet
              d'un changement avant de quitter la page.
            </p>
          </section>

          <section className="ui-card ui-card-interactive ui-card-fade-in ui-card-lg p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <SectionTitle id="tips">Bonnes pratiques & FAQ</SectionTitle>
            <div className="mt-3 space-y-3">
              <InfoCallout title="Slugs stables" icon={LightBulbIcon}>
                Ne modifiez un slug qu'en cas de nécessité absolue : les URLs partagées et les favoris clients en
                dépendent.
              </InfoCallout>
              <InfoCallout title="Tester avant d'importer" icon={CheckCircleIcon} tone="good">
                Toujours faire un dry-run avant d'appliquer un import, surtout lors d'une première migration.
              </InfoCallout>
              <InfoCallout title="Désactiver plutôt que supprimer" icon={ShieldCheckIcon} tone="warn">
                Pour masquer temporairement une catégorie (ex : hors saison), désactivez-la au lieu de la supprimer.
              </InfoCallout>
              <div className="ui-card-soft-separator rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">FAQ</p>
                <div className="mt-2 space-y-2">
                  {[
                    ['Combien de niveaux puis-je créer ?', 'Deux : catégories principales et sous-catégories.'],
                    ['Puis-je supprimer définitivement une catégorie ?', 'La suppression est douce et restaurable depuis l\'éditeur.'],
                    ['Un import peut-il écraser mes catégories existantes ?', 'Non : le dry-run affiche le résumé exact avant toute écriture.'],
                    ['Où voir qui a modifié une catégorie ?', 'Dans le panneau Activity, filtrable par action et par date.']
                  ].map(([question, answer]) => (
                    <div key={question}>
                      <p className="text-xs font-medium text-neutral-800 dark:text-neutral-100">{question}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">{answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
