
const { client } = require('../Utils/redisClient');
const { ErrorResponse, validateInput } = require("../Utils/validateInput");
const asyncHandler = require('../MiddleWares/asyncHandler')
const User = require('../Models/UserModel')


const { Op } = require("sequelize");

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const img = req.file.path; 
    
    const validationErrors = validateInput({ name, email, password, role });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Invalid input data",
        details: validationErrors,
      });
    }

    
    const existingUser = await User.findOne({
      where: { email },
      attributes: ["id"], 
    });

    if (existingUser) {
      return res.status(400).json({
        error: "User already exists",
        message: "A user with this email already exists in the database.",
      });
    }

   
    const newUser = await User.create({
      name: name || null,
      email: email || null,
      password: password || null,
      role: role || null,
      img: img || null,
    });

   
    const cacheKey = `user:${email}`;
    client.setEx(cacheKey, 3600, JSON.stringify({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      img: newUser.img,
    }));

   
    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        img: newUser.img,
      },
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({
      error: "Server error",
      message: err.message,
    });
  }
};






exports.findByEmail = async (email) => {
    try {
      
      const cacheKey = `user:email:${email}`;
  
      
      const cachedUser = await new Promise((resolve) => {
        client.get(cacheKey, (err, data) => {
          if (err) {
            console.error("Error fetching from Redis:", err);
            return resolve(null);
          }
          resolve(data ? JSON.parse(data) : null);
        });
      });
  
      if (cachedUser) {
        console.log("User fetched from Redis cache");
        return cachedUser;
      }
  
      
      const user = await User.findOne({
        where: { email },
        attributes: ["id", "name", "email", "role", "img"], 
      });
  
      if (!user) {
        throw new Error("User not found");
      }
  
      
      client.setEx(cacheKey, 3600, JSON.stringify(user));
  
      return user;
    } catch (err) {
      console.error("Error in findByEmail:", err);
      throw new Error(err.message || "Server error");
    }
  };


   exports.getDeviceInfo = async (userId) => {
    try {
      
        const cacheKey = `user:${userId}:deviceInfo`;
  
      
      const cachedDeviceInfo = await new Promise((resolve) => {
        client.get(cacheKey, (err, data) => {
          if (err) {
            console.error("Error fetching from Redis:", err);
            return resolve(null);
          }
          resolve(data ? JSON.parse(data) : null);
        });
      });
  
      
      if (cachedDeviceInfo) {
        return cachedDeviceInfo;
      }
  
      
      const user = await User.findOne({
        attributes: ['device_id'], 
        where: { id: userId },
      });
  
      if (!user || !user.device_id) {
        return null; 
      }
  
      
      const deviceInfo = JSON.parse(user.device_id);
  
      
      client.setEx(cacheKey, 3600, JSON.stringify(deviceInfo)); 
  
      return deviceInfo;
    } catch (error) {
      console.error("Error in getDeviceInfo:", error);
      throw new ErrorResponse("Failed to fetch device information", 500);
    }
  };



  exports.updateDeviceInfo = async (userId, deviceInfo) => {
    try {
    
      const existingUser = await User.findOne({
        attributes: ['id'], 
        where: { id: userId }
      });
  
      if (!existingUser) {
        throw new ErrorResponse("User not found", 404);
      }
  
      
      const result = await User.update(
        { device_id: JSON.stringify(deviceInfo) },
        { where: { id: userId } } 
      );
  
      if (result[0] === 0) {
        throw new ErrorResponse("No changes made to device information", 400);
      }
  
      
      const cacheKey = `user:${userId}:deviceInfo`;
  
      
      client.setEx(cacheKey, 3600, JSON.stringify(deviceInfo)); 
  
      return { message: "Device information updated successfully" };
    } catch (error) {
      console.error("Error in updateDeviceInfo:", error);
      throw new ErrorResponse("Failed to update device information", 500);
    }
  };


