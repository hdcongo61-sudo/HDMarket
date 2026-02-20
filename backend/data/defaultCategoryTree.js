export const DEFAULT_CATEGORY_TREE = [
  {
    name: 'Électronique & High-Tech',
    slug: 'electronics',
    iconKey: 'Smartphone',
    children: [
      { name: 'Téléphones & Accessoires', slug: 'telephones' },
      { name: 'Ordinateurs & Composants', slug: 'informatique' },
      { name: 'Gadgets Connectés', slug: 'gadgets' },
      { name: 'Audio & Vidéo', slug: 'audio' }
    ]
  },
  {
    name: 'Mode & Accessoires',
    slug: 'fashion',
    iconKey: 'Shirt',
    children: [
      { name: 'Prêt-à-porter', slug: 'pret-porter' },
      { name: 'Chaussures', slug: 'chaussures' },
      { name: 'Bijoux & Montres', slug: 'bijoux' },
      { name: 'Sacs & Accessoires', slug: 'sacs' }
    ]
  },
  {
    name: 'Sport & Fitness',
    slug: 'sport',
    iconKey: 'Dumbbell',
    children: [
      { name: 'Sports & Loisirs', slug: 'sports-loisirs' },
      { name: 'Fitness & Musculation', slug: 'fitness' },
      { name: 'Sports Collectifs', slug: 'sports-collectifs' },
      { name: 'Plein Air & Randonnée', slug: 'sports-plein-air' },
      { name: 'Vélos & Mobilité', slug: 'velos' },
      { name: 'Accessoires Sportifs', slug: 'accessoires-sport' }
    ]
  },
  {
    name: 'Maison & Jardin',
    slug: 'home',
    iconKey: 'Home',
    children: [
      { name: 'Meubles', slug: 'meubles' },
      { name: 'Décoration', slug: 'decoration' },
      { name: 'Ustensiles de Cuisine', slug: 'cuisine' },
      { name: 'Jardinage', slug: 'jardinage' }
    ]
  },
  {
    name: 'Industrie & Business',
    slug: 'industry',
    iconKey: 'Factory',
    children: [
      { name: 'Machines Industrielles', slug: 'machines-industrielles' },
      { name: 'Outils', slug: 'outils' },
      { name: 'Matières Premières', slug: 'matieres-premieres' },
      { name: 'Emballage', slug: 'emballage' }
    ]
  },
  {
    name: 'Santé, Beauté & Loisirs',
    slug: 'health',
    iconKey: 'HeartPulse',
    children: [
      { name: 'Cosmétiques', slug: 'cosmetiques' },
      { name: 'Soins de la Peau', slug: 'soins-peau' },
      { name: 'Équipement Médical', slug: 'equipement-medical' },
      { name: 'Compléments Alimentaires', slug: 'complements' }
    ]
  },
  {
    name: 'Automobile & Accessoires',
    slug: 'automobile',
    iconKey: 'Car',
    children: [
      { name: 'Voitures', slug: 'voitures' },
      { name: 'Motos & Scooters', slug: 'motos' },
      { name: 'Pièces Détachées', slug: 'pieces-detachees' },
      { name: 'Accessoires Auto & Moto', slug: 'accessoires-auto' },
      { name: 'Produits d’Entretien & Réparation', slug: 'entretien' },
      { name: 'Pneus & Jantes', slug: 'pneus-jantes' },
      { name: 'Audio & Électronique de Bord', slug: 'audio-auto' }
    ]
  },
  {
    name: 'Transport & Véhicules Professionnels',
    slug: 'transport',
    iconKey: 'Truck',
    children: [
      { name: 'Camions & Véhicules Utilitaires', slug: 'camions' },
      { name: 'Bus & Minibus', slug: 'bus' },
      { name: 'Engins & Matériels Lourds', slug: 'engins' },
      { name: 'Bateaux & Accessoires Maritimes', slug: 'bateaux' },
      { name: 'Remorques & Porte-charges', slug: 'remorques' },
      { name: 'Pièces & Accessoires de Transport', slug: 'pieces-transport' }
    ]
  }
];

export default DEFAULT_CATEGORY_TREE;
