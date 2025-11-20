# Type Information Extraction Analysis: mint-tsdocs

## Overview

This document provides a comprehensive analysis of how mint-tsdocs extracts, analyzes, and processes type information from API Extractor's `.api.json` files. The system uses a multi-layered approach combining API model traversal, type string analysis, and recursive property extraction.

---

## 1. Architecture Overview

```
API Extractor (.api.json)
    ↓
ApiModel (from @microsoft/api-extractor-model)
    ↓
MarkdownDocumenter
    ├── TemplateDataConverter (converts ApiItem → template data)
    ├── ObjectTypeAnalyzer (parses type strings)
    └── DocumentationHelper (semantic type analysis)
    ↓
Liquid Templates → MDX Output
```

---

## 2. Type Extraction Pipeline

### 2.1 Primary Entry Points

#### File: `/work/mintlify-tsdocs/src/documenters/MarkdownDocumenter.ts`

The main documentation generator orchestrates type extraction:

**Key Methods:**
- `generateFiles()` - Main entry point, loads API model and generates pages
- `_writeApiItemPageTemplate()` - Recursively processes API items and their members
- `_createTableRows()` - Creates table rows from API items with type information
- `_createParameterRows()` - Extracts parameter type information from functions/methods

**Type Extraction Pattern (Lines 101-110):**
```typescript
private _addFunctionData(data: ITemplateData, apiFunction: ApiFunction, 
                        getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
  data.parameters = this._createParameterRows(apiFunction, getLinkFilename);
  data.returnType = this._createReturnData(apiFunction);
  return data;
}
```

**Parameter Type Extraction (Lines 164-189):**
```typescript
private _createParameterRows(apiFunction: ApiFunction | ApiMethod, 
                            getLinkFilename: (apiItem: ApiItem) => string | undefined): ITableRow[] {
  const parameters = apiFunction.parameters;
  return parameters.map(param => {
    // Extract type from param.parameterTypeExcerpt.text
    return {
      title: param.name,
      type: param.parameterTypeExcerpt.text,  // Raw type string from API Extractor
      typePath: undefined,
      description: description,
      isOptional: param.isOptional
    };
  });
}
```

---

### 2.2 TemplateDataConverter: Structured Conversion

#### File: `/work/mintlify-tsdocs/src/templates/TemplateDataConverter.ts`

Converts raw API items to template-friendly data structures.

**Core Conversion Method (Lines 21-79):**
```typescript
public convertApiItem(apiItem: ApiItem, options: {
  pageTitle: string;
  pageDescription: string;
  pageIcon: string;
  breadcrumb: Array<{ name: string; path?: string }>;
  navigation?: { id: string; title: string; group?: string };
  getLinkFilenameForApiItem: (apiItem: ApiItem) => string | undefined;
}): ITemplateData {
  const baseData: ITemplateData = {
    apiItem: {
      name: normalizedDisplayName,
      kind: apiItem.kind,
      displayName: normalizedDisplayName,
      description: this._getDescription(apiItem),
      summary: this._getSummary(apiItem),
      remarks: this._getRemarks(apiItem),
      signature: this._getSignature(apiItem),  // Calls apiItem.excerpt.text
      isDeprecated: this._isDeprecated(apiItem),
      isAlpha: this._isAlpha(apiItem),
      isBeta: this._isBeta(apiItem),
      releaseTag: this._getReleaseTag(apiItem)
    },
    // ... other fields
  };

  // Dispatch to type-specific handlers
  switch (apiItem.kind) {
    case ApiItemKind.Class:
      return this._addClassData(baseData, apiItem as ApiClass, options.getLinkFilenameForApiItem);
    case ApiItemKind.Interface:
      return this._addInterfaceData(baseData, apiItem as ApiInterface, options.getLinkFilenameForApiItem);
    // ... more cases
  }
}
```

**Type-Specific Data Extraction:**

