import { ApiItem, ApiItemKind, ApiClass, ApiInterface, ApiEnum, ApiFunction, ApiMethod, ApiProperty, ApiPackage, ApiNamespace, ApiTypeAlias, ApiVariable, ApiEnumMember, ReleaseTag, ApiReleaseTagMixin, ApiDeclaredItem, ApiOptionalMixin, ApiStaticMixin, ApiAbstractMixin, ApiProtectedMixin, ApiReadonlyMixin, ApiInitializerMixin, ApiDocumentedItem, ApiModel, Excerpt, ExcerptToken, ExcerptTokenKind, type IResolveDeclarationReferenceResult } from '@microsoft/api-extractor-model';
import { DocSection, DocPlainText, DocParagraph } from '@microsoft/tsdoc';
import { DocSectionConverter } from '../utils/DocSectionConverter';
import type { DocSegment } from '../utils/DocSectionConverter';

import { ITemplateData, ITableData, ITableRow, IReturnData } from './TemplateEngine';
import { DocumentationHelper } from '../utils/DocumentationHelper';
import { Utilities } from '../utils/Utilities';
import { LinkValidator } from '../utils/LinkValidator';

/**
 * Converts API model data to template-friendly format
 *
 * @see /architecture/generation-layer - Data conversion architecture
 */
export class TemplateDataConverter {
  private readonly _documentationHelper: DocumentationHelper;
  private readonly _apiModel: ApiModel;
  private readonly _linkValidator: LinkValidator;
  private readonly _docSectionConverter: DocSectionConverter;

  public constructor(apiModel: ApiModel, linkValidator: LinkValidator) {
    this._documentationHelper = new DocumentationHelper();
    this._apiModel = apiModel;
    this._linkValidator = linkValidator;
    this._docSectionConverter = new DocSectionConverter();
  }

  /**
   * Convert an API item to template data
   */
  public convertApiItem(apiItem: ApiItem, options: {
    pageTitle: string;
    pageDescription: string;
    pageIcon: string;
    breadcrumb: Array<{ name: string; path?: string }>;
    navigation?: { id: string; title: string; group?: string };
    getLinkFilenameForApiItem: (apiItem: ApiItem) => string | undefined;
  }): ITemplateData {
    const normalizedDisplayName = Utilities.normalizeDisplayName(apiItem.displayName);
    const baseData: ITemplateData = {
      apiItem: {
        name: normalizedDisplayName,
        kind: apiItem.kind,
        displayName: normalizedDisplayName,
        description: this._getDescription(apiItem),
        summary: this._getSummary(apiItem),
        remarks: this._getRemarks(apiItem),
        signature: this._getSignature(apiItem),
        isDeprecated: this._isDeprecated(apiItem),
        isAlpha: this._isAlpha(apiItem),
        isBeta: this._isBeta(apiItem),
        releaseTag: this._getReleaseTag(apiItem)
      },
      page: {
        title: options.pageTitle,
        description: options.pageDescription,
        icon: options.pageIcon,
        breadcrumb: options.breadcrumb
      },
      navigation: options.navigation,
      examples: this._getExamples(apiItem),
      heritageTypes: this._getHeritageTypes(apiItem, options.getLinkFilenameForApiItem),
      guides: this._extractGuideLinks(apiItem)
    };

    // Add type-specific data
    switch (apiItem.kind) {
      case ApiItemKind.Class:
        return this._addClassData(baseData, apiItem as ApiClass, options.getLinkFilenameForApiItem);
      case ApiItemKind.Interface:
        return this._addInterfaceData(baseData, apiItem as ApiInterface, options.getLinkFilenameForApiItem);
      case ApiItemKind.Enum:
        return this._addEnumData(baseData, apiItem as ApiEnum, options.getLinkFilenameForApiItem);
      case ApiItemKind.Function:
        return this._addFunctionData(baseData, apiItem as ApiFunction, options.getLinkFilenameForApiItem);
      case ApiItemKind.Method:
      case ApiItemKind.Constructor:
        return this._addMethodData(baseData, apiItem as ApiMethod, options.getLinkFilenameForApiItem);
      case ApiItemKind.Package:
        return this._addPackageData(baseData, apiItem as ApiPackage, options.getLinkFilenameForApiItem);
      case ApiItemKind.Namespace:
        return this._addNamespaceData(baseData, apiItem as ApiNamespace, options.getLinkFilenameForApiItem);
      case ApiItemKind.TypeAlias:
        return this._addTypeAliasData(baseData, apiItem as ApiTypeAlias, options.getLinkFilenameForApiItem);
      case ApiItemKind.Variable:
        return this._addVariableData(baseData, apiItem as ApiVariable, options.getLinkFilenameForApiItem);
      default:
        return baseData;
    }
  }

