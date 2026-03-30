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
    <div className="overflow-hidden rounded-xl border border-[#E0D9CF] bg-white p-4" id="reviews">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl font-medium text-[#1A1A18]">
            {t('shop_profile.reviews', 'Avis clients')}
          </h2>
          <p className="mt-0.5 text-xs text-[#8A7F6E]">
            {formatCount(ratingCount)} {t('shop_profile.reviews_count', 'avis')} ·{' '}
            {formatRatingLabel(ratingAverage)}/5
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCommentsModal(true)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#E0D9CF] px-3 text-xs font-medium text-[#8A7F6E] transition hover:border-[#1A2744] hover:text-[#1A1A18]"
        >
          <span>{t('shop_profile.view_all', 'Voir tout')}</span>
          <ExternalLink size={13} />
        </button>
      </div>

      {/* Rating summary card */}
      {ratingCount > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl bg-[#1A2744] p-4">
          <div className="flex items-center gap-5">
            <span className="font-serif text-[44px] font-medium leading-none text-white">
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
                        ? 'fill-[#C9A84C] text-[#C9A84C]'
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
                        className="h-1 rounded-full bg-[#C9A84C]"
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
        <p className="mt-3 rounded-xl border border-[#5A9E6F]/30 bg-[#5A9E6F]/10 px-3 py-2 text-sm font-medium text-[#5A9E6F]">
          {reviewSuccess}
        </p>
      )}

      {/* Write review form */}
      {showReviewForm && (
        <form
          onSubmit={onSubmitReview}
          className="mt-4 rounded-xl border border-[#E0D9CF] bg-[#F5F3EF] p-4"
        >
          <p className="text-sm font-medium text-[#1A1A18]">
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
                      ? 'fill-[#C9A84C] text-[#C9A84C]'
                      : 'text-[#E0D9CF]'
                  }
                />
              </button>
            ))}
          </div>
          <textarea
            value={reviewForm.comment}
            onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
            rows={4}
            className="mt-3 w-full rounded-xl border border-[#E0D9CF] bg-white px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#8A7F6E] focus:border-[#1A2744] focus:outline-none"
            placeholder={t('shop_profile.comment_placeholder', 'Partagez votre expérience...')}
          />
          {reviewError && (
            <p className="mt-2 text-xs text-[#C0392B]">{reviewError}</p>
          )}
          <button
            type="submit"
            disabled={reviewPending || !user}
            className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#1A2744] text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#5A9E6F]/30 bg-[#5A9E6F]/10 px-3 py-2">
          <p className="text-sm font-medium text-[#5A9E6F]">
            {t('shop_profile.review_published', 'Votre avis est publié')}
          </p>
          <button
            type="button"
            onClick={() => setIsEditingReview(true)}
            className="rounded-full border border-[#5A9E6F]/40 bg-white px-3 py-1 text-xs font-medium text-[#5A9E6F] transition hover:bg-[#5A9E6F]/10"
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
                className="rounded-xl border border-[#E0D9CF] bg-white p-3"
              >
                <div className="flex items-start gap-3">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={name}
                      className="h-9 w-9 shrink-0 rounded-full border border-[#E0D9CF] object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A2744] text-xs font-medium text-[#C9A84C]">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-medium text-[#1A1A18]">{name}</p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={`${review._id}-${star}`}
                            size={11}
                            className={
                              star <= Number(review.rating || 0)
                                ? 'fill-[#C9A84C] text-[#C9A84C]'
                                : 'text-[#E0D9CF]'
                            }
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-[#8A7F6E]">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#8A7F6E]">
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
                      className="shrink-0 rounded-full border border-[#E0D9CF] px-2.5 py-1 text-xs font-medium text-[#8A7F6E] transition hover:border-[#1A2744] hover:text-[#1A1A18]"
                    >
                      {t('shop_profile.edit', 'Modifier')}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-[#E0D9CF] px-4 py-8 text-center text-sm text-[#8A7F6E]">
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
                <div key={item} className="h-20 animate-pulse rounded-xl bg-[#EDE9E0]" />
              ))}
            </div>
          )}
          {allCommentsQuery.isError && (
            <p className="rounded-xl border border-[#C0392B]/30 bg-[#C0392B]/10 px-3 py-2 text-sm font-medium text-[#C0392B]">
              {allCommentsQuery.error?.response?.data?.message ||
                t('shop_profile.comments_error', 'Impossible de charger les commentaires')}
            </p>
          )}
          {!allCommentsQuery.isLoading &&
            !allCommentsQuery.isError &&
            (allCommentsQuery.data?.length || 0) === 0 && (
              <p className="rounded-xl border border-dashed border-[#E0D9CF] px-4 py-10 text-center text-sm text-[#8A7F6E]">
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
                      className="rounded-xl border border-[#E0D9CF] bg-white p-3"
                    >
                      <div className="flex items-start gap-3">
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt={name}
                            className="h-8 w-8 shrink-0 rounded-full border border-[#E0D9CF] object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1A2744] text-xs font-medium text-[#C9A84C]">
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-[#1A1A18]">{name}</p>
                            <span className="text-xs text-[#8A7F6E]">
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
                                    ? 'fill-[#C9A84C] text-[#C9A84C]'
                                    : 'text-[#E0D9CF]'
                                }
                              />
                            ))}
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-[#8A7F6E]">
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
    </div>
  );
}
