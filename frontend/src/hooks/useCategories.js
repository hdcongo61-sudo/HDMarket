import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
  Smartphone, Shirt, Dumbbell, Home, Factory, HeartPulse, Car, Truck,
  Package, ShoppingBag, Sparkles, Globe
} from 'lucide-react';

// Maps iconKey strings from the admin category model to Lucide React components
const ICON_MAP = {
  Smartphone, Shirt, Dumbbell, Home, Factory, HeartPulse, Car, Truck,
  Package, ShoppingBag, Sparkles, Globe
};

const DEFAULT_ICON = Package;

export const resolveIcon = (iconKey) => {
  if (!iconKey) return DEFAULT_ICON;
  return ICON_MAP[iconKey] || DEFAULT_ICON;
};

// Flattens the API tree into the legacy categoryGroups shape:
// [{ id, label, description, icon, options: [{ value, label }] }]
const normalizeTree = (tree = []) => {
  return tree
    .filter((node) => node.level === 0)
    .map((group) => ({
      id: group.slug || group._id,
      label: group.name,
      description: group.description || '',
      icon: resolveIcon(group.iconKey),
      options: (group.children || [])
        .filter((child) => child.level === 1)
        .map((child) => ({
          value: child.slug || child._id,
          label: child.name
        }))
    }))
    .filter((group) => group.options.length > 0);
};

// Build a flat map of value → { value, label, group } for getCategoryMeta
const buildCategoryMap = (groups) => {
  const map = new Map();
  groups.forEach((group) => {
    group.options.forEach((option) => {
      map.set(option.value, { ...option, group });
    });
  });
  return map;
};

// Build flat array of all options for allCategoryOptions
const buildAllOptions = (groups) => {
  return groups.flatMap((group) => group.options);
};

export default function useCategories() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/categories/tree');
        if (!cancelled) {
          setTree(Array.isArray(data?.tree) ? data.tree : []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setTree([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCategories();
    return () => { cancelled = true; };
  }, []);

  const categoryGroups = useMemo(() => normalizeTree(tree), [tree]);
  const categoryMap = useMemo(() => buildCategoryMap(categoryGroups), [categoryGroups]);
  const allCategoryOptions = useMemo(() => buildAllOptions(categoryGroups), [categoryGroups]);

  const getCategoryMeta = (value) => {
    if (!value) return null;
    return categoryMap.get(value) || null;
  };

  return {
    categoryGroups,
    allCategoryOptions,
    getCategoryMeta,
    loading,
    error,
    rawTree: tree
  };
}
