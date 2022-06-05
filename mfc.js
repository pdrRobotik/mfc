AccessNode = require("./AccessNode.js");

const isWaiting = 0;
const isRunning = 1;
const isWaitingNext = 2;
const isRunningNext = 3;

class MFC {
    constructor() {
        this.bestell_queque = [];
        this.order_nummer = 0;
        this.statusGreifer = isWaiting;
        this.order_greifer = null;
        this.order_greifer_next = null;

        this.statusBefueller = isWaiting;
        this.order_befueller = null;
        this.order_befueller_next = null;

        this.ric = null;
        this.handlersWebsocket = new Map();
        this.handlersSerial = new Map();

        this.register_websocket("bestell",this.handle_bestell.bind(this));

        this.register_serial("greifarm",this.handle_greifer.bind(this));
        this.register_serial("befueller",this.handle_befueller.bind(this));

    }

    setRic(ric) {
        this.ric = ric;
    }

    register_serial(name,handler) {
        this.handlersSerial.set(name,handler);
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
        if (this.statusGreifer == isWaiting) {
            if (this.bestell_queque.length > 0) {
                this.bestell_queque.push({id: this.order_nummer, color: message});
                this.ric.send("bestell","websocket", this.order_nummer);
                this.order_nummer++;

                let order = this.bestell_queque.shift();
                this.order_greifer = order;

                this.statusGreifer = isRunning;
                this.ric.send("greifarm","serial",order.color);
            } else {
                let order = {id: this.order_nummer, color: message};
                this.ric.send("bestell","websocket", this.order_nummer);
                this.order_nummer++;

                this.order_greifer = order;
                this.statusGreifer = isRunning;
                this.ric.send("greifarm","serial",order.color);
            }
        } else if (this.statusGreifer == isRunning) {
            this.bestell_queque.push({id: this.order_nummer, color: message})
            this.ric.send("bestell","websocket", this.order_nummer);
            this.order_nummer++;
        }
    }

    handle_greifer(message) {
        if (message == "OK") {
            this.statusGreifer = isWaiting;

            if (this.bestell_queque.length > 0) {
                let order = this.bestell_queque.shift();

                this.order_greifer = order;
                this.statusGreifer = isRunning;
                this.ric.send("greifarm","serial",order.color);
            }
        } else if (message == "NEXT") {
            this.statusGreifer = isWaitingNext;
            this.order_greifer_next = this.order_greifer;
            this.order_greifer = null;

            if (this.statusBefueller == isWaiting) {
                this.order_befueller = this.order_greifer_next;
                this.order_greifer_next == null;

                this.ric.send("greifarm","serial","GO");
                this.statusGreifer = isRunningNext;
            }

        }
    }

    handle_befueller(message) {
        if (message == "OK") {
            this.statusBefueller = isWaiting;
            
            if (this.statusGreifer == isWaitingNext && this.order_greifer_next != null) {

                this.order_befueller = this.order_greifer_next;
                this.order_greifer_next == null;

                this.ric.send("greifarm","serial","GO");
                this.statusGreifer = isRunningNext;
            }

        } else if (message == "NEXT") {
            this.statusBefueller = isWaitingNext;

            this.ric.send("befueller","serial","GO");
            this.statusBefueller = isRunningNext;
        }
    }
    
}

let mfc = new MFC();
let ric = new AccessNode.RobotikInterConnect("localhost",5678, "w", "mfc", (data)=>{mfc.handle(data)});
mfc.setRic(ric);