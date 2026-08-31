/**
 * Wholesale model - PRD appendix D.
 *
 *   buyerPrice   = ARV x MAO% - repairs
 *   MAO          = buyerPrice - assignmentFee
 *   initialOffer = round(MAO x (1 - buffer))
 *   fee          = buyerPrice - MAO
 *
 * Read as a chain: what a cash buyer will pay, less what you keep, is the most
 * you can go to contract for; the opening offer sits below that by whatever
 * room you want to negotiate with.
 */
import type { WholesaleInputs, WholesaleResult } from './types';

export function analyzeWholesale(inputs: WholesaleInputs): WholesaleResult {
  const { arv, repairs, maoPct, assignmentFee, negotiationBuffer } = inputs;

  const buyerPrice = arv * maoPct - repairs;
  const mao = buyerPrice - assignmentFee;

  // Appendix D rounds the opening offer, and only the opening offer: it is the
  // number that gets spoken out loud on a call, so a clean figure matters more
  // than the cent.
  const initialOffer = Math.round(mao * (1 - negotiationBuffer));

  return {
    buyerPrice,
    mao,
    initialOffer,
    fee: buyerPrice - mao,
  };
}
