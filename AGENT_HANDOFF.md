# Wildhaven：給下一個 agent 的部署交接

## 使用者要完成的事

把本專案上傳至使用者指定的 GitHub 帳戶 **terrycheang**，並啟用 GitHub Pages，讓其他人可以直接用公開網址遊玩。建議新儲存庫名稱為 **wildhaven-rescue**；此名稱尚未在遠端確認或建立。使用者已要求發布遊戲，不需要重新詢問是否要開始準備。

## 目前狀態

- 遊戲已完成，原始碼、依賴的本地副本、可直接開啟的單檔、Pages 網頁及測試程式均已附上。
- **尚未上傳 GitHub，也沒有已驗證的公開遊玩網址。** 先前因連接帳戶不符而未發布。
- 部署前確認實際 GitHub 登入及寫入權限屬於 `terrycheang`。不要使用其他帳戶代發，也不要把預期網址當成已上線網址。
- 本壓縮包沒有 Git 歷史、登入憑證或 `node_modules`。請在解壓後的 `wildhaven/` 資料夾內建立 Git 儲存庫。

## 專案內容

| 路徑 | 用途 |
| --- | --- |
| `docs/index.html` | 已打包的完整網頁遊戲，GitHub Pages 的正式入口 |
| `docs/.nojekyll` | 靜態發布標記；須一併提交 |
| `Play Wildhaven.html` | 可直接雙擊的離線版本，與 Pages 入口內容相同 |
| `index.html`、`style.css`、`src/` | 可繼續修改的開發原始碼 |
| `vendor/` | Three.js 0.186.1 本地檔案及 MIT 授權 |
| `server.mjs`、`Start Game.command`、`Start Game.bat` | 本地啟動方式 |
| `build.mjs` | 重新產生單檔和 `docs/` 發布檔案 |
| `tests/`、`TEST_REPORT.md` | 自動測試及已有測試結果 |
| `README.md`、`PUBLISHING.md` | 使用及發布說明 |
| `PREVIEW.png` | 遊戲主頁的實際畫面，供視覺參考 |
| `MANIFEST.sha256` | 包內檔案的 SHA-256 校驗清單 |

## 建議部署流程

1. 解壓並進入 `wildhaven/`。**將這個資料夾的內容作為 Git 儲存庫根目錄**，不要再多包一層 `wildhaven/`，否則 Pages 的 `/docs` 路徑會不符。
2. 驗證 GitHub 帳戶、寫入權限及目標儲存庫是否存在。若已有同名專案，先讀取內容，避免覆蓋其他作品。
3. 對尚未存在的目標，建立 `terrycheang/wildhaven-rescue` 公開儲存庫，提交完整專案至 `main`。`package.json` 的 `private: true` 只表示不發布到 npm，不影響 GitHub 網頁公開。
4. 在 GitHub Pages 設定選擇 **Deploy from a branch → main → /docs**，儲存後等待發布完成。現有檔案已可直接部署，不必先安裝 npm 套件。
5. 以 Pages 實際回傳的網址開啟遊戲。若帳戶與儲存庫名稱維持上述建議，預期路徑形式為 `https://terrycheang.github.io/wildhaven-rescue/`，但必須實際驗證後才能交付。
6. 檢查首頁載入、3D 畫面、開始遊戲、行走、`V` 視角切換及 `E` 救援互動；確認公開訪客無需登入 GitHub。回覆使用者正式遊玩網址與儲存庫網址。

## 本地重建與測試

已有檔案直接使用 `node server.mjs`，或雙擊 `Play Wildhaven.html`。開發用的根目錄 `index.html` 需要本地伺服器。

需要修改後重建時：

```sh
npm ci
npm test
npm run build
```

`npm run build` 會同時更新 `Play Wildhaven.html`、`docs/index.html` 和 `docs/.nojekyll`。如果只部署現有版本，無須重建。

完整瀏覽器測試方式見 `README.md`。已有 11 項邏輯測試及最終單檔的 18 項瀏覽器測試通過；詳情和測試限制見 `TEST_REPORT.md`。`?test=1` 只用於測試定位，分享給玩家的正式網址不應包含它。

發布時保留 `CREDITS.md` 和 `vendor/THREE-LICENSE.txt`。若修改檔案，重新產生校驗清單；不要將本機登入憑證加入儲存庫。
