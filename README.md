# Hype5

Hype5 是一個 **realtime room synchronization engine**。
定位是給小型多人房間制遊戲使用，負責房間生命週期、玩家連線、狀態同步、事件廣播與房間清理。

## 1. 定位
Hype5 的角色是：
- 房間建立 / 加入 / 結束
- 玩家連線管理
- 房間狀態同步
- 事件廣播
- join code / room metadata 管理
- snapshot / reconnect 基礎能力

Hype5 不是：
- 遊戲邏輯伺服器
- RNG / 機率裁決引擎
- 經濟結算引擎
- MMO 世界伺服器

## 2. 責任邊界
### Hype5 負責
- room lifecycle
- player connections
- room state sync
- event broadcast
- join validation
- room cleanup
- snapshot / reconnect（基礎版）

### Hype5 不負責
- game logic
- RNG / probability
- economic settlement
- persistent world simulation
- heavy physics
- MMO world management

## 3. 架構位置
```text
Pixel GD / Client
        │
        │ WebSocket
        ▼
Hype5
Realtime Room Sync Engine
        │
        ├─ Aura（一般遊戲邏輯）
        ├─ FuGhost（博奕機率裁決）
        └─ Spinnova（經濟 / 帳本）
4. 適用場景

Hype5 適合：

2D 房間制遊戲

小型對戰遊戲

棋牌 / 卡牌

小型 RPG 小隊房

魚機房

直播互動房

打賞事件 / event broadcast

2～10 人內的多人互動

Hype5 不適合：

MMO
大型開放世界
大量玩家同圖
高頻 FPS / 格鬥 / 大型 MOBA 競技同步

大規模物理模擬

5. 目前技術堆疊

Node.js

Express

Colyseus

WebSocket

@colyseus/ws-transport

6. 專案檔案

目前本機 MVP 主要檔案：

hype5-server/
├─ index.js
├─ room-config.js
├─ test_client.js
├─ load-test.js
├─ package.json
└─ README.md
7. 本機啟動
安裝依賴
npm install
啟動 server
npm run dev

啟動後預設：

HTTP: http://localhost:2567

WS: ws://localhost:2567

8. 測試指令
本機 client 測試
node test_client.js P1
node test_client.js P2
本機輕量壓測
node load-test.js
9. 目前已完成功能（本機 MVP）
已完成

Hype5 server 可正常啟動

Colyseus room 已註冊並可建立 / 連線

test_client 可成功 join room

Room Lifecycle 完成

waiting

playing

ended

room_start / room_end 可切換房間狀態

welcome 訊息可回傳 room lifecycle 資訊

Join Validation 基礎版完成

playing 房禁止加入

ended 房禁止加入

Join Validation 強化完成

resolve/:code 只接受 waiting

playing / ended 會回 not_joinable

Room Cleanup 完成

room_end 後延遲 cleanup

cleanup 後自動 dispose

join code create / resolve / cleanup 已驗證

空房自動結束完成

全員離開後自動 ended

延遲 cleanup 後 disposed

Player Sync / Snapshot 完成

server 主動廣播 player_snapshot

新加入 client 立即收到 snapshot

Movement Rate Limit 完成

Fake Tip / 互動事件廣播完成

fake_tip -> fake_tip_event

Room config 抽離完成

room-config.js

本機雙 client 測試完成

同房

座標同步

fake tip 廣播

本機輕量壓測完成

20 clients

success = 20

fail = 0

10. 目前本機完成度

約 98%～100%
可視為：
Hype5 本機 MVP 完成

11. 房間結束策略規格結論

房間結束策略不應一律固定 timer。
應依房型 / end_mode 決定。

建議 end_mode

on_empty

on_timer

manual

match_based

說明

on_empty：玩家都離開就結束

on_timer：時間到就結束

manual：由 host / 系統手動結束

match_based：依遊戲規則判定結束

12. 本機 MVP 收尾結論

目前 Hype5 已具備：

房間建立 / 加入 / 結束

小房間多人同步

join code 解析與保護

房內事件廣播

空房自動結束

基礎 snapshot 同步

基礎節流保護

基礎本機壓測能力

所以本機階段可視為已完成 MVP 驗證。

13. 下一階段

下一階段可往下列方向擇一：

Render 部署

雲端驗證

Supabase rooms metadata 整合

snapshot / reconnect 強化

room 結構再模組化

Discord / monitoring 接入

14. API（目前）
Health
GET /health
Status
GET /status
Create Room
POST /rooms/create
Resolve Join Code
GET /rooms/resolve/:code
15. 開發原則

Hype5 只做同步，不放遊戲邏輯

房間制優先，不做 MMO 化

先做可跑 MVP，再逐步補強

每房控制在小人數（建議 10 人內）

盡量保持模組化，避免 room 類別過肥

16. 備註

目前為本機 MVP 收尾版。
雲端部署、Supabase metadata、監控、進一步 reconnect / snapshot 強化，放在下一階段。