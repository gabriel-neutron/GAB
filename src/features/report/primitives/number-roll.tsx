import { motion, useReducedMotion } from 'motion/react';

/** A value that fades in when it enters the view. It always shows the written value, so that a
 * frame caught during the animation never shows a wrong figure. Under reduced motion, the value
 * shows at once. */
export function NumberRoll({ value }: { readonly value: string }) {
  const reduce = useReducedMotion();
  return (
    <>
      <motion.span
        aria-hidden="true"
        initial={reduce === true ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {value}
      </motion.span>
      <span className="sr-only">{value}</span>
    </>
  );
}
