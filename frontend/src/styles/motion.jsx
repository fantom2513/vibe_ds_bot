import { motion } from 'framer-motion'

export const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

export const pageTransition = {
  type: 'tween',
  ease: [0.25, 0.1, 0.25, 1],
  duration: 0.22,
}

export const cardVariants = {
  initial: { opacity: 0, y: 16 },
  animate: (i) => ({
    opacity: 1, y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.28,
      ease: [0.25, 0.1, 0.25, 1],
    }
  }),
}

export const listItemVariants = {
  initial: { opacity: 0, x: -8 },
  animate: (i) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.04, duration: 0.2 }
  }),
}

export const drawerVariants = {
  initial: { x: 40, opacity: 0 },
  animate: {
    x: 0, opacity: 1,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }
  },
}

export const PageWrapper = ({ children }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={pageTransition}
    style={{ height: '100%' }}
  >
    {children}
  </motion.div>
)