1. **Class/Interface Properties (Lines 81-94):**
```typescript
private _addClassData(data: ITemplateData, apiClass: ApiClass, 
                     getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
  data.constructors = this._createTableRows(
    apiClass.members.filter(m => m.kind === ApiItemKind.Constructor), 
    getLinkFilename);
  data.properties = this._createTableRows(
    apiClass.members.filter(m => m.kind === ApiItemKind.Property), 
    getLinkFilename);
  data.methods = this._createTableRows(
    apiClass.members.filter(m => m.kind === ApiItemKind.Method), 
    getLinkFilename);
  data.events = this._createTableRows(
    apiClass.members.filter(m => m.kind === ApiItemKind.Property && this._isEvent(m as ApiProperty)), 
    getLinkFilename);
  return data;
}
```

2. **Generic TableRow Creation (Lines 149-162):**
```typescript
private _createTableRows(apiItems: ApiItem[], 
                        getLinkFilename: (apiItem: ApiItem) => string | undefined): ITableRow[] {
  return apiItems.map(apiItem => ({
    title: Utilities.normalizeDisplayName(apiItem.displayName),
    titlePath: getLinkFilename(apiItem),
    modifiers: this._getModifiers(apiItem),
    type: this._getTypeDisplay(apiItem),              // Extracts type string
    typePath: this._getTypePath(apiItem, getLinkFilename),
    description: this._getDescription(apiItem),
    isOptional: this._isOptional(apiItem),
    isInherited: this._isInherited(apiItem),
    isDeprecated: this._isDeprecated(apiItem),
    defaultValue: this._getDefaultValue(apiItem)
  }));
}
```

**Type Display Extraction (Lines 276-281):**
```typescript
private _getTypeDisplay(apiItem: ApiItem): string {
  if (apiItem instanceof ApiDeclaredItem) {
    return apiItem.excerpt.text;  // Core: excerpt.text contains type signature
  }
  return '';
}
```

---

### 2.3 ObjectTypeAnalyzer: Recursive Type Parsing

#### File: `/work/mintlify-tsdocs/src/utils/ObjectTypeAnalyzer.ts`

Parses type strings to extract nested object properties and structure.

**Type Analysis Interface (Lines 4-22):**
```typescript
export interface TypeAnalysis {
  type: 'primitive' | 'array' | 'union' | 'intersection' | 'generic' | 'object-literal' | 'unknown';
  name?: string;
  elementType?: TypeAnalysis;           // For arrays
  unionTypes?: TypeAnalysis[];          // For unions
  intersectionTypes?: TypeAnalysis[];   // For intersections
  baseType?: string;                    // For generics
  typeParameters?: string[];            // For generics
  properties?: PropertyAnalysis[];       // For object literals - RECURSIVE
}

export interface PropertyAnalysis {
  name: string;
  type: TypeAnalysis;                   // Recursive type analysis
  optional: boolean;
}
```

**Core Analysis Method (Lines 41-53):**
```typescript
analyzeType(type: string): TypeAnalysis {
  // Check cache first
  const cached = this._cache.get(type);
  if (cached) {
    return cached;
  }

  const result = this._analyzeTypeInternal(type);

  // Cache the result
  this._cache.set(type, result);
  return result;
}
```

**Internal Type Analysis (Lines 58-127):**

The analyzer handles multiple type patterns:

1. **Object Literals (Lines 66-68):**
   ```typescript
   if (type.startsWith('{') && type.endsWith('}')) {
     return this._parseObjectLiteral(type);
   }
   ```

2. **Array Types (Lines 71-77):**
   ```typescript
   if (type.endsWith('[]')) {
     const elementType = type.slice(0, -2);
     return {
       type: 'array',
       elementType: this.analyzeType(elementType)  // Recursive
     };
   }
   ```

3. **Union Types (Lines 80-86):**
   ```typescript
   if (type.includes('|') && !type.startsWith('{')) {
     const unionTypes = type.split('|').map(t => this.analyzeType(t.trim()));
     return {
       type: 'union',
       unionTypes
     };
   }
   ```

