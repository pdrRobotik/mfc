AccessNode = require("./MFCAccessNode.js");



class Robot {

    constructor(name,group,handler,status) {
        this.mfc = null;

        this.status = status;
        this.name = name;
        this.group = group;
        
        this.order = null;
        this.order_next = null;

        this.handler = handler;
    }

    setMFC(mfc) {
        this.mfc = mfc;
    }

    run(message="GO") {
        this.status = Robot.isRunning;
        this.mfc.ric.send(this.name,this.group,message);
    }

    run_next(message="GO") {
        this.status = Robot.isRunningNext;
        this.mfc.ric.send(this.name,this.group,message);
    }

    move_next_to(robot) {
        robot.order = this.order_next;
        this.order_next = null;
    }

    //Set status
    wait() {
        this.status = Robot.isWaiting;
    }

    wait_next() {
        this.status = Robot.isWaitingNext;

        this.order_next = this.order;
        this.order = null; 
    }

}

Robot.isWaiting = 0;
Robot.isRunning = 1;
Robot.isWaitingNext = 2;
Robot.isRunningNext = 3;
//Für HRL
Robot.isFull = 4;

class RobotHRL {

    constructor(name,group,handler,status) {
        this.mfc = null;

        this.status = status;
        this.name = name;
        this.group = group;

        this.handler = handler;

        //Tempory order store
        this.order = null;
        this.order_array = new Array(6).fill(null);
        this.amount_filled = 0;
    }

    setMFC(mfc) {
        this.mfc = mfc;
    }

    wait() {
        this.status = Robot.isWaiting;
    }

    isReady() {
        console.log(0);
        if (this.status != Robot.isWaiting) return false;
        console.log(1);
        if (this.amount_filled >= this.order_array.length) {
            this.status = Robot.isFull;
            return false;
        }
        console.log(2);
        return true;
    }

    store_set_order() {
        for (let i=0; i < this.order_array.length; i++) {
            if (this.order_array[i] == null) {
                this.order_array[i] = this.order;
                this.amount_filled++;
                this.mfc.ric.send("abhol","websocket", this.order.id + "," + this.order.color + ",a,"+i);
                this.order = null;

                this.status = Robot.isRunning;
                this.mfc.ric.send(this.name,this.group,String(10+i));

                return;
            }
        }

        //Wenn oben nich geklappt hat ist es voll.
        this.status = Robot.isFull;
    }

    retrive(fach) {
        let order = this.order_array[fach];
        this.order_array[fach] = null;
        this.amount_filled -= 1;

        this.status = Robot.isRunning;
        this.mfc.ric.send(this.name,this.group,String(10+i));

        this.mfc.ric.send("abhol","websocket", order.id + "," + order.color + ",n,"+fach);
    }
}

class MFC {
    constructor() {
        this.ric = null;
        this.handlersWebsocket = new Map();
        this.handlersSerial = new Map();

        this.register_websocket("bestell",this.handle_bestell.bind(this));
        this.register_websocket("abhol",this.handle_abhol.bind(this));

        this.bestell_queque = [];
        this.order_nummer = 0;

        this.greifer = new Robot("greifarm","serial",this.handle_greifer.bind(this),Robot.isWaiting);
        this.register(this.greifer);

        this.befueller = new Robot("befueller","serial",this.handle_befueller.bind(this),Robot.isWaiting);
        this.register(this.befueller);

        this.bedeckler = new Robot("bedeckler","serial",this.handle_bedeckler.bind(this),Robot.isWaiting);
        this.register(this.bedeckler);

        this.aufzug = new Robot("aufzug","serial",this.handle_aufzug.bind(this),Robot.isWaiting);
        this.register(this.aufzug);

        this.hrl = new RobotHRL("hrl","serial",this.handle_hrl.bind(this),Robot.isWaiting);
        this.register(this.hrl);

    }

    setRic(ric) {
        this.ric = ric;
    }

    register(robot) {
        if (robot.group == "serial")
            this.handlersSerial.set(robot.name,robot.handler);
        if (robot.group == "websocket")
            this.handlersWebsocket.set(robot.name,robot.handler);

        robot.setMFC(this);
    }

    register_websocket(name,handler) {
        this.handlersWebsocket.set(name,handler);
    }

    handle(data) {
        if (data.target == "mfc" && data.targetgroup == "websocket") {
            if (data.origingroup == "websocket") {
                
                if (this.handlersWebsocket.has(data.origin)) {
                    this.handlersWebsocket.get(data.origin)(data.message);
                }
                
            } else if (data.origingroup == "serial") {
                
                if (this.handlersSerial.has(data.origin)) {
                    this.handlersSerial.get(data.origin)(data.message);
                }

            }

        }
    }


