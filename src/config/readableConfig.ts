export type ModelContext = 'list' | 'facet' | 'download' | 'search' | 'overlap';
export type FacetKind = 'category' | 'numeric';

export interface FieldOptions {
    schema?: string;
    requirement?: string;
    select?: string;
    filterSelect?: string;
    whereClause?: string;
    groupMethod?: string;
    dataType?: FacetKind;
    binSize?: number;
    log?: boolean;
    singleResponse?: boolean;
    aliases?: string[];
}

export class Field {
    readonly schema: string;
    readonly requirement: string;
    readonly select: string;
    readonly filterSelect: string;
    readonly whereClause: string;
    readonly groupMethod: string;
    readonly dataType: FacetKind;
    readonly binSize?: number;
    readonly log: boolean;
    readonly singleResponse: boolean;
    readonly aliases: string[];

    constructor(
        readonly name: string,
        readonly table: string,
        readonly column: string,
        readonly description: string = '',
        options: FieldOptions = {}
    ) {
        this.schema = options.schema || '';
        this.requirement = options.requirement || '';
        this.select = options.select || '';
        this.filterSelect = options.filterSelect || '';
        this.whereClause = options.whereClause || '';
        this.groupMethod = options.groupMethod || '';
        this.dataType = options.dataType || 'category';
        this.binSize = options.binSize;
        this.log = !!options.log;
        this.singleResponse = !!options.singleResponse;
        this.aliases = options.aliases || [];
    }
}

export interface FieldUsageOptions {
    order?: number | string;
    default?: boolean;
    alias?: string;
    description?: string;
}

export class FieldUsage {
    constructor(
        readonly field: Field,
        readonly options: FieldUsageOptions = {}
    ) {}

    get default() {
        return this.options.default !== false;
    }

    get alias() {
        return this.options.alias || this.field.column;
    }

    get description() {
        return this.options.description || this.field.description;
    }
}

export function use(field: Field, options: FieldUsageOptions = {}) {
    return new FieldUsage(field, options);
}

export class ModelList {
    constructor(
        readonly context: ModelContext,
        readonly fields: FieldUsage[],
        readonly options: {name?: string, associatedModel?: string} = {}
    ) {}

    get name() {
        return this.options.name || '';
    }

    get associatedModel() {
        return this.options.associatedModel || '';
    }

    get enabledFields() {
        return this.fields;
    }
}

export abstract class ReadableModel {
    abstract readonly name: string;
    abstract readonly table: string;
    abstract readonly keyColumn: string;
}
