import * as path from 'path';
import { ApiModel, ApiItem, ApiDocumentedItem, ApiItemKind, ReleaseTag, ApiDeclaredItem, ApiReleaseTagMixin } from '@microsoft/api-extractor-model';
import { CommandLineFlagParameter, CommandLineStringParameter, CommandLineStringListParameter, CommandLineChoiceParameter } from '@rushstack/ts-command-line';
import { FileSystem } from '@rushstack/node-core-library';
import * as clack from '@clack/prompts';
import { minimatch } from 'minimatch';
import Table from 'cli-table3';
import { Colorize } from '@rushstack/terminal';

import { BaseAction } from './BaseAction';
import { DocumenterCli } from './ApiDocumenterCommandLine';
import { loadConfig, generateApiExtractorConfig } from '../config';
import { CoverageConfig, CoverageLevel, CoverageRule } from '../config/types';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { Extractor, ExtractorConfig, ExtractorResult } from '@microsoft/api-extractor';
import { showCliHeader } from './CliHelpers';

interface CoverageItem {
    name: string;
    kind: string;
    sourceFile: string;
    isDocumented: boolean;
    releaseTag: ReleaseTag;
    level: CoverageLevel;
}

interface CoverageStats {
    total: number;
    documented: number;
    percentage: number;

    required: {
        total: number;
        documented: number;
        percentage: number;
    };
    desired: {
        total: number;
        documented: number;
        percentage: number;
    };
}

interface GroupedCoverage {
    [group: string]: {
        items: CoverageItem[];
        stats: CoverageStats;
    };
}

export class CoverageAction extends BaseAction {
    private readonly _parser: DocumenterCli;
    private readonly _thresholdParameter: CommandLineStringParameter;
    private readonly _includeParameter: CommandLineStringListParameter;
    private readonly _excludeParameter: CommandLineStringListParameter;
    private readonly _groupByParameter: CommandLineChoiceParameter;
    private readonly _jsonParameter: CommandLineFlagParameter;
    private readonly _skipExtractorParameter: CommandLineFlagParameter;
    private readonly _includePrivateParameter: CommandLineFlagParameter;
    private readonly _projectDirParameter: CommandLineStringParameter;

    public constructor(parser: DocumenterCli) {
        super({
            actionName: 'coverage',
            summary: 'Calculate TSDocs coverage for the project',
            documentation: 'Analyzes the project and reports the percentage of API items that have TSDoc comments.'
        });
        this._parser = parser;

        this._thresholdParameter = this.defineStringParameter({
            parameterLongName: '--threshold',
            argumentName: 'NUMBER',
            description: 'Minimum coverage percentage required to pass (overrides config)'
        });

        this._includeParameter = this.defineStringListParameter({
            parameterLongName: '--include',
            argumentName: 'GLOB',
            description: 'Glob pattern for files to include in coverage calculation'
        });

        this._excludeParameter = this.defineStringListParameter({
            parameterLongName: '--exclude',
            argumentName: 'GLOB',
            description: 'Glob pattern for files to exclude from coverage calculation'
        });

        this._groupByParameter = this.defineChoiceParameter({
            parameterLongName: '--group-by',
            description: 'How to group the coverage report',
            alternatives: ['file', 'folder', 'kind', 'none'],
            defaultValue: 'none'
        });

        this._jsonParameter = this.defineFlagParameter({
            parameterLongName: '--json',
            description: 'Output report in JSON format'
        });

        this._skipExtractorParameter = this.defineFlagParameter({
            parameterLongName: '--skip-extractor',
            description: 'Skip running api-extractor (use existing .api.json files)'
        });

        this._includePrivateParameter = this.defineFlagParameter({
            parameterLongName: '--include-private',
            description: 'Include internal/private code (non-exported) in coverage analysis'
        });

        this._projectDirParameter = this.defineStringParameter({
            parameterLongName: '--project-dir',
            argumentName: 'PATH',
            description: 'Project directory containing mint-tsdocs.config.json'
        });
    }

