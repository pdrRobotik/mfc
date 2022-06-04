import asyncio
from platform import release
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
WAITING_AFTER_DONE = 0
WORKING_AFTER_DONE = 1
WAITING_AFTER_NEXT = 2
WORKING_AFTER_NEXT = 4

# class OrderDB:
#     def __init__(self):
#         self.orderList = []
#         self.database = Database('sqlite+aiosqlite:///order.db')
            
#     async def connect(self):
#         await self.database.connect()

#         query = """SELECT count(name) FROM sqlite_master WHERE type='table' AND name='Robots'"""
#         hasRobots = await self.database.fetch_all(query=query)
#         if len(hasRobots) == 0 or hasRobots[0][0] == 0:
#             query = """CREATE TABLE Robots (id INTEGER PRIMARY KEY, name VARCHAR(32), state INTEGER)"""
#             await self.database.execute(query=query)

#             # Insert some data.
#             query = "INSERT INTO Robots(name, state) VALUES (:name, :state)"
#             values = [
#                 {"name": "befueller", "state": WAITING_AFTER_DONE},
#                 {"name": "greifarm", "state": WAITING_AFTER_DONE},
#                 {"name": "aufzug", "state": WAITING_AFTER_DONE},
#                 {"name": "bedeckler", "state": WAITING_AFTER_DONE}
#             ]
#             await self.database.execute_many(query=query, values=values)


#         query = """SELECT count(name) FROM sqlite_master WHERE type='table' AND name='Orders'"""
#         hasOrders = await self.database.fetch_all(query=query)
#         if len(hasOrders) == 0 or hasOrders[0][0] == 0:
#             query = """CREATE TABLE Orders (id INTEGER PRIMARY KEY, color VARCHAR(32), state INTEGER, position INTEGER)"""
#             await self.database.execute(query=query)


#     async def new(self,color):
#         query = "INSERT INTO Orders(color, state, position) VALUES (:color, :state, :position)"
#         await self.database.execute(query=query, values={ "color": color, "state": 0, "position": None })

#         return (await self.database.fetch_one(query="SELECT max(id) as last_id FROM Orders")).last_id

#     async def setState(self,name,state):
#         query = "UPDATE Robots SET state = :state WHERE name = :name"
#         await self.database.execute(query=query, values={ 'name': name, 'state':state })

async def bestell(mfc,OrdersBestellt,message):
    OrdersBestellt.put_nowait({"color": message, "state": 0, id: OrdersBestellt.qsize()+1})
    await mfc.send("bestell","websocket",str(OrdersBestellt.qsize()))

async def greifarm(mfc,OrdersBestellt,message):
    if message == "OK":
        order = await OrdersBestellt.get()
        print("Test1",order)
    elif message == "NEXT":
        print("Test2")

async def befueller(mfc,message):
    if message == "OK":
        pass
    elif message == "NEXT":
        pass

async def aufzug(mfc,message):
    if message == "OK":
        pass
    elif message == "NEXT":
        pass

async def bedeckler(mfc,message):
    if message == "OK":
        pass
    elif message == "NEXT":
        pass


async def main():
    connection = websockets.connect(uri='ws://localhost:5678')

    async with connection as websocket:
        
        mfc = MFC(websocket)
        await mfc.handshake()

        OrdersBestellt = asyncio.Queue()
        OrderGreifer = asyncio.Queue(1)
        OrderBefueller = asyncio.Queue(1)
        OrderBedeckler = asyncio.Queue(1)
        OrderAufzug = asyncio.Queue(1)

        lock0 = asyncio.Lock()
        lock1 = asyncio.Lock()
        lock2 = asyncio.Lock()
        lock3 = asyncio.Lock()


        # Receives the replies.
        async for data in mfc.websocket:
            origin_header, target_header, message = await mfc.parse(data)
            print("testAB")
            if target_header == "mfc@websocket":
                if origin_header == "bestell@websocket":
                    print(message)
                    await bestell(mfc,OrdersBestellt,message)
                elif origin_header == "greifarm@serial":
                    await greifarm(mfc,OrdersBestellt,message)

                        
                """
                elif origin_header == "befueller@serial":
                    if message == "OK":
                        
                        #async with lock0:
                        await OrderBefueller.put( await OrderGreifer.get() )
                        await mfc.send("befueller","serial","GO")
                        #await lock1.acquire()

                    elif message == "NEXT":
                        
                        #if lock1.locked(): lock1.release()

                        #await OrderBefueller.join()
                        await OrderBefueller.get()
                        await mfc.send("bedeckler","serial","GO")
                        
                        
                elif origin_header == "bedeckler@serial":
                    if message == "OK":
                        
                        async with lock1:
                            await OrderBedeckler.put(await OrderBefueller.get())
                            await mfc.send("bedeckler","serial","GO")
                        await lock2.acquire()

                    elif message == "NEXT":
                        
                        if lock2.locked(): lock2.release()

                        await OrderAufzug.join()
                        await mfc.send("aufzug","serial","GO")
                        
                elif origin_header == "aufzug@serial":
                    if message == "OK":
                        
                        async with lock2:
                            await OrderAufzug.put(await OrderBedeckler.get())
                            await mfc.send("bedeckler","serial","GO")
                        await lock3.acquire()

                    elif message == "NEXT":

                        if lock3.locked(): lock3.release()

                        await OrderAufzug.get()
                """

        # Closes the connection.
        await websocket.close()
        print("Connection Was Closed")

#seed(16)
asyncio.run(main())