  private _addClassData(data: ITemplateData, apiClass: ApiClass, getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
    data.constructors = this._createTableRows(apiClass.members.filter(m => m.kind === ApiItemKind.Constructor), getLinkFilename);
    data.properties = this._createTableRows(apiClass.members.filter(m => m.kind === ApiItemKind.Property), getLinkFilename);
    data.methods = this._createTableRows(apiClass.members.filter(m => m.kind === ApiItemKind.Method), getLinkFilename);
    data.events = this._createTableRows(apiClass.members.filter(m => m.kind === ApiItemKind.Property && this._isEvent(m as ApiProperty)), getLinkFilename);
    return data;
  }

  private _addInterfaceData(data: ITemplateData, apiInterface: ApiInterface, getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
    data.properties = this._createTableRows(apiInterface.members.filter(m => m.kind === ApiItemKind.Property), getLinkFilename);
    data.methods = this._createTableRows(apiInterface.members.filter(m => m.kind === ApiItemKind.Method), getLinkFilename);
    data.events = this._createTableRows(apiInterface.members.filter(m => m.kind === ApiItemKind.Property && this._isEvent(m as ApiProperty)), getLinkFilename);
    return data;
  }

  private _addEnumData(data: ITemplateData, apiEnum: ApiEnum, getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
    data.members = this._createTableRows(Array.from(apiEnum.members), getLinkFilename);
    return data;
  }

  private _addFunctionData(data: ITemplateData, apiFunction: ApiFunction, getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
    data.parameters = this._createParameterRows(apiFunction, getLinkFilename);
    data.returnType = this._createReturnData(apiFunction, getLinkFilename);
    return data;
  }

  private _addMethodData(data: ITemplateData, apiMethod: ApiMethod, getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
    data.parameters = this._createParameterRows(apiMethod, getLinkFilename);
    data.returnType = this._createReturnData(apiMethod, getLinkFilename);
    return data;
  }

