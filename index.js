const express = require("express");
const app = express();
const path = require("path");
// 注入.env环境变量
const config = require("dotenv").config();
require("dotenv-expand")(config);
const CustomError = require("./config/CustomError");

// 启动web服务
app.listen(process.env.APP_PORT, () => {
  console.log(
    `服务已启动，${process.env.APP_PORT}，${new Date().toLocaleString()}`
  );
});

// 配置允许跨域
// 允许跨域的白名单
const allowDomains = ["http://localhost:3000", "http://localhost:5000"];
app.all("*", (req, res, next) => {
  // 动态设置，支持多域名跨域访问服务器资源
  const allowDomain = req.get("origin");
  if (allowDomains.includes(allowDomain)) {
    // 接受此域的请求,*代表接受任何域的请求
    res.header("Access-Control-Allow-Origin", allowDomain);
    // 允许跨域时携带cookie（前后端都要配置Credentials参数为true，后端为true时，Access-Control-Allow-Origin必须指定某个具体域，不可以是*）
    res.header("Access-Control-Allow-Credentials", true);
  } else {
    // 接受此域的请求,*代表接受任何域的请求
    res.header("Access-Control-Allow-Origin", "*");
  }
  // 禁止浏览器缓存响应
  res.header("cache-control", "no-cache");
  res.header("pragma", "no-cache");
  // 接受任何方式的请求
  res.header("Access-Control-Allow-Methods", "*");
  // 允许请求头中携带xx字段
  res.header("Access-Control-Allow-Headers", "content-type,x-auto-token");
  // 设置预检请求的缓存时间（即针对同一个复杂请求（非简单请求），xx时间内不必再次发送预检请求(单位：s，比如86400，即24小时)
  // res.header("Access-Control-Max-Age", 30);
  console.log(req.method + req.path, "经过all");
  // 直接放行预检请求（注意OPTIONS是大写的）
  if (req.method === "OPTIONS") {
    return res.end();
  }
  // 交给下一个处理程序
  next();
});
// -------------一堆全局中间件-----------------
// 设置静态资源文件路径，稳妥一些最好传入绝对路径
app.use(express.static(path.resolve(__dirname, "./public")));
// express.json负责解析json数据，express.urlencoded负责解析key=value&key=value序列化数据
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// -------------日志相关--------------------
const morgan = require("morgan");
const FileStreamRotator = require("file-stream-rotator");
// 配置输出日志（加入日志切割功能）
const accessLogStream = FileStreamRotator.getStream({
  filename: path.resolve(__dirname, "./logs/access-%DATE%.log"),
  frequency: "daily", // 频率：每天生成一份
  verbose: false,
  date_format: "YYYYMMDD",
});
// 自定义日志展示字段
// morgan.token("params", function (req, res) {
//   if (req.method === "GET") {
//     return JSON.stringify(req.query) || "-";
//   }
//   if (req.method === "POST") {
//     return JSON.stringify(req.body) || "-";
//   }
//   return null;
// });
// 日志加入自定义字段
// app.use(
//   morgan(
//     (tokens, req, res) => {
//       return [
//         tokens.method(req, res),
//         tokens.url(req, res),
//         tokens.status(req, res),
//         // tokens.res(req, res, "content-length"),
//         // "byte",
//         tokens["response-time"](req, res),
//         "ms",
//         tokens["params"](req, res)
//       ].join(" ");
//     },
//     { stream: accessLogStream }
//   )
// );
app.use(morgan("combined", { stream: accessLogStream }));
// -------------session相关--------------------
const session = require("express-session");
// 把session持久化到redis中，便于以后session分布式共享和防止服务器重启后session丢失
const redis = require("redis");
const RedisClient = redis.createClient();
const RedisStore = require("connect-redis")(session);
// 配置session及redis
app.use(
  session({
    secret: "keybord cat",// 加盐
    resave: false,
    saveUninitialized: true,
    cookie: {
      // 单位毫秒，1小时后，用户的登陆状态会过期
      maxAge: 60000 * 60,
    },
    // 存储到redis中，防止服务器重启丢失用户登录信息
    store: new RedisStore({ client: RedisClient }),
  })
);
app.use((req, res, next) => {
  if (!req.session) {
    return next(new CustomError("wode", "是是自定义错误"));
  }
  next();
});
// ---------------注册路由------------------------
// 配置注册路由（第一个参数，类似于命名空间，用户请求匹配到相应路径，进入相应的路由模块（或者叫路由中间件，也是三参函数））
// const member = require("./routers/member.router");
// const sku = require("./routers/sku.router");
// const LoginAndLogout = require("./routers/LoginAndLogout.router");
// app.use("/mem", member);
// app.use("/sku", sku);
// app.use("/log", LoginAndLogout);
// app.get("/", (req, res) => {
//   res.send(`<h1><a href="./src.zip" download="asset">asset</a></h1>`);
// });
// -------------错误处理----------------------
// 错误及404处理，放在最底部兜底
// 区别错误处理中间件或普通中间件，就看有没有err形参
app.use((req, res, next) => {
  res.status(404).json({ error: "404 - Not Found!兜底", path: req.path });
});
app.use((err, req, res, next) => {
  res
    .status(500)
    .json({ error: err, level: `app兜底${Date.now()}`, path: req.path });
});
