import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';

afterEach(cleanup);
import { SkeletonCard, SkeletonList } from '../../src/SkeletonCard';

describe('SkeletonCard', () => {
  it('renders with data-testid skeleton-card', () => {
    const { getAllByTestId } = render(<SkeletonCard />);
    expect(getAllByTestId('skeleton-card')).toHaveLength(1);
  });
});

describe('SkeletonList', () => {
  it('renders the requested number of skeletons', () => {
    const { getAllByTestId } = render(<SkeletonList count={5} />);
    expect(getAllByTestId('skeleton-card')).toHaveLength(5);
  });

  it('renders zero skeletons when count is 0', () => {
    const { queryAllByTestId } = render(<SkeletonList count={0} />);
    expect(queryAllByTestId('skeleton-card')).toHaveLength(0);
  });
});
