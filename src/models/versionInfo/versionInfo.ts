

export class VersionInfo{
    knex: any;
    constructor(knex: any) {
        this.knex = knex;
    }
    getVersion(keys: string[]) {
        if (Array.isArray(keys)) {
            return this.knex('input_version').leftJoin('ncats_dataSource', 'data_source', 'dataSource')
                .select('*').whereIn('source_key', keys)
                .then((res: any[]) => this.parseVersionObjects(res));
        } else {
            return this.knex('input_version').leftJoin('ncats_dataSource', 'data_source', 'dataSource')
                .select('*')
                .then((res: any[]) => this.parseVersionObjects(res));
        }
        return null;
    }

    parseVersionObjects(results: any[]) {
        const keyObjects: any[] = [];
        results.forEach(row => {
            let keyObject = keyObjects.find(o => o.key === row.source_key);
            if (!keyObject) {
                keyObject = {
                    key: row.source_key,
                    dataSources: []
                };
                keyObjects.push(keyObject);
            }
            let dataSourceObject = keyObject.dataSources.find((o: any) => o.name === row.data_source);
            if (!dataSourceObject) {
                dataSourceObject = {
                    name: row.data_source,
                    url: row.url,
                    license: row.license,
                    licenseURL: row.licenseURL,
                    citation: row.citation,
                    description: row.dataSourceDescription,
                    files: []
                }
                keyObject.dataSources.push(dataSourceObject);
            }
            dataSourceObject.files.push({
                key: row.file_key,
                file: row.file,
                version: row.version,

                releaseDate: row.release_date?.toISOString(),
                downloadDate: row.download_date?.toISOString()
            });
        })
        return keyObjects;
    }
}