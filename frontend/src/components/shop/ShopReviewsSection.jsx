import React from 'react';
import { ExternalLink, Star } from 'lucide-react';
import {
  GlassBottomSheetModal,
  GlassModalBody,
  GlassModalHeader
} from '../ui/GlassModal';
import { formatCount, formatDate, formatRatingLabel } from './shopProfileHelpers';
import { resolveUserProfileImage } from '../../utils/userAvatar';

export default function ShopReviewsSection({
  ratingCount,
  ratingAverage,
  recentReviews,
  userScopeId,
  currentUserReview,
  showReviewForm,
  setIsEditingReview,
  reviewForm,
  setReviewForm,
  reviewSuccess,
  reviewError,
  onSubmitReview,
  reviewPending,
  user,
  showCommentsModal,
  setShowCommentsModal,
  allCommentsQuery,
  t
}) {
  const ownCommentExists = Boolean(currentUserReview?.comment?.trim());

  return (
    <section className="overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.7)] ring-1 ring-orange-100/80 dark:bg-neutral-950 dark:ring-neutral-800" id="reviews">
      <div className="flex items-start justify-between gap-2 px-1">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-[#FF6A00]">Communauté</p>
          <h2 className="text-xl font-black text-slate-950 dark:text-white sm:text-2xl">
            {t('shop_profile.reviews', 'Avis clients')}
          </h2>
          <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {formatCount(ratingCount)} {t('shop_profile.reviews_count', 'avis')} ·{' '}
            {formatRatingLabel(ratingAverage)}/5
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCommentsModal(true)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#fff7ef] px-3 text-xs font-black text-[#FF6A00] ring-1 ring-orange-100 transition hover:bg-orange-50 dark:bg-neutral-900 dark:ring-neutral-800"
        >
          <span>{t('shop_profile.view_all', 'Voir tout')}</span>
          <ExternalLink size={13} />
        </button>
      </div>

      {/* Rating summary card */}
      {ratingCount > 0 && (
        <div className="mt-4 overflow-hidden rounded-[24px] bg-slate-950 p-4 dark:bg-neutral-900">
          <div className="flex items-center gap-5">
            <span className="text-[44px] font-extrabold leading-none text-white">
              {formatRatingLabel(ratingAverage)}
            </span>
            <div className="flex-1">
              <div className="mb-2.5 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    className={
                      star <= Math.round(ratingAverage)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-white/25'
                    }
                  />
                ))}
                <span className="ml-1 text-xs text-white/60">
                  {formatCount(ratingCount)} {t('shop_profile.reviews_count', 'avis')}
                </span>
              </div>
              {[5, 4, 3, 2, 1].map((bar) => {
                const count = recentReviews.filter(
                  (r) => Math.round(Number(r.rating || 0)) === bar
                ).length;
                const pct = ratingCount > 0 ? Math.round((count / ratingCount) * 100) : 0;
                return (
                  <div key={bar} className="mb-1 flex items-center gap-2">
                    <span className="w-2 text-[10px] text-white/50">{bar}</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-1 rounded-full bg-amber-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {reviewSuccess && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {reviewSuccess}
        </p>
      )}

      {/* Write review form */}
      {showReviewForm && (
        <form
          onSubmit={onSubmitReview}
          className="mt-4 rounded-[24px] bg-[#fffaf6] p-4 ring-1 ring-orange-100/80 dark:bg-neutral-900 dark:ring-neutral-800"
        >
          <p className="text-sm font-black text-slate-950 dark:text-white">
            {t('shop_profile.your_rating', 'Votre note')}
          </p>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={`rate-${value}`}
                type="button"
                onClick={() => setReviewForm((prev) => ({ ...prev, rating: value }))}
                className="transition hover:scale-110"
              >
                <Star
                  size={26}
                  className={
                    value <= Number(reviewForm.rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-neutral-300 dark:text-neutral-700'
                  }
                />
              </button>
            ))}
          </div>
          <textarea
            value={reviewForm.comment}
            onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
            rows={4}
            className="mt-3 w-full rounded-[18px] border border-orange-100 bg-white px-3 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-[#FF6A00] focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
            placeholder={t('shop_profile.comment_placeholder', 'Partagez votre expérience...')}
          />
          {reviewError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{reviewError}</p>
          )}
          <button
            type="submit"
            disabled={reviewPending || !user}
            className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#FF6A00] text-sm font-black text-white transition hover:bg-[#f45f00] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reviewPending
              ? t('shop_profile.sending', 'Envoi...')
              : currentUserReview
                ? t('shop_profile.update_review', 'Mettre à jour mon avis')
                : t('shop_profile.publish_review', 'Publier mon avis')}
          </button>
        </form>
      )}

      {!showReviewForm && ownCommentExists && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-[20px] bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/30">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {t('shop_profile.review_published', 'Votre avis est publié')}
          </p>
          <button
            type="button"
            onClick={() => setIsEditingReview(true)}
            className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-neutral-950 dark:text-emerald-300"
          >
            {t('shop_profile.edit', 'Modifier')}
          </button>
        </div>
      )}

      {/* Review cards */}
      <div className="mt-4 space-y-3">
        {recentReviews.length > 0 ? (
          recentReviews.map((review) => {
            const isOwn =
              Boolean(userScopeId) &&
              Boolean(review?.user?._id) &&
              String(review.user._id) === String(userScopeId);
            const name = review.user?.name || review.user?.shopName || 'Utilisateur';
            const initials = name.substring(0, 2).toUpperCase();
            const avatarSrc = resolveUserProfileImage(review.user);
            return (
              <article
                key={review._id}
                className="rounded-[22px] bg-white p-3 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800"
              >
                <div className="flex items-start gap-3">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={name}
                      className="h-9 w-9 shrink-0 rounded-full border border-neutral-200 dark:border-neutral-800 object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-amber-300 dark:bg-neutral-900">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-black text-slate-950 dark:text-white">{name}</p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={`${review._id}-${star}`}
                            size={11}
                            className={
                              star <= Number(review.rating || 0)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-neutral-300 dark:text-neutral-700'
                            }
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-neutral-400">
                      {review.comment || t('shop_profile.no_comment', 'Pas de commentaire')}
                    </p>
                  </div>
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingReview(true);
                        setReviewForm({
                          rating: Number(review.rating || 0),
                          comment: review.comment || ''
                        });
                      }}
                      className="shrink-0 rounded-full border border-neutral-200 dark:border-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 transition hover:border-neutral-400 hover:text-neutral-950 dark:hover:text-white"
                    >
                      {t('shop_profile.edit', 'Modifier')}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        ) : (
        <div className="rounded-[22px] border border-dashed border-orange-200 bg-orange-50/40 px-4 py-8 text-center text-sm font-semibold text-slate-500 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
            {t('shop_profile.no_reviews', 'Aucun avis publié pour le moment')}
          </div>
        )}
      </div>

      {/* All comments modal */}
      <GlassBottomSheetModal
        isOpen={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        ariaLabel={t('shop_profile.all_reviews', 'Tous les commentaires')}
      >
        <GlassModalHeader
          title={t('shop_profile.all_reviews', 'Tous les commentaires')}
          subtitle={`${formatCount(allCommentsQuery.data?.length || 0)} ${t('shop_profile.comments', 'commentaires')}`}
          onClose={() => setShowCommentsModal(false)}
          icon={<ExternalLink size={16} />}
        />
        <GlassModalBody className="max-h-[72vh] overflow-y-auto">
          {allCommentsQuery.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
              ))}
            </div>
          )}
          {allCommentsQuery.isError && (
            <p className="rounded-xl border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400">
              {allCommentsQuery.error?.response?.data?.message ||
                t('shop_profile.comments_error', 'Impossible de charger les commentaires')}
            </p>
          )}
          {!allCommentsQuery.isLoading &&
            !allCommentsQuery.isError &&
            (allCommentsQuery.data?.length || 0) === 0 && (
              <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                {t('shop_profile.no_comments', 'Aucun commentaire pour cette boutique')}
              </p>
            )}
          {!allCommentsQuery.isLoading &&
            !allCommentsQuery.isError &&
            (allCommentsQuery.data?.length || 0) > 0 && (
              <div className="space-y-3">
                {allCommentsQuery.data.map((review) => {
                  const name =
                    review.user?.name || review.user?.shopName || 'Utilisateur';
                  const initials = name.substring(0, 2).toUpperCase();
                  const avatarSrc = resolveUserProfileImage(review.user);
                  return (
                    <article
                      key={`full-${review._id}`}
                      className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
                    >
                      <div className="flex items-start gap-3">
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt={name}
                            className="h-8 w-8 shrink-0 rounded-full border border-neutral-200 dark:border-neutral-800 object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-amber-300 dark:bg-neutral-900">
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-neutral-950 dark:text-white">{name}</p>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={`${review._id}-full-${star}`}
                                size={11}
                                className={
                                  star <= Number(review.rating || 0)
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-neutral-300 dark:text-neutral-700'
                                }
                              />
                            ))}
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                            {review.comment ||
                              t('shop_profile.no_comment', 'Pas de commentaire')}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
        </GlassModalBody>
      </GlassBottomSheetModal>
    </section>
  );
}
