/**
 * The deck's panels, rendered.
 *
 * These check what a reader actually sees - a dash where there is no number, a
 * drop line only where deals were lost, an empty state instead of a bare
 * heading - rather than that a component returned something.
 */
import type { Deal } from '@/domain/types';
import type { DealStatus } from '@/domain/status';
import { EMPTY_VALUE } from '@/lib/format';
import { fireEvent, renderWithProviders, screen } from '@/test/render';

import { pipelineFunnel, stageDetail, workQueue } from '../deck';
import { PipelineFunnel } from '../PipelineFunnel';
import { Sparkline } from '../Sparkline';
import { StageDetail } from '../StageDetail';
import { WorkQueue } from '../WorkQueue';

const TODAY = new Date('2026-03-15T12:00:00Z');

let sequence = 0;

function deal(overrides: Partial<Deal> & { status: DealStatus }): Deal {
  sequence += 1;
  return {
    id: `deal-${sequence}`,
    org_id: 'org-1',
    address: `${sequence} Test St`,
    city: null,
    state: null,
    zip: null,
    parcel_id: null,
    mls: null,
    agent_id: null,
    list_price: null,
    offer_price: null,
    submitted_at: null,
    next_action_at: null,
    assignee_id: null,
    notes: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  } as Deal;
}

beforeEach(() => {
  sequence = 0;
});

describe('PipelineFunnel', () => {
  it('names every stage and its count', () => {
    const funnel = pipelineFunnel([
      deal({ status: 'loi_sent', offer_price: 100_000 }),
      deal({ status: 'offer_accepted', offer_price: 200_000 }),
      deal({ status: 'pass' }),
    ]);
    renderWithProviders(<PipelineFunnel funnel={funnel} dense={false} showAmounts />);

    expect(screen.getByText('Logged')).toBeTruthy();
    expect(screen.getByText('Offer sent')).toBeTruthy();
    expect(screen.getByText('Answered')).toBeTruthy();
    expect(screen.getByText('Accepted')).toBeTruthy();
  });

  it('shows a drop line for deals that left, and none where none did', () => {
    const funnel = pipelineFunnel([
      deal({ status: 'offer_accepted' }),
      deal({ status: 'pass' }),
    ]);
    renderWithProviders(<PipelineFunnel funnel={funnel} dense={false} showAmounts />);

    expect(screen.getByText('passed before an offer went out')).toBeTruthy();
    // Nothing is waiting and nothing was rejected, so those lines stay off.
    expect(screen.queryByText(/waiting on a reply/)).toBeNull();
    expect(screen.queryByText(/seller no/)).toBeNull();
  });

  it('reads a dash rather than $0 for a stage with nothing priced', () => {
    const funnel = pipelineFunnel([deal({ status: 'loi_sent' })]);
    renderWithProviders(<PipelineFunnel funnel={funnel} dense={false} showAmounts />);
    expect(screen.getAllByText(EMPTY_VALUE).length).toBeGreaterThan(0);
  });

  it('states the conversion each stage carries, for a screen reader too', () => {
    const funnel = pipelineFunnel([
      deal({ status: 'loi_sent', offer_price: 100_000 }),
      deal({ status: 'pass' }),
    ]);
    renderWithProviders(<PipelineFunnel funnel={funnel} dense={false} showAmounts />);
    expect(
      screen.getByLabelText(/Offer sent: 1 deal, \$100,000 offered, 50% of the step above/),
    ).toBeTruthy();
  });

  it('drops the money column on a narrow screen, keeping the counts', () => {
    const funnel = pipelineFunnel([deal({ status: 'loi_sent', offer_price: 100_000 })]);
    renderWithProviders(<PipelineFunnel funnel={funnel} dense={false} showAmounts={false} />);

    expect(screen.queryByText('$100,000')).toBeNull();
    expect(screen.getByText('Offer sent')).toBeTruthy();
    // The figure is still spoken, so nothing is lost - only the column is.
    expect(screen.getByLabelText(/Offer sent: 1 deal, \$100,000 offered/)).toBeTruthy();
  });
});

describe('WorkQueue', () => {
  it('says so plainly when there is nothing to chase', () => {
    renderWithProviders(<WorkQueue items={[]} onOpen={() => {}} />);
    expect(screen.getByText(/Nothing is overdue/)).toBeTruthy();
  });

  it('leads each row with the reason, not the status', () => {
    const items = workQueue(
      [deal({ status: 'loi_sent', submitted_at: '2026-02-20', offer_price: 184_000 })],
      TODAY,
    );
    renderWithProviders(<WorkQueue items={items} onOpen={() => {}} />);

    expect(screen.getByText('1 Test St')).toBeTruthy();
    expect(screen.getByText('No reply in 23d · $184,000')).toBeTruthy();
  });

  it('opens the deal the row is about', () => {
    const items = workQueue([deal({ status: 'follow_up', submitted_at: '2026-02-01' })], TODAY);
    const onOpen = jest.fn();
    renderWithProviders(<WorkQueue items={items} onOpen={onOpen} />);

    fireEvent.press(screen.getByText('1 Test St'));
    expect(onOpen).toHaveBeenCalledWith('deal-1');
  });
});

describe('StageDetail', () => {
  it('lists every stage, including the empty ones', () => {
    renderWithProviders(
      <StageDetail rows={stageDetail([deal({ status: 'loi_sent' })], TODAY)} showShare />,
    );

    expect(screen.getByText('LOI Sent')).toBeTruthy();
    expect(screen.getByText('Buyer Rejected')).toBeTruthy();
    expect(screen.getByText('Pass')).toBeTruthy();
  });

  it('shows a dash for a stage nobody is in rather than a row of zeroes', () => {
    renderWithProviders(
      <StageDetail rows={stageDetail([deal({ status: 'loi_sent' })], TODAY)} showShare />,
    );
    // Five empty stages, each contributing a dashed count, amount and age.
    expect(screen.getAllByText(EMPTY_VALUE).length).toBeGreaterThanOrEqual(5);
  });

  it('reports the oldest live deal in words as well as a number', () => {
    const rows = stageDetail(
      [deal({ status: 'follow_up', submitted_at: '2026-03-01', offer_price: 90_000 })],
      TODAY,
    );
    renderWithProviders(<StageDetail rows={rows} showShare />);
    expect(screen.getByLabelText(/Follow Up: 1 deal, \$90,000 offered.*oldest 14 days/)).toBeTruthy();
  });

  it('drops the share column on a narrow screen', () => {
    const rows = stageDetail([deal({ status: 'loi_sent' }), deal({ status: 'pass' })], TODAY);
    renderWithProviders(<StageDetail rows={rows} showShare={false} />);

    expect(screen.queryByText('Share')).toBeNull();
    expect(screen.queryByText('50.0%')).toBeNull();
    expect(screen.getByText('Offered')).toBeTruthy();
  });
});

describe('Sparkline', () => {
  it('describes the series it draws', () => {
    renderWithProviders(
      <Sparkline values={[1, null, 3]} accessibilityLabel="Offers each week: 1, none, 3" />,
    );
    expect(screen.getByLabelText('Offers each week: 1, none, 3')).toBeTruthy();
  });

  it('renders an all-null series without dividing by zero', () => {
    expect(() =>
      renderWithProviders(
        <Sparkline values={[null, null]} accessibilityLabel="No decisions yet" />,
      ),
    ).not.toThrow();
  });
});
