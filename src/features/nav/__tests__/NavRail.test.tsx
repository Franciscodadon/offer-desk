import { fireEvent, renderWithProviders, screen } from '@/test/render';

import { isCurrent, NavRail } from '../NavRail';

describe('isCurrent', () => {
  it('lights the destination you are on', () => {
    expect(isCurrent('/pipeline', '/pipeline')).toBe(true);
  });

  it('keeps the parent lit on a screen underneath it', () => {
    expect(isCurrent('/deal/abc/analyzer', '/deal')).toBe(true);
  });

  it('does not light a destination that merely shares a prefix', () => {
    expect(isCurrent('/settings-export', '/settings')).toBe(false);
  });
});

describe('NavRail', () => {
  it('offers every destination and the workspace it belongs to', () => {
    renderWithProviders(
      <NavRail pathname="/dashboard" workspaceName="Joseph Real Estate" onNavigate={() => {}} />,
    );

    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Pipeline')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Joseph Real Estate')).toBeTruthy();
  });

  it('marks the current destination as selected, not just colored', () => {
    renderWithProviders(
      <NavRail pathname="/pipeline" workspaceName={null} onNavigate={() => {}} />,
    );

    const links = screen.getAllByRole('link');
    const selected = links.filter((link) => link.props.accessibilityState?.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toContainElement(screen.getByText('Pipeline'));
  });

  it('navigates to the route it names', () => {
    const onNavigate = jest.fn();
    renderWithProviders(
      <NavRail pathname="/dashboard" workspaceName={null} onNavigate={onNavigate} />,
    );

    fireEvent.press(screen.getByText('Settings'));
    expect(onNavigate).toHaveBeenCalledWith('/settings');
  });
});
