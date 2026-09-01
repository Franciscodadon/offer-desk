/**
 * Default LOI and outreach templates - PRD 7.4.
 *
 * Two axes of variant, as the PRD specifies:
 *   - vacant vs. occupied: whether the letter can promise a fast, unconditional
 *     close or has to acknowledge tenants and possession.
 *   - priced vs. preliminary: whether a firm number is on the table or the
 *     letter opens a conversation subject to inspection.
 *
 * House style, enforced deliberately:
 *   - No em dashes anywhere in output copy (PRD 7.4).
 *   - Short sentences. An agent skims this on a phone between showings.
 *   - The letter states plainly that it is non-binding, which PRD 13 requires
 *     and which also keeps it a genuine letter of intent rather than a contract
 *     the sender did not mean to make.
 *   - No superlatives and no pressure. The offer is the argument.
 */

export type LoiOccupancy = 'vacant' | 'occupied';
export type LoiPricing = 'priced' | 'preliminary';

export type LoiVariant = {
  occupancy: LoiOccupancy;
  pricing: LoiPricing;
};

export const DEFAULT_VARIANT: LoiVariant = { occupancy: 'vacant', pricing: 'priced' };

/** The shared skeleton every variant fills in. */
function letter(body: string): string {
  return `{{letter_date}}

{{agent_name}}
{{agent_brokerage}}

Re: Letter of Intent to Purchase, {{full_address}}

Dear {{agent_name}},

${body}

This letter is a non-binding expression of interest. It is intended to outline the principal terms of a potential purchase so both sides can decide whether to proceed. It does not create a contract or obligate either party. Any agreement would be set out in a purchase and sale agreement signed by both parties.

We appreciate your time and look forward to your response.

Sincerely,

{{signatory_name}}
{{signatory_title}}
{{buyer_entity}}`;
}

const PRICED_VACANT = letter(
  `{{buyer_entity}} is pleased to submit this letter of intent to purchase the property at {{full_address}}. We understand the property is vacant.

The principal terms we propose are:

Purchase price: {{purchase_price}}
Earnest money deposit: {{earnest_money}}, delivered to the title company within three business days of a signed agreement
Inspection period: {{inspection_days}} days from the effective date
Closing: on or before {{close_days}} days from the effective date
Financing: none. This is a cash purchase, not contingent on a loan or an appraisal
Title and closing costs: paid in the customary manner for the county
Condition: purchased as is, with the inspection period as the buyer's sole opportunity to review condition

Because the property is vacant and we are paying cash, we can close on your timeline. If a faster closing is useful to the seller, we can accommodate it.`,
);

const PRICED_OCCUPIED = letter(
  `{{buyer_entity}} is pleased to submit this letter of intent to purchase the property at {{full_address}}. We understand the property is currently occupied.

The principal terms we propose are:

Purchase price: {{purchase_price}}
Earnest money deposit: {{earnest_money}}, delivered to the title company within three business days of a signed agreement
Inspection period: {{inspection_days}} days from the effective date
Closing: on or before {{close_days}} days from the effective date
Financing: none. This is a cash purchase, not contingent on a loan or an appraisal
Occupancy: we will purchase with the occupants in place and assume any existing leases after closing
Condition: purchased as is, with the inspection period as the buyer's sole opportunity to review condition

Please send any existing leases, rent roll, or occupancy details you have. If the seller would prefer to deliver the property vacant instead, we can discuss adjusting the timeline.`,
);

const PRELIMINARY_VACANT = letter(
  `{{buyer_entity}} is writing to express interest in the property at {{full_address}}. We understand the property is vacant.

We would like to open a conversation on the following basis:

Purchase price: {{purchase_price}}, subject to inspection and a review of condition
Earnest money deposit: {{earnest_money}} on a signed agreement
Inspection period: {{inspection_days}} days from the effective date
Closing: on or before {{close_days}} days from the effective date
Financing: none. This is a cash purchase

This is a preliminary number based on the information available to us. We are prepared to move quickly once we have seen the property, and we would welcome the chance to walk it at your convenience.`,
);

const PRELIMINARY_OCCUPIED = letter(
  `{{buyer_entity}} is writing to express interest in the property at {{full_address}}. We understand the property is currently occupied.

We would like to open a conversation on the following basis:

Purchase price: {{purchase_price}}, subject to inspection and a review of condition and occupancy
Earnest money deposit: {{earnest_money}} on a signed agreement
Inspection period: {{inspection_days}} days from the effective date
Closing: on or before {{close_days}} days from the effective date
Financing: none. This is a cash purchase
Occupancy: we will purchase with the occupants in place

This is a preliminary number based on the information available to us. Leases, a rent roll, or any occupancy details would help us firm it up. We are prepared to move quickly once we have seen the property.`,
);

const TEMPLATES: Record<LoiOccupancy, Record<LoiPricing, string>> = {
  vacant: { priced: PRICED_VACANT, preliminary: PRELIMINARY_VACANT },
  occupied: { priced: PRICED_OCCUPIED, preliminary: PRELIMINARY_OCCUPIED },
};

export function templateFor(variant: LoiVariant): string {
  return TEMPLATES[variant.occupancy][variant.pricing];
}

export function describeVariant(variant: LoiVariant): string {
  const occupancy = variant.occupancy === 'vacant' ? 'Vacant' : 'Occupied';
  const pricing = variant.pricing === 'priced' ? 'priced offer' : 'preliminary interest';
  return `${occupancy}, ${pricing}`;
}

/**
 * Picks a sensible starting variant from what is already known about the deal,
 * so the common case needs no choosing. The user can still switch.
 */
export function suggestVariant(
  isVacant: boolean | null | undefined,
  hasPrice: boolean,
): LoiVariant {
  return {
    occupancy: isVacant === false ? 'occupied' : 'vacant',
    pricing: hasPrice ? 'priced' : 'preliminary',
  };
}

// ---------------------------------------------------------------------------
// Outreach email that carries the LOI
// ---------------------------------------------------------------------------

export const EMAIL_SUBJECT_TEMPLATE = 'Offer on {{property_address}} from {{buyer_entity}}';

export const EMAIL_BODY_TEMPLATE = `Hi {{agent_name}},

Attached is a letter of intent from {{buyer_entity}} to purchase
{{full_address}} for {{purchase_price}}, along with our proof of funds.

The offer is cash, with a {{inspection_days}} day inspection period and closing
on or before {{close_days}} days. No financing or appraisal contingency.

Happy to answer questions or adjust terms if something does not work for the
seller. If you would rather talk it through, let me know a good time.

Thank you,
{{signatory_name}}
{{buyer_entity}}`;
