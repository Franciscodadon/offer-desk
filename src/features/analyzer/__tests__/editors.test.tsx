/**
 * Editor behaviour, including an end-to-end check that the PRD 7.6 acceptance
 * case still reads correctly once it has been through the UI.
 *
 * The math is already verified in src/domain/analyzer, so what is at stake here
 * is the wiring: percent fields converting 12.5 to 0.125 exactly once, holding
 * costs summing before being multiplied by months, and the right figure landing
 * next to the right label.
 */
import { defaultLoan, emptyHolding, type FlipInputs, type WholesaleInputs } from '@/domain/analyzer';
import { fireEvent, renderWithProviders, screen } from '@/test/render';

import { FlipEditor, WholesaleEditor } from '../editors';

const acceptanceCase: FlipInputs = {
  arv: 357244,
  repairs: 25000,
  purchase: 0,
  targetProfit: 50000,
  mode: 'max_offer',
  loans: [
    {
      ...defaultLoan,
      base: 'purchase',
      downPct: 0.25,
      type: 'interest_only',
      ratePct: 0.125,
      pointsPct: 0,
      lenderFees: 0,
    },
  ],
  holding: { ...emptyHolding, other: 687, months: 6 },
  transaction: {
    agentPct: 0.06,
    transferPct: 0.01,
    buyingFlat: 2500,
    sellingFlat: 2000,
    buyerCredits: 0,
  },
};

/**
 * The flip editor opens on the offer ladder; the inputs live behind "Full
 * model". Tests that drive those inputs open it first, the way a user would.
 */
function renderWithFullModel(onChange: (state: { inputs: FlipInputs }) => void = () => {}) {
  const view = renderWithProviders(
    <FlipEditor initial={acceptanceCase} onChange={onChange as never} />,
  );
  fireEvent.press(screen.getByText('Full model'));
  return view;
}

