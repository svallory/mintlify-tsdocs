/**
 * Feature Component
 *
 * A simple component for showcasing product features with a header and custom content.
 * Displays a header with icon/title/subtitle, and renders any children below.
 *
 * @version 2.1.0
 */

// ============================================================================
// Feature Component
// ============================================================================

/**
 * Feature - Showcase component for product features
 * @param {import('./Feature').FeatureProps} props
 * @returns {JSX.Element}
 */
export const Feature = ({ icon, title, subtitle, children }) => {
  // Validate required props
  if (!title || typeof title !== 'string') {
    console.error('Feature: title prop is required and must be a string');
    return null;
  }

  if (!subtitle || typeof subtitle !== 'string') {
    console.error('Feature: subtitle prop is required and must be a string');
    return null;
  }

  return (
    <article
      className="block font-normal relative my-8 rounded-2xl bg-white dark:bg-background-dark border border-gray-950/10 dark:border-white/10 overflow-hidden w-full p-8"
      data-component="tsdocs-feature"
    >
      {/* Header */}
      <div className="mb-8">
        <h3 className="flex items-center gap-3 text-3xl font-semibold m-0 mb-2">
          {icon && (
            <div className="icon flex items-center justify-center h-6 w-6 fill-gray-800 dark:fill-gray-100 text-gray-800 dark:text-gray-100">
              <Icon icon={icon} size={24} />
            </div>
          )}
          {title}
        </h3>
        <p className="text-lg opacity-70 m-0">{subtitle}</p>
      </div>

      {/* Content */}
      {children && (
        <div className="text-base leading-relaxed flex flex-col gap-6">
          {children}
        </div>
      )}
    </article>
  );
};

export default Feature;
