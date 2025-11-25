import { describe, expect, test } from 'bun:test';
import { ApiParameterListMixin } from '@microsoft/api-extractor-model';
import { Utilities } from '../../src/utils/Utilities';
import { DocumentationError, ErrorCode } from '../../src/errors/DocumentationError';

describe('Utilities', () => {
  describe('getSafeFilenameForName', () => {
    test('should convert valid identifiers to lowercase filenames', () => {
      expect(Utilities.getSafeFilenameForName('MyClass')).toBe('myclass');
      expect(Utilities.getSafeFilenameForName('myFunction')).toBe('myfunction');
      expect(Utilities.getSafeFilenameForName('CONSTANT')).toBe('constant');
    });

    test('should replace invalid characters with underscores', () => {
      expect(Utilities.getSafeFilenameForName('my-class')).toBe('my-class');
      expect(Utilities.getSafeFilenameForName('my_class')).toBe('my_class');
      expect(Utilities.getSafeFilenameForName('my.class')).toBe('my.class');
      expect(Utilities.getSafeFilenameForName('my@class')).toBe('my_class');
      expect(Utilities.getSafeFilenameForName('my#class')).toBe('my_class');
      expect(Utilities.getSafeFilenameForName('my class')).toBe('my_class');
    });

    test('should remove path traversal patterns', () => {
      expect(Utilities.getSafeFilenameForName('../MyClass')).toBe('myclass');
      expect(Utilities.getSafeFilenameForName('../../MyClass')).toBe('myclass');
      expect(Utilities.getSafeFilenameForName('My..Class')).toBe('myclass');
    });

    test('should remove path characters', () => {
      expect(Utilities.getSafeFilenameForName('/MyClass')).toBe('myclass');
      expect(Utilities.getSafeFilenameForName('~MyClass')).toBe('myclass');
      expect(Utilities.getSafeFilenameForName('My/Class')).toBe('myclass');
      expect(Utilities.getSafeFilenameForName('My\\Class')).toBe('myclass');
    });

    test('should limit filename length to 50 characters', () => {
      const longName = 'A'.repeat(100);
      const result = Utilities.getSafeFilenameForName(longName);
      expect(result.length).toBe(50);
      expect(result).toBe('a'.repeat(50));
    });

    test('should throw error for empty filename', () => {
      expect(() => Utilities.getSafeFilenameForName('')).toThrow(DocumentationError);
      expect(() => Utilities.getSafeFilenameForName('   ')).toThrow(DocumentationError);
    });

    test('should throw error if sanitization results in empty string', () => {
      // Only path characters - should result in empty string
      expect(() => Utilities.getSafeFilenameForName('///')).toThrow(DocumentationError);
      expect(() => Utilities.getSafeFilenameForName('~~~')).toThrow(DocumentationError);
    });

    test('should handle common API Extractor names', () => {
      expect(Utilities.getSafeFilenameForName('constructor')).toBe('constructor');
      expect(Utilities.getSafeFilenameForName('(constructor)')).toBe('_constructor_');
      expect(Utilities.getSafeFilenameForName('MyClass.constructor')).toBe('myclass.constructor');
    });
  });

  describe('getSafeFilenamePreservingCase', () => {
    test('should preserve original casing', () => {
      expect(Utilities.getSafeFilenamePreservingCase('MyClass')).toBe('MyClass');
      expect(Utilities.getSafeFilenamePreservingCase('myFunction')).toBe('myFunction');
      expect(Utilities.getSafeFilenamePreservingCase('CONSTANT')).toBe('CONSTANT');
    });

    test('should replace invalid characters with underscores', () => {
      expect(Utilities.getSafeFilenamePreservingCase('my-class')).toBe('my-class');
      expect(Utilities.getSafeFilenamePreservingCase('my_class')).toBe('my_class');
      expect(Utilities.getSafeFilenamePreservingCase('my.class')).toBe('my.class');
      expect(Utilities.getSafeFilenamePreservingCase('my@class')).toBe('my_class');
      expect(Utilities.getSafeFilenamePreservingCase('my#class')).toBe('my_class');
      expect(Utilities.getSafeFilenamePreservingCase('my Class')).toBe('my_Class');
    });

    test('should remove path traversal patterns', () => {
      expect(Utilities.getSafeFilenamePreservingCase('../MyClass')).toBe('MyClass');
      expect(Utilities.getSafeFilenamePreservingCase('../../MyClass')).toBe('MyClass');
      expect(Utilities.getSafeFilenamePreservingCase('My..Class')).toBe('MyClass');
    });

    test('should remove path characters', () => {
      expect(Utilities.getSafeFilenamePreservingCase('/MyClass')).toBe('MyClass');
      expect(Utilities.getSafeFilenamePreservingCase('~MyClass')).toBe('MyClass');
      expect(Utilities.getSafeFilenamePreservingCase('My/Class')).toBe('MyClass');
      expect(Utilities.getSafeFilenamePreservingCase('My\\Class')).toBe('MyClass');
    });

    test('should limit filename length to 50 characters', () => {
      const longName = 'A'.repeat(100);
      const result = Utilities.getSafeFilenamePreservingCase(longName);
      expect(result.length).toBe(50);
      expect(result).toBe('A'.repeat(50));
    });

    test('should throw error for empty filename', () => {
      expect(() => Utilities.getSafeFilenamePreservingCase('')).toThrow(DocumentationError);
      expect(() => Utilities.getSafeFilenamePreservingCase('   ')).toThrow(DocumentationError);
    });

    test('should throw error if sanitization results in empty string', () => {
      expect(() => Utilities.getSafeFilenamePreservingCase('///')).toThrow(DocumentationError);
      expect(() => Utilities.getSafeFilenamePreservingCase('~~~')).toThrow(DocumentationError);
    });

    test('should handle nested namespace names', () => {
      expect(Utilities.getSafeFilenamePreservingCase('MyNamespace.MyClass')).toBe('MyNamespace.MyClass');
      expect(Utilities.getSafeFilenamePreservingCase('Outer.Inner.Class')).toBe('Outer.Inner.Class');
    });
  });

  describe('normalizeDisplayName', () => {
    test('should remove parentheses from constructor', () => {
      expect(Utilities.normalizeDisplayName('(constructor)')).toBe('constructor');
    });

    test('should handle qualified constructor names', () => {
      expect(Utilities.normalizeDisplayName('MyClass.(constructor)')).toBe('MyClass.constructor');
    });

    test('should not modify other names', () => {
      expect(Utilities.normalizeDisplayName('MyClass')).toBe('MyClass');
      expect(Utilities.normalizeDisplayName('myFunction')).toBe('myFunction');
    });

    test('should handle empty or undefined input', () => {
      expect(Utilities.normalizeDisplayName('')).toBe('');
      expect(Utilities.normalizeDisplayName(null as any)).toBe(null);
      expect(Utilities.normalizeDisplayName(undefined as any)).toBe(undefined);
    });
  });

  describe('getConciseSignature', () => {
    test('should generate signature for functions with parameters', () => {
      const mockApiItem = {
        displayName: 'myFunction',
        parameters: [
          { name: 'param1' },
          { name: 'param2' },
          { name: 'param3' }
        ]
      };

      // Mock the isBaseClassOf check
      const originalIsBaseClassOf = (ApiParameterListMixin as any).isBaseClassOf;
      (ApiParameterListMixin as any).isBaseClassOf = () => true;

      const result = Utilities.getConciseSignature(mockApiItem as any);
      expect(result).toBe('myFunction(param1, param2, param3)');

      // Restore original
      (ApiParameterListMixin as any).isBaseClassOf = originalIsBaseClassOf;
    });

    test('should return display name for non-parameterized items', () => {
      const mockApiItem = {
        displayName: 'MyClass'
      };

      // Mock the isBaseClassOf check
      const originalIsBaseClassOf = (ApiParameterListMixin as any).isBaseClassOf;
      (ApiParameterListMixin as any).isBaseClassOf = () => false;

      const result = Utilities.getConciseSignature(mockApiItem as any);
      expect(result).toBe('MyClass');

      // Restore original
      (ApiParameterListMixin as any).isBaseClassOf = originalIsBaseClassOf;
    });
  });
});
