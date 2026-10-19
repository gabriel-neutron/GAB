import { createAppRouter } from './app-router';
import { keepOperatorKey } from '@/shared/write/operator-key';

// The router reads the address when it is created, so the key leaves the address first.
keepOperatorKey();

export const router = createAppRouter();
