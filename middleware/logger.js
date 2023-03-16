const path = require("path");
const morgan = require("morgan");
const FileStreamRotator = require("file-stream-rotator");
// 配置输出日志（加入日志切割功能）
const accessLogStream = FileStreamRotator.getStream({
  filename: path.resolve(__dirname, "../logs/access-%DATE%.log"),
  frequency: "daily", // 频率：每天生成一份
  date_format: "YYYYMMDD",
});

module.exports = morgan("combined", { stream: accessLogStream });
