import React from 'react';

/**
 * A carousel component that displays one child at a time with navigation controls.
 * Loops through children when reaching the end.
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
 *   <Frame>
 *     <img src="/image3.png" alt="Third image" />
 *   </Frame>
 * </Carousel>
 * ```
 */
export default function Carousel(props: {
  /** Child elements to display in the carousel (typically Frame components) */
  children: React.ReactNode;
}): React.ReactElement | null;
