
# IPMS — 商品库存与人员管理（示例项目）

## 说明
这是一个基于 React + Vite + Tailwind + Firebase 的单页应用示例（单文件核心：`src/main.jsx`），实现：
- 商品（products）实时同步（Firestore）
- 人员（people）实时同步（Firestore）
- 模拟扫码输入：优先匹配商品条码，再匹配人员ID
- 新增商品/人员、更新库存、低库存高亮、复制 userId 等

## 使用方法（本地运行）
1. 安装依赖
```bash
cd ipms
npm install
```
2. 配置 Firebase
- 在 Firebase 控制台创建项目，启用 Firestore（Native mode）。
- 在项目设置中获取 `firebaseConfig`，替换 `src/main.jsx` 顶部的配置对象。
- 设置 Firestore 读写规则（开发阶段可临时设为 public，但生产请配置规则）：
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. 启动本地开发
```bash
npm run dev
# 打开 http://localhost:5173
```

## 部署到 Vercel / Netlify（示例）
### Vercel
1. 登录 Vercel，创建新项目，连接你的代码仓库（GitHub/GitLab）。
2. 构建命令：`npm run build`
   输出目录：`dist`
3. 在 Vercel 环境变量中设置 `FIREBASE_API_KEY` 等（如果你把配置放在 env 中）。
4. 部署完成后 Vercel 会提供一个公网 URL（例如 `https://your-project.vercel.app`）。

### Netlify
1. 登录 Netlify，Create site from Git。
2. Build command: `npm run build`，Publish directory: `dist`。
3. 部署后 Netlify 会给出公网 URL。

## 注意
- 本项目核心代码位于 `src/main.jsx`（单文件实现），便于阅读与定制。
- 部署前请务必配置 Firebase 安全规则与授权策略（不要在生产环境暴露全开放规则）。

