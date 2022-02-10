const session = require("express-session");
let RedisStore = require("connect-redis")(session);
const { createClient } = require("redis");
let redisClient = createClient({ legacyMode: true });
redisClient.connect().catch(console.error);

module.exports = session({
  secret: "keybord cat", // 加盐
  resave: false,
  saveUninitialized: true,
  cookie: {
    // 单位毫秒，1小时后，用户的登陆状态会过期
    maxAge: 60000 * 60,
  },
  // 存储到redis中，防止服务器重启丢失用户登录信息
  store: new RedisStore({ client: redisClient }),
});
