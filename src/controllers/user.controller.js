import { asynchandler } from "../utils/asynchandler.js";
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/APiresponse.js'


const registerUser = asynchandler(async (req,res)=>{
    // return res.status(200).json({
    //     message:"ok"
    // })

    //get user details from frontend based on user model
    //validation-not empty (format checking)
    //check if user already exist or not:useig username and email
    //check for images, check for avatar
    //upload them to cloudinary
    //from the response we get by uploading img on cloudinary check weather the image is uploaded
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation 
    // return res else send error message

    const { username,fullname,email,password } = req.body
    console.log('fullname',fullname);
    
    // if(fullname===""){
    //     throw new ApiError(400,"Fullname is required")
    // }

    if(
        [fullname,email,username,password].some((field)=> field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser = User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409,"User with same email or username already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath) 
    const coverimage= await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverimage:coverimage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(201,createdUser,"user registered successfully")
    )
})

export {registerUser}