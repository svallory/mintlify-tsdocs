/**
 * Test fixtures and sample data
 */

import type { ApiItem } from '@microsoft/api-extractor-model';

/**
 * Sample configuration for testing
 */
export const sampleConfig = {
  entryPoint: './lib/index.d.ts',
  outputFolder: './docs/reference',
  docsJson: './docs/docs.json',
  tabName: 'API Reference',
  groupName: 'API',
  convertReadme: false,
};

/**
 * Sample Mintlify docs.json structure
 */
export const sampleDocsJson = {
  name: 'Test Project',
  navigation: [
    {
      group: 'Getting Started',
      pages: ['introduction', 'quickstart']
    }
  ]
};

/**
 * Sample template content
 */
export const sampleTemplate = `
{% layout "layout" %}

{% block content %}
# {{ apiItem.displayName }}

{{ apiItem.description }}

{% if properties and properties.size > 0 %}
## Properties

{% for property in properties %}
- **{{ property.name }}**: {{ property.type }}
{% endfor %}
{% endif %}
{% endblock %}
`.trim();

/**
 * Sample API item metadata (simplified)
 */
export const sampleApiItem = {
  kind: 'class',
  name: 'TestClass',
  displayName: 'TestClass',
  description: 'A test class for unit testing',
};

/**
 * Sample TypeScript type strings for testing type analysis
 */
export const sampleTypeStrings = {
  simple: 'string',
  union: 'string | number',
  intersection: 'A & B',
  generic: 'Array<string>',
  nested: 'Promise<Array<Record<string, unknown>>>',
  complex: '{ name: string; age: number; address: { street: string; city: string } }',
  function: '(x: number, y: string) => boolean',
};

/**
 * Sample file paths for testing
 */
export const samplePaths = {
  valid: {
    relative: './docs/reference/index.mdx',
    absolute: '/workspace/docs/reference/index.mdx',
    nested: './docs/reference/api/classes/TestClass.mdx',
  },
  invalid: {
    traversal: '../../../etc/passwd',
    absoluteTraversal: '/etc/passwd',
    withSymlink: './docs/../../../etc/passwd',
    windowsTraversal: '..\\..\\..\\windows\\system32\\config\\sam',
  },
};

/**
 * Sample CLI inputs for testing
 */
export const sampleCliInputs = {
  valid: {
    path: './docs',
    name: 'my-project',
    option: '--output ./docs',
  },
  invalid: {
    commandInjection: './docs; rm -rf /',
    commandSubstitution: '$(whoami)',
    backticks: '`cat /etc/passwd`',
    pipes: './docs | cat',
    newlines: './docs\nrm -rf /',
    empty: '',
    tooLong: 'a'.repeat(1001),
  },
};

/**
 * Sample YAML content for testing sanitization
 */
export const sampleYamlContent = {
  safe: 'Simple description',
  needsEscaping: 'Description with "quotes" and \'apostrophes\'',
  specialChars: '- Item starting with dash',
  multiline: 'First line\nSecond line\nThird line',
  colons: 'Key: value syntax',
};

/**
 * Sample JSX attribute content for testing
 */
export const sampleJsxAttributes = {
  safe: 'Click here',
  needsEscaping: 'Hello <world> & "friends"',
  dangerousHref: 'javascript:alert(1)',
  dangerousData: 'data:text/html,<script>alert(1)</script>',
  safeHref: 'https://example.com',
  relativePath: '/docs/reference',
};

/**
 * Sample JSON content for testing validation
 */
export const sampleJsonContent = {
  valid: '{"name": "test", "value": 123}',
  validArray: '[1, 2, 3]',
  withConstructor: '{"constructor": "MyClass"}',
  withProto: '{"__proto__": {"polluted": true}}',
  withEval: '{"code": "eval(malicious)"}',
  tooLarge: `{"data": "${'x'.repeat(11 * 1024 * 1024)}"}`,
  invalid: 'not json at all',
};
