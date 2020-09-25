import mysql.connector
from mysql.connector import Error
from credentials import *  # loads variables for DBHOST, DBNAME, USER, PWORD

id = 1
allValues = []

def createDoTree(cursor):
    cursor.execute("DROP TABLE IF EXISTS ncats_do")
    sql = """CREATE TABLE `ncats_do` (
            `lft` int NOT NULL,
            `rght` int NOT NULL,
            `doid` varchar(12) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT '',
            `name` text CHARACTER SET utf8 COLLATE utf8_unicode_ci,
            `def` text CHARACTER SET utf8 COLLATE utf8_unicode_ci,
            PRIMARY KEY (`lft`),
            KEY `doid_idx1` (`doid`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8"""
    cursor.execute(sql)
    return

def getDoDetails(cursor, doid):
    cursor.execute('SELECT name, def FROM do WHERE doid = "' + doid + '"')
    return cursor.fetchone()

def getNodeChildren(cursor, doid):
    cursor.execute('SELECT doid FROM do_parent WHERE parent_id = "' + doid + '"')
    return cursor.fetchall()

def doNode(cursor, doid):
    global id, allValues
    if (id % 1000) == 0:
        print id
    left = id
    children = getNodeChildren(cursor, doid)
    for child in children:
        id = id + 1
        doNode(cursor, child[0])
    right = id
    name, definition = getDoDetails(cursor,doid)
    values = (left, right, doid, name, definition)
    allValues.append(values)

def parseDoTree(cursor):
    doNode(cursor, "DOID:4")

def fillinDoTree(cursor):
    print 'filling in'
    global id, allValues
    sql = """SELECT 
                ncats_name
            FROM
                disease
                group by ncats_name 
                having max(case when did like 'doid%' then did else null end) is null"""
    cursor.execute(sql)
    nonDOIDnames = cursor.fetchall()
    formattedList = [row[0] for row in nonDOIDnames]
    for name in formattedList:
        if (id % 1000) == 0:
            print id
        id = id + 1
        values = [id,id,None,name,'non-standard DO name']
        allValues.append(values)

def connect():
    """ Connect to MySQL database """
    global allValues
    conn = None
    try:
        conn = mysql.connector.connect(host=DBHOST,
                                       database=DBNAME,
                                       user=USER,
                                       password=PWORD)
        if conn.is_connected():
            print('Connected to MySQL database')
            cursor = conn.cursor()
            parseDoTree(cursor)
            fillinDoTree(cursor) # with stuff that doesn't have doids

            sql = "INSERT INTO ncats_do (lft, rght, doid, name, def) VALUES (%s,%s,%s,%s,%s)"
            createDoTree(cursor)
            cursor.executemany(sql,allValues)

    except Error as e:
        print(e)

    finally:
        if conn is not None and conn.is_connected():
            conn.commit()
            conn.close()


if __name__ == '__main__':
    connect()

