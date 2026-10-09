# Kieran 的学术主页

在线访问：https://kieran0625.github.io/

参考 [Zhihao Zhang 的个人主页](https://pridezzh.github.io/#about) 的视觉结构，使用暖白背景、蓝金配色、简介与头像首屏、编号栏目和卡片式内容。页面代码独立编写，个人资料仅使用 Kieran 已有的公开信息。

- 中英文切换，默认中文。
- 浅色 / 深色主题，首次跟随系统；主题与语言偏好保存在浏览器中。
- 深蓝色几何 K 标志，导航与浏览器图标使用同一 SVG。
- 支持手机、桌面、键盘导航和打印；禁用 JavaScript 仍可阅读完整中文内容。

## 维护

- `index.html`：个人介绍、研究方向、项目、学习资源和联系链接。
- `assets/home.css`：视觉样式、响应式布局、主题与打印样式。
- `assets/home.js`：语言和主题切换。
- `assets/profile.png`：公开 GitHub 头像，可替换为个人照片。
- `assets/favicon.svg`：现代简约 K 标志。

文本的中英文分别写在 `data-zh` 与 `data-en` 中；编辑时也同步更新元素内的默认中文文本。主题和语言仅使用 `kieran-homepage-*` 存储键，不影响题库的练习记录。

直接提交到 `main`，GitHub Pages 从根目录发布，无需构建。可通过 `python3 -m http.server 8000` 在本地预览。

学校、教育经历、论文、邮箱与学术链接待取得本人确认的资料后添加。Fork 课程保留标注。

工程伦理习题库由 [buaa-engineering-ethics](https://github.com/kieran0625/buaa-engineering-ethics) 独立维护，访问地址仍为 https://kieran0625.github.io/buaa-engineering-ethics/。
