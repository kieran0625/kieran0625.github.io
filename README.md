# Kieran 的个人网站

- 个人主页：https://kieran0625.github.io/
- 工程伦理习题库：https://kieran0625.github.io/buaa-engineering-ethics/

首页展示个人介绍、公开项目和学习资料；课程类开源仓库标注为 Fork 学习资料。

## 目录与更新

- index.html：个人主页内容。
- assets/home.css：个人主页样式。
- buaa-engineering-ethics/：工程伦理题库、源码与原始资料。

更新个人介绍时编辑根目录 index.html。更新题库时进入子目录后构建：

    cd buaa-engineering-ethics
    node build-site.js
    node tests/verify-site.js

题库构建只更新子目录，不会覆盖个人主页。提交 main 分支后 GitHub Pages 自动发布，发布目录为根目录。

题库继续使用同一个域名和本地存储键；同一浏览器中原先的错题、收藏和练习记录可继续使用。不同浏览器或设备之间不自动同步。
