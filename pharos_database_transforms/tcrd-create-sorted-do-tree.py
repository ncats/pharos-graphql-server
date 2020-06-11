import mysql.connector
from mysql.connector import Error
from pharos_database_transforms.credentials import *  # loads variables for DBHOST, DBNAME, USER, PWORD

id = 1

def createDoTree(cursor):
    cursor.execute("DROP TABLE IF EXISTS ncats_do")
    sql = """CREATE TABLE `ncats_do` (
            `lft` int NOT NULL,
            `rght` int NOT NULL,
            `doid` varchar(12) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT '' NOT NULL,
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
    global id
    left = id
    children = getNodeChildren(cursor, doid)
    for child in children:
        id = id + 1
        doNode(cursor, child[0])
    right = id
    name, definition = getDoDetails(cursor,doid)
    sql = "INSERT INTO ncats_do (lft, rght, doid, name, def) VALUES (%s,%s,%s,%s,%s)"
    values = (left, right, doid, name, definition)
    print(sql,values)
    cursor.execute(sql, values)

def parseDoTree(cursor):
    doNode(cursor, "DOID:4")


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
            createDoTree(conn.cursor())
            parseDoTree(conn.cursor())
            conn.commit()

    except Error as e:
        print(e)

    finally:
        if conn is not None and conn.is_connected():
            conn.close()


if __name__ == '__main__':
    connect()

