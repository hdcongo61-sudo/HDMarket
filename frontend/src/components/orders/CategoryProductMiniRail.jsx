import React from 'react';
import { ChevronRight, Package, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import useDesktopExternalLink from '../../hooks/useDesktopExternalLink';
import { buildProductPath } from '../../utils/links';
import { formatPriceWithStoredSettings } from '../../utils/priceFormatter';

export default function CategoryProductMiniRail({ products = [], loading = false }) {
  const externalLinkProps = useDesktopExternalLink();

  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-black text-gray-900">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#e85d00] ring-1 ring-orange-100">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">Produits de la même catégorie</span>
        </h3>
        <Link to="/suggestions" className="flex shrink-0 items-center gap-0.5 text-[11px] font-black text-gray-500">
          Voir tout <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="h-36 w-28 shrink-0 animate-pulse rounded-xl bg-gray-100 sm:w-32" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {products.map((product) => {
            const imageUrl = Array.isArray(product.images) ? product.images[0] : product.image;
            const price = product.price != null ? product.price : product.prix;
            return (
              <Link
                key={product._id}
                to={buildProductPath(product)}
                {...externalLinkProps}
                className="w-28 shrink-0 snap-start overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] sm:w-32"
              >
                <div className="relative aspect-square bg-gray-100">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.title || 'Produit'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-5 w-5 text-[#e85d00]/45" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="line-clamp-2 min-h-7 text-[10px] font-bold leading-3.5 text-gray-900">
                    {product.title || 'Produit'}
                  </p>
                  <p className="mt-1 truncate text-[10px] font-black text-[#e85d00]">
                    {formatPriceWithStoredSettings(price)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Link
          to="/suggestions"
          className="block rounded-xl border border-dashed border-gray-200 bg-gray-50 py-4 text-center text-xs font-semibold text-gray-500"
        >
          Découvrir des suggestions personnalisées
        </Link>
      )}
    </section>
  );
}
