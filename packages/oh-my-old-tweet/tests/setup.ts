import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Auto-cleanup DOM between component tests.
// See: https://testing-library.com/docs/react-testing-library/api/#cleanup
afterEach(cleanup);