4. **Intersection Types (Lines 89-95):**
   ```typescript
   if (type.includes('&') && !type.startsWith('{')) {
     const intersectionTypes = type.split('&').map(t => this.analyzeType(t.trim()));
     return {
       type: 'intersection',
       intersectionTypes
     };
   }
   ```

5. **Generic Types (Lines 98-111):**
   ```typescript
   const genericMatch = type.match(/^(\w+)<(.+)>$/);
   if (genericMatch) {
     const baseType = genericMatch[1];
     const typeParams = genericMatch[2];
     const typeParameters = this._splitTypeParameters(typeParams);  // Handles nested <>
     return {
       type: 'generic',
       baseType,
       typeParameters
     };
   }
   ```

6. **Primitive Types (Lines 114-120):**
   ```typescript
   const primitiveTypes = ['string', 'number', 'boolean', 'void', 'any', 'never', 'unknown', 'null', 'undefined'];
   if (primitiveTypes.includes(type)) {
     return {
       type: 'primitive',
       name: type
     };
   }
   ```

**Object Literal Parsing (Lines 132-155):**
```typescript
private _parseObjectLiteral(objectLiteral: string): TypeAnalysis {
  const properties: PropertyAnalysis[] = [];
  const content = objectLiteral.slice(1, -1).trim();
  const propertyMatches = this._parseProperties(content);

  for (const match of propertyMatches) {
    const { name, type, optional } = match;
    properties.push({
      name,
      type: this.analyzeType(type),  // RECURSIVE: nested type analysis
      optional
    });
  }

  return {
    type: 'object-literal',
    properties
  };
}
```

**Property Extraction (Lines 160-186):**
```typescript
private _parseProperties(content: string): Array<{ name: string; type: string; optional: boolean }> {
  const properties: Array<{ name: string; type: string; optional: boolean }> = [];
  const propertyStrings = this._splitBySemicolons(content);  // Handles nested {}

  for (const propString of propertyStrings) {
    const trimmed = propString.trim();
    if (!trimmed) continue;

    // Match property pattern: name?: type
    const match = trimmed.match(/^(\w+)\??\s*:\s*(.+)$/);
    if (match) {
      const name = match[1];
      const type = match[2].trim();
      const optional = trimmed.includes('?');

      properties.push({
        name,
        type,
        optional
      });
    }
  }

  return properties;
}
```

**Nested Brace Handling (Lines 191-217):**
```typescript
private _splitBySemicolons(content: string): string[] {
  const result: string[] = [];
  let current = '';
  let braceDepth = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '{') {
      braceDepth++;
    } else if (char === '}') {
      braceDepth--;
    } else if (char === ';' && braceDepth === 0) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}
```

---

### 2.4 DocumentationHelper: Semantic Type Enhancement

#### File: `/work/mintlify-tsdocs/src/utils/DocumentationHelper.ts`

Builds on ObjectTypeAnalyzer to add semantic meaning and descriptions.

**Property Info Interface (Lines 10-17):**
```typescript
export interface PropertyInfo {
  name: string;
  type: string;
  description: string;
  required: boolean;
  deprecated: boolean;
  nestedProperties?: PropertyInfo[];  // Recursive support
}
```

