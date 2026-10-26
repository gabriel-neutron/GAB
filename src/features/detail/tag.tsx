import type { ReactNode } from 'react';

import { TAG_CLASS } from './style';

export interface TagProps {
  readonly kind: keyof typeof TAG_CLASS;
  readonly children: ReactNode;
}

/** StatusTag: a mono uppercase tag that states the status of a fact. */
export function Tag({ kind, children }: TagProps) {
  return <span className={TAG_CLASS[kind]}>{children}</span>;
}
