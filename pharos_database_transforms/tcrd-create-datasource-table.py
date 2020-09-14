import mysql.connector
from mysql.connector import Error
from credentials import *  # loads variables for DBHOST, DBNAME, USER, PWORD
from dataSourceMappings import *
from executeSQLfile import readAndExecuteFile


class idMap:
    def __init__(self, entity, list):
        self.entity = entity
        self.list = list


class dataSourceMap:
    def __init__(self, source):
        self.source = source
        self.maps = []

    def addMapping(self, entity, list):
        self.maps.append(idMap(entity, list))


def loadDataSourceIDs(cursor, dataSource):
    sourceObj = dataSourceMap(dataSource)
    for mapping in dataSource.mappings:
        cursor.execute(mapping.idQuery)
        sourceObj.addMapping(mapping.destinationTable, cursor.fetchall())
    return sourceObj


def valueChecker(value, entity, reqEntity):
    if entity == reqEntity:
        return value
    return None


def saveData(cursor, map):
    sql = "insert into ncats_dataSource_map values (null, %s, %s, %s, %s, %s, %s, %s)"
    chunks = 25000
    for i in xrange(0, len(map), chunks):
        cursor.executemany(sql, map[i:i + chunks])
    return


def connect():
    """ Connect to MySQL database """
    conn = None
    try:
        conn = mysql.connector.connect(host=DBHOST,
                                       database=DBNAME,
                                       user=USER,
                                       password=PWORD)
        if conn.is_connected():
            cursor = conn.cursor()
            print('Connected to MySQL database')

            readAndExecuteFile(cursor, "tcrd-create-datasource-table.sql")

            for dataSource in dataSourceMapping:
                print 'loading ', dataSource.source
                sourceObj = loadDataSourceIDs(cursor, dataSource)

                output = [[dataSource.source,
                           dataSource.url,
                           dataSource.license,
                           dataSource.licenseURL,
                           valueChecker(id[0], map.entity, "protein"),
                           valueChecker(id[0], map.entity, "ligand"),
                           valueChecker(id[0], map.entity, "disease")]
                          for map in sourceObj.maps
                          for id in map.list]
                print 'found ', len(output), ' rows'
                print 'saving ', dataSource.source, ' to ncats_dataSource_map'
                if (len(output) > 0):
                    saveData(cursor, output)
                else:
                    cursor.execute("insert into ncats_dataSource_map values (null, %s, %s, %s, %s, null, null, null)",
                                   [dataSource.source, dataSource.url, dataSource.license, dataSource.licenseURL])

            print('done')

    except Error as e:
        print(e)

    finally:
        if conn is not None and conn.is_connected():
            conn.commit()
            conn.close()


if __name__ == '__main__':
    connect()
