import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { useReleaseRender } from '../hydrate-near';
import { useReduceMotion } from '../reduced-motion';

/** Show the content with a fade and a rise of 24px when it enters the view, once. Under reduced
 * motion, and on the release page, it shows the content at once: the release HTML shows its text
 * before any script runs. */
export function Reveal({ children }: { readonly children: ReactNode }) {
  const reduce = useReduceMotion();
  const still = useReleaseRender() || reduce;
  return (
    <motion.div
      initial={still ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      // Any visible pixel starts it: a tall block shows no empty band while it waits.
      viewport={{ once: true, amount: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
