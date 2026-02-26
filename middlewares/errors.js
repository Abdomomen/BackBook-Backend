const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // سجل الخطأ للمبرمج في الكونسول
    console.error(`[Error] ${err.name}: ${err.message}`);

    // 1. خطأ ID غير صحيح في MongoDB
    if (err.name === "CastError") {
        error.message = `Resource not found`;
        error.statusCode = 404;
    }

    // 2. خطأ تكرار البيانات (Duplicate Key)
    if (err.code === 11000) {
        error.message = "Duplicate field value entered";
        error.statusCode = 400;
    }

    // 3. خطأ التحقق من الحقول (Validation)
    if (err.name === "ValidationError") {
        error.message = Object.values(err.errors).map((val) => val.message).join(", ");
        error.statusCode = 400;
    }

    // 4. إضافة معالجة أخطاء الـ JWT (مهم جداً لنظامنا)
    if (err.name === "TokenExpiredError") {
        error.message = "Token expired";
        error.statusCode = 401;
        error.errorCode = "TOKEN_EXPIRED"; // كود إضافي للفرونت إند
    }

    if (err.name === "JsonWebTokenError") {
        error.message = "Invalid token";
        error.statusCode = 401;
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Server Error",
        // أضف الـ stack فقط في مرحلة التطوير
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        code: error.errorCode // ليتمكن الفرونت إند من قراءته
    });
};

const asyncWrapper = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { errorHandler, asyncWrapper };