**Type Analysis with JSDoc Enrichment (Lines 34-125):**
```typescript
analyzeTypeProperties(type: string, description: string = '', propertyPath: string = ''): PropertyInfo {
  if (!type) {
    return {
      name: '',
      type: 'any',
      description,
      required: true,
      deprecated: false
    };
  }

  const typeAnalysis = this._typeAnalyzer.analyzeType(type);  // Uses ObjectTypeAnalyzer

  // If it's an object literal with properties, extract nested structure
  if (typeAnalysis.type === 'object-literal' && typeAnalysis.properties && typeAnalysis.properties.length > 0) {
    return {
      name: '',
      type: 'object',
      description,
      required: true,
      deprecated: false,
      nestedProperties: typeAnalysis.properties?.map((prop: any) => {
        // Build the full property path for JSDoc lookup
        const currentPath = propertyPath ? `${propertyPath}.${prop.name}` : prop.name;
        const propDescription = this._jsDocExtractor.getDescription(currentPath);

        // If the property type is itself an object literal with properties
        if (prop.type.type === 'object-literal' && prop.type.properties && prop.type.properties.length > 0) {
          return {
            name: prop.name,
            type: 'object',
            description: propDescription,
            required: !prop.optional,
            deprecated: false,
            nestedProperties: prop.type.properties.map((nestedProp: any) => {
              const nestedPath = `${currentPath}.${nestedProp.name}`;
              const nestedDescription = this._jsDocExtractor.getDescription(nestedPath);

              return {
                name: nestedProp.name,
                type: this._getPropertyTypeString(nestedProp.type),
                description: nestedDescription,
                required: !nestedProp.optional,
                deprecated: false
              };
            })
          };
        } else {
          // For non-object-literal types, use the recursive approach
          const nestedInfo = this.analyzeTypeProperties(this._getPropertyTypeString(prop.type), '', currentPath);
          return {
            name: prop.name,
            type: nestedInfo.type,
            description: propDescription,
            required: !prop.optional,
            deprecated: false,
            nestedProperties: nestedInfo.nestedProperties  // Recursively include
          };
        }
      })
    };
  }

  return {
    name: '',
    type: this._getPropertyTypeString(typeAnalysis),
    description,
    required: true,
    deprecated: false
  };
}
```

**Type String Conversion (Lines 130-150):**
```typescript
private _getPropertyTypeString(typeAnalysis: any): string {
  if (typeAnalysis.type === 'primitive') {
    return typeAnalysis.name;
  }
  if (typeAnalysis.type === 'array') {
    return this._getPropertyTypeString(typeAnalysis.elementType) + '[]';
  }
  if (typeAnalysis.type === 'union') {
    return typeAnalysis.unionTypes.map((t: any) => this._getPropertyTypeString(t)).join(' | ');
  }
  if (typeAnalysis.type === 'intersection') {
    return typeAnalysis.intersectionTypes.map((t: any) => this._getPropertyTypeString(t)).join(' & ');
  }
  if (typeAnalysis.type === 'generic') {
    return `${typeAnalysis.baseType}<${typeAnalysis.typeParameters.join(', ')}>`;
  }
  if (typeAnalysis.type === 'object-literal') {
    return 'object';
  }
  return typeAnalysis.name || 'any';
}
```

---

## 3. API Model Data Structures

### 3.1 From API Extractor (@microsoft/api-extractor-model)

The system works with these core types from the API Extractor model:

**Excerpt (Type Information Container):**
- `apiItem.excerpt.text` - Full type signature string
- `apiItem.excerptTokens` - Tokenized form for linking
- `apiItem.getExcerptWithModifiers()` - Type with modifiers (static, readonly, etc.)

**Property-Specific:**
- `ApiPropertyItem.propertyTypeExcerpt` - Type of a property
- `ApiOptionalMixin.isOptional` - Is property optional?
- `ApiReadonlyMixin.isReadonly` - Is property readonly?
- `ApiInitializerMixin.initializerExcerpt` - Default value

**Parameter-Specific:**
- `ApiParameter.parameterTypeExcerpt.text` - Parameter type string
- `ApiParameter.isOptional` - Is parameter optional?

**Function/Method-Specific:**
- `ApiFunction.returnTypeExcerpt.text` - Return type
- `ApiFunction.parameters` - Array of ApiParameter objects
- `ApiMethod.tsdocComment.returnsBlock` - @returns documentation

**Inheritance:**
- `ApiClass.extendsType.excerpt` - Base class type
- `ApiClass.implementsTypes` - Array of interface types
- `ApiInterface.extendsTypes` - Extended interfaces

---

## 4. Type Resolution Pipeline

### 4.1 Flow for Complex Types

