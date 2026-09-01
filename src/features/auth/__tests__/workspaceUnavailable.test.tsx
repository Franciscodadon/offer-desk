import type { WorkspaceProblem } from '../AuthProvider';
import { renderWithProviders, screen } from '@/test/render';

const mockSignOut = jest.fn();
const mockRefresh = jest.fn();

jest.mock('../AuthProvider', () => ({
  useAuth: () => ({
    profile: null,
    session: { user: { email: 'francisco@dvolente.com' } },
    signOut: mockSignOut,
    refreshProfile: mockRefresh,
  }),
}));

// eslint-disable-next-line import/first
import { WorkspaceUnavailable } from '../WorkspaceUnavailable';

describe('WorkspaceUnavailable', () => {
  it('tells a missing schema apart from a missing profile', () => {
    const problem: WorkspaceProblem = {
      kind: 'schema_missing',
      message: 'relation "public.users" does not exist',
    };
    renderWithProviders(<WorkspaceUnavailable problem={problem} />);

    expect(screen.getByText('The database is empty')).toBeTruthy();
    expect(screen.getByText(/npm run db:bundle/)).toBeTruthy();
    // The fix for the other case would be wrong here.
    expect(screen.queryByText(/Delete this account/)).toBeNull();
  });

  it('offers the account-level fix when the tables exist but the row does not', () => {
    const problem: WorkspaceProblem = {
      kind: 'no_profile',
      message: 'This account signed in, but it has no workspace row.',
    };
    renderWithProviders(<WorkspaceUnavailable problem={problem} />);

    expect(screen.getByText('This account has no workspace')).toBeTruthy();
    expect(screen.getByText(/Delete this account/)).toBeTruthy();
    expect(screen.queryByText(/npm run db:bundle/)).toBeNull();
  });

  it('names the signed-in address so the right user gets deleted', () => {
    renderWithProviders(
      <WorkspaceUnavailable problem={{ kind: 'no_profile', message: 'x' }} />,
    );
    expect(screen.getByText(/francisco@dvolente\.com/)).toBeTruthy();
  });

  it('shows the raw database error only when the cause is unknown', () => {
    renderWithProviders(
      <WorkspaceUnavailable
        problem={{ kind: 'unknown', message: 'permission denied for table users' }}
      />,
    );
    expect(screen.getByText('permission denied for table users')).toBeTruthy();
  });

  it('always offers a way out rather than trapping the user', () => {
    renderWithProviders(
      <WorkspaceUnavailable problem={{ kind: 'schema_missing', message: 'x' }} />,
    );
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.getByText('Sign out')).toBeTruthy();
  });
});
