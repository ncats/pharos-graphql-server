import mysql.connector
from mysql.connector import Error
from credentials import *  # loads variables for DBHOST, DBNAME, USER, PWORD

def addColumn(cursor):
    print "adding column"
    sql = """ALTER TABLE `disease` 
            DROP INDEX `disease_text_idx` ,
            DROP INDEX `disease_idx4`,
            -- DROP COLUMN `ncats_name`,
            ADD COLUMN `ncats_name` text CHARACTER SET 'utf8' COLLATE 'utf8_unicode_ci' NOT NULL AFTER `name`,
            ADD INDEX disease_idx4(`ncats_name`(256)),
            ADD FULLTEXT INDEX `disease_text_idx` (`ncats_name`, `description`, `drug_name`);"""
    cursor.execute(sql)
    return

def populateColumn(cursor):
    print "populating column"
    sql = """update disease
                set ncats_name = CASE 
		            WHEN SUBSTRING(did,1,4)="DOID" 
			        THEN (
				        CASE WHEN (SELECT `name` FROM `do` WHERE doid = did) is null THEN disease.name 
                        ELSE (SELECT `name` FROM `do` WHERE doid = did) END
                    )
		            ELSE `name` END"""
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
            addColumn(conn.cursor())
            populateColumn(conn.cursor())
            conn.commit()
            print('done')

    except Error as e:
        print(e)

    finally:
        if conn is not None and conn.is_connected():
            conn.close()

if __name__ == '__main__':
    connect()

