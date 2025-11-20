# Type Extraction Quick Reference

## File Locations

| Purpose | File Path |
|---------|-----------|
| **Main orchestrator** | `/work/mintlify-tsdocs/src/documenters/MarkdownDocumenter.ts` |
| **API → Template data** | `/work/mintlify-tsdocs/src/templates/TemplateDataConverter.ts` |
| **Type string parser** | `/work/mintlify-tsdocs/src/utils/ObjectTypeAnalyzer.ts` |
| **Semantic enrichment** | `/work/mintlify-tsdocs/src/utils/DocumentationHelper.ts` |
| **JSDoc extraction** | `/work/mintlify-tsdocs/src/utils/JsDocExtractor.ts` |
| **Type caching** | `/work/mintlify-tsdocs/src/cache/TypeAnalysisCache.ts` |
| **API resolution caching** | `/work/mintlify-tsdocs/src/cache/ApiResolutionCache.ts` |

## Key Type Extraction Entry Points

### 1. Parameter Type Extraction
**File:** `MarkdownDocumenter.ts:164-189`
```typescript
private _createParameterRows(apiFunction, getLinkFilename): ITableRow[] {
  return parameters.map(param => ({
    type: param.parameterTypeExcerpt.text,  // <- Type string
    isOptional: param.isOptional
  }));
}
```

### 2. Property Type Extraction
**File:** `TemplateDataConverter.ts:276-281`
```typescript
private _getTypeDisplay(apiItem): string {
  return apiItem.excerpt.text;  // <- Type string
}
```

### 3. Type String Analysis
**File:** `ObjectTypeAnalyzer.ts:41-127`
```typescript
analyzeType(typeString): TypeAnalysis {
  // Detects: primitive | array | union | intersection | generic | object-literal
  // Recursively parses nested structures
}
```

### 4. Semantic Enrichment
**File:** `DocumentationHelper.ts:34-125`
```typescript
analyzeTypeProperties(type, description, propertyPath): PropertyInfo {
  // Uses ObjectTypeAnalyzer
  // Enriches with JSDoc descriptions via propertyPath
  // Builds nestedProperties[] recursively
}
```

## Type Information Sources

### From API Extractor Model
```typescript
// All items
apiItem.excerpt.text
apiItem.excerptTokens
apiItem.kind  // ApiItemKind enum

// Properties
ApiPropertyItem.propertyTypeExcerpt.text
ApiOptionalMixin.isOptional
ApiReadonlyMixin.isReadonly
ApiInitializerMixin.initializerExcerpt.text

// Parameters
ApiParameter.parameterTypeExcerpt.text
ApiParameter.isOptional
ApiParameter.tsdocParamBlock  // @param docs

// Functions/Methods
ApiFunction.returnTypeExcerpt.text
ApiFunction.parameters[]
ApiMethod.tsdocComment.returnsBlock  // @returns docs

// Classes
ApiClass.extendsType
ApiClass.implementsTypes[]
ApiClass.members[]

// Interfaces
ApiInterface.extendsTypes[]
ApiInterface.members[]
```

## Type Analysis Patterns

### Primitive Types
```typescript
string, number, boolean, void, any, never, unknown, null, undefined
```
Detected in: `ObjectTypeAnalyzer.ts:114-120`

### Arrays
```typescript
string[] → { type: 'array', elementType: { type: 'primitive', name: 'string' } }
number[][] → recursively analyzed
```
Detected in: `ObjectTypeAnalyzer.ts:71-77`

### Unions
```typescript
string | number → { type: 'union', unionTypes: [...] }
```
Detected in: `ObjectTypeAnalyzer.ts:80-86`

### Intersections
```typescript
Type1 & Type2 → { type: 'intersection', intersectionTypes: [...] }
```
Detected in: `ObjectTypeAnalyzer.ts:89-95`

### Generics
```typescript
Record<string, any> → { type: 'generic', baseType: 'Record', typeParameters: ['string', 'any'] }
```
Detected in: `ObjectTypeAnalyzer.ts:98-111`