    protected onDefineParameters(): void {
        // Parameters are now defined in the constructor
    }

    protected async onExecuteAsync(): Promise<void> {
        showCliHeader();

        const projectDir = this._projectDirParameter.value
            ? path.resolve(process.cwd(), this._projectDirParameter.value)
            : process.cwd();

        // Load config
        const config = loadConfig(projectDir);

        // Determine .tsdocs directory
        const tsdocsDir = config.docsJson
            ? path.join(path.dirname(config.docsJson), '.tsdocs')
            : path.join(projectDir, 'docs', '.tsdocs');

        // Run api-extractor if not skipped
        if (!this._skipExtractorParameter.value) {
            await this._runApiExtractor(config, projectDir, tsdocsDir, this._includePrivateParameter.value);
        }

        // Build API model
        const { apiModel } = this.buildApiModel(tsdocsDir);

        // Calculate coverage
        const items = this._collectApiItems(apiModel, config.coverage);
        const filteredItems = this._filterItems(items, config);

        // Grouping
        const groupBy = this._groupByParameter.value as 'file' | 'folder' | 'kind' | 'none' || config.coverage?.groupBy || 'none';
        const grouped = this._groupItems(filteredItems, groupBy);

        // Calculate stats
        const totalStats = this._calculateStats(filteredItems);

        // Threshold
        const threshold = this._thresholdParameter.value
            ? parseFloat(this._thresholdParameter.value)
            : (config.coverage?.threshold ?? 80);

        // Report
        if (this._jsonParameter.value) {
            this._reportJson(grouped, totalStats, threshold);
        } else {
            this._reportText(grouped, totalStats, threshold, groupBy);
        }

        // Exit code
        if (totalStats.required.percentage < threshold) {
            process.exitCode = 1;
        }
    }

    private async _runApiExtractor(config: any, projectDir: string, tsdocsDir: string, includePrivate: boolean = false): Promise<void> {
        FileSystem.ensureFolder(tsdocsDir);
        const apiExtractorConfigPath = path.join(tsdocsDir, 'api-extractor.json');

        let tempEntryPoint: string | undefined;
        let originalEntryPoint: string | undefined;

        if (!config.apiExtractor?.configPath) {
            // If including private code, create a temporary entry point that exports everything
            if (includePrivate) {
                originalEntryPoint = config.entryPoint;
                tempEntryPoint = path.join(tsdocsDir, 'temp-full-entry.d.ts');

                // Find all .d.ts files in lib directory
                const libDir = path.dirname(path.resolve(projectDir, config.entryPoint));
                const allDtsFiles = this._findAllDtsFiles(libDir, libDir);

                // Create entry point that exports everything
                const tempDir = path.dirname(tempEntryPoint);
                const exports = allDtsFiles.map(file => {
                    const relativePath = './' + path.relative(tempDir, file).replace(/\.d\.ts$/, '');
                    return `export * from '${relativePath}';`;
                }).join('\n');

                FileSystem.writeFile(tempEntryPoint, exports);

                // Temporarily modify config to use temp entry point
                config.entryPoint = tempEntryPoint;
            }

            // Always suppress lint warnings for coverage command
            const apiExtractorConfig = generateApiExtractorConfig(config, projectDir, tsdocsDir, true);
            FileSystem.writeFile(apiExtractorConfigPath, JSON.stringify(apiExtractorConfig, null, 2));

            // Restore original entry point
            if (originalEntryPoint) {
                config.entryPoint = originalEntryPoint;
            }
        }

        try {
            const extractorConfig = ExtractorConfig.loadFileAndPrepare(
                config.apiExtractor?.configPath
                    ? path.resolve(projectDir, config.apiExtractor.configPath)
                    : apiExtractorConfigPath
            );

            // Suppress console output during api-extractor
            const originalConsoleLog = console.log;
            const originalConsoleError = console.error;
            const originalConsoleWarn = console.warn;

            console.log = () => { };
            console.error = () => { };
            console.warn = () => { };

            try {
                const extractorResult = Extractor.invoke(extractorConfig, {
                    localBuild: true,
                    showVerboseMessages: false,
                    messageCallback: (message: any) => {
                        // Skip all messages with logLevel 'none' (suppressed by config)
                        if (message.logLevel === 'none') {
                            return;
                        }
                        // For coverage, we only care about errors, not warnings
                        // Warnings are already suppressed by noLint config
                    }
                });

                if (!extractorResult.succeeded) {
                    throw new DocumentationError(
                        `api-extractor completed with ${extractorResult.errorCount} errors`,
                        ErrorCode.COMMAND_FAILED
                    );
                }
            } finally {
                // Restore console methods
                console.log = originalConsoleLog;
                console.error = originalConsoleError;
                console.warn = originalConsoleWarn;

                // Clean up temporary entry point
                if (tempEntryPoint && FileSystem.exists(tempEntryPoint)) {
                    FileSystem.deleteFile(tempEntryPoint);
                }
            }
        } catch (error) {
            // Clean up temp file on error too
            if (tempEntryPoint && FileSystem.exists(tempEntryPoint)) {
                FileSystem.deleteFile(tempEntryPoint);
            }

            throw new DocumentationError(
                `Failed to run api-extractor: ${error instanceof Error ? error.message : String(error)}`,
                ErrorCode.COMMAND_FAILED
            );
        }
    }

