import { asynchandler } from "../utils/asynchandler.js";
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/APiresponse.js'
import jwt from 'jsonwebtoken'

// we might have to generate access token and refrsh token again
// therefore maded function for that
const generateAccessAndRefreshTokens = async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken =  user.generateAccessToken() // predefind methods
        const refreshToken = user.generateRefreshToken()

        user.refreshToken=refreshToken //storing refresh token in database
        await user.save({validateBeforeSave: false}) // ensuring that database doesnot check for all the other required fields

        return {accessToken,refreshToken}

    }catch(error){
        throw new ApiError(500,"something went wrong while generating refresh and access token")
    }
}

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

    const existedUser =await User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409,"User with same email or username already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path
    }


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

const loginUser = asynchandler(async (req,res)=>{
    // take credentials -> req body
    //check weather format of credentials are correct or not
    //check weather user is already registered or not
    //if registered, check credentials are correct or not
    //access and refresh token
    //send cookies
    //if correct allow login

    const {email,username,password} = req.body // destructured and stored user credentials

    if(!username && !email){
        throw new ApiError(400,"username or email is required !")
    } //check wheather user has provided username or email

    const user = await User.findOne({
        $or:[{email},{username}]
    }) // checking if username is given or email is given

    if(!user){
        throw new ApiError(404,"User does not exist")
    } // if user doesnot register

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"password is incorrect")
    } // checking is given password is correct

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id);// generating access token and refresh token and storing them in variable

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //sending cookies
    const options = {
        httpOnly:true,
        secure:true
    } // now cookies can only be modified by server only not via frontend

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            user:loggedInUser,accessToken,refreshToken
        }, //this whole json block is data which we mentioned in utils/ApiResponse.js
        "User logged in successfully"
    ) //here we are sending refresh token and access token in json again even we sent them in cookie bcz user can save them if he want explicitly
    )

})

//log out 
//clear cookies
// also delete refresh token as user loggs out 
const logoutUser = asynchandler(async(req,res)=>{
    // we will use middleware to perform a mid action
    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true  
        }
    )
    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie('refreshToken',options)
    .json(new ApiResponse(200,{},"User logged Out"))
})

// endopoint for refreshing accesstoken
const refreshAccessToken = asynchandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request")
    }
    

    //now we want to verify incoming token for that we use our auth middleware to get decoded token data
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newrefreshToken}=await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newrefreshToken,options)
        .json(
            new ApiResponse(200,
                {accessToken, refreshToken:newrefreshToken},
                "Access token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }

})

const changeCurrentPassword = asynchandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body
    // now we have to find user
    //since user able to change password therefore he is logged in
    // we can get from auth middleware req.user
    const user = await User.findById(req.user?._id)
    const passwordCheck = user.isPasswordCorrect(oldPassword) //here user gives it old password

    if(!passwordCheck){
        throw new ApiError(401,"Invalid password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))

})

const getCurrentUser = asynchandler(async(req,res)=>{
    return res.status(200)
    .json(new ApiResponse(200,req.user,"Current user fetched successfully"))
})

//for other details updation
const updateAccountDetails = asynchandler(async(req,res) =>{
   const {fullname,email} = req.body

   if(!fullname && !email){
    throw new ApiError(400,"All fields are required")
   }

   const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
        $set:{
            fullname,
            email
        }
    },
    {new:true} // this returns new data after updation 
    ).select("-password")
    return res.status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))
})

const updateUserAvatar = asynchandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing");
    }

    // todo -> delete old avatar
    
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200,user,"Avatar Updated Successfully")
    )
})

const updateUserCoverImage = asynchandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"CoverImage file is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on coverImage");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password")

     return res.status(200)
    .json(
        new ApiResponse(200,user,"Cover Image Updated Successfully")
    )
})



export {registerUser,loginUser,logoutUser,refreshAccessToken,changeCurrentPassword,getCurrentUser,updateAccountDetails,updateUserAvatar,updateUserCoverImage}