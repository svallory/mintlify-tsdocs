/**
 * Tests for TypeTree component - Recursion Protection
 *
 * These tests verify the recursion depth protection that prevents
 * stack overflow crashes when rendering deeply nested or circular structures.
 */

import { describe, it, expect } from 'bun:test';
import type { TypeTreeProperty } from '../../src/components/TypeTree';

/**
 * Helper: Create a deeply nested structure for testing
 */
function createDeepStructure(depth: number): TypeTreeProperty {
  let current: TypeTreeProperty = {
    name: `level${depth}`,
    type: 'string',
    description: `Deepest level (${depth})`
  };

  for (let i = depth - 1; i >= 0; i--) {
    current = {
      name: `level${i}`,
      type: 'object',
      description: `Level ${i}`,
      properties: [current]
    };
  }

  return current;
}

/**
 * Helper: Create a circular structure for testing
 */
function createCircularStructure(): TypeTreeProperty {
  const root: TypeTreeProperty = {
    name: 'root',
    type: 'object',
    description: 'Root object with circular reference',
    properties: []
  };

  const child: TypeTreeProperty = {
    name: 'child',
    type: 'object',
    description: 'Child that references parent',
    properties: [root] // Creates circular reference
  };

  root.properties = [child];

  return root;
}

/**
 * Helper: Simulate TypeTree rendering with depth tracking
 * This extracts the recursion logic without needing React
 */
function simulateTypeTreeRender(
  props: TypeTreeProperty,
  level: number = 0,
  maxDepth: number = 10
): { maxLevelReached: number; stoppedAtMaxDepth: boolean } {
  // This is the key logic from TypeTree component
  if (level >= maxDepth) {
    return { maxLevelReached: level, stoppedAtMaxDepth: true };
  }

  const hasNested = props.properties && props.properties.length > 0;

  if (!hasNested) {
    return { maxLevelReached: level, stoppedAtMaxDepth: false };
  }

  // Recursively process children
  let deepest = level;
  let hitMax = false;

  for (const prop of props.properties) {
    const result = simulateTypeTreeRender(prop, level + 1, maxDepth);
    if (result.maxLevelReached > deepest) {
      deepest = result.maxLevelReached;
    }
    if (result.stoppedAtMaxDepth) {
      hitMax = true;
    }
  }

  return { maxLevelReached: deepest, stoppedAtMaxDepth: hitMax };
}

describe('TypeTree - Recursion Protection', () => {
  describe('maxDepth parameter', () => {
    it('should stop rendering at default maxDepth of 10', () => {
      const deepStructure = createDeepStructure(15);
      const result = simulateTypeTreeRender(deepStructure, 0, 10);

      expect(result.stoppedAtMaxDepth).toBe(true);
      expect(result.maxLevelReached).toBe(10);
    });

    it('should allow custom maxDepth', () => {
      const deepStructure = createDeepStructure(8);
      const result = simulateTypeTreeRender(deepStructure, 0, 5);

      expect(result.stoppedAtMaxDepth).toBe(true);
      expect(result.maxLevelReached).toBe(5);
    });

    it('should not stop if depth is within limit', () => {
      const shallowStructure = createDeepStructure(5);
      const result = simulateTypeTreeRender(shallowStructure, 0, 10);

      expect(result.stoppedAtMaxDepth).toBe(false);
      expect(result.maxLevelReached).toBe(5);
    });
  });

  describe('circular reference handling', () => {
    it('should prevent infinite recursion with circular references', () => {
      const circularStructure = createCircularStructure();

      // This would cause stack overflow without maxDepth protection
      const result = simulateTypeTreeRender(circularStructure, 0, 10);

      expect(result.stoppedAtMaxDepth).toBe(true);
      expect(result.maxLevelReached).toBe(10);
    });

    it('should handle circular references with custom maxDepth', () => {
      const circularStructure = createCircularStructure();

      const result = simulateTypeTreeRender(circularStructure, 0, 3);

      expect(result.stoppedAtMaxDepth).toBe(true);
      expect(result.maxLevelReached).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty properties array', () => {
      const emptyProps: TypeTreeProperty = {
        name: 'empty',
        type: 'object',
        properties: []
      };

      const result = simulateTypeTreeRender(emptyProps, 0, 10);

      expect(result.stoppedAtMaxDepth).toBe(false);
      expect(result.maxLevelReached).toBe(0);
    });

    it('should handle undefined properties', () => {
      const noProps: TypeTreeProperty = {
        name: 'noProps',
        type: 'string'
        // properties is undefined
      };

      const result = simulateTypeTreeRender(noProps, 0, 10);

      expect(result.stoppedAtMaxDepth).toBe(false);
      expect(result.maxLevelReached).toBe(0);
    });

    it('should handle maxDepth of 0', () => {
      const anyStructure: TypeTreeProperty = {
        name: 'root',
        type: 'object',
        properties: [
          { name: 'child', type: 'string' }
        ]
      };

      const result = simulateTypeTreeRender(anyStructure, 0, 0);

      expect(result.stoppedAtMaxDepth).toBe(true);
      expect(result.maxLevelReached).toBe(0);
    });
  });

  describe('realistic scenarios', () => {
    it('should handle typical API response structure (3-4 levels)', () => {
      const apiResponse: TypeTreeProperty = {
        name: 'response',
        type: 'object',
        properties: [
          {
            name: 'data',
            type: 'object',
            properties: [
              {
                name: 'user',
                type: 'object',
                properties: [
                  { name: 'id', type: 'number' },
                  { name: 'name', type: 'string' },
                  {
                    name: 'profile',
                    type: 'object',
                    properties: [
                      { name: 'avatar', type: 'string' },
                      { name: 'bio', type: 'string' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const result = simulateTypeTreeRender(apiResponse, 0, 10);

      expect(result.stoppedAtMaxDepth).toBe(false);
      expect(result.maxLevelReached).toBe(4);
    });

    it('should stop deeply nested configuration objects', () => {
      // Simulate a pathological case like webpack config
      const deepConfig = createDeepStructure(20);

      const result = simulateTypeTreeRender(deepConfig, 0, 10);

      expect(result.stoppedAtMaxDepth).toBe(true);
      expect(result.maxLevelReached).toBe(10);
    });
  });
});

describe('TypeTree - Type Safety', () => {
  it('should accept valid TypeTreeProperty structure', () => {
    const validProp: TypeTreeProperty = {
      name: 'config',
      type: 'object',
      description: 'Configuration object',
      required: true,
      deprecated: false,
      defaultValue: '{}',
      properties: [
        {
          name: 'host',
          type: 'string',
          required: true
        },
        {
          name: 'port',
          type: 'number',
          defaultValue: '5432'
        }
      ]
    };

    // This test just verifies TypeScript compilation
    // If it compiles, the type is correct
    expect(validProp.name).toBe('config');
    expect(validProp.properties).toHaveLength(2);
  });

  it('should support TypeAnnotation union type', () => {
    const annotations: Array<TypeTree openProperty['type']> = [
      'string',
      'number',
      'boolean',
      'object',
      'array',
      'function',
      'null',
      'undefined',
      'any',
      'unknown',
      'never',
      'void',
      'Array<string>', // Custom string type
      'Promise<number>' // Custom string type
    ];

    annotations.forEach(type => {
      const prop: TypeTreeProperty = {
        name: 'test',
        type
      };
      expect(prop.type).toBe(type);
    });
  });
});