    private _findAllDtsFiles(baseDir: string, currentDir: string): string[] {
        const files: string[] = [];
        const items = FileSystem.readFolderItemNames(currentDir);

        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stats = FileSystem.getStatistics(fullPath);

            if (stats.isDirectory()) {
                // Recurse into subdirectories
                files.push(...this._findAllDtsFiles(baseDir, fullPath));
            } else if (item.endsWith('.d.ts') && !item.endsWith('.d.ts.map')) {
                // Skip special files that shouldn't be exported
                if (item === 'globals.d.ts' || item === 'global.d.ts') {
                    continue;
                }
                files.push(fullPath);
            }
        }

        return files;
    }

    private _collectApiItems(apiModel: ApiModel, coverageConfig?: CoverageConfig): CoverageItem[] {
        const items: CoverageItem[] = [];
        const includeInternal = coverageConfig?.includeInternal ?? false;
        const rules = coverageConfig?.rules || [];

        const visit = (item: ApiItem) => {
            if (item instanceof ApiDocumentedItem) {
                if (item.kind !== ApiItemKind.Model &&
                    item.kind !== ApiItemKind.Package &&
                    item.kind !== ApiItemKind.EntryPoint) {

                    let releaseTag = ReleaseTag.None;
                    if (ApiReleaseTagMixin.isBaseClassOf(item)) {
                        releaseTag = item.releaseTag;
                    }

                    // Determine coverage level based on rules
                    const level = this._evaluateRule(item, releaseTag, rules, includeInternal);

                    // Skip if optional
                    if (level === 'optional') {
                        return;
                    }

                    // Try to get source file from item or its parents
                    let sourceFile = 'unknown';
                    let currentItem: ApiItem | undefined = item;

                    while (currentItem && sourceFile === 'unknown') {
                        if (currentItem instanceof ApiDeclaredItem && currentItem.fileUrlPath) {
                            sourceFile = currentItem.fileUrlPath;
                            break;
                        }
                        currentItem = currentItem.parent;
                    }

                    const isDocumented = !!item.tsdocComment;

                    items.push({
                        name: item.displayName,
                        kind: item.kind,
                        sourceFile,
                        isDocumented,
                        releaseTag,
                        level
                    });
                }
            }

            if (item.members) {
                for (const member of item.members) {
                    visit(member);
                }
            }
        };

        for (const pkg of apiModel.packages) {
            visit(pkg);
        }

        return items;
    }

    private _evaluateRule(item: ApiItem, releaseTag: ReleaseTag, rules: CoverageRule[], includeInternal: boolean): CoverageLevel {
        const tsVisibility = this._getTsVisibility(item);
        const releaseTagString = this._releaseTagToString(releaseTag);

        // Check configured rules first
        for (const rule of rules) {
            // Check kind
            const kinds = Array.isArray(rule.kind) ? rule.kind : [rule.kind];
            if (!kinds.includes(item.kind)) {
                continue;
            }

            // Check TS visibility
            if (rule.visibility) {
                const visibilities = Array.isArray(rule.visibility) ? rule.visibility : [rule.visibility];
                if (!visibilities.includes(tsVisibility as any)) {
                    continue;
                }
            }

            // Check release tag
            if (rule.releaseTag) {
                const tags = Array.isArray(rule.releaseTag) ? rule.releaseTag : [rule.releaseTag];
                if (!tags.includes(releaseTagString)) {
                    continue;
                }
            }

            return rule.level;
        }

        // Default behavior if no rules match
        if (releaseTag === ReleaseTag.Internal) {
            return includeInternal ? 'required' : 'optional';
        }

        return 'required';
    }

    private _getTsVisibility(item: ApiItem): 'public' | 'protected' | 'private' {
        if (item instanceof ApiDeclaredItem) {
            // Try to find visibility modifier in excerpt tokens
            // This is a heuristic as api-extractor might not expose modifiers directly in a structured way
            // other than in the excerpt.
            // However, for class members, it's important.
            // If we can't find it, default to public (as api-extractor mostly handles exported/public items)

            // Note: ApiDeclaredItem has excerpt property which is an ApiExcerpt.
            // ApiExcerpt has tokens.
            for (const token of item.excerpt.tokens) {
                if (token.kind === 'Content') {
                    const text = token.text.trim();
                    if (text === 'private') return 'private';
                    if (text === 'protected') return 'protected';
                    if (text === 'public') return 'public';
                }
            }
        }
        return 'public';
    }

    private _releaseTagToString(tag: ReleaseTag): string {
        switch (tag) {
            case ReleaseTag.Public: return 'public';
            case ReleaseTag.Beta: return 'beta';
            case ReleaseTag.Alpha: return 'alpha';
            case ReleaseTag.Internal: return 'internal';
            default: return 'none';
        }
    }

    private _filterItems(items: CoverageItem[], config: any): CoverageItem[] {
        const includes = this._includeParameter.values.length > 0
            ? this._includeParameter.values
            : (config.coverage?.include || []);

        const excludes = this._excludeParameter.values.length > 0
            ? this._excludeParameter.values
            : (config.coverage?.exclude || []);

        if (includes.length === 0 && excludes.length === 0) {
            return items;
        }

        return items.filter(item => {
            if (item.sourceFile === 'unknown') {
                return true;
            }

            let included = includes.length === 0;
            for (const pattern of includes) {
                if (minimatch(item.sourceFile, pattern)) {
                    included = true;
                    break;
                }
            }

            if (!included) return false;

            for (const pattern of excludes) {
                if (minimatch(item.sourceFile, pattern)) {
                    return false;
                }
            }

            return true;
        });
    }

    private _groupItems(items: CoverageItem[], groupBy: 'file' | 'folder' | 'kind' | 'none'): GroupedCoverage {
        const grouped: GroupedCoverage = {};

        for (const item of items) {
            let key = 'all';
            if (groupBy === 'file') {
                key = item.sourceFile;
            } else if (groupBy === 'folder') {
                key = path.dirname(item.sourceFile);
            } else if (groupBy === 'kind') {
                key = item.kind;
            }

            if (!grouped[key]) {
                grouped[key] = {
                    items: [],
                    stats: {
                        total: 0,
                        documented: 0,
                        percentage: 0,
                        required: { total: 0, documented: 0, percentage: 0 },
                        desired: { total: 0, documented: 0, percentage: 0 }
                    }
                };
            }

            grouped[key].items.push(item);
        }

        for (const key in grouped) {
            grouped[key].stats = this._calculateStats(grouped[key].items);
        }

        return grouped;
    }

    private _calculateStats(items: CoverageItem[]): CoverageStats {
        const total = items.length;
        const documented = items.filter(i => i.isDocumented).length;

        const requiredItems = items.filter(i => i.level === 'required');
        const requiredTotal = requiredItems.length;
        const requiredDocumented = requiredItems.filter(i => i.isDocumented).length;

        const desiredItems = items.filter(i => i.level === 'desired');
        const desiredTotal = desiredItems.length;
        const desiredDocumented = desiredItems.filter(i => i.isDocumented).length;

        return {
            total,
            documented,
            percentage: total === 0 ? 100 : (documented / total) * 100,
            required: {
                total: requiredTotal,
                documented: requiredDocumented,
                percentage: requiredTotal === 0 ? 100 : (requiredDocumented / requiredTotal) * 100
            },
            desired: {
                total: desiredTotal,
                documented: desiredDocumented,
                percentage: desiredTotal === 0 ? 100 : (desiredDocumented / desiredTotal) * 100
            }
        };
    }

    private _reportText(grouped: GroupedCoverage, totalStats: CoverageStats, threshold: number, groupBy: string): void {
        // Determine column header based on grouping
        const groupHeader = groupBy === 'file' ? 'File' :
                           groupBy === 'folder' ? 'Folder' :
                           groupBy === 'kind' ? 'Type' :
                           'Type';

        clack.log.message('');
        clack.log.message(Colorize.bold(`API Surface Coverage (Threshold: ${threshold}%)`));
        clack.log.message('');

        const table = new Table({
            head: [groupHeader, 'Total', 'Documented', 'Undocumented', 'Coverage'],
            style: {
                head: ['cyan'],
                border: [],
                compact: false
            }
        });

        // Sort entries - put 'all' last if it exists
        const entries = Object.entries(grouped).sort(([keyA], [keyB]) => {
            if (keyA === 'all') return 1;
            if (keyB === 'all') return -1;
            return keyA.localeCompare(keyB);
        });

        // Add individual groups first
        for (const [group, data] of entries) {
            if (group === 'all') continue; // Skip 'all' for now, will add as TOTAL at end

            const { total, documented } = data.stats;
            const undocumented = total - documented;
            const percentage = data.stats.percentage;

            // Color code the coverage percentage
            const coverageColor = percentage >= threshold ? Colorize.green :
                                 percentage >= 50 ? Colorize.yellow :
                                 Colorize.red;

            table.push([
                group,
                total.toString(),
                documented.toString(),
                undocumented.toString(),
                coverageColor(`${percentage.toFixed(1)}%`)
            ]);
        }

        // Always add TOTAL line at the end
        const { total, documented } = totalStats;
        const undocumented = total - documented;
        const percentage = totalStats.percentage;
        const coverageColor = percentage >= threshold ? Colorize.green :
                             percentage >= 50 ? Colorize.yellow :
                             Colorize.red;

        table.push([
            Colorize.bold('TOTAL'),
            Colorize.bold(total.toString()),
            Colorize.bold(documented.toString()),
            Colorize.bold(undocumented.toString()),
            Colorize.bold(coverageColor(`${percentage.toFixed(1)}%`))
        ]);

        clack.log.message(table.toString());
        clack.log.message('');

        if (totalStats.percentage < threshold) {
            clack.log.error(`Coverage check failed: ${totalStats.percentage.toFixed(1)}% < ${threshold}%`);
        } else {
            clack.log.success(`Coverage check passed: ${totalStats.percentage.toFixed(1)}%`);
        }
    }

    private _reportJson(grouped: GroupedCoverage, totalStats: CoverageStats, threshold: number): void {
        const output = {
            threshold,
            stats: totalStats,
            groups: grouped,
            success: totalStats.required.percentage >= threshold
        };
        console.log(JSON.stringify(output, null, 2));
    }
}
