import mysql.connector
from mysql.connector import Error
from credentials import *  # loads variables for DBHOST, DBNAME, USER, PWORD


def createTable(cursor):
    cursor.execute("DROP TABLE IF EXISTS `ncats_generif_pubmed_map`")

    sql = """CREATE TABLE `ncats_generif_pubmed_map` (
              `generif_id` INT(11) NOT NULL,
              `pubmed_id` INT(11) NOT NULL,
              INDEX `g2p_idx1` (`generif_id` ASC),
              INDEX `g2p_idx2` (`pubmed_id` ASC),
              CONSTRAINT `g2p_generif_id` FOREIGN KEY (`generif_id`) REFERENCES `generif` (`id`))
              """
    cursor.execute(sql)
    return

def getMapData(cursor):
    cursor.execute("select id, pubmed_ids from generif")
    return cursor.fetchall()

def generateMap(data, cursor):
    map = []
    for x in data:
        for y in x[1].split('|'):
            map.append([x[0], y])
    return map

def saveData(cursor, map):
    sql = "insert into ncats_generif_pubmed_map values (%s, %s)"
    chunks = 50000
    for i in xrange(0, len(map), chunks) :
        cursor.executemany(sql, map[i:i+chunks])
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
            cursor = conn.cursor()
            createTable(cursor)
            data = getMapData(cursor)
            map = generateMap(data, cursor)
            saveData(cursor,map)

            conn.commit()
            print('done')

    except Error as e:
        print(e)

    finally:
        if conn is not None and conn.is_connected():
            conn.commit()
            conn.close()


if __name__ == '__main__':
    connect()