exports.findById = async (id) => {
    try {
      const cacheKey = `user:${id}`;
  
      
      const cachedUser = await new Promise((resolve, reject) => {
        client.get(cacheKey, (err, data) => {
          if (err) return reject(err);
          resolve(data ? JSON.parse(data) : null);
        });
      });
  
      if (cachedUser) {
        return cachedUser; 
      }
  
      
      const user = await User.findOne({
        where: { id }, 
        attributes: ['id', 'name', 'email', 'role', 'img'] 
          });
  
      if (!user) {
        throw new ErrorResponse("User not found", 404);
      }
  
      
      client.setEx(cacheKey, 3600, JSON.stringify(user)); 
  
      return user;
    } catch (error) {
      console.error("Error in findById:", error);
      throw new ErrorResponse("Failed to fetch user data", 500);
    }
  };


  exports.deleteStudent = asyncHandler(async (req, res) => {
    const { id } = req.params;
  
    try {
      
        const cacheKey = `student:${id}`;
      const cachedStudent = await new Promise((resolve, reject) => {
        client.get(cacheKey, (err, data) => {
          if (err) return reject(err);
          resolve(data ? JSON.parse(data) : null);
        });
      });
  
      if (cachedStudent) {
       
        client.del(cacheKey); 
          }
  
      
      
      await Promise.all([
        
        CourseUser.destroy({
          where: { user_id: id },
          individualHooks: true 
        }),
  
       
        TeacherStudent.destroy({
          where: { student_id: id },
          individualHooks: true 
        }),
  
        
        Payment.destroy({
          where: { user_id: id },
          individualHooks: true 
        }),
  
        
        User.destroy({
          where: { id, role: 'student' }
        })
      ]);
  
      
      const deletedStudent = await User.findOne({
        where: { id, role: 'student' }
      });
  
      if (!deletedStudent) {
        return res.status(404).json({ message: "Student not found" });
      }
  
      
      client.del(cacheKey);
  
      return res.json({ message: "Student and related records deleted successfully" });
    } catch (error) {
      console.error("Error in deleting student:", error);
      return res.status(500).json({ message: "Error deleting student and related records" });
    }
  });




  exports.deleteAdmin = asyncHandler(async (req, res) => {
    const { id } = req.params;
  
    try {
      
        const cacheKey = `admin:${id}`;
      const cachedAdmin = await new Promise((resolve, reject) => {
        client.get(cacheKey, (err, data) => {
          if (err) return reject(err);
          resolve(data ? JSON.parse(data) : null);
        });
      });
  
      if (cachedAdmin) {
        
        client.del(cacheKey);
      }
  
      
      
      await Promise.all([
        
        CourseUser.destroy({
          where: { user_id: id },
          individualHooks: true 
        }),
  
        
        TeacherStudent.destroy({
          where: { student_id: id },
          individualHooks: true 
        }),
  
        
        Payment.destroy({
          where: { user_id: id },
          individualHooks: true 
        }),
  
        
        User.destroy({
          where: { id, role: 'admin' }
        })
      ]);
  
      
      const deletedAdmin = await User.findOne({
        where: { id, role: 'admin' }
      });
  
      if (!deletedAdmin) {
        return res.status(404).json({ message: "Admin not found" });
      }
  
      
      client.del(cacheKey);
  
      return res.json({ message: "Admin and related records deleted successfully" });
    } catch (error) {
      console.error("Error in deleting admin:", error);
      return res.status(500).json({ message: "Error deleting admin and related records" });
    }
  });





  exports.saveResetToken = async (userId, resetToken) => {
    try {
      if (!userId || !resetToken) {
        return Promise.reject(new Error('Invalid parameters'));
      }
  
          
      const result = await User.update(
        {
          reset_token: resetToken,
          reset_token_expiration: Sequelize.fn('DATE_ADD', Sequelize.fn('NOW'), Sequelize.literal('INTERVAL 1 HOUR'))
        },
        {
          where: { id: userId },
          
          limit: 1
        }
      );
  
      if (result[0] === 0) {
        throw new Error('User not found or no update performed');
      }
  
      
      return { message: 'Reset token saved successfully' };
    } catch (err) {
      console.error('Error saving reset token:', err);
      
      return { error: err.message || 'Error saving reset token' };
    }
  };



  exports.updatePassword = async (userId, hashedPassword) => {
    try {
      if (!userId || !hashedPassword) {
        throw new Error('User ID and password are required');
      }
  
      
      const [updatedRows] = await User.update(
        { password: hashedPassword }, 
        { where: { id: userId }, limit: 1 } 
      );
  
      
      if (updatedRows === 0) {
        return { error: 'User not found or password not updated' };
      }
  
      
      return { message: 'Password updated successfully' };
  
    } catch (err) {
      console.error('Error updating password:', err);
      
      return { error: err.message || 'Error updating password' };
    }
  };



  exports.clearResetToken = async (userId) => {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
  
     
      const [updatedRows] = await User.update(
        { reset_token: null, reset_token_expiration: null }, 
        { where: { id: userId }, limit: 1 } 
      );
  
      
      if (updatedRows === 0) {
        return { error: 'User not found or reset token not cleared' };
      }
  
    
      return { message: 'Reset token cleared successfully' };
  
    } catch (err) {
      console.error('Error clearing reset token:', err);
      
      return { error: err.message || 'Error clearing reset token' };
    }
  };









  getResetToken = async (userId) => {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const user = await User.findOne({
        attributes: ['reset_token', 'reset_token_expiration'], 
        where: { id: userId }, 
      });
  
      
      if (!user) {
        return { error: 'User not found' };
      }
  
      
      return { reset_token: user.reset_token, reset_token_expiration: user.reset_token_expiration };
  
    } catch (err) {
      console.error('Error fetching reset token:', err);
      
      return { error: err.message || 'Error fetching reset token' };
    }
  };




exports.getUsers = asyncHandler(async (req, res) => {
    try {
      
      const users = await User.findAll();
      res.status(200).json(users);
    } catch (err) {
      console.error('Error selecting data:', err.message);
      
      res.status(500).json({ message: "Error fetching users", error: err.message });
    }
  });


exports.getUserById = asyncHandler(async (req, res) => {
    const userId = req.params.id;
  
    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'name', 'email', 'role', 'img'], 
      });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      
      res.status(200).json(user);
    } catch (err) {
      console.error('Error fetching user:', err.message);
     
      res.status(500).json({ message: 'Error fetching user', error: err.message });
    }
  });







