const express = require("express");
const path = require("path");
const config = require("dotenv").config();
const dotenvExpand = require("dotenv-expand");
dotenvExpand.expand(config);
const app = express();
const uploader = require("./middleware/uploader");
const logger = require("./middleware/logger");
const session = require("./middleware/session");
const createError = require("http-errors");
const query = require("./utils/query");

// 设置静态资源文件路径
app.use(express.static(path.resolve(__dirname, "./public")));
app.use(express.static(path.resolve(__dirname, "./uploads")));
// 处理跨域
app.use((req, res, next) => {
  console.log(`${req.method}, ${req.path}, ${Date.now()}`);
  // 动态设置，支持多域名跨域访问服务器资源
  const reqOrigin = req.get("origin");
  if (process.env.ALLOW_DOMAINS.includes(reqOrigin)) {
    // 想要跨域时携带cookie（前后端都要配置Credentials参数为true，后端为true时，Access-Control-Allow-Origin必须指定某个具体域，不可以是*）
    res.header("Access-Control-Allow-Credentials", true);
    res.header("Access-Control-Allow-Origin", reqOrigin);
  } else {
    // *代表接受任何域的请求
    res.header("Access-Control-Allow-Origin", "*");
  }
  // 接受任何方式的请求
  res.header("Access-Control-Allow-Methods", "*");
  // 允许请求头中携带xxx字段
  res.header("Access-Control-Allow-Headers", "content-type, x-auth-token");
  // 设置预检请求的缓存时间（即针对同一个复杂请求（非简单请求），xx时间内不必再次发送预检请求(单位：s；比如86400，即24小时)
  res.header("Access-Control-Max-Age", 30);
  // 拦截预检请求（注意OPTIONS是大写的），并直接响应结束
  if (req.method === "OPTIONS") {
    return res.end();
  }
  // 交给下一个中间件处理程序
  next();
});
// 日志
app.use(logger);
// session
app.use(session);
// 模板引擎
app.set("views", path.resolve(__dirname, "./views"));
app.engine(".ejs", require("ejs").__express);
app.set("view engine", ".ejs");
// express.json负责解析请求体中的json数据
// express.urlencoded负责解析请求体中的类似key = value & key=value的序列化数据
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // true：使用qs解析器，可以递归解析
// -------------登录/退出/鉴权----------------------------
function isAuth(req, res, next) {
  res.locals.user = null;
  // 不需要鉴权的接口或页面
  const whiteList = ["/loginPage", "/login", "/logout"];
  if (whiteList.includes(req.path)) {
    next();
    return; // 需要写，不然会执行后面的代码
  }
  const { islogin, user } = req.session;
  if (islogin) {
    res.locals.user = user;
    next();
  } else {
    res.redirect("/loginPage");
  }
}
app.use(isAuth);
// 登陆页面
app.get("/loginPage", (req, res) => {
  res.render("loginPage");
});
// 登录
app.post("/login", async (req, res) => {
  const { username, userpassword } = req.body;
  const sql = `SELECT user_password FROM test.user where user_name='${username}';`;
  const result = await query(sql);
  if (result[0]?.user_password === userpassword) {
    // 登陆成功，录入session
    req.session.islogin = true;
    req.session.user = username;
    // 并回到来源页
    // TODO 如何携带来源页的path？
    res.redirect("/");
  } else {
    // 继续登录页
    res.redirect("/loginPage");
  }
});
// 退出
app.get("/logout", (req, res) => {
  req.session.islogin = false;
  req.session.user = null;
  res.redirect("/loginPage");
});
// ---------------后台管理页面------------------------
// 后台管理首页
app.get("/", (req, res) => {
  res.redirect("/articleList");
});
// 后台管理测试上传文件页面
app.get("/testUpload", (req, res) => {
  res.render("testUploadPage");
});
// 后台管理查询文章列表页面
app.get("/articleList", (req, res) => {
  res.render("articleListPage");
});
// 后台管理编辑文章页面
app.get("/edit", (req, res) => {
  res.render("editPage");
});
// 后台管理提交文章页面
app.get("/insertArticle", (req, res) => {
  res.render("insertArticlePage");
});
// 注册路由模块
// 第一个参数，类似于命名空间，用户请求匹配到相应路径，进入相应的路由模块（或者叫路由中间件，也是三参函数）
// const member = require("./routers/member.router");
// const sku = require("./routers/sku.router");
// const LoginAndLogout = require("./routers/LoginAndLogout.router");
// app.use("/mem", member);
// app.use("/sku", sku);
// app.use("/log", LoginAndLogout);
// ---------------RESTful接口------------------------
// 文件上传
app.post("/uploadImage", uploader.single("myFile"), (req, res) => {
  // console.log(req.file, "file类数据");
  // console.log(req.body, "非file类数据");
  const { originalname } = req.file;
  const result = {
    fileName: originalname,
    uploaded: 1,
    url: "./" + originalname,
  };
  res.json(result);
});
// 提交文章
app.post("/insertArticle", async (req, res, next) => {
  let { editorData, category_id, article_title } = req.body;
  // 注意：把从富文本中获取的内容的单引号转义成实体字符，防止mysql报错
  editorData = editorData.replace(/\'/g, "&#39;");
  // console.log(category_id, "category_id");
  // console.log(article_title, "article_title");
  // console.log(editorData, "editorData");
  const r = await query(
    `insert into article (article_content,category_id,article_title) values('${editorData}',${category_id},'${article_title}');`
  );
  // console.log(r, "insert");
  if (r.affectedRows === 1) {
    res.send({ status: 1, message: "提交文章成功！" });
  } else {
    res.send({ status: 0, message: "提交文章失败！" });
  }
});
// 逻辑删除文章
app.post("/delArticle", async (req, res) => {
  let { article_id, article_delflag } = req.body;
  // console.log(req.body)
  // 逻辑删
  const r = await query(
    `update article set article_delflag=${article_delflag} where article_id=${article_id};`
  );
  // 物理删
  // const r = await query(`DELETE FROM article WHERE article_id=${article_id}';`);
  // console.log(r, "update");
  if (r.affectedRows === 1) {
    res.send({ status: 1, message: "删除文章成功！" });
  } else {
    res.send({ status: 0, message: "删除文章失败！" });
  }
});
// 获取文章分类
app.get("/getArticleCategory", async (req, res) => {
  const r = await query(`select * from category;`);
  // console.log(r, "select");
  res.send(r);
});
// 获取文章列表
app.post("/getArticleList", async (req, res) => {
  // 先查文章
  let r;
  if (req.body.category_id) {
    // 根据分类查
    r = await query(
      `select * from article where article_delflag=0 and category_id=${req.body.category_id} ORDER BY article_update_time DESC;`
    );
  } else if (req.body.article_id) {
    // 根据id查
    r = await query(
      `select * from article where article_delflag=0 and article_id=${req.body.article_id} ORDER BY article_update_time DESC;`
    );
  } else {
    // 全查
    r = await query(`select * from article ORDER BY article_update_time DESC;`);
  }
  // 然后并发查询对应文章的文章分类和评论列表
  await Promise.all(
    r.map(async (item) => {
      let data = await query(
        `select category_name from category where category_id=${item.category_id};`
      );
      let data2 = await query(
        `select * from blog_comment where article_id=${item.article_id};`
      );
      item.commentList = data2;
      item.category_name = data[0].category_name;
    })
  );
  // console.log(r, "select");
  res.send(r);
});
// 获取评论列表
app.get("/getfreshCommentList", async (req, res) => {
  // 左连接查询评论表和文章表
  const r = await query(
    `select user_id,category_id,blog_comment_update_time,blog_comment_pid,blog_comment_id,blog_comment_create_time,blog_comment_content,article_title,article.article_id from blog_comment left join article on blog_comment.article_id=article.article_id ORDER BY blog_comment_update_time DESC;`
  );
  // console.log(r, "select");
  res.send(r);
});
// ----------------错误处理------------------------
// 捕获404并转发到错误处理程序
app.use((req, res, next) => {
  next(createError(404));
});
// 错误处理程序
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = process.env.ENV === "DEV" ? err : {};
  // 设置响应码并渲染错误处理页面
  res.status(err.status || 500);
  res.render("error");
});
// -------------启动web服务------------------
app.listen(process.env.APP_PORT, () => {
  console.log(
    `服务已启动 / ${process.env.APP_PORT} / ${new Date().toLocaleString()}`
  );
});
