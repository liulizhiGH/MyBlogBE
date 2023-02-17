const ExpressSession = require("express-session");
const RedisStore = require("connect-redis")(ExpressSession);
const { createClient } = require("redis");
const redisClient = createClient({
  legacyMode: true,
  password: process.env.ENV === "DEV" ? null : process.env.HOST_PASSWORD,
});
redisClient.connect().catch(console.error);

module.exports = ExpressSession({
  secret: "keybord cat", // 加盐
  resave: false,
  saveUninitialized: true,
  cookie: {
    // 单位毫秒，1小时后，用户的登陆状态会过期
    maxAge: 60000 * 60,
  },
  // 存储到redis服务器中，防止web服务器重启后丢失用户登录信息
  store: new RedisStore({ client: redisClient }),
});