  private _addPackageData(data: ITemplateData, apiPackage: ApiPackage, getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
    const members = Array.from(apiPackage.members);
    data.abstractClasses = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Class && ApiAbstractMixin.isBaseClassOf(m as ApiClass)), getLinkFilename);
    data.classes = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Class && !ApiAbstractMixin.isBaseClassOf(m as ApiClass)), getLinkFilename);
    data.enumerations = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Enum), getLinkFilename);
    data.functions = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Function), getLinkFilename);
    data.interfaces = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Interface), getLinkFilename);
    data.namespaces = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Namespace), getLinkFilename);
    data.typeAliases = this._createTableRows(members.filter(m => m.kind === ApiItemKind.TypeAlias), getLinkFilename);
    data.variables = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Variable), getLinkFilename);
    return data;
  }

  private _addNamespaceData(data: ITemplateData, apiNamespace: ApiNamespace, getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
    const members = Array.from(apiNamespace.members);
    data.abstractClasses = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Class && ApiAbstractMixin.isBaseClassOf(m as ApiClass)), getLinkFilename);
    data.classes = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Class && !ApiAbstractMixin.isBaseClassOf(m as ApiClass)), getLinkFilename);
    data.enumerations = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Enum), getLinkFilename);
    data.functions = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Function), getLinkFilename);
    data.interfaces = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Interface), getLinkFilename);
    data.namespaces = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Namespace), getLinkFilename);
    data.typeAliases = this._createTableRows(members.filter(m => m.kind === ApiItemKind.TypeAlias), getLinkFilename);
    data.variables = this._createTableRows(members.filter(m => m.kind === ApiItemKind.Variable), getLinkFilename);
    return data;
  }

  private _addTypeAliasData(data: ITemplateData, apiTypeAlias: ApiTypeAlias, getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
    // Type alias specific data can be added here
    return data;
  }

  private _addVariableData(data: ITemplateData, apiVariable: ApiVariable, getLinkFilename: (apiItem: ApiItem) => string | undefined): ITemplateData {
    // Variable specific data can be added here
    return data;
  }

  private _createTableRows(apiItems: ApiItem[], getLinkFilename: (apiItem: ApiItem) => string | undefined): ITableRow[] {
    return apiItems.map(apiItem => {
      const typeInfo = this._getTypeInfo(apiItem, getLinkFilename);
      return {
        title: Utilities.normalizeDisplayName(apiItem.displayName),
        titlePath: getLinkFilename(apiItem),
        modifiers: this._getModifiers(apiItem),
        type: this._getTypeDisplay(apiItem),
        typeRef: typeInfo.typeRef,
        typePath: typeInfo.typePath,
        description: this._getDescription(apiItem),
        isOptional: this._isOptional(apiItem),
        isInherited: this._isInherited(apiItem),
        isDeprecated: this._isDeprecated(apiItem),
        defaultValue: this._getDefaultValue(apiItem)
      };
    });
  }

  private _createParameterRows(apiFunction: ApiFunction | ApiMethod, getLinkFilename: (apiItem: ApiItem) => string | undefined): ITableRow[] {
    const parameters = apiFunction.parameters;
    return parameters.map(param => {
      // Get parameter-specific description from TSDoc
      let description = '';
      if (apiFunction instanceof ApiDocumentedItem && apiFunction.tsdocComment) {
        const params = apiFunction.tsdocComment.params;
        if (params) {
          for (const paramBlock of params) {
            if (paramBlock.parameterName === param.name) {
              description = this._getTextFromDocSection(paramBlock.content);
              break;
            }
          }
        }
      }

      // Extract type information for linking
      const typeInfo = this._getTypeInfoFromExcerpt(param.parameterTypeExcerpt, getLinkFilename);

      return {
        title: param.name,
        type: param.parameterTypeExcerpt.text,
        typeRef: typeInfo.typeRef,
        typePath: typeInfo.typePath,
        description: description,
        isOptional: param.isOptional
      };
    });
  }

  private _createReturnData(apiFunction: ApiFunction | ApiMethod, getLinkFilename: (apiItem: ApiItem) => string | undefined): IReturnData {
    const returnType = apiFunction.returnTypeExcerpt?.text || 'void';
    const description = this._getDescription(apiFunction); // Could extract @returns specifically

    // Extract type information for linking
    let typeInfo: { typeRef?: string; typePath?: string } = {};
    if (apiFunction.returnTypeExcerpt) {
      typeInfo = this._getTypeInfoFromExcerpt(apiFunction.returnTypeExcerpt, getLinkFilename);
    }

    return {
      type: returnType,
      typeRef: typeInfo.typeRef,
      typePath: typeInfo.typePath,
      description
    };
  }


  private _getDescription(apiItem: ApiItem): string {
    // Extract description from TSDoc
    if (apiItem instanceof ApiDocumentedItem) {
      const tsdocComment = apiItem.tsdocComment;
      if (tsdocComment?.summarySection) {
        return this._getTextFromDocSection(tsdocComment.summarySection);
      }
    }
    return '';
  }

  private _getSummary(apiItem: ApiItem): DocSegment[] {
    if (apiItem instanceof ApiDocumentedItem) {
      const tsdocComment = apiItem.tsdocComment;
      if (tsdocComment?.summarySection) {
        return this._docSectionConverter.convertSection(tsdocComment.summarySection);
      }
    }
    return [];
  }

  private _getRemarks(apiItem: ApiItem): DocSegment[] {
    if (apiItem instanceof ApiDocumentedItem) {
      const tsdocComment = apiItem.tsdocComment;
      if (tsdocComment?.remarksBlock) {
        return this._docSectionConverter.convertSection(tsdocComment.remarksBlock.content);
      }
    }
    return [];
  }

  private _getExamples(apiItem: ApiItem): string[] {
    if (apiItem instanceof ApiDocumentedItem) {
      const tsdocComment = apiItem.tsdocComment;
      if (!tsdocComment?.customBlocks) return [];

      return tsdocComment.customBlocks
        .filter((block: any) => block.blockTag.tagName === '@example')
        .map((block: any) => this._getTextFromDocSection(block.content));
    }
    return [];
  }

  /**
   * Extract guide links from @see tags
   * Supports two formats:
   * - @see {@link /path | description}
   * - @see /path - description
   */
  private _extractGuideLinks(apiItem: ApiItem): Array<{ path: string; description: string }> {
    if (!(apiItem instanceof ApiDocumentedItem)) {
      return [];
    }

    const tsdocComment = apiItem.tsdocComment;
    if (!tsdocComment?.seeBlocks || tsdocComment.seeBlocks.length === 0) {
      return [];
    }

    const guides: Array<{ path: string; description: string }> = [];

    for (const seeBlock of tsdocComment.seeBlocks) {
      const text = this._getTextFromDocSection(seeBlock.content);

      // Try to parse {@link /path | description} format
      const linkMatch = text.match(/\{@link\s+(\/[^\s|}]+)\s*\|\s*([^}]+)\}/);
      if (linkMatch) {
        guides.push({
          path: linkMatch[1].trim(),
          description: linkMatch[2].trim()
        });
        continue;
      }

      // Try to parse /path - description format
      // Match: /path then " - " (delimiter) then description
      const simpleMatch = text.match(/^\s*(\/\S+)\s+-\s+(.+)$/);
      if (simpleMatch) {
        guides.push({
          path: simpleMatch[1].trim(),
          description: simpleMatch[2].trim()
        });
      }
    }

    return guides;
  }

  private _getSignature(apiItem: ApiItem): string {
    if (apiItem instanceof ApiDeclaredItem) {
      return apiItem.excerpt.text;
    }
    return '';
  }

  private _getHeritageTypes(apiItem: ApiItem, getLinkFilename: (apiItem: ApiItem) => string | undefined): Array<{ name: string; path?: string }> {
    // This would need to be implemented based on inheritance analysis
    return [];
  }

  private _getModifiers(apiItem: ApiItem): string[] {
    const modifiers: string[] = [];

    if (ApiStaticMixin.isBaseClassOf(apiItem) && apiItem.isStatic) {
      modifiers.push('static');
    }
    if (ApiAbstractMixin.isBaseClassOf(apiItem) && apiItem.isAbstract) {
      modifiers.push('abstract');
    }
    if (ApiProtectedMixin.isBaseClassOf(apiItem) && apiItem.isProtected) {
      modifiers.push('protected');
    }
    if (ApiReadonlyMixin.isBaseClassOf(apiItem) && apiItem.isReadonly) {
      modifiers.push('readonly');
    }

    return modifiers;
  }

  private _getTypeDisplay(apiItem: ApiItem): string {
    if (apiItem instanceof ApiDeclaredItem) {
      return apiItem.excerpt.text;
    }
    return '';
  }

  /**
   * Extract type information including RefId and path for linking
   */
  private _getTypeInfo(apiItem: ApiItem, getLinkFilename: (apiItem: ApiItem) => string | undefined): { typeRef?: string; typePath?: string } {
    if (!(apiItem instanceof ApiDeclaredItem)) {
      return {};
    }

    const excerpt = apiItem.excerpt;
    if (!excerpt || !excerpt.spannedTokens) {
      return {};
    }

    // Find the first reference token in the excerpt
    for (const token of excerpt.spannedTokens) {
      if (token.kind === ExcerptTokenKind.Reference && token.canonicalReference) {
        // Try to resolve the reference to an API item
        const result: IResolveDeclarationReferenceResult = this._apiModel.resolveDeclarationReference(
          token.canonicalReference,
          undefined
        );

        if (result.resolvedApiItem) {
          // Generate RefId using LinkValidator
          const refId = this._linkValidator.getRefId(result.resolvedApiItem);
          const path = getLinkFilename(result.resolvedApiItem);

          return {
            typeRef: refId,
            typePath: path
          };
        }
      }
    }

    return {};
  }

  /**
   * Extract type information from an Excerpt directly (for parameters and return types)
   */
  private _getTypeInfoFromExcerpt(excerpt: Excerpt, getLinkFilename: (apiItem: ApiItem) => string | undefined): { typeRef?: string; typePath?: string } {
    if (!excerpt || !excerpt.spannedTokens) {
      return {};
    }

    // Find the first reference token in the excerpt
    for (const token of excerpt.spannedTokens) {
      if (token.kind === ExcerptTokenKind.Reference && token.canonicalReference) {
        // Try to resolve the reference to an API item
        const result: IResolveDeclarationReferenceResult = this._apiModel.resolveDeclarationReference(
          token.canonicalReference,
          undefined
        );

        if (result.resolvedApiItem) {
          // Generate RefId using LinkValidator
          const refId = this._linkValidator.getRefId(result.resolvedApiItem);
          const path = getLinkFilename(result.resolvedApiItem);

          return {
            typeRef: refId,
            typePath: path
          };
        }
      }
    }

    return {};
  }

  private _isOptional(apiItem: ApiItem): boolean {
    return ApiOptionalMixin.isBaseClassOf(apiItem) && apiItem.isOptional;
  }

  private _isInherited(apiItem: ApiItem): boolean {
    // This would need to be implemented based on inheritance analysis
    return false;
  }

  private _isDeprecated(apiItem: ApiItem): boolean {
    return ApiReleaseTagMixin.isBaseClassOf(apiItem) && apiItem.releaseTag === ReleaseTag.Beta;
  }

  private _isAlpha(apiItem: ApiItem): boolean {
    return ApiReleaseTagMixin.isBaseClassOf(apiItem) && apiItem.releaseTag === ReleaseTag.Alpha;
  }

  private _isBeta(apiItem: ApiItem): boolean {
    return ApiReleaseTagMixin.isBaseClassOf(apiItem) && apiItem.releaseTag === ReleaseTag.Beta;
  }

  private _getReleaseTag(apiItem: ApiItem): string {
    if (ApiReleaseTagMixin.isBaseClassOf(apiItem)) {
      return ReleaseTag[apiItem.releaseTag];
    }
    return '';
  }

  private _getDefaultValue(apiItem: ApiItem): string {
    if (ApiInitializerMixin.isBaseClassOf(apiItem) && apiItem.initializerExcerpt) {
      return apiItem.initializerExcerpt.text;
    }
    return '';
  }

  private _isEvent(apiProperty: ApiProperty): boolean {
    // Simple heuristic - could be enhanced
    return apiProperty.name.startsWith('on') || apiProperty.name.endsWith('Event');
  }

  private _getTextFromDocSection(docSection: DocSection): string {
    // Convert DocSection to plain text
    // This is a simplified implementation
    let text = '';
    for (const node of docSection.getChildNodes()) {
      if (node instanceof DocPlainText) {
        text += node.text;
      } else if (node instanceof DocParagraph) {
        for (const child of node.getChildNodes()) {
          if (child instanceof DocPlainText) {
            text += child.text;
          }
        }
      }
    }

    // Remove TSDoc block tags and type annotations
    // First pass: Remove @tag patterns with their type parameters and descriptions
    text = text.replace(/@(param|returns?|throws?|example|remarks?|see|alpha|beta|deprecated|internal|public|private|protected|readonly|virtual|override|sealed|event|eventProperty|typeParam|enum|namespace|package|module|class|interface|function|method|property|constructor|variable|typedef|callback|extends|implements)[^\n]*/gi, '');

    // Second pass: Remove any leftover type annotations in curly braces
    text = text.replace(/\s*\{[^}]*\}\s*/g, ' ');

    // Third pass: Remove common standalone type/class names at the end (leftovers from @extends, @enum, etc.)
    // Only remove if preceded by period and space/punctuation
    text = text.replace(/[.!?]\s+(Error|string|number|boolean|object|any|void|null|undefined|never|unknown)\s*$/gi, '.');

    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }
}