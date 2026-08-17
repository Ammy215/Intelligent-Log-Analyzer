import { motion } from 'framer-motion'

// ml-60 applies only from lg up: below that the sidebar is a slide-in drawer
// rather than a permanent rail, so reserving 240px of left gutter would push
// content off a phone screen entirely. pt-[72px] clears the fixed mobile header.
export default function PageWrapper({ children, title, subtitle, actions }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-4 sm:p-6 lg:p-8 pt-[72px] lg:pt-8 lg:ml-60 max-w-[1600px]"
    >
      {/* Page header — stacks below sm so a long title and its action buttons
          stop colliding on narrow screens. */}
      {(title || actions) && (
        <div className="mb-6 lg:mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            {title && <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>}
            {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3 flex-wrap shrink-0">{actions}</div>}
        </div>
      )}

      {/* Page content */}
      <div>{children}</div>
    </motion.div>
  )
}
