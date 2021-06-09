const express = require('express');
const { Pool, Client } = require('pg');
const bodyParser = require('body-parser');
//const dotenv = require('dotenv');
//dotenv.config();

const DBHOST='localhost';
const DBPORT=5432;
const DBUSER='postgres';
const DBPASS='root';
const DBNAME='ruby_dev';

const SERVER_PORT=3500;

function getPgClient(){
    console.log("getPgClient");
    let db = new Client({
        host: DBHOST,
        port: DBPORT,
        user: DBUSER,
        database: DBNAME,
        password: DBPASS,
    });
    return db;
}

var app = express();
app.use(bodyParser.json());

app.get('/api/customers/:registration_key',async function(req,res){
    let resToSend="";
    let resStatus=200;
    res.append('Content-Type','application/json');
    try{
        let license_key=req.params["registration_key"];
        console.log("license_key="+license_key);
        let db=await getPgClient();
        await db.connect();
        let data=await db.query("SELECT id FROM accounts WHERE license_key=$1",[license_key]);
        let resData={customer:{config:{}}};
        if (data.rows.length>0){
            let account=data.rows[0];
            console.log("Account found with id: "+account.id);
            data=await db.query("SELECT uninstall,verbosity,offline,super,polling,report_agent_errors,url,license_key,parallel_sub_task_count,file_hash_refresh_interval FROM settings WHERE account_id=$1",[account.id]);
            if (data.rows.length>0){
                let config=data.rows[0];
                config.ws_url="wss://ws.app.rocketcyber.com";
                config.default_start="RocketCyber.lua";
                
                resData.customer.config=config;
            }
        }else{
            resStatus=404;
        }
        resToSend=JSON.stringify(resData);
        db.end();
    }catch(e){
        console.log("Exception: "+e.message);
        resToSend="Exception: "+e.message;
        resStatus=500;
    }
    res.status(resStatus);
    res.send(resToSend);
});

app.put('/api/customers/:registration_key/devices/:device_id',async function(req,res){
    let resToSend="";
    let resStatus=200;
    let body=req.body;
    console.log("Body: "+JSON.stringify(body));
    res.append('Content-Type','application/json');
    try{
        let license_key=req.params["registration_key"];
        let device_id=req.params["device_id"];
        console.log("license_key="+license_key+",device_id="+device_id);
        let db=await getPgClient();
        await db.connect();
        let data=await db.query("SELECT id FROM devices WHERE id=$1 OR uuid=$1",[device_id]);
        let resData={};
        let bKeys=Object.keys(body);
        if (data.rows.length>0){
            let device=data.rows[0];
            let query="UPDATE devices SET updated_at=NOW()::timestamp,";
            let vals=[];
            let maxParam=1;
            for (let x=0;x<bKeys.length;x++){
                query+=bKeys[x]+"=$"+(x+1);
                vals.push(body[bKeys[x]]);
                if (x<(bKeys.length-1)){
                    query+=",";
                }
                maxParam=(x+1);
            }
            query+=" WHERE id=$"+(maxParam+1);
            vals.push(device.id);
            console.log(query);
            await db.query(query,vals);
            console.log("Record updated");
        }else{
            let query="INSERT INTO devices(id,uuid,created_at,updated_at,";
            let insQuery=" VALUES($1,$2,NOW()::timestamp,NOW()::timestamp,";
            let vals=[];
            vals.push(device_id);
            vals.push(device_id);
            for (let x=0;x<bKeys.length;x++){
                query+=bKeys[x];
                insQuery+="$"+(x+3);
                vals.push(body[bKeys[x]]);
                if (x<(bKeys.length-1)){
                    query+=",";
                    insQuery+=",";
                }
            }
            query+=")";
            insQuery+=")";
            console.log(query);
            console.log(insQuery);
            query+=insQuery;
            await db.query(query,vals);
            console.log("Record inserted");
        }
        resStatus=201;
        resToSend=JSON.stringify(resData);
        db.end();
    }catch(e){
        console.log("Exception: "+e.message);
        resToSend="Exception: "+e.message;
        resStatus=500;
    }
    res.status(resStatus);
    res.send(resToSend);
});

app.get('/',async function(req, res){
   res.send("Hello world!");
});

console.log("Listening on "+SERVER_PORT);
app.listen(SERVER_PORT);