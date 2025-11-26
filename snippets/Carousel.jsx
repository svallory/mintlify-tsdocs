/**
 * A carousel component that displays one child at a time with navigation controls.
 * Automatically loops through children when reaching the end.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child elements to display in the carousel (typically Frame components)
 * @returns {React.ReactElement | null} The carousel component or null if no children
 *
 * @example
 * ```jsx
 * <Carousel>
 *   <Frame>
 *     <img src="/image1.png" alt="First image" />
 *   </Frame>
 *   <Frame>
 *     <img src="/image2.png" alt="Second image" />
 *   </Frame>
 * </Carousel>
 * ```
 */
export default function Carousel({ children }) {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  /** @type {React.ReactElement[]} */
  const items = React.Children.toArray(children);
  const totalItems = items.length;

  if (totalItems === 0) {
    return null;
  }

  /**
   * Navigate to the previous item, looping to the end if at the start
   */
  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? totalItems - 1 : prevIndex - 1
    );
  };

  /**
   * Navigate to the next item, looping to the start if at the end
   */
  const goToNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === totalItems - 1 ? 0 : prevIndex + 1
    );
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '100%',
      margin: '1rem 0'
    }}>
      {/* Carousel content */}
      <div style={{
        overflow: 'hidden',
        borderRadius: '8px'
      }}>
        <div style={{
          display: 'flex',
          transition: 'transform 0.3s ease-in-out',
          transform: `translateX(-${currentIndex * 100}%)`
        }}>
          {items.map((item, index) => (
            <div
              key={index}
              style={{
                minWidth: '100%',
                width: '100%'
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation buttons */}
      {totalItems > 1 && (
        <>
          <button
            onClick={goToPrevious}
            aria-label="Previous"
            style={{
              position: 'absolute',
              top: '50%',
              left: '0.5rem',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '2.5rem',
              height: '2.5rem',
              cursor: 'pointer',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              zIndex: 10
            }}
            onMouseEnter={
              /** @param {React.MouseEvent<HTMLButtonElement>} e */
              (e) => e.target.style.background = 'rgba(0, 0, 0, 0.7)'
            }
            onMouseLeave={
              /** @param {React.MouseEvent<HTMLButtonElement>} e */
              (e) => e.target.style.background = 'rgba(0, 0, 0, 0.5)'
            }
          >
            ‹
          </button>

          <button
            onClick={goToNext}
            aria-label="Next"
            style={{
              position: 'absolute',
              top: '50%',
              right: '0.5rem',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '2.5rem',
              height: '2.5rem',
              cursor: 'pointer',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              zIndex: 10
            }}
            onMouseEnter={
              /** @param {React.MouseEvent<HTMLButtonElement>} e */
              (e) => e.target.style.background = 'rgba(0, 0, 0, 0.7)'
            }
            onMouseLeave={
              /** @param {React.MouseEvent<HTMLButtonElement>} e */
              (e) => e.target.style.background = 'rgba(0, 0, 0, 0.5)'
            }
          >
            ›
          </button>

          {/* Indicators */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '1rem'
          }}>
            {items.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
                style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: index === currentIndex ? '#3b82f6' : '#d1d5db',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.2s'
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
