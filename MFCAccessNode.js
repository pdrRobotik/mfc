var WebSocket = require('ws').WebSocket

class RobotikInterConnect {

    constructor(addr, port=5678, mode="w", name=null, callback=null) {
        this.addr = addr;
        this.port = port;
        this.mode = mode;

        if (name == null || name == undefined) {
            this.name = ((Date.now()/1000)|0)%10000;
        } else {
            this.name = name;
        }

        if (callback == null || callback == undefined) {
            this.callback = (data) => {
                console.log(data);
            };
        } else {
            this.callback = callback;
        }


        
        this.websocket = new WebSocket("ws://"+this.addr+":"+this.port);

        this.websocket.onopen = this.init_connections.bind(this);
        this.websocket.onmessage = this.on_message_recieved.bind(this);
        this.websocket.onclose = this.close_connection.bind(this);
        

        this.testOutsiudeASCII = new RegExp("[^ -~]");
        this.testHasForbiddenChar = new RegExp("[:@>\n]");  
    }

    init_connections() {
        this.websocket.send(this.name+":"+this.mode);
    }

    close_connection() {
        console.error("Connection is closed...");
    }

    parse_message(msg_data) {
        let split_msg_data = msg_data.split(":");
        let header = split_msg_data[0];
        let message = split_msg_data[1].replace("\n","");

        let split_header = header.split(">");
        let origin_header = split_header[0];
        let target_header = split_header[1];

        let split_origin_header = origin_header.split("@");
        let origin = split_origin_header[0];
        let origingroup = split_origin_header[1];

        let split_target_header = target_header.split("@");
        let target = split_target_header[0];
        let targetgroup = split_target_header[1];
        
        return {
            message: message,
            target: target,
            targetgroup: targetgroup,
            origin: origin,
            origingroup: origingroup
        }
    }

    on_message_recieved(event) {
        if (this.mode == "w")
            this.callback(this.parse_message(event.data));
        else if (this.mode == "n")
            this.callback(event.data);
    }

    check(str,errFrom) {
        if (this.testOutsiudeASCII.test(str)) {
            throw errFrom+" string contains illegal Character (outside of allowed range): "+ this.testOutsiudeASCII.exec(str).toString()
        }

        if (this.testHasForbiddenChar.test(str)) {
            throw errFrom+" string contains illegal Character (forbidden, but inside range): "+ this.testHasForbiddenChar.exec(str).toString()
        }

        return true
    }

    send(target,targetgroup,message) {
        this.check(target, "Target");
        this.check(targetgroup, "TargetGroup");
        this.check(message,"Message");

        //console.log(target+"@"+targetgroup+":"+message);
        this.websocket.send(target+"@"+targetgroup+":"+message);
    }

    send_using_obj(obj) {
        this.send( obj.target, obj.targetgroup, obj.message );
    }
}

module.exports = { RobotikInterConnect };