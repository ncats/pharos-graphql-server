import {FieldUsage, ModelList, ReadableModel} from "./readableConfig";

export function getReadableModelLists(model: ReadableModel): ModelList[] {
    const lists: ModelList[] = [];
    const seen = new Set<ModelList>();

    const visit = (value: any) => {
        if (!value) {
            return;
        }
        if (value instanceof ModelList) {
            if (!seen.has(value)) {
                lists.push(value);
                seen.add(value);
            }
            return;
        }
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (typeof value === 'object' && !(value instanceof FieldUsage)) {
            Object.keys(value).forEach(key => visit(value[key]));
        }
    };

    Object.keys(model).forEach(key => visit((model as any)[key]));
    return lists;
}

export function toListManagerFieldRow(usage: FieldUsage, order: number) {
    const field = usage.field;
    return {
        name: field.name,
        alias: usage.options.alias || null,
        order: usage.default ? order : 0,
        default: usage.default,
        description: usage.description,
        schema: field.schema,
        requirement: field.requirement,
        table: field.table,
        column: field.column,
        select: field.select,
        filter_select: field.filterSelect,
        where_clause: field.whereClause,
        group_method: field.groupMethod,
        dataType: field.dataType,
        binSize: field.binSize,
        single_response: field.singleResponse,
        log: field.log
    };
}