```
ApiItem with type information
    ↓
Extract excerpt.text or propertyTypeExcerpt.text
    ↓
ObjectTypeAnalyzer.analyzeType(typeString)
    ↓
Classify: primitive | array | union | intersection | generic | object-literal | unknown
    ↓
For object-literals: Recursively parse properties
    For arrays: Analyze element type
    For unions/intersections: Analyze component types
    For generics: Extract base type and parameters
    ↓
DocumentationHelper enriches with descriptions via propertyPath
    ↓
TemplateDataConverter formats for templates
    ↓
Templates render property tables and type documentation
```

### 4.2 Example: Nested Object Type Processing

Given a parameter type:
```typescript
{
  name: string;
  config?: {
    enabled: boolean;
    timeout?: number;
  };
  tags: string[];
}
```

**Step 1: Extract from parameter**
```typescript
param.parameterTypeExcerpt.text = "{name: string; config?: {enabled: boolean; timeout?: number;}; tags: string[];}"
```

**Step 2: ObjectTypeAnalyzer processes**
```typescript
analyzeType(fullString) → {
  type: 'object-literal',
  properties: [
    {
      name: 'name',
      type: { type: 'primitive', name: 'string' },
      optional: false
    },
    {
      name: 'config',
      type: {
        type: 'object-literal',
        properties: [
          {
            name: 'enabled',
            type: { type: 'primitive', name: 'boolean' },
            optional: false
          },
          {
            name: 'timeout',
            type: { type: 'primitive', name: 'number' },
            optional: true
          }
        ]
      },
      optional: true
    },
    {
      name: 'tags',
      type: {
        type: 'array',
        elementType: { type: 'primitive', name: 'string' }
      },
      optional: false
    }
  ]
}
```

**Step 3: DocumentationHelper enriches**
```typescript
analyzeTypeProperties(fullString, '', 'paramName') → {
  type: 'object',
  nestedProperties: [
    {
      name: 'name',
      type: 'string',
      description: 'From JSDoc extractor',
      required: true
    },
    {
      name: 'config',
      type: 'object',
      nestedProperties: [
        {
          name: 'enabled',
          type: 'boolean',
          description: 'From paramName.config.enabled lookup',
          required: true
        },
        // ... more nested properties
      ]
    },
    {
      name: 'tags',
      type: 'string[]',
      description: 'From paramName.tags lookup',
      required: true
    }
  ]
}
```

---

## 5. Caching System

### 5.1 TypeAnalysisCache

#### File: `/work/mintlify-tsdocs/src/cache/TypeAnalysisCache.ts`

**Purpose:** Cache expensive type analysis operations

**Configuration (Lines 10-22):**
```typescript
export interface TypeAnalysisCacheOptions {
  maxSize?: number;      // Default: 1000
  enabled?: boolean;     // Default: true
}
```

**Usage in ObjectTypeAnalyzer (Lines 41-53):**
```typescript
analyzeType(type: string): TypeAnalysis {
  // Check cache first
  const cached = this._cache.get(type);
  if (cached) {
    return cached;
  }

  const result = this._analyzeTypeInternal(type);
  
  // Cache the result
  this._cache.set(type, result);
  return result;
}
```

**LRU Implementation (Lines 66-82):**
```typescript
public set(type: string, analysis: TypeAnalysis): void {
  if (!this._enabled) {
    return;
  }

  const cacheKey = this._createCacheKey(type);

  // If cache is full, remove oldest item (first in map)
  if (this._cache.size >= this._maxSize && !this._cache.has(cacheKey)) {
    const firstKey = this._cache.keys().next().value;
    if (firstKey) {
      this._cache.delete(firstKey);
    }
  }

  this._cache.set(cacheKey, analysis);
}
```

**Cache Statistics (Lines 96-115):**
```typescript
public getStats(): {
  size: number;
  maxSize: number;
  hitRate: number;
  hitCount: number;
  missCount: number;
  enabled: boolean;
} {
  const totalRequests = this._hitCount + this._missCount;
  const hitRate = totalRequests > 0 ? this._hitCount / totalRequests : 0;

  return {
    size: this._cache.size,
    maxSize: this._maxSize,
    hitRate,
    hitCount: this._hitCount,
    missCount: this._missCount,
    enabled: this._enabled
  };
}
```

