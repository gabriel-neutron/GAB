import { OPERATOR_KEY_HEADER } from '@gab/proposal/request';

// Test support: the key that the tests give to the writer, and the header that carries it.
export const TEST_OPERATOR_KEY = 'test-key-of-the-operator-0123456789abcdef';

export const OPERATOR = { [OPERATOR_KEY_HEADER]: TEST_OPERATOR_KEY } as const;
