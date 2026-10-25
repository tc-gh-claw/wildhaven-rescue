# GitHub Pages 發布設定

遊戲的公開網站檔案位於 `docs/`。`docs/index.html` 是已經打包的完整遊戲，沒有外部套件或伺服器需求；`.nojekyll` 讓 GitHub 直接提供靜態檔案。

GitHub 儲存庫的 Pages 設定應使用：

- Source：**Deploy from a branch**
- Branch：**main**
- Folder：**/docs**

儲存設定並等候 GitHub 完成發布後，以 Pages 設定頁顯示的正式網址為準。此檔案本身不代表網站已經上線。

後續修改 `src/`、`index.html` 或 `style.css` 時，執行 `npm run build` 會同時更新單檔遊戲及 `docs/index.html`。提交更新後，GitHub Pages 會重新發布。

參考：[GitHub 官方 Pages 發布來源說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
