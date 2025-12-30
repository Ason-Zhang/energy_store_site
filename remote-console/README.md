# Remote Console

本目录为**远程控制台（Remote Console）**的纯静态页面（HTML/CSS/JS），用于在浏览器端对“就地监控页面”的控制命令进行远程下发，并查看控制下发历史。

- 入口：`/remote/index.html`
- 登录：`/remote/login.html`

> 远程控制台页面由后端 Express 静态托管：`app.use('/remote', express.static(...))`

---

## 功能

- **登录与会话**：用户名/密码登录，Cookie Session 维持会话；未登录自动跳转登录页。
- **控制命令下发**：AGC / AVC / 手动功率 三种模式互斥，下发后写入数据库。
- **控制下发历史/日志**：展示最近 N 条下发记录（时间、操作者、命令概览）。
- **就地页面联动**：就地页面会展示“远端指令正在执行”标识（依据 `actor=remote` + 当前命令非 off）。

---

## 运行方式

### 1) 开发模式（推荐）

在项目根目录：

```bash
npm run dev:full
```

说明：

- 后端默认端口：`3001`
- 前端 Vite 默认端口：`5173`
- 远程控制台地址：
  - `http://localhost:3001/remote/`

### 2) 只运行后端

```bash
npm run server
```

然后访问：

- `http://localhost:3001/remote/`

---

## 登录与账号

远程控制台使用后端的 Session 登录。

- 登录接口：`POST /api/remote/login`
- 会话检测：`GET /api/remote/me`
- 退出：`POST /api/remote/logout`

账号密码通常通过环境变量配置（以 `server/index.ts` 为准）。

---

## 使用说明

1. 打开 `http://<host>:3001/remote/`
2. 未登录会跳转到 `login.html`
3. 登录成功后进入控制台首页
4. 选择模式（AGC / AVC / 手动 / OFF），填写参数
5. 点击“下发/应用”后：
   - 服务器持久化 `control_commands`
   - 写入日志表 `control_command_logs`
   - 就地页面侧边栏出现“远端指令正在执行”标识（命令启用时）
6. 在“下发历史”区域可以刷新查看最近记录

---

## 关键接口（Remote Console 会用到）

> 远端控制相关接口均为远端专用（需要登录）。

### 远端控制命令

- **获取当前控制命令**：`GET /api/remote/control-commands`
- **下发控制命令**：`POST /api/remote/control-commands`

请求体（示例）：

```json
{
  "agc": { "enabled": true, "targetPower": 300, "rampRate": 10, "deadband": 5 },
  "avc": { "enabled": false, "targetVoltage": 400, "voltageRange": { "min": 380, "max": 420 } },
  "manualPower": { "enabled": false, "targetPower": 0 }
}
```

### 下发日志

- **查询下发日志**：`GET /api/remote/control-command-logs?limit=30&offset=0`

返回（示例）：

```json
[
  {
    "id": 1,
    "ts": 1730000000000,
    "actor": "remote",
    "username": "admin",
    "ip": "127.0.0.1",
    "commands": {
      "agc": { "enabled": true, "targetPower": 300 },
      "avc": { "enabled": false },
      "manualPower": { "enabled": false }
    }
  }
]
```

### 就地页面显示用（无需登录）

- **获取控制命令状态元数据**：`GET /api/control-commands/status`
  - 返回：`{ ts, actor, username }`

---

## 目录结构

- `index.html`：远程控制台首页
- `styles.css`：首页样式
- `app.js`：首页逻辑（轮询数据、下发命令、渲染日志、登录态校验）
- `login.html`：登录页
- `login.css`：登录页样式
- `login.js`：登录逻辑
- `README.md`：本说明

---

## 常见问题

### 1) 页面一直显示 NO API / 离线

- 确认后端是否启动：`npm run server` 或 `npm run dev:full`
- 确认访问地址是否正确：`http://localhost:3001/remote/`

### 2) 一直跳回登录页

- 账号密码不匹配或会话失效
- 检查后端登录接口是否返回 200
- 如果跨域访问，需确保 Cookie/代理配置符合实际部署方式

---

## 安全提示

远程控制台用于“下发控制命令”。生产部署时建议：

- 使用 HTTPS
- 将远端接口放在内网或 VPN 之后
- 定期更换账号密码
- 根据需要对登录做限流/失败次数限制
