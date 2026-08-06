import { motion } from 'framer-motion'

export default function PageWrapper({ children, title, subtitle, actions }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-8 ml-60"
    >
      {/* Page header */}
      {(title || actions) && (
        <div className="mb-8 flex items-center justify-between">
          <div>
            {title && <h1 className="text-3xl font-semibold mb-2">{title}</h1>}
            {subtitle && <p className="text-text-secondary">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      )}

      {/* Page content */}
      <div>{children}</div>
    </motion.div>
  )
}