    handle_bestell(message) {
        
        if (this.greifer.status == Robot.isWaiting) {

            if (this.bestell_queque.length > 0) {
                this.bestell_queque.push({id: this.order_nummer, color: message});
                this.ric.send("bestell","websocket", this.order_nummer + "," + message);
                this.order_nummer++;

                let order = this.bestell_queque.shift();
                this.greifer.order = order;

                this.ric.send("abhol","websocket", order.id + "," + order.color + ",p,0");
                this.greifer.run(order.color);
            } else {
                let order = {id: this.order_nummer, color: message};
                this.ric.send("bestell","websocket", this.order_nummer+ "," + message);
                this.order_nummer++;

                this.greifer.order = order;
                
                this.ric.send("abhol","websocket", order.id + "," + order.color + ",p,0");
                this.greifer.run(order.color);
            }
        } else {

            this.bestell_queque.push({id: this.order_nummer, color: message})
            this.ric.send("bestell","websocket", this.order_nummer+ "," + message);
            this.order_nummer++;
        }
    }

    handle_greifer(message) {
        if (message == "OK") {
            this.greifer.wait();

            if (this.bestell_queque.length > 0) {
                let order = this.bestell_queque.shift();

                this.greifer.order = order;
                
                this.ric.send("abhol","websocket", order.id + "," + order.color + ",p,0");
                this.greifer.run(order.color);
            }
        } else if (message == "NEXT") {
            this.greifer.wait_next();

            if (this.befueller.status == Robot.isWaiting) {
                this.greifer.move_next_to(this.befueller);

                this.greifer.run_next();

                this.befueller.run();
            }

        }
    }

    handle_befueller(message) {
        if (message == "OK") {
            this.befueller.wait();
            
            if (this.greifer.status == Robot.isWaitingNext) {
                this.greifer.move_next_to(this.befueller);

                this.greifer.run_next();

                this.befueller.run();
            }

        } else if (message == "NEXT") {
            this.befueller.wait_next();

            if (this.bedeckler.status == Robot.isWaiting) {
                this.befueller.move_next_to(this.bedeckler);

                this.befueller.run_next();

                this.bedeckler.run();
            }
            
        }
    }
    
    handle_bedeckler(message) {

        if (message == "OK") {
            this.bedeckler.wait();
            
            if (this.befueller.status == Robot.isWaitingNext) {
                this.befueller.move_next_to(this.bedeckler);

                this.befueller.run_next();

                this.bedeckler.run();
            }

        } else if (message == "NEXT") {
            this.bedeckler.wait_next();

            if (this.aufzug.status == Robot.isWaiting) {
                this.bedeckler.move_next_to(this.aufzug);

                this.bedeckler.run_next();

                this.aufzug.run();
            }
            
        }

    }

    handle_aufzug(message) {

        if (message == "OK") {

            this.aufzug.wait();
            
            if (this.bedeckler.status == Robot.isWaitingNext) {
                this.bedeckler.move_next_to(this.aufzug);

                this.bedeckler.run_next();

                this.aufzug.run();
            }

        } else if (message == "NEXT") {
            this.aufzug.wait_next();

            /*if (this.hrl.isReady()) {
                this.aufzug.move_next_to(this.hrl);
                
                this.aufzug.run_next();
                
                this.hrl.store_set_order();
            }*/
            this.aufzug.run_next();
            

        }

    }

    /*handle_hrl(message) {

        if (message == "OK") {
            this.hrl.wait();

            if (this.hrl.toRetrive != null) {

                this.hrl.retrive(this.hrl.toRetrive);
                this.hrl.toRetrive = null;

            } else if (this.hrl.isReady() && this.aufzug.status == Robot.isWaitingNext) {
                this.aufzug.move_next_to(this.hrl);

                this.aufzug.run_next();

                this.hrl.store_set_order();
            }

        }

    }*/

    /*handle_abhol(message) {
        if (message == "resend") {
            for (let i=0; i < this.hrl.order_array.length; i++) {
                let o = this.hrl.order_array[i];
                if (o != null) 
                    this.ric.send("abhol","websocket", o.id + "," + o.color + ",a,"+i);
            }
        } else {

            if (this.hrl.isReady()) {
                this.hrl.retrive(Number(message));
            } else {
                this.hrl.toRetrive = Number(message);
            }
            
        }

    }*/

}

let mfc = new MFC();
let ric = new AccessNode.RobotikInterConnect("localhost",5678, "w", "mfc", (data)=>{mfc.handle(data)});
mfc.setRic(ric);
