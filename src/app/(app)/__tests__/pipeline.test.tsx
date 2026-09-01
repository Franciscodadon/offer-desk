/**
 * Pipeline screen behaviour. The data layer and router are mocked so this
 * exercises the real screen - filters, search, empty states, and the figures
 * on each row - without needing a live Supabase project.
 */
import type { Contact, Deal } from '@/domain/types';
import { fireEvent, renderWithProviders, screen } from '@/test/render';

// Jest hoists jest.mock factories above the file, so anything they close over
// must be prefixed with `mock` to be allowed out of scope.
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ orgId: 'org-1' }),
}));

const deals: Deal[] = [
  {
    id: '1',
    org_id: 'org-1',
    address: '123 Main St',
    city: 'Fort Myers',
    state: 'FL',
    zip: '33901',
    parcel_id: null,
    mls: null,
    agent_id: 'agent-1',
    list_price: 300000,
    offer_price: 240000,
    status: 'loi_sent',
    submitted_at: '2026-08-20',
    next_action_at: null,
    assignee_id: null,
    notes: null,
    created_at: '2026-08-20T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
    deleted_at: null,
  },
  {
    id: '2',
    org_id: 'org-1',
    address: '456 Oak Ave',
    city: 'Cape Coral',
    state: 'FL',
    zip: '33904',
    parcel_id: null,
    mls: null,
    agent_id: null,
    list_price: 250000,
    offer_price: 225000,
    status: 'follow_up',
    submitted_at: '2026-08-25',
    next_action_at: '2026-09-05',
    assignee_id: null,
    notes: null,
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
    deleted_at: null,
  },
];

const mockContacts: Contact[] = [
  {
    id: 'agent-1',
    org_id: 'org-1',
    name: 'Dana Reyes',
    brokerage: 'Gulf Coast Realty',
    phone: null,
    email: null,
    type: 'listing_agent',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    deleted_at: null,
  },
];

let mockDealsResult: {
  data: Deal[];
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
};

jest.mock('@/features/deals/queries', () => ({
  useDeals: () => ({ ...mockDealsResult, refetch: jest.fn() }),
  useContacts: () => ({ data: mockContacts }),
}));

// Imported after the mocks above on purpose: the screen resolves them at
// module load, so the import must not be hoisted above their registration.
// eslint-disable-next-line import/first
import PipelineScreen from '../pipeline';

function renderPipeline() {
  return renderWithProviders(<PipelineScreen />);
}

beforeEach(() => {
  mockPush.mockClear();
  mockDealsResult = { data: deals, isLoading: false, isError: false, isRefetching: false };
});

describe('PipelineScreen', () => {
  it('lists every deal with its address and money figures', () => {
    renderPipeline();

    expect(screen.getByText('123 Main St')).toBeTruthy();
    expect(screen.getByText('456 Oak Ave')).toBeTruthy();
    expect(screen.getByText('$300,000')).toBeTruthy();
    expect(screen.getByText('$240,000')).toBeTruthy();
  });

  it('shows offer-to-list on each row, per PRD 7.2', () => {
    renderPipeline();
    // 240,000 / 300,000 and 225,000 / 250,000
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('90%')).toBeTruthy();
  });

  it('reports how many deals are visible', () => {
    renderPipeline();
    expect(screen.getByText('2 of 2 deals')).toBeTruthy();
  });

  it('filters by status when a chip is tapped', () => {
    renderPipeline();

    fireEvent.press(screen.getByLabelText('Follow Up, 1'));

    expect(screen.queryByText('123 Main St')).toBeNull();
    expect(screen.getByText('456 Oak Ave')).toBeTruthy();
    expect(screen.getByText('1 of 2 deals')).toBeTruthy();
  });

  it('searches by address', () => {
    renderPipeline();

    fireEvent.changeText(screen.getByLabelText('Search'), 'oak');

    expect(screen.queryByText('123 Main St')).toBeNull();
    expect(screen.getByText('456 Oak Ave')).toBeTruthy();
  });

  it('searches by listing agent', () => {
    renderPipeline();

    fireEvent.changeText(screen.getByLabelText('Search'), 'dana');

    expect(screen.getByText('123 Main St')).toBeTruthy();
    expect(screen.queryByText('456 Oak Ave')).toBeNull();
  });

  it('offers a way out when filters match nothing', () => {
    renderPipeline();

    fireEvent.changeText(screen.getByLabelText('Search'), 'nonexistent');
    expect(screen.getByText('No matches')).toBeTruthy();

    fireEvent.press(screen.getByText('Clear filters'));
    expect(screen.getByText('123 Main St')).toBeTruthy();
  });

  it('invites the first deal when the pipeline is empty', () => {
    mockDealsResult = { data: [], isLoading: false, isError: false, isRefetching: false };
    renderPipeline();

    expect(screen.getByText('Your pipeline is empty')).toBeTruthy();
    fireEvent.press(screen.getByText('Log a deal'));
    expect(mockPush).toHaveBeenCalledWith('/deal/new');
  });

  it('opens a deal when its row is tapped', () => {
    renderPipeline();

    fireEvent.press(screen.getByLabelText('123 Main St, loi sent'));
    expect(mockPush).toHaveBeenCalledWith('/deal/1');
  });

  it('says it is showing cached data when the refresh failed', () => {
    // The offline promise in PRD principle 3: a failed sync must not look like
    // an empty pipeline.
    mockDealsResult = { data: deals, isLoading: false, isError: true, isRefetching: false };
    renderPipeline();

    expect(screen.getByText(/last synced copy/i)).toBeTruthy();
    expect(screen.getByText('123 Main St')).toBeTruthy();
  });
});