describe('FlipEditor - PRD 7.6 acceptance case through the UI', () => {
  it('displays the max offer and every headline figure the PRD states', () => {
    renderWithProviders(<FlipEditor initial={acceptanceCase} onChange={() => {}} />);

    expect(screen.getByText('$237,483')).toBeTruthy();
    expect(screen.getByText('$50,000')).toBeTruthy();
    expect(screen.getByText('14.0%')).toBeTruthy();
    expect(screen.getByText('49%')).toBeTruthy();
    expect(screen.getByText('$102,125')).toBeTruthy();
    expect(screen.getByText('$307,244')).toBeTruthy();
    expect(screen.getByText('$11,132')).toBeTruthy();
    expect(screen.getByText('$4,122')).toBeTruthy();
    expect(screen.getByText('$29,507')).toBeTruthy();
  });

  it('shows rates as whole percentages, not as ratios', () => {
    renderWithFullModel();

    // 0.125 must reach the user as 12.5, and 0.06 as 6 - not 0.125 and 0.06.
    expect(screen.getByLabelText('Rate %').props.value).toBe('12.5');
    expect(screen.getByLabelText('Agent %').props.value).toBe('6');
    expect(screen.getByLabelText('Down %').props.value).toBe('25');
  });

  it('converts a typed percentage back to a ratio exactly once', () => {
    const reports: FlipInputs[] = [];
    renderWithFullModel(({ inputs }) => reports.push(inputs));

    fireEvent.changeText(screen.getByLabelText('Rate %'), '10');

    const latest = reports[reports.length - 1];
    expect(latest.loans[0].ratePct).toBe(0.1);
  });

  it('recomputes when an input changes', () => {
    renderWithFullModel();

    expect(screen.getByText('$237,483')).toBeTruthy();
    // A higher target profit must lower the max offer.
    fireEvent.changeText(screen.getByLabelText('Target profit'), '75000');
    expect(screen.queryByText('$237,483')).toBeNull();
  });

  it('switches between max-offer and profit mode', () => {
    renderWithFullModel();

    expect(screen.getByLabelText('Target profit')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Profit'));
    expect(screen.getByLabelText('Purchase price')).toBeTruthy();
    expect(screen.queryByLabelText('Target profit')).toBeNull();
  });

  it('grades the margin with a verdict pill', () => {
    renderWithProviders(<FlipEditor initial={acceptanceCase} onChange={() => {}} />);
    // 14.0% margin falls in the "thin" band.
    expect(screen.getByText('Thin')).toBeTruthy();
  });

  it('lets a loan be added and removed', () => {
    renderWithFullModel();

    expect(screen.queryByText('Remove loan')).toBeNull();
    fireEvent.press(screen.getByText('Add loan'));
    expect(screen.getAllByText('Remove loan')).toHaveLength(2);

    fireEvent.press(screen.getAllByText('Remove loan')[0]);
    expect(screen.queryByText('Remove loan')).toBeNull();
  });

  it('clearing a money field does not write a bogus number', () => {
    const reports: FlipInputs[] = [];
    renderWithFullModel(({ inputs }) => reports.push(inputs));

    fireEvent.changeText(screen.getByLabelText('Repairs'), '');

    const latest = reports[reports.length - 1];
    expect(latest.repairs).toBe(0);
    expect(Number.isFinite(latest.repairs)).toBe(true);
  });
});

describe('FlipEditor - the offer ladder', () => {
  it('opens on the ladder, with the full model behind a tap', () => {
    renderWithProviders(<FlipEditor initial={acceptanceCase} onChange={() => {}} />);

    expect(screen.getByText('Offer ladder')).toBeTruthy();
    // The financing inputs are not on screen until asked for.
    expect(screen.queryByLabelText('Rate %')).toBeNull();

    fireEvent.press(screen.getByText('Full model'));
    expect(screen.getByLabelText('Rate %')).toBeTruthy();
  });

  it('prices every percentage on the ladder', () => {
    renderWithProviders(<FlipEditor initial={acceptanceCase} onChange={() => {}} />);

    // Each rung is a real run of the model at that purchase price.
    expect(screen.getByText('$153,622')).toBeTruthy(); // 50%
    expect(screen.getByText('$225,071')).toBeTruthy(); // 70%
    expect(screen.getByText('$278,657')).toBeTruthy(); // 85%
  });

  it('says how high you can go, in words', () => {
    renderWithProviders(<FlipEditor initial={acceptanceCase} onChange={() => {}} />);
    expect(screen.getByText(/75% is as high as you can go/)).toBeTruthy();
  });

  it('takes a rung into the model as a fixed purchase when tapped', () => {
    const reports: FlipInputs[] = [];
    renderWithProviders(
      <FlipEditor initial={acceptanceCase} onChange={({ inputs }) => reports.push(inputs)} />,
    );

    fireEvent.press(screen.getByLabelText(/^65% of ARV/));

    const latest = reports[reports.length - 1];
    expect(latest.mode).toBe('profit');
    expect(Math.round(latest.purchase)).toBe(207209);
  });
});

describe('WholesaleEditor', () => {
  const wholesale: WholesaleInputs = {
    arv: 300000,
    repairs: 40000,
    maoPct: 0.7,
    assignmentFee: 10000,
    negotiationBuffer: 0.1,
  };

  it('shows the appendix D chain', () => {
    renderWithProviders(<WholesaleEditor initial={wholesale} onChange={() => {}} />);

    expect(screen.getByText('$144,000')).toBeTruthy(); // opening offer
    expect(screen.getByText('$160,000')).toBeTruthy(); // MAO
    expect(screen.getByText('$170,000')).toBeTruthy(); // buyer price
    expect(screen.getByText('$10,000')).toBeTruthy(); // fee
  });

  it('warns when repairs leave nothing to contract for', () => {
    renderWithProviders(
      <WholesaleEditor initial={{ ...wholesale, repairs: 250000 }} onChange={() => {}} />,
    );
    expect(screen.getByText(/does not work at this ARV/i)).toBeTruthy();
  });
});
