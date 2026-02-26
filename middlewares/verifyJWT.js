const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    
    if (!authHeader) {
        const error = new Error("No token provided");
        error.statusCode = 401;
        return next(error);
    }

    const token = authHeader.split(' ')[1]; // طريقة أنظف من slice

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            // التعديل الجوهري هنا: التفريق بين أنواع الأخطاء
            if (err.name === 'TokenExpiredError') {
                const error = new Error("Token expired");
                error.statusCode = 401; 
                error.code = "TOKEN_EXPIRED"; // كود خاص ليفهمه الفرونت إند
                return next(error);
            } else {
                const error = new Error("Invalid token");
                error.statusCode = 403; // 403 Forbidden لأن التوكن فاسد
                return next(error);
            }
        }
        
        req.user = decoded;
        next();
    });
};

module.exports = verifyJWT;