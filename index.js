const express = require("express");
const app = express();
const path = require("path");
const config = require("dotenv").config();
const dotenvExpand = require("dotenv-expand");
dotenvExpand.expand(config);

// 启动web服务
app.listen(process.env.APP_PORT, () => {
  console.log(
    `服务已启动，${process.env.APP_PORT}，${new Date().toLocaleString()}`
  );
});
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
  console.log(req.method + req.path, "经过all中间件");
  // 直接响应预检请求（注意OPTIONS是大写的）
  if (req.method === "OPTIONS") {
    return res.end();
  }
  // 交给下一个中间件处理程序
  next();
});
// 设置静态资源文件路径
app.use(express.static(path.resolve(__dirname, "./public")));
app.use(express.static(path.resolve(__dirname, "./uploads")));
// express.json负责解析json数据，express.urlencoded负责解析key=value&key=value序列化数据
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// -------------文件上传--------------------
const multer = require("multer");
let upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./uploads/");
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  }),
});
app.post("/uploadImg", upload.single("upload"), (req, res, next) => {
  console.log(req.file, "file");
  const { originalname } = req.file;
  const result = {
    fileName: originalname,
    uploaded: 1,
    url: "./" + originalname,
  };
  res.json(result);
});
// -------------日志--------------------
const logs = require("./middleware/logger");
app.use(logs);
// -------------session--------------------
const redisSession = require("./middleware/session");
app.use(redisSession);
// ---------------模板引擎------------------------
// 设置html文件所在目录
app.set("views", path.resolve(__dirname, "./views"));
// 设置html文件解析引擎
app.engine("html", require("ejs").__express);
// 设置引擎
app.set("view engine", "html");
// 前端查询文章页面
app.get("/articleList", (req, res) => {
  res.render("articleList");
});
// 前端提交文章页面
app.get("/insertArticle", (req, res) => {
  res.render("insertArticle");
});
// ---------------注册路由------------------------
// 配置注册路由（第一个参数，类似于命名空间，用户请求匹配到相应路径，进入相应的路由模块（或者叫路由中间件，也是三参函数））
// const member = require("./routers/member.router");
// const sku = require("./routers/sku.router");
// const LoginAndLogout = require("./routers/LoginAndLogout.router");
// app.use("/mem", member);
// app.use("/sku", sku);
// app.use("/log", LoginAndLogout);
// ---------------restful接口------------------------
const query = require("./config/query");
// 获取文章列表接口
app.get("/getlist", async (req, res, next) => {
  const r = await query(`select content from test.article;`);
  console.log(r, "rrrr");
  res.send(r);
});
// 提交文章接口
app.post("/insertArticle", async (req, res, next) => {
  let { editorData, category_id, article_title } = req.body;
  // 把从富文本中获取的内容的单引号转义成实体字符，防止mysql报错
  editorData = editorData.replace(/\'/g, "&#39;");
  // console.log(category_id, "category_id");
  // console.log(article_title, "article_title");
  // console.log(editorData, "editorData");
  const r = await query(
    `insert into article (content,category_id,title) values('${editorData}',${category_id},'${article_title}');`
  );
  // console.log(r, "rrrr");
  if (r.affectedRows === 1) {
    res.send({ status: 1, message: "提交文章成功！" });
  } else {
    res.send({ status: 0, message: "提交文章失败！" });
  }
});
// -------------错误处理----------------------
// 错误及404处理，放在最底部兜底
app.use((req, res, next) => {
  res.status(404).json({ error: "404 - Not Found!未找到兜底", path: req.path });
});
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err,
    level: `app错误拦截兜底${Date.now()}`,
    path: req.path,
  });
});
