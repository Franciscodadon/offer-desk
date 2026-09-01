import { toPayload, validate, type DealFormValues } from '../DealForm';

const values = (over: Partial<DealFormValues> = {}): DealFormValues => ({
  address: '123 Main St',
  city: 'Fort Myers',
  state: 'FL',
  zip: '33901',
  mls: '',
  parcelId: '',
  listPrice: '',
  offerPrice: '',
  status: 'loi_sent',
  submittedAt: '',
  nextActionAt: '',
  notes: '',
  agentName: '',
  agentBrokerage: '',
  agentPhone: '',
  agentEmail: '',
  beds: '',
  baths: '',
  sqft: '',
  yearBuilt: '',
  listingUrl: '',
  ...over,
});

describe('validate', () => {
  it('accepts a minimal deal with only an address', () => {
    expect(validate(values())).toEqual({});
  });

  it('requires an address', () => {
    expect(validate(values({ address: '   ' })).address).toBeDefined();
  });

  it('rejects a malformed date', () => {
    expect(validate(values({ submittedAt: '8/31/2026' })).submittedAt).toBeDefined();
    expect(validate(values({ submittedAt: '2026-08-31' })).submittedAt).toBeUndefined();
  });

  it('allows an empty date', () => {
    expect(validate(values({ nextActionAt: '' })).nextActionAt).toBeUndefined();
  });

  it('rejects a non-numeric price but accepts a formatted one', () => {
    expect(validate(values({ listPrice: 'about 300k' })).listPrice).toBeDefined();
    expect(validate(values({ listPrice: '$300,000' })).listPrice).toBeUndefined();
  });

  it('rejects an email with no @', () => {
    expect(validate(values({ agentEmail: 'dana.example.com' })).agentEmail).toBeDefined();
  });
});

describe('toPayload', () => {
  it('parses formatted money into numbers', () => {
    const payload = toPayload(values({ listPrice: '$300,000', offerPrice: '240000' }));
    expect(payload.deal.list_price).toBe(300000);
    expect(payload.deal.offer_price).toBe(240000);
  });

  it('stores an empty price as null, never as zero', () => {
    // The rule that protects the deal math: a blank field is unknown, not free.
    const payload = toPayload(values({ listPrice: '', offerPrice: '' }));
    expect(payload.deal.list_price).toBeNull();
    expect(payload.deal.offer_price).toBeNull();
  });

  it('trims text and nulls out blanks', () => {
    const payload = toPayload(values({ address: '  123 Main St  ', city: '   ' }));
    expect(payload.deal.address).toBe('123 Main St');
    expect(payload.deal.city).toBeNull();
  });

  it('omits the agent entirely when no name was entered', () => {
    const payload = toPayload(values({ agentPhone: '239-555-0100' }));
    expect(payload.agent).toBeNull();
  });

  it('includes the agent once a name is present', () => {
    const payload = toPayload(
      values({ agentName: 'Dana Reyes', agentEmail: 'dana@gulfcoast.com' }),
    );
    expect(payload.agent).toEqual({
      name: 'Dana Reyes',
      brokerage: null,
      phone: null,
      email: 'dana@gulfcoast.com',
    });
  });

  it('omits the property row when no facts were entered', () => {
    expect(toPayload(values()).property).toBeNull();
  });

  it('includes the property row when any single fact is present', () => {
    const payload = toPayload(values({ sqft: '1850' }));
    expect(payload.property).toEqual({
      beds: null,
      baths: null,
      sqft: 1850,
      year_built: null,
      listing_url: null,
    });
  });

  it('keeps a listing URL as a property fact', () => {
    const payload = toPayload(values({ listingUrl: 'https://example.com/listing' }));
    expect(payload.property?.listing_url).toBe('https://example.com/listing');
  });
});
