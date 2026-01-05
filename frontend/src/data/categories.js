import {
  Smartphone,
  Shirt,
  Dumbbell,
  Home as HomeIcon,
  Factory,
  HeartPulse,
  Car,
  Truck as TruckIcon
} from 'lucide-react';

const categoryGroups = [
  {
    id: 'electronics',
    label: 'Électronique & High-Tech',
    description: 'Smartphones, ordinateurs, accessoires et plus encore.',
    icon: Smartphone,
    options: [
      { value: 'telephones', label: 'Téléphones & Accessoires' },
      { value: 'informatique', label: 'Ordinateurs & Composants' },
      { value: 'gadgets', label: 'Gadgets Connectés' },
      { value: 'audio', label: 'Audio & Vidéo' }
    ]
  },
  {
    id: 'fashion',
    label: 'Mode & Accessoires',
    description: 'Prêt-à-porter, chaussures, bijoux et sacs tendance.',
    icon: Shirt,
    options: [
      { value: 'pret-porter', label: 'Prêt-à-porter' },
      { value: 'chaussures', label: 'Chaussures' },
      { value: 'bijoux', label: 'Bijoux & Montres' },
      { value: 'sacs', label: 'Sacs & Accessoires' }
    ]
  },
  {
    id: 'sport',
    label: 'Sport & Fitness',
    description: 'Équipements sportifs, fitness, plein air et loisirs.',
    icon: Dumbbell,
    options: [
      { value: 'sports-loisirs', label: 'Sports & Loisirs' },
      { value: 'fitness', label: 'Fitness & Musculation' },
      { value: 'sports-collectifs', label: 'Sports Collectifs' },
      { value: 'sports-plein-air', label: 'Plein Air & Randonnée' },
      { value: 'velos', label: 'Vélos & Mobilité' },
      { value: 'accessoires-sport', label: 'Accessoires Sportifs' }
    ]
  },
  {
    id: 'home',
    label: 'Maison & Jardin',
    description: 'Meubles, décoration, cuisine et jardinage pour la maison.',
    icon: HomeIcon,
    options: [
      { value: 'meubles', label: 'Meubles' },
      { value: 'decoration', label: 'Décoration' },
      { value: 'cuisine', label: 'Ustensiles de Cuisine' },
      { value: 'jardinage', label: 'Jardinage' }
    ]
  },
  {
    id: 'industry',
    label: 'Industrie & Business',
    description: 'Machines, outils, matières premières et emballages.',
    icon: Factory,
    options: [
      { value: 'machines-industrielles', label: 'Machines Industrielles' },
      { value: 'outils', label: 'Outils' },
      { value: 'matieres-premieres', label: 'Matières Premières' },
      { value: 'emballage', label: 'Emballage' }
    ]
  },
  {
    id: 'health',
    label: 'Santé, Beauté & Loisirs',
    description: 'Cosmétiques, soins, équipements médicaux et sports.',
    icon: HeartPulse,
    options: [
      { value: 'cosmetiques', label: 'Cosmétiques' },
      { value: 'soins-peau', label: 'Soins de la Peau' },
      { value: 'equipement-medical', label: 'Équipement Médical' },
      { value: 'complements', label: 'Compléments Alimentaires' }
    ]
  },
  {
    id: 'automobile',
    label: 'Automobile & Accessoires',
    description: 'Voitures, motos, pièces détachées et équipements automobiles.',
    icon: Car,
    options: [
      { value: 'voitures', label: 'Voitures' },
      { value: 'motos', label: 'Motos & Scooters' },
      { value: 'pieces-detachees', label: 'Pièces Détachées' },
      { value: 'accessoires-auto', label: 'Accessoires Auto & Moto' },
      { value: 'entretien', label: 'Produits d’Entretien & Réparation' },
      { value: 'pneus-jantes', label: 'Pneus & Jantes' },
      { value: 'audio-auto', label: 'Audio & Électronique de Bord' }
    ]
  },
  {
    id: 'transport',
    label: 'Transport & Véhicules Professionnels',
    description: 'Camions, bus, engins, bateaux et équipements de transport.',
    icon: TruckIcon,
    options: [
      { value: 'camions', label: 'Camions & Véhicules Utilitaires' },
      { value: 'bus', label: 'Bus & Minibus' },
      { value: 'engins', label: 'Engins & Matériels Lourds' },
      { value: 'bateaux', label: 'Bateaux & Accessoires Maritimes' },
      { value: 'remorques', label: 'Remorques & Porte-charges' },
      { value: 'pieces-transport', label: 'Pièces & Accessoires de Transport' }
    ]
  }
];

const legacyValueMap = {
  'sports,-loisirs': 'sports-loisirs'
};

const categoryMap = new Map();
categoryGroups.forEach((group) => {
  group.options.forEach((option) => {
    categoryMap.set(option.value, { ...option, group });
  });
});

Object.entries(legacyValueMap).forEach(([legacyValue, currentValue]) => {
  const meta = categoryMap.get(currentValue);
  if (meta) {
    categoryMap.set(legacyValue, { ...meta, legacyValue });
  }
});

export const allCategoryOptions = Array.from(
  categoryGroups.flatMap((group) => group.options)
);

export const getCategoryMeta = (value) => {
  if (!value) return null;
  return categoryMap.get(value) || null;
};

export default categoryGroups;