### Object Literals
```typescript
{ name: string; age?: number; } → {
  type: 'object-literal',
  properties: [
    { name: 'name', type: {...}, optional: false },
    { name: 'age', type: {...}, optional: true }
  ]
}
```
Detected in: `ObjectTypeAnalyzer.ts:132-155`

## Data Flow Example

**Input:** Function parameter with object type
```typescript
function execute(config: { 
  enabled: boolean; 
  timeout?: number; 
}): void
```

**Flow:**
1. `MarkdownDocumenter._createParameterRows()` extracts `param.parameterTypeExcerpt.text`
2. `TemplateDataConverter._createTableRows()` passes to template
3. Template calls `DocumentationHelper.analyzeTypeProperties()`
4. `ObjectTypeAnalyzer.analyzeType()` parses the object literal
5. `_parseObjectLiteral()` recursively extracts properties
6. `DocumentationHelper` enriches with descriptions
7. Template renders property table

**Output:** Structured property information
```typescript
{
  type: 'object',
  nestedProperties: [
    { name: 'enabled', type: 'boolean', required: true, description: '...' },
    { name: 'timeout', type: 'number', required: false, description: '...' }
  ]
}
```

## Caching Strategy

### TypeAnalysisCache
- **Max size:** 1000 items (configurable)
- **Strategy:** LRU (Least Recently Used)
- **Hit/miss tracking:** Yes
- **Used by:** `ObjectTypeAnalyzer.analyzeType()`

### ApiResolutionCache
- **Max size:** 500 items (configurable)
- **Strategy:** LRU (Least Recently Used)
- **Hit/miss tracking:** Yes
- **Used by:** Type reference resolution

**Access cache stats:**
```typescript
const stats = cache.getStats();
// { size, maxSize, hitRate, hitCount, missCount, enabled }
```

## Member Traversal

### Recursive Processing
**File:** `MarkdownDocumenter.ts:241-322`
```typescript
_writeApiItemPageTemplate(apiItem, parentApiItem) {
  // 1. Skip EntryPoint - process children
  // 2. Convert to template data
  // 3. Render and write file
  // 4. Recursively process children
}
```

### Member Filtering by Type
**File:** `TemplateDataConverter.ts:81-137`
```typescript
// Classes
filter(m => m.kind === ApiItemKind.Constructor)
filter(m => m.kind === ApiItemKind.Property)
filter(m => m.kind === ApiItemKind.Method)

// Interfaces
filter(m => m.kind === ApiItemKind.PropertySignature)
filter(m => m.kind === ApiItemKind.MethodSignature)

// Packages/Namespaces
filter(m => m.kind === ApiItemKind.Class)
filter(m => m.kind === ApiItemKind.Function)
filter(m => m.kind === ApiItemKind.TypeAlias)
// ... etc
```

## Current Limitations

| Issue | Location | Impact |
|-------|----------|--------|
| JSDoc descriptions hardcoded | `JsDocExtractor.ts` | Only predefined paths work |
| Type linking not implemented | `TemplateDataConverter.ts:283-286` | Types don't link to definitions |
| Generic constraints not extracted | `TemplateDataConverter.ts` | Type parameters not fully analyzed |
| Simple string-based caching | `TypeAnalysisCache.ts` | No TTL or auto-invalidation |
| Generic type parameters not followed | `ObjectTypeAnalyzer.ts` | `Record<K, V>` not deeply resolved |

## Key Takeaways

1. **Type extraction is multi-layered:** API Extractor model → string analysis → semantic enrichment
2. **Recursion is central:** Handles nested objects, arrays, and type structures
3. **Caching improves performance:** LRU caches for both type analysis and API resolution
4. **Member traversal is hierarchical:** Classes → properties/methods → parameters
5. **Templates receive structured data:** ObjectTypeAnalyzer creates analyzable type structures
6. **JSDoc integration is basic:** Currently hardcoded; could parse source files
7. **Type linking is incomplete:** Types don't resolve to their definitions yet

