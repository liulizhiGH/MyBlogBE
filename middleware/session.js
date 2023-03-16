const ExpressSession = require("express-session");
const Redis = require("ioredis");
const RedisStore = require("connect-redis").default;
const redis = new Redis({
  // port: 6379, // Redis port
  // host: "127.0.0.1", // Redis host
  // username: "default", // needs Redis >= 6
  // db: 0, // Defaults to 0
  password: process.env.ENV === "DEV" ? null : process.env.HOST_PASSWORD,
});

module.exports = ExpressSession({
  secret: "keybord cat", // 加盐
  resave: false,
  saveUninitialized: true,
  cookie: {
    // 单位毫秒，1小时后，用户的登陆状态会过期
    maxAge: 60000 * 60,
  },
  // 使用redis存储session
  // 好处：1.可以防止web服务器重启后丢失用户session
  // 好处：2.可以分布式共享用户session，用于服务端分布式架构中
  store: new RedisStore({ client: redis }),
});
