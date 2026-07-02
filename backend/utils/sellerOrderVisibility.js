// Sponsored ("pay for me") orders awaiting the designated payer must stay
// invisible to sellers until payment is captured. Spread this into any
// seller-scoped order query.
export const HIDE_PENDING_SPONSORED = {
  $nor: [{ 'sponsoredPayment.isSponsored': true, 'sponsoredPayment.status': 'pending' }]
};
