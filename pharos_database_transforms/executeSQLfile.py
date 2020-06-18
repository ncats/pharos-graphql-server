#!/usr/bin/python
import sys
import mysql.connector
from mysql.connector import Error, OperationalError
from credentials import *  # loads variables for DBHOST, DBNAME, USER, PWORD

def getSQLcommands(sqlFile):
    fd = open(sqlFile, 'r')
    sqlFile = fd.read().strip()
    fd.close()
    return sqlFile.split(';')

def readAndExecuteFile(cursor,sqlFile):
    commands = getSQLcommands(sqlFile)
    count = 0
    for command in commands:
        try:
            count = count + 1
            strippedCommand = " ".join(command.split())
            print "executing:  ", count, " of ", len(commands)
            print "   ",strippedCommand[0:73] + ("", "...")[len(strippedCommand)>74]
            cursor.execute(command)
        except OperationalError, msg:
            print "Command skipped ", count, ": ", msg
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
            print('Connected to MySQL database @ ' + DBHOST + " : " + DBNAME)
            readAndExecuteFile(conn.cursor(), sys.argv[1])
            conn.commit()
            print('done')

    except Error as e:
        print(e)

    finally:
        if conn is not None and conn.is_connected():
            conn.close()

if __name__ == '__main__':
    connect()
