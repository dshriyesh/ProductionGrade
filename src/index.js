// require('dotenv').config()
import dotenv from 'dotenv'
import connectDB from './db/index.js'
import {app} from './app.js'

dotenv.config({
    path:'./.env'
})

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 5000 , ()=>{
        console.log(`server is running at port ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log("MONGODB connection failed ",err);
})











/*
creating iffe to connect db in index file it is a good approach , but it pollutes index file
import express from 'express'
const app = express()

;(async ()=>{
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",(error)=>{
            console.log('Error: ',error);
            throw err
            
        })

        app.listen(process.env.PORT,()=>{
            console.log(`app is listening on ${process.env.PORT}`);
        })
    }catch(error){
        console.log("error :",error);
        throw err
    }
} )()

*/