### 5.2 ApiResolutionCache

#### File: `/work/mintlify-tsdocs/src/cache/ApiResolutionCache.ts`

**Purpose:** Cache API model cross-reference resolution

Used by MarkdownDocumenter when resolving type references for hyperlinks.

---

## 6. Member Traversal Strategy

### 6.1 Recursive API Item Processing

#### File: `/work/mintlify-tsdocs/src/documenters/MarkdownDocumenter.ts` (Lines 241-322)

```typescript
private async _writeApiItemPageTemplate(apiItem: ApiItem, parentApiItem?: ApiItem): Promise<void> {
  // Skip EntryPoints - just process their members
  if (apiItem.kind === ApiItemKind.EntryPoint) {
    if ('members' in apiItem) {
      for (const member of (apiItem as any).members) {
        await this._writeApiItemPageTemplate(member);
      }
    }
    return;
  }

  // Convert API item to template data
  const templateData = this._templateDataConverter.convertApiItem(apiItem, {
    pageTitle: this._getPageTitle(apiItem),
    pageDescription: description,
    pageIcon: icon,
    breadcrumb: breadcrumb,
    navigation: navigation,
    getLinkFilenameForApiItem: (item: ApiItem) => this._getLinkFilenameForApiItem(item)
  });

  // Render template
  const renderedContent = await this._templateManager.renderApiItem(apiItem, templateData);

  // Write file
  FileSystem.writeFile(filename, renderedContent);

  // Process child items recursively
  if ('members' in apiItem) {
    for (const member of (apiItem as any).members) {
      await this._writeApiItemPageTemplate(member, apiItem);  // Pass parent
    }
  }
}
```

### 6.2 Member Extraction Patterns

**For Classes (Lines 81-87 in TemplateDataConverter):**
```typescript
private _addClassData(data: ITemplateData, apiClass: ApiClass, 
                     getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
  data.constructors = this._createTableRows(
    apiClass.members.filter(m => m.kind === ApiItemKind.Constructor), 
    getLinkFilename);
  data.properties = this._createTableRows(
    apiClass.members.filter(m => m.kind === ApiItemKind.Property), 
    getLinkFilename);
  data.methods = this._createTableRows(
    apiClass.members.filter(m => m.kind === ApiItemKind.Method), 
    getLinkFilename);
  data.events = this._createTableRows(
    apiClass.members.filter(m => m.kind === ApiItemKind.Property && this._isEvent(m as ApiProperty)), 
    getLinkFilename);
  return data;
}
```

**For Interfaces (Lines 89-94):**
```typescript
private _addInterfaceData(data: ITemplateData, apiInterface: ApiInterface, 
                         getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
  data.properties = this._createTableRows(
    apiInterface.members.filter(m => m.kind === ApiItemKind.Property), 
    getLinkFilename);
  data.methods = this._createTableRows(
    apiInterface.members.filter(m => m.kind === ApiItemKind.Method), 
    getLinkFilename);
  data.events = this._createTableRows(
    apiInterface.members.filter(m => m.kind === ApiItemKind.Property && this._isEvent(m as ApiProperty)), 
    getLinkFilename);
  return data;
}
```

**For Packages/Namespaces (Lines 113-137):**
```typescript
private _addPackageData(data: ITemplateData, apiPackage: ApiPackage, 
                       getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
  const members = Array.from(apiPackage.members);
  data.abstractClasses = this._createTableRows(
    members.filter(m => m.kind === ApiItemKind.Class && ApiAbstractMixin.isBaseClassOf(m as ApiClass)), 
    getLinkFilename);
  data.classes = this._createTableRows(
    members.filter(m => m.kind === ApiItemKind.Class && !ApiAbstractMixin.isBaseClassOf(m as ApiClass)), 
    getLinkFilename);
  data.enumerations = this._createTableRows(
    members.filter(m => m.kind === ApiItemKind.Enum), 
    getLinkFilename);
  data.functions = this._createTableRows(
    members.filter(m => m.kind === ApiItemKind.Function), 
    getLinkFilename);
  data.interfaces = this._createTableRows(
    members.filter(m => m.kind === ApiItemKind.Interface), 
    getLinkFilename);
  data.namespaces = this._createTableRows(
    members.filter(m => m.kind === ApiItemKind.Namespace), 
    getLinkFilename);
  data.typeAliases = this._createTableRows(
    members.filter(m => m.kind === ApiItemKind.TypeAlias), 
    getLinkFilename);
  data.variables = this._createTableRows(
    members.filter(m => m.kind === ApiItemKind.Variable), 
    getLinkFilename);
  return data;
}
```

