/**
 * Global type declarations for Mintlify components.
 * These components are provided by Mintlify at runtime.
 */

declare namespace JSX {
  interface IntrinsicElements {
    ResponseField: any;
    Expandable: any;
  }
}

// Also declare as global React components
declare const ResponseField: React.FC<any>;
declare const Expandable: React.FC<any>;
