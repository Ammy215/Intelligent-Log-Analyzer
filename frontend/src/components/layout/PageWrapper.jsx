import { motion } from 'framer-motion'

export default function PageWrapper({ children, title, subtitle, actions }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-8 ml-60 max-w-[1600px]"
    >
      {/* Page header */}
      {(title || actions) && (
        <div className="mb-7 flex items-center justify-between">
          <div>
            {title && <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>}
            {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      )}

      {/* Page content */}
      <div>{children}</div>
    </motion.div>
  )
}
