import asyncio
import websockets
import re
import pickle
import os
from databases import Database

from random import seed
from random import randint

class MFC:
    def __init__(self,websocket):
        self.websocket = websocket

        self.testOutsideASCII =  re.compile(r"[^ -~]")
        self.testHasForbiddenChar =  re.compile(r"[:@>\n]")

    async def handshake(self):
        #Handshake
        await self.websocket.send('mfc:w')

    async def check(self,str,errFrom):
        if self.testOutsideASCII.search(str):
            raise ValueError(errFrom+' string contains illegal Character (outside of allowed range)')

        if self.testHasForbiddenChar.search(str):
            raise ValueError(errFrom+' string contains illegal Character (forbidden, but inside range)')

    async def send(self,target,targetgroup,message):
        await self.check(target,"Target")
        await self.check(targetgroup,"Targetgroup")
        await self.check(message,"Message")

        await self.websocket.send(f'{target}@{targetgroup}:{message}')

    async def parse(self,data):
        split_msg_data = data.split(":")
        header = split_msg_data[0]
        message = split_msg_data[1].replace("\n","")
        
        split_header = header.split(">")
        origin_header = split_header[0]
        target_header = split_header[1]

        return (origin_header, target_header, message)

#States
READY = 0
WORKING = 1
ALMOSTDONE = 2

class OrderDB:
    def __init__(self):
        self.orderList = []
        self.database = Database('sqlite+aiosqlite:///order.db')
            
    async def connect(self):
        await self.database.connect()

        query = """SELECT count(name) FROM sqlite_master WHERE type='table' AND name='Robots'"""
        hasRobots = await self.database.fetch_all(query=query)
        if len(hasRobots) == 0 or hasRobots[0][0] == 0:
            query = """CREATE TABLE Robots (id INTEGER PRIMARY KEY, name VARCHAR(32), state INTEGER)"""
            await self.database.execute(query=query)

            # Insert some data.
            query = "INSERT INTO Robots(name, state) VALUES (:name, :state)"
            values = [
                {"name": "befueller", "state": READY},
                {"name": "greifarm", "state": READY},
                {"name": "aufzug", "state": READY},
                {"name": "bedeckler", "state": READY}
            ]
            await self.database.execute_many(query=query, values=values)


        query = """SELECT count(name) FROM sqlite_master WHERE type='table' AND name='Orders'"""
        hasOrders = await self.database.fetch_all(query=query)
        if len(hasOrders) == 0 or hasOrders[0][0] == 0:
            query = """CREATE TABLE Orders (id INTEGER PRIMARY KEY, name VARCHAR(32), color VARCHAR(32), state INTEGER, position INTEGER)"""
            await self.database.execute(query=query)

    async def new(self,color):
        nummer = randint(0, 1000000)

        self.orderList[0].append({ "id": nummer, "color": color, "state": 0, "position": None })
        

        pickle.dump(self.orderList[0],open("order_s0.db","wb"))

        print(self.orderList)

        return nummer


class Robot:
    def __init__(self,name):
        self.name = name
        self.filename = name + ".robot.db"

        if os.path.exists(self.filename): 
            self.status = pickle.load( open(self.filename,"rb") )
        else: 
            self.status = READY

    async def ok(self):
        self.status = READY
        pickle.dump(self.status,open(self.filename,"wb"))
        
    async def work(self):
        self.status = WORKING
        pickle.dump(self.status,open(self.filename,"wb"))

    async def almostdone(self):
        self.status = ALMOSTDONE
        pickle.dump(self.status,open(self.filename,"wb"))

                


async def main():
    connection = websockets.connect(uri='ws://localhost:5678')

    async with connection as websocket:
        mfc = MFC(websocket)
        await mfc.handshake()

        oDB = OrderDB()
        await oDB.connect()

        # Receives the replies.
        async for data in mfc.websocket:
            origin_header, target_header, message = await mfc.parse(data)

            if target_header == "mfc@websocket":
                if origin_header == "bestell@websocket":
                    nummer = oDB.new(message)
                    await mfc.send("bestell","websocket",str(nummer))
                elif origin_header == "befueller@serial":
                    pass
                elif origin_header == "greifarm@serial":
                    pass
                elif origin_header == "aufzug@serial":
                    pass
                elif origin_header == "bedeckler@serial":
                    pass

        # Closes the connection.
        await websocket.close()
        print("Connection Was Closed")

#seed(16)
asyncio.run(main())