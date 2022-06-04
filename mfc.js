AccessNode = require("./AccessNode.js");

const isWaiting = 0;
const isRunning = 1;
const isWaitingNext = 2;

class MFC {
    constructor() {
        this.bestell_queque = [];
        this.order_nummer = 0;
        this.statusGreifer = isWaiting;

        this.ric = null;
        this.handlersWebsocket = new Map();
        this.handlersSerial = new Map();

        this.register_websocket("bestell",this.handle_bestell.bind(this));

        this.register_serial("greifarm",this.handle_greifer.bind(this));

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

                this.statusGreifer = isRunning;
                this.ric.send("greifarm","serial",order.color);
            } else {
                let order = {id: this.order_nummer, color: message};
                this.ric.send("bestell","websocket", this.order_nummer);
                this.order_nummer++;

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

                this.statusGreifer = isRunning;
                this.ric.send("greifarm","serial",order.color);
            }
        } else if (message == "NEXT") {
            this.statusGreifer = isWaitingNext;

            //TestWeise Direkt
            this.ric.send("greifarm","serial","GO");
        }
    }

    
}

let mfc = new MFC();
let ric = new AccessNode.RobotikInterConnect("localhost",5678, "w", "mfc", (data)=>{mfc.handle(data)});
mfc.setRic(ric);