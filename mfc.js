AccessNode = require("./AccessNode.js");



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

class MFC {
    constructor() {
        this.ric = null;
        this.handlersWebsocket = new Map();
        this.handlersSerial = new Map();

        this.register_websocket("bestell",this.handle_bestell.bind(this));


        this.bestell_queque = [];
        this.order_nummer = 0;

        this.greifer = new Robot("greifarm","serial",this.handle_greifer.bind(this),Robot.isWaiting);
        this.befueller = new Robot("befueller","serial",this.handle_befueller.bind(this),Robot.isWaiting);
        this.bedeckler = new Robot("bedeckler","serial",this.handle_bedeckler.bind(this),Robot.isWaiting);
        //this.greifer = new Robot("greifarm","serial",this.handle_greifer.bind(this),Robot.isWaiting);

        this.register(this.greifer);
        this.register(this.befueller);
        this.register(this.bedeckler);
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
                this.ric.send("bestell","websocket", this.order_nummer);
                this.order_nummer++;

                let order = this.bestell_queque.shift();
                this.greifer.order = order;

                this.greifer.run(order.color);
            } else {
                let order = {id: this.order_nummer, color: message};
                this.ric.send("bestell","websocket", this.order_nummer);
                this.order_nummer++;

                this.greifer.order = order;
                
                this.greifer.run(order.color);
            }
        } else {

            this.bestell_queque.push({id: this.order_nummer, color: message})
            this.ric.send("bestell","websocket", this.order_nummer);
            this.order_nummer++;
        }
    }

    handle_greifer(message) {
        if (message == "OK") {
            this.greifer.wait();

            if (this.bestell_queque.length > 0) {
                let order = this.bestell_queque.shift();

                this.greifer.order = order;
                
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
                this.greifer.next_to(this.befueller);

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
                this.befueller.next_to(this.bedeckler);

                this.befueller.run_next();

                this.bedeckler.run();
            }

        } else if (message == "NEXT") {
            this.bedeckler.wait_next();

            //TEst
            this.bedeckler.run_next();
            
        }

    }
}

let mfc = new MFC();
let ric = new AccessNode.RobotikInterConnect("localhost",5678, "w", "mfc", (data)=>{mfc.handle(data)});
mfc.setRic(ric);