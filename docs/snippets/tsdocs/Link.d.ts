/**
 * Link component types and interfaces
 *
 * @packageDocumentation
 */
/**
 * Validation result for links
 */
export interface LinkValidation {
    /** Whether the link target is valid */
    isValid: boolean;
    /** The resolved path to the target (if valid) */
    path?: string;
    /** Error message if validation failed */
    error?: string;
}
//# sourceMappingURL=Link.d.ts.map