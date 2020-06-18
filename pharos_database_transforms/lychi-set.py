import glob

import mysql.connector
from mysql.connector import Error
from credentials import *  # loads variables for DBHOST, DBNAME, USER, PWORD

def createTempTable(cursor):
    sql = """create table if not exists `temp_map`(
                `id` int NOT NULL,
                `smiles` text CHARACTER SET utf8 COLLATE utf8_unicode_ci,
                `lychi_h4` varchar(15) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
                PRIMARY KEY (`id`)) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;"""
    cursor.execute(sql)
    return

def dropTempTable(cursor):

    sql = "drop table if exists `temp_map`"
    cursor.execute(sql)
    return

def get_lychi_files(prefix):
    return sorted(glob.glob(prefix + '*.lychi'))

def get_smiles_files(prefix):
    return sorted(glob.glob(prefix + '*.smiles'))

def read_file(filename):
    with open(filename, 'r') as f:
        return f.readlines()

def compile_lychis(cursor, lychi_file, smile_file):
    lychi_lines = read_file(lychi_file)
    smile_lines = read_file(smile_file)
    mapping = []
    offset = 0
    for i, smile_line in enumerate(smile_lines):
        (smile, smile_id) = smile_line.split('\t')
        lychi_line = lychi_lines[i - offset]
        (canonSmile, read_id, keys) = lychi_line.split('\t')
        if(smile_id.strip() != read_id.strip()):
            offset = offset + 1
            print 'lychi missing for id: ', smile_id
        else:
            (h1, h2, h3, lychi_h4) = keys.split('-')
            for id in smile_id.split(','):
                mapping.append((id, smile.strip(), lychi_h4.strip()))
    sql = "insert into temp_map values (%s, %s, %s)"

    for i in xrange(0, len(mapping), 10000) :
        cursor.executemany(sql, mapping[i:i+10000])
    return

def set_lychis(cursor, prefix):
    tableName = 'drug_activity'
    if(prefix == 'c'):
        tableName = 'cmpd_activity'
    sql = "UPDATE {} SET {}.lychi_h4 = NULL;".format(tableName,tableName,tableName)
    cursor.execute(sql)
    sql =  "update {} left join temp_map on {}.id = temp_map.id set {}.lychi_h4 = temp_map.lychi_h4;".format(tableName,tableName,tableName)
    cursor.execute(sql)
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
            print('Connected to MySQL database')

            for prefix in ['d','c']:
                dropTempTable(conn.cursor())
                createTempTable(conn.cursor())

                lychi_files = get_lychi_files(prefix)
                smile_files = get_smiles_files(prefix)

                for i, lychi_file in enumerate(lychi_files):
                    smile_file = smile_files[i]
                    compile_lychis(conn.cursor(), lychi_file, smile_file)
                    print "loaded: ", lychi_file

                set_lychis(conn.cursor(), prefix)
                conn.commit()

            print('done')

            dropTempTable(conn.cursor())
            conn.commit()
    except Error as e:
        print(e)

    finally:
        if conn is not None and conn.is_connected():
            conn.commit()
            conn.close()

if __name__ == '__main__':
    connect()

