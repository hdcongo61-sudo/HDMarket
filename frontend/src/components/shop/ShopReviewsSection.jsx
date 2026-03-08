import React from 'react';
import { ExternalLink, Star } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import {
  GlassBottomSheetModal,
  GlassModalBody,
  GlassModalHeader
} from '../ui/GlassModal';
import { formatCount, formatDate, formatRatingLabel } from './shopProfileHelpers';

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
    <GlassCard className="min-w-0 space-y-4 overflow-hidden" id="reviews">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
            {t('shop_profile.reviews', 'Avis clients')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {formatCount(ratingCount)} {t('shop_profile.reviews_count', 'avis')} · {formatRatingLabel(ratingAverage)}/5
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCommentsModal(true)}
          className="inline-flex min-h-[44px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 sm:w-auto"
        >
          <span className="truncate">{t('shop_profile.view_all', 'Voir tout')}</span>
          <ExternalLink size={14} />
        </button>
      </div>

      {reviewSuccess && (
        <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 [overflow-wrap:anywhere]">
          {reviewSuccess}
        </p>
      )}

      {showReviewForm && (
        <form onSubmit={onSubmitReview} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-900/60 sm:p-4">
          <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('shop_profile.your_rating', 'Votre note')}
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
            {[5, 4, 3, 2, 1].map((value) => (
              <button
                key={`rate-${value}`}
                type="button"
                onClick={() => setReviewForm((prev) => ({ ...prev, rating: value }))}
                className={`inline-flex min-h-[38px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition sm:min-h-[40px] sm:px-3 sm:text-sm ${
                  Number(reviewForm.rating) === value
                    ? 'bg-amber-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                <Star size={14} className={Number(reviewForm.rating) === value ? 'fill-current' : ''} />
                {value}
              </button>
            ))}
          </div>

          <label className="mt-3 block text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('shop_profile.comment', 'Commentaire')}
          </label>
          <textarea
            value={reviewForm.comment}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
            rows={4}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder={t('shop_profile.comment_placeholder', 'Partagez votre expérience...')}
          />
          {reviewError && <p className="mt-2 text-xs font-medium text-red-600">{reviewError}</p>}
          <button
            type="submit"
            disabled={reviewPending || !user}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-slate-700 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
          <p className="min-w-0 break-words text-sm font-medium text-green-700">{t('shop_profile.review_published', 'Votre avis est publié')}</p>
          <button
            type="button"
            onClick={() => setIsEditingReview(true)}
            className="rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
          >
            {t('shop_profile.edit', 'Modifier')}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {recentReviews.length > 0 ? (
          recentReviews.map((review) => {
            const isOwn =
              Boolean(userScopeId) &&
              Boolean(review?.user?._id) &&
              String(review.user._id) === String(userScopeId);
            return (
              <article
                key={review._id}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 transition hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {review.user?.name || review.user?.shopName || 'Utilisateur'}
                    </p>
                    <div className="mt-1 flex items-center gap-1 text-amber-500">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={`${review._id}-${star}`}
                          size={13}
                          className={star <= Number(review.rating || 0) ? 'fill-current' : ''}
                        />
                      ))}
                    </div>
                    <p className="mt-2 break-words text-sm text-slate-700 dark:text-slate-200">
                      {review.comment || t('shop_profile.no_comment', 'Pas de commentaire')}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formatDate(review.createdAt)}</p>
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
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {t('shop_profile.edit', 'Modifier')}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
            {t('shop_profile.no_reviews', 'Aucun avis publié pour le moment')}
          </div>
        )}
      </div>

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
                <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          )}

          {allCommentsQuery.isError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {allCommentsQuery.error?.response?.data?.message ||
                t('shop_profile.comments_error', 'Impossible de charger les commentaires')}
            </p>
          )}

          {!allCommentsQuery.isLoading &&
            !allCommentsQuery.isError &&
            (allCommentsQuery.data?.length || 0) === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                {t('shop_profile.no_comments', 'Aucun commentaire pour cette boutique')}
              </p>
            )}

          {!allCommentsQuery.isLoading &&
            !allCommentsQuery.isError &&
            (allCommentsQuery.data?.length || 0) > 0 && (
              <div className="space-y-3">
                {allCommentsQuery.data.map((review) => (
                  <article
                    key={`full-${review._id}`}
                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {review.user?.name || review.user?.shopName || 'Utilisateur'}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-amber-500">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={`${review._id}-full-${star}`}
                              size={12}
                              className={star <= Number(review.rating || 0) ? 'fill-current' : ''}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(review.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                      {review.comment || t('shop_profile.no_comment', 'Pas de commentaire')}
                    </p>
                  </article>
                ))}
              </div>
            )}
        </GlassModalBody>
      </GlassBottomSheetModal>
    </GlassCard>
  );
}
