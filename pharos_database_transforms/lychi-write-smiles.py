import mysql.connector
from mysql.connector import Error
from credentials import *  # loads variables for DBHOST, DBNAME, USER, PWORD

shellScript = 'run_all.sh'

def setConcatLength(cursor):
    sql = """SET SESSION group_concat_max_len = 100000;"""
    cursor.execute(sql)
    return

def getCsmiles(cursor):
    setConcatLength(cursor)
    sql = """
            select smiles collate utf8_bin, group_concat(id) as 'ids'
            from cmpd_activity
            where length(smiles)>0
            group by smiles"""
    cursor.execute(sql)
    return cursor.fetchall()

def getDsmiles(cursor):
    setConcatLength(cursor)
    sql = """
            select smiles collate utf8_bin, group_concat(id) as 'ids'
            from drug_activity
            where length(smiles)>0
            group by smiles"""
    cursor.execute(sql)
    return cursor.fetchall()

def writeSmilesFiles(smilesArray, prefix):
    maxLen = len(smilesArray)
    fileSize = 50000
    startIndex = 0
    filenumber = 0

    while (startIndex < maxLen):
        filenumber = filenumber + 1
        endIndex = min(fileSize * filenumber , maxLen)
        basename = prefix + str(startIndex) + '-' + str(endIndex - 1)
        smileFile = basename + '.smiles'
        lychiFile = basename + '.lychi'
        with open(smileFile, 'w') as f:
            print "writing ", smileFile
            for item in smilesArray[startIndex:endIndex]:
                f.write("%s\t%s\n" % item)
        with open(shellScript, 'a') as f:
            f.write("java -jar lib/lychi-all-fe2ea2a.jar %s > %s &\n" % (smileFile, lychiFile))
        startIndex = filenumber * fileSize
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

            with open(shellScript, 'w') as f:
                f.write("#!/bin/sh\n")
            smilesArray = getCsmiles(conn.cursor())
            writeSmilesFiles(smilesArray,'c')
            smilesArray = getDsmiles(conn.cursor())
            writeSmilesFiles(smilesArray,'d')

            print('done')

    except Error as e:
        print(e)

    finally:
        if conn is not None and conn.is_connected():
            conn.close()

if __name__ == '__main__':
    connect()

