import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Show the content with a fade and a rise of 24px when it enters the view, once. Under reduced
 * motion, it shows the content at once. */
export function Reveal({ children }: { readonly children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce === true ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      // Any visible pixel starts it: a tall block shows no empty band while it waits.
      viewport={{ once: true, amount: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