---

## 7. Type Information Accessed via API Extractor

### 7.1 Key Properties by Item Kind

**For All ApiDeclaredItems:**
- `excerpt.text` - Full type/signature
- `excerptTokens` - Tokenized form
- `getExcerptWithModifiers()` - With modifiers

**For Properties:**
- `ApiPropertyItem.propertyTypeExcerpt.text` - Type of property

**For Parameters:**
- `ApiParameter.parameterTypeExcerpt.text` - Parameter type
- `ApiParameter.isOptional` - Optional flag
- `ApiParameter.tsdocParamBlock` - JSDoc @param

**For Functions/Methods:**
- `ApiFunction.parameters` - Array of parameters
- `ApiFunction.returnTypeExcerpt.text` - Return type
- `ApiFunction.tsdocComment.returnsBlock` - JSDoc @returns

**For Classes:**
- `ApiClass.extendsType` - Base class
- `ApiClass.implementsTypes` - Implemented interfaces
- `ApiClass.members` - Array of member items

**For Interfaces:**
- `ApiInterface.extendsTypes` - Extended interfaces
- `ApiInterface.members` - Array of member items

**For Enums:**
- `ApiEnum.members` - Array of enum members

---

## 8. Current Limitations and Future Enhancements

### Known Issues

1. **JSDoc Extraction (JsDocExtractor.ts, Lines 4-30)**
   - Currently hardcoded descriptions
   - Does not parse actual TypeScript source files
   - Limited to predefined property paths

2. **Type Linking (TemplateDataConverter.ts, Lines 283-286)**
   ```typescript
   private _getTypePath(apiItem: ApiItem, 
                       getLinkFilename: (apiItem: ApiItem) => string | undefined): string | undefined {
     // Could be enhanced to link to type definitions
     return undefined;
   }
   ```
   - Type path resolution not implemented
   - External type references not linked

3. **Generic Type Parameters (TemplateDataConverter.ts)**
   - Generic types are extracted but not deeply analyzed
   - Type parameter constraints not extracted

4. **Cached Type Analysis** (ObjectTypeAnalyzer.ts, Lines 33-37)
   - Simple string-based caching
   - No TTL or auto-invalidation
   - Maximum 1000 types cached by default

### Areas for Enhancement

1. **Deep type resolution** - Follow generic type parameters
2. **Better JSDoc integration** - Parse actual TypeScript source
3. **Cross-reference linking** - Link types to their definitions
4. **Complex generic handling** - Better support for `Record<K, V>`, `Partial<T>`, etc.
5. **Circular reference detection** - Handle self-referencing types

---

## 9. Summary

The type extraction system in mint-tsdocs:

1. **Leverages API Extractor's model** - Uses @microsoft/api-extractor-model for accurate type data
2. **Recursively processes members** - Traverses class/interface hierarchies
3. **Analyzes type strings** - ObjectTypeAnalyzer parses complex type expressions
4. **Extracts nested properties** - Handles object literals with multiple levels
5. **Enriches with metadata** - Adds modifiers, optional flags, descriptions
6. **Caches aggressively** - LRU caches for performance
7. **Integrates with templates** - Passes structured data to Liquid templates

The pipeline is well-suited for documentation generation but has room for improvement in type linking, generic handling, and JSDoc integration.

