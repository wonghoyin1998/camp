export const RESOURCE_KEYS = ["energy", "intel", "gear", "network"] as const;

export type ResourceKey = (typeof RESOURCE_KEYS)[number];
export type TeamId = "red" | "blue" | "gold";

export const RESOURCES: Record<
  ResourceKey,
  { name: string; short: string; icon: string; color: string }
> = {
  energy: { name: "能源", short: "能", icon: "⚡", color: "#ffd24a" },
  intel: { name: "情報", short: "情", icon: "◉", color: "#25d9f5" },
  gear: { name: "裝備", short: "裝", icon: "▣", color: "#ff5964" },
  network: { name: "人脈", short: "脈", icon: "◆", color: "#a978ff" },
};

export const TEAMS: Record<
  TeamId,
  { name: string; color: string; accent: string }
> = {
  red: { name: "紅隊", color: "#ff4d57", accent: "#ff8a90" },
  blue: { name: "藍隊", color: "#25d9f5", accent: "#92efff" },
  gold: { name: "金隊", color: "#ffd24a", accent: "#ffe79a" },
};

export const STATIONS = [
  { id: "tai-wo", name: "太和", zone: "A", venue: "港鐵閘內", lat: 22.4509, lng: 114.1612 },
  { id: "tai-po-market", name: "大埔墟", zone: "A", venue: "港鐵閘內", lat: 22.4448, lng: 114.1702 },
  { id: "university", name: "大學", zone: "A", venue: "港鐵閘內", lat: 22.4134, lng: 114.2100 },
  { id: "sha-tin", name: "沙田", zone: "A", venue: "港鐵閘內", lat: 22.3820, lng: 114.1870 },
  { id: "tai-wai", name: "大圍", zone: "A", venue: "港鐵閘內", lat: 22.3726, lng: 114.1785 },
  { id: "hin-keng", name: "顯徑", zone: "B", venue: "港鐵閘內", lat: 22.3631, lng: 114.1711 },
  { id: "diamond-hill", name: "鑽石山", zone: "B", venue: "港鐵閘內", lat: 22.3402, lng: 114.2017 },
  { id: "wong-tai-sin", name: "黃大仙", zone: "B", venue: "港鐵閘內", lat: 22.3419, lng: 114.1930 },
  { id: "prince-edward", name: "太子", zone: "B", venue: "港鐵閘內", lat: 22.3245, lng: 114.1684 },
  { id: "mong-kok", name: "旺角", zone: "B", venue: "港鐵閘內", lat: 22.3193, lng: 114.1694 },
  { id: "yau-ma-tei", name: "油麻地", zone: "B", venue: "港鐵閘內", lat: 22.3133, lng: 114.1705 },
  { id: "tsim-sha-tsui", name: "尖沙咀", zone: "B", venue: "港鐵閘內", lat: 22.2973, lng: 114.1722 },
  { id: "hung-hom", name: "紅磡", zone: "B", venue: "港鐵閘內", lat: 22.3032, lng: 114.1817 },
  { id: "exhibition", name: "會展", zone: "C", venue: "港鐵閘內", lat: 22.2819, lng: 114.1750 },
  { id: "wan-chai", name: "灣仔", zone: "C", venue: "港鐵閘內", lat: 22.2775, lng: 114.1736 },
  { id: "admiralty", name: "金鐘", zone: "C", venue: "港鐵閘內", lat: 22.2790, lng: 114.1654 },
  { id: "hong-kong", name: "香港", zone: "C", venue: "港鐵閘內", lat: 22.2852, lng: 114.1582 },
  { id: "observation-wheel", name: "香港摩天輪", zone: "C", venue: "站外・中環海濱", lat: 22.2850, lng: 114.1624 },
] as const;

export const ROUTE_ZONE_ORDER = { A: 0, B: 1, C: 2 } as const;

export type Reward = {
  cash?: number;
  resources?: Partial<Record<ResourceKey, number>>;
  note?: string;
};

export type TaskDefinition = {
  id: string;
  title: string;
  station: number;
  duration: number;
  /** Shared first-come capacity across all teams. Omit when every team may attempt it. */
  capacity?: number;
  mode: "physical" | "phone" | "market" | "cross-team";
  tagline: string;
  rules: string[];
  success: string;
  reward: Reward;
};

export const AFTERNOON_TASKS: TaskDefinition[] = [
  {
    id: "A5",
    title: "左右同頻",
    station: 0,
    duration: 5,
    mode: "phone",
    tagline: "五個無聲選擇，測試導師團隊有幾同步。",
    rules: [
      "每題全員先各自在心中揀左手（1）或右手（2），唔可以討論。",
      "主持人倒數 3、2、1，全員同時舉起所選的左手或右手。",
      "完成 5 題；每題記錄最多人選擇及是否全隊一致。",
    ],
    success: "5 題中最少 3 題全隊一致。",
    reward: { resources: { intel: 1 }, cash: 3 },
  },
  {
    id: "A3",
    title: "不能說的路線",
    station: 1,
    duration: 5,
    capacity: 2,
    mode: "phone",
    tagline: "用有限線索令隊友估中指定交通詞。",
    rules: [
      "抽一名描述者，畫面會顯示目標詞及 4 個禁詞。",
      "描述者不可講禁詞、同音字、英文或用手指指現場物件。",
      "90 秒內輪流估，估中即換下一詞。",
    ],
    success: "90 秒內估中 4 個詞。",
    reward: { resources: { intel: 2 } },
  },
  {
    id: "A1",
    title: "營袋密碼鎖",
    station: 2,
    duration: 6,
    capacity: 2,
    mode: "physical",
    tagline: "記住營袋動作密碼，再由全隊一次還原。",
    rules: [
      "全隊有 10 秒查看一串 6 步營袋動作；時間到題目會收起。",
      "分配每人記住最少一步；5 人隊由其中一人負責兩步，營袋全程由本人孭住。",
      "按正確次序逐步做出動作，再揭曉密碼核對；不可在月台走動或傳袋。",
    ],
    success: "連續完成 2 組不同的 6 步密碼。",
    reward: { resources: { energy: 1, network: 1 } },
  },
  {
    id: "B7",
    title: "無聲數字",
    station: 5,
    duration: 6,
    mode: "physical",
    tagline: "無主持、無暗號，靠觀察依次報數。",
    rules: [
      "全隊望住地下，任何人都可以由 1 開始報數。",
      "不可預先分工、打手勢或按固定次序。",
      "兩人同時出聲、跳數或同一人連續報兩個數，即由 1 重來。",
    ],
    success: "成功由 1 報到 20。",
    reward: { resources: { gear: 1 }, cash: 2 },
  },
  {
    id: "A6",
    title: "全隊做畀你估",
    station: 3,
    duration: 5,
    capacity: 2,
    mode: "phone",
    tagline: "一人估，全隊同時演，混亂中找共同訊號。",
    rules: [
      "一名估題者背向畫面，其餘人查看同一個動作題。",
      "全隊只能做動作，不可發聲、唇語或用物件砌字。",
      "估中後換估題者，畫面抽出下一題。",
    ],
    success: "2 分鐘內估中 5 題，而且最少 3 人做過估題者。",
    reward: { resources: { network: 2 } },
  },
  {
    id: "A2",
    title: "全隊包剪揼",
    station: 4,
    duration: 4,
    mode: "phone",
    tagline: "全隊同步出拳，完成指定勝負組合。",
    rules: [
      "畫面先只顯示今輪要勝、要負或要和；全隊不可討論。",
      "全員準備好後按掣，等待 3 秒倒數，手機先揭曉對手手勢。",
      "揭曉一刻全員同時向手機出拳，不可見到對手後再商量。",
      "全隊必須出同一手勢，而且結果符合指定要求先算成功。",
    ],
    success: "連續完成『勝、負、和』各一次。",
    reward: { resources: { energy: 1 }, cash: 4 },
  },
  {
    id: "B2",
    title: "動作傳真",
    station: 6,
    duration: 6,
    capacity: 2,
    mode: "physical",
    tagline: "一個動作由隊頭傳到隊尾，看看訊號剩幾多。",
    rules: [
      "排一直線，除第一人外全部背向隊頭。",
      "第一人看 8 秒動作片段，拍下一人肩膊後只可示範一次。",
      "逐個傳到最後一人；期間不可發聲或重播。",
    ],
    success: "最後一人做到 3 個關鍵動作中最少 2 個。",
    reward: { resources: { intel: 1, network: 1 } },
  },
  {
    id: "B1",
    title: "城市批發場",
    station: 8,
    duration: 5,
    mode: "market",
    tagline: "八個貨盤只睇 20 秒，再靠記憶砌出高價值組合。",
    rules: [
      "全隊只有 20 秒查看 8 個貨盤的成本、貨值及組別。",
      "貨盤反轉後，隊伍用 $14 預算揀剛好 4 個貨盤。",
      "揭曉後按貨值及組合加成計算，買錯或超支即失去該貨盤。",
    ],
    success: "最終貨值達 24。",
    reward: { resources: { gear: 1 }, cash: 4 },
  },
  {
    id: "B4",
    title: "行情黑箱",
    station: 7,
    duration: 4,
    mode: "market",
    tagline: "市場每做一步都會變價，四個情境測你算唔算得切。",
    rules: [
      "每輪先看一個市場情境，再在三個行動結果中揀一個。",
      "鎖定後系統才揭曉答案及計法；答錯亦會繼續下一輪。",
      "全隊可討論，但每題只有一次作答機會。",
    ],
    success: "4 個市場情境中答中最少 3 個。",
    reward: { cash: 5 },
  },
  {
    id: "B3",
    title: "貨櫃記憶配對",
    station: 10,
    duration: 5,
    mode: "phone",
    tagline: "16 個貨櫃、8 對貨物，全員輪流翻牌。",
    rules: [
      "一次只可翻兩張；不相同會在短時間後蓋回。",
      "每位隊員最少要負責一個回合，不可由一人包辦。",
      "隊員可以討論位置，但輪到的人必須親手選牌。",
    ],
    success: "在 15 次翻牌回合內找出全部 8 對。",
    reward: { resources: { gear: 1 }, cash: 3 },
  },
  {
    id: "B5",
    title: "跨隊通關合約",
    station: 12,
    duration: 6,
    mode: "cross-team",
    tagline: "用真交易證明你能創造雙贏，而非單純換分。",
    rules: [
      "在玩家交易所向另一隊發出一份真實報價。",
      "交易必須最少包含兩類資產：錢、資源或業權。",
      "對方接受並由系統完成原子交換後，再回來提交任務。",
    ],
    success: "完成一宗雙方資產均有變動的交易。",
    reward: { cash: 6 },
  },
  {
    id: "B6",
    title: "啤牌貨運鏈",
    station: 11,
    duration: 5,
    capacity: 2,
    mode: "phone",
    tagline: "用一副真啤牌合作接龍，手機只負責倒數及記錄。",
    rules: [
      "物資：標準啤牌 1 副（除 Joker）；洗牌後每人派 5 張，再翻 1 張做中央牌。",
      "順時針輪流出同花色或同點數的牌；無牌可出就抽 1 張並輪到下一人。",
      "手機放在中間，任何人可按記錄；錯出一張要按犯規並扣 5 秒。",
    ],
    success: "90 秒內合計打出 18 張合法啤牌，而且每人最少成功出 2 張。",
    reward: { resources: { gear: 2 } },
  },
  {
    id: "C2",
    title: "泊位密封競投",
    station: 13,
    duration: 5,
    mode: "market",
    tagline: "三隊暗標爭奪港口優先權。",
    rules: [
      "輸入一個不高於隊伍現金的整數出價；提交後不可查看對手出價。",
      "所有隊伍提交或限時完結後，由 GM 一次揭標。",
      "最高價付款；同價時先提交者勝出。",
    ],
    success: "完成有效出價。",
    reward: { note: "最高價可選 2 資源，第二名可免費使用一次 2 換 1。" },
  },
  {
    id: "C3",
    title: "默契波長",
    station: 14,
    duration: 6,
    capacity: 2,
    mode: "phone",
    tagline: "提示者用一句話，帶全隊找出光譜上的隱藏位置。",
    rules: [
      "提示者秘密查看目標位置及光譜兩端，例如『計劃—即興』。",
      "提示者只可講一句提示，其餘隊員討論後放置指針。",
      "揭曉目標；提示者不可補充、做手勢或講數字比例。",
    ],
    success: "3 輪合計取得 7 分。",
    reward: { resources: { intel: 2 } },
  },
  {
    id: "B8",
    title: "六箱排位戰",
    station: 9,
    duration: 7,
    capacity: 2,
    mode: "phone",
    tagline: "全隊共睇一部手機，按限制排出唯一裝船次序。",
    rules: [
      "畫面同時顯示 6 件貨物及 4 條裝船限制，毋須傳手機。",
      "全隊討論後用上下鍵重排貨物；鎖定前可以任意修改。",
      "提交後只會顯示有幾個位置不符合限制，不會直接顯示答案。",
    ],
    success: "連續解開 2 張不同的裝船次序卡。",
    reward: { resources: { network: 2 } },
  },
  {
    id: "C1",
    title: "唯一線索",
    station: 15,
    duration: 6,
    mode: "phone",
    tagline: "大家各寫一個提示，但重複提示會全部取消。",
    rules: [
      "估題者不看目標詞，其餘人各自在手機輸入一個單詞提示。",
      "公開提示前，完全相同、同詞根或明顯變體全部剔除。",
      "估題者只可看剩餘提示並回答一次。",
    ],
    success: "5 題中估中最少 3 題。",
    reward: { resources: { intel: 1 }, cash: 4 },
  },
  {
    id: "C5",
    title: "三隊拼船單",
    station: 16,
    duration: 6,
    mode: "cross-team",
    tagline: "同一合約碼、三隊各出貨，湊齊三種資源先成單。",
    rules: [
      "第一隊建立 3–8 位英數合約碼；其餘兩隊在畫面按『使用現有合約碼』加入。",
      "每隊最少提交 1 份自己現有的資源；畫面會即時顯示三隊提交狀態及合計涵蓋種類。",
      "三隊總貢獻要涵蓋最少 3 種資源；全部提交後由 GM 一次扣貨及付款。",
    ],
    success: "三隊使用同一合約碼提交，且合計涵蓋最少 3 種資源。",
    reward: { cash: 4, note: "合約成立後每隊各獲 $4。" },
  },
  {
    id: "C6",
    title: "終局補貨站",
    station: 17,
    duration: 4,
    mode: "market",
    tagline: "用現金換兩份，或押上業權搏三份終局資源。",
    rules: [
      "現金方案：支付 $7，換取自選 2 份資源。",
      "業權方案：抵押 1 個上午業權，換取自選 3 份資源；同一資源最多揀 2 份。",
      "若 15:00 前完成四項認證，抵押業權會歸還；否則失去業權。",
    ],
    success: "鎖定一個有效方案及資源組合，待 GM 確認後即時結算。",
    reward: { note: "$7 換自選資源×2；或抵押業權換自選資源×3。" },
  },
];

export const PROPERTIES = [
  { id: "P1", title: "管道運輸線", game: "管槽運球" },
  { id: "P2", title: "吊臂堆疊站", game: "繩控疊杯" },
  { id: "P3", title: "藍圖工房", game: "分散藍圖砌建（免費轉產）" },
  { id: "P4", title: "浮島補給線", game: "地墊過河" },
  { id: "P5", title: "雙圈穿越線", game: "雙圈人體傳送" },
  { id: "P6", title: "纜索貨運站", game: "繩控托盤運輸" },
] as const;

export const PROJECTS = [
  {
    id: "power",
    title: "動力認證",
    icon: "⚡",
    cost: { energy: 2, gear: 1 },
    perk: "下一個 checkpoint 時限 +60 秒",
  },
  {
    id: "route",
    title: "航線情報",
    icon: "◉",
    cost: { intel: 2, network: 1, energy: 1, gear: 1 },
    perk: "完成航線規劃認證並計入最終出航資格",
  },
  {
    id: "voyage",
    title: "航行裝備",
    icon: "▣",
    cost: { gear: 3, energy: 2, intel: 1 },
    perk: "任務失敗時可重試一次",
  },
  {
    id: "pier",
    title: "碼頭協調",
    icon: "◆",
    cost: { network: 3, intel: 1, gear: 1, energy: 1 },
    perk: "一次官方 3 換 1 變成 2 換 1",
  },
] as const;

export const WARMUPS = [
  { id: "W1", title: "隊伍訊號", text: "8 分鐘內創作隊名、口號及 3 秒無聲手勢。" },
  { id: "W2", title: "紙塔試作", text: "只用紙及膠紙搭出可承托手機 10 秒的高塔。" },
  { id: "W3", title: "系統教學交易", text: "登入隊伍、買賣一次資源，再完成一宗測試交易。" },
] as const;

export type PublicTaskDefinition = {
  id: string;
  title: string;
  summary: string;
  materials: string;
  rules: string[];
  success: string;
  prompts: Array<{ title: string; detail: string; pattern?: string[] }>;
  reward: ResourceKey;
};

export const PUBLIC_TASKS: PublicTaskDefinition[] = [
  {
    id: "U1", title: "靜默排位", summary: "抽出排序條件後，全隊無聲排成一直線。", materials: "毋須物資",
    rules: ["確認開始後先會抽出今次排序條件。", "由看見條件起全隊不可說話、打字或展示數字。", "排好後才可依次公開答案，由 GM 核對次序。"],
    success: "全隊一次排對；錯位可重新開始，但會抽新條件。",
    prompts: [
      { title: "由今日起身時間早 → 晚", detail: "排好後每人依次講出今日起身時間。" },
      { title: "由鞋碼細 → 大", detail: "排好後每人依次講出鞋碼；同碼者可並排。" },
      { title: "由住處到太和所需時間短 → 長", detail: "以今日實際交通分鐘計算。" },
      { title: "由手機現時電量低 → 高", detail: "排好後同時亮出電量；同電量者可並排。" },
      { title: "由生日月份早 → 晚", detail: "只按月份排序；同月者可並排。" },
      { title: "由營袋重量輕 → 重", detail: "排好後逐個用手比較，毋須使用磅。" },
    ], reward: "energy",
  },
  {
    id: "U2", title: "背脊密碼圖", summary: "隊尾秘密看點陣圖，再逐個畫在隊友背上傳到隊頭。", materials: "A4 紙×1、筆×1",
    rules: ["只有隊尾可查看 4×4 點陣題卡 8 秒，記住後收起手機。", "用手指在前一人背上畫一次，不可重播、發聲或講方向。", "隊頭在紙上畫出收到的圖案，再揭答案由 GM 核對。"],
    success: "16 個位置中最少 12 個黑點／空位正確。",
    prompts: [
      { title: "燈號圖 A", detail: "● 是黑點，○ 是空位。", pattern: ["● ○ ○ ●", "○ ● ● ○", "○ ○ ● ○", "● ○ ○ ●"] },
      { title: "燈號圖 B", detail: "● 是黑點，○ 是空位。", pattern: ["○ ● ○ ○", "● ● ● ○", "○ ● ○ ●", "○ ○ ● ●"] },
      { title: "燈號圖 C", detail: "● 是黑點，○ 是空位。", pattern: ["● ● ○ ○", "○ ● ○ ●", "● ○ ● ○", "○ ○ ● ●"] },
      { title: "燈號圖 D", detail: "● 是黑點，○ 是空位。", pattern: ["○ ○ ● ○", "● ○ ● ●", "● ● ○ ○", "○ ● ○ ●"] },
      { title: "燈號圖 E", detail: "● 是黑點，○ 是空位。", pattern: ["● ○ ● ○", "● ○ ○ ●", "○ ● ● ○", "○ ● ○ ●"] },
      { title: "燈號圖 F", detail: "● 是黑點，○ 是空位。", pattern: ["○ ● ● ○", "● ○ ○ ●", "● ● ○ ○", "○ ○ ● ●"] },
    ], reward: "intel",
  },
  {
    id: "U3", title: "反轉補給島", summary: "全隊連營袋留在地墊範圍內，把地墊完整反轉。", materials: "大地墊×1、每人的營袋",
    rules: ["全員連營袋站在地墊範圍內，任何身體部位及營袋不可掂地。", "確認開始後會抽出一條額外限制。", "在限制下把地墊完整反轉；旁人只可安全監察，不可托人或托袋。"],
    success: "90 秒內完成，期間沒有人或營袋觸地。",
    prompts: [
      { title: "限制：每人一隻手全程捉住自己肩帶", detail: "另一隻手可合作處理地墊。" },
      { title: "限制：全隊最少保持三個搭膊連接", detail: "連接可換人，但任何時間不可少過三個。" },
      { title: "限制：任何人不可坐低或跪低", detail: "可蹲下，但雙膝不可接觸地墊。" },
      { title: "限制：全隊只可使用合共六隻手", detail: "開始前自行決定哪六隻手可碰地墊。" },
      { title: "限制：每次只可一人移動雙腳", detail: "其他人可以移動身體及雙手，但雙腳要留在原位。" },
      { title: "限制：全程最少兩人閉上一隻眼", detail: "閉眼人選可以中途交換，但不可出現空檔。" },
    ], reward: "gear",
  },
  {
    id: "U4", title: "失控報數台", summary: "無預定次序完成一組特別報數規則。", materials: "毋須物資",
    rules: ["確認開始後先抽出今次報數規則。", "不可預先分工、打暗號或按固定次序。", "兩人同時出聲、報錯或同一人連續兩次，即由頭重來。"],
    success: "完整完成抽中的報數序列一次。",
    prompts: [
      { title: "由 1 報到 25", detail: "5 的倍數不可講數字，要拍手一次代替。" },
      { title: "由 25 倒數到 1", detail: "7 的倍數不可講數字，要講「轉船」。" },
      { title: "只報奇數：1、3、5…到 31", detail: "任何人講出偶數即重來。" },
      { title: "由 1 報到 20", detail: "同一人全局最多只可出聲 4 次。" },
      { title: "由 1 報到 24", detail: "3 的倍數講「浪」，4 的倍數講「船」；12 要講「浪船」。" },
      { title: "由 30 倒數到 10", detail: "所有含有數字 2 的數不可講，要拍大髀一次。" },
    ], reward: "network",
  },
];

export const LUNCH_CONTRACTS = [
  { id: "L1", title: "動力情報餐券", cost: { energy: 1, intel: 1 }, cash: 10 },
  { id: "L2", title: "裝備人脈餐券", cost: { gear: 1, network: 1 }, cash: 10 },
  { id: "L3", title: "混合批發單", cost: null, cash: 15, note: "任意 3 個資源" },
] as const;

export const TABOO_DECK = [
  { word: "轉線", banned: ["月台", "車站", "路線", "換", "港鐵"] },
  { word: "八達通", banned: ["拍卡", "車費", "增值", "銀包", "入閘"] },
  { word: "尾班船", banned: ["碼頭", "時間", "最後", "長洲", "錯過"] },
  { word: "行李", banned: ["營袋", "重", "背", "物品", "寄存"] },
  { word: "月台", banned: ["上車", "列車", "等", "閘內", "車站"] },
  { word: "迷路", banned: ["方向", "地圖", "唔知", "行錯", "問人"] },
  { word: "轉車", banned: ["落車", "另一條線", "月台", "站", "行"] },
  { word: "扶手電梯", banned: ["樓梯", "企右", "向上", "向下", "扶手"] },
  { word: "車門", banned: ["打開", "關閉", "上車", "落車", "幕門"] },
  { word: "指示牌", banned: ["出口", "方向", "箭嘴", "睇", "標誌"] },
  { word: "延誤", banned: ["遲", "事故", "廣播", "服務", "時間"] },
  { word: "車廂", banned: ["座位", "企", "列車", "乘客", "門"] },
  { word: "碼頭", banned: ["船", "海", "上船", "渡輪", "岸"] },
  { word: "快船", banned: ["長洲", "慢船", "時間", "海", "速度"] },
  { word: "閘機", banned: ["拍卡", "入閘", "出閘", "八達通", "門"] },
  { word: "路線圖", banned: ["顏色", "車站", "地圖", "港鐵", "線"] },
  { word: "轉乘通道", banned: ["行", "月台", "另一條線", "指示", "車站"] },
  { word: "客務中心", banned: ["職員", "問路", "車站", "服務", "窗口"] },
  { word: "行李寄存", banned: ["營袋", "擺低", "櫃", "保管", "取回"] },
  { word: "渡輪碼頭", banned: ["船", "中環", "長洲", "海", "上船"] },
  { word: "實時到站", banned: ["手機", "時間", "下一班", "列車", "顯示"] },
  { word: "落車提示", banned: ["廣播", "下一站", "車門", "聲音", "乘客"] },
  { word: "出口編號", banned: ["字母", "街道", "指示牌", "閘外", "方向"] },
  { word: "繁忙時間", banned: ["多人", "上班", "擠迫", "早上", "放工"] },
];

export const CHARADES_DECK = [
  "趕尾班船", "營袋拉鏈爆開", "港鐵突然停駛", "食魚蛋燒賣",
  "落大雨搵遮", "搬一箱好重的貨", "電話得返 1% 電", "全隊跑錯月台",
  "八達通餘額不足", "扶手電梯突然停低", "瞓過龍坐過站", "船上暈浪",
  "營袋入面漏水", "見到摩天輪好興奮", "喺人群中搵隊友", "一邊食飯一邊交易",
  "拖住大箱落樓梯", "發現搭錯方向列車", "排隊時有人打尖", "突然收到緊急訂單",
  "雨傘被風吹反", "手機地圖不停轉圈", "隊友隔住車門上唔到車", "買到最後一份補給",
  "背住營袋行得太快", "在月台聞到食物香味", "船票跌在地上被風吹走", "交易時發現自己計錯數",
  "到站後搵唔到出口", "搬貨途中鞋帶鬆開",
];

export const SYNC_QUESTIONS = [
  { prompt: "去到陌生地方，你會先做邊樣？", a: "睇地圖", b: "跟住隊友" },
  { prompt: "營袋只可留一樣，你會揀？", a: "充電器", b: "水" },
  { prompt: "落錯車，第一反應係？", a: "即刻上返車", b: "停低重新計劃" },
  { prompt: "隊伍有額外 $5，應該？", a: "買資源", b: "留作交易" },
  { prompt: "任務剩30秒，你會？", a: "加速照做", b: "停一停重整" },
  { prompt: "兩條路一樣快，你會揀？", a: "少轉車", b: "多任務點" },
  { prompt: "隊友遲到，你會？", a: "原地等", b: "邊行邊聯絡" },
  { prompt: "只差一種資源，你會？", a: "官方市場買", b: "向玩家交易" },
  { prompt: "遇到難題，先聽？", a: "最有信心的人", b: "每人講一句" },
  { prompt: "搭船揀位，你會？", a: "船艙入面", b: "甲板出面" },
  { prompt: "見到另一隊，你會？", a: "主動傾交易", b: "先觀察佢哋" },
  { prompt: "最後10分鐘，你會？", a: "衝高價任務", b: "穩陣完成項目" },
  { prompt: "陌生站有兩個出口，你會？", a: "先問職員", b: "跟地圖行" },
  { prompt: "午餐只剩10分鐘，你會？", a: "邊行邊食", b: "坐定食完" },
  { prompt: "隊伍意見打和，你會？", a: "投票決定", b: "再傾一分鐘" },
  { prompt: "見到限量任務點，你會？", a: "即刻挑戰", b: "先睇獎勵" },
  { prompt: "有隊提出急交易，你會？", a: "先壓價", b: "先查自己需要" },
  { prompt: "GPS 差少少未到，你會？", a: "行近指定點", b: "先做其他準備" },
  { prompt: "只可帶一種後備品，你會？", a: "後備電源", b: "後備食水" },
  { prompt: "有簡單低獎勵同難高獎勵，你揀？", a: "簡單穩陣", b: "難題高回報" },
  { prompt: "另一隊領先好多，你會？", a: "改變策略", b: "照原計劃" },
  { prompt: "轉線要行好遠，你會？", a: "快步趕車", b: "留力慢行" },
  { prompt: "全隊得一人睇懂題目，你會？", a: "由佢指揮", b: "叫佢逐步解釋" },
  { prompt: "最後一份資源價格升咗，你會？", a: "照買", b: "搵玩家換" },
  { prompt: "任務失敗一次，你會？", a: "立即重試", b: "先檢討分工" },
  { prompt: "去到中環早咗，你會？", a: "做多個任務", b: "先整合資產" },
  { prompt: "船程可能大浪，你會？", a: "坐船艙", b: "企近出口" },
  { prompt: "隊友提議冒險交易，你會？", a: "接受風險", b: "要求保底" },
  { prompt: "得一把遮，你會？", a: "全隊迫埋", b: "分頭快行" },
  { prompt: "任務要公開資料，你會？", a: "主動分享", b: "保留優勢" },
] as const;

export const ACTION_RELAY_DECK = [
  { title: "暴雨搬貨", actions: ["撐開雨傘", "抬起重箱", "跣一跣企返穩"] },
  { title: "趕船三步曲", actions: ["望手錶", "孭袋跑步", "揮手叫船等"] },
  { title: "月台意外", actions: ["拍八達通", "發現入錯閘", "抱頭轉身"] },
  { title: "營袋爆開", actions: ["拉拉鏈", "物件跌滿地", "蹲低執拾"] },
  { title: "電話危機", actions: ["拎手機", "見到1%電", "四圍搵充電器"] },
  { title: "船上風浪", actions: ["扶住欄杆", "身體左右搖", "掩口想嘔"] },
  { title: "迷路求救", actions: ["打開地圖", "抓頭", "問路後指向前"] },
  { title: "買錯車票", actions: ["遞出金錢", "望住車票愕然", "搖頭退回"] },
  { title: "秘密交收", actions: ["左右觀察", "握手", "把小盒收進袋"] },
  { title: "摩天輪打卡", actions: ["抬頭望高", "擺姿勢", "按手機快門"] },
  { title: "錯過列車", actions: ["望住關門", "拍門一下", "無奈望手錶"] },
  { title: "大雨轉線", actions: ["打開雨傘", "跨過水氹", "抹乾手機"] },
  { title: "補給到貨", actions: ["接過紙箱", "檢查封條", "舉起拇指"] },
  { title: "車廂搖晃", actions: ["捉緊扶手", "身體失平衡", "扶住隊友"] },
  { title: "地圖失靈", actions: ["不停轉手機", "皺眉抓頭", "指向路牌"] },
  { title: "碼頭點貨", actions: ["打開清單", "逐箱點算", "在紙上剔號"] },
  { title: "行李超重", actions: ["嘗試抬袋", "腰向後彎", "招手叫人幫忙"] },
  { title: "緊急集合", actions: ["看手機訊息", "吹口哨", "揮手叫隊友過來"] },
] as const;

export const WHOLESALE_LOTS = [
  { id: "W1", name: "太陽能板", cost: 5, value: 8, combo: "power" },
  { id: "W2", name: "後備電池", cost: 3, value: 4, combo: "power" },
  { id: "W3", name: "濾水器", cost: 4, value: 7, combo: "supply" },
  { id: "W4", name: "急救藥箱", cost: 3, value: 5, combo: "supply" },
  { id: "W5", name: "短波電台", cost: 4, value: 6, combo: "signal" },
  { id: "W6", name: "訊號天線", cost: 2, value: 3, combo: "signal" },
  { id: "W7", name: "乾糧箱", cost: 3, value: 5, combo: "cargo" },
  { id: "W8", name: "保溫貨袋", cost: 5, value: 7, combo: "cargo" },
] as const;

export const MARKET_SCENARIOS = [
  {
    question: "裝備買價 $6。另一隊先買 1 裝備，你隊再賣 1 裝備，會收到幾多？",
    options: ["$3", "$4", "$5"], answer: 1,
    explanation: "另一隊買入後，裝備買價由 $6 升至 $7；賣價是買價減 $3，所以收到 $4。",
  },
  {
    question: "情報買價 $6，你隊有 $12、零情報。連續向官方市場買 2 情報，夠唔夠錢？",
    options: ["剛好夠", "唔夠，欠 $1", "唔夠，欠 $2"], answer: 1,
    explanation: "第一份 $6，買完價格升至 $7；第二份要 $7，合共 $13。",
  },
  {
    question: "能源買價 $6。先賣 1 能源，再立即買返 1 能源，現金淨變化係？",
    options: ["不變", "少 $2", "多 $2"], answer: 1,
    explanation: "先賣得 $3，價格跌至 $5；買返要 $5，淨少 $2。",
  },
  {
    question: "人脈買價已到上限 $8。另一隊再買 1 人脈後，新的買價係？",
    options: ["仍然 $8", "$9", "跌回 $7"], answer: 0,
    explanation: "官方買價有 $5–$8 上下限；即使再買亦停在 $8。",
  },
  {
    question: "裝備買價 $7。你隊先賣 1 裝備，再立即買返，現金淨變化係？",
    options: ["少 $2", "少 $3", "不變"], answer: 0,
    explanation: "先賣得 $4，價格跌至 $6；買返要 $6，淨少 $2。",
  },
  {
    question: "情報買價 $8，兩隊先後各賣 1 情報，合共從市場收幾多？",
    options: ["$8", "$9", "$10"], answer: 1,
    explanation: "第一隊賣得 $5，價格跌至 $7；第二隊賣得 $4，合共 $9。",
  },
  {
    question: "能源買價 $5。你隊買 1 份後立即賣出，現金淨變化係？",
    options: ["少 $2", "少 $3", "不變"], answer: 0,
    explanation: "買入花 $5，價格升至 $6；立即賣出收 $3，淨少 $2。",
  },
  {
    question: "人脈買價 $7，你隊有 $15。連買 2 份後餘下幾多現金？",
    options: ["$0", "$1", "$2"], answer: 0,
    explanation: "第一份 $7，第二份升至上限 $8，合共剛好 $15。",
  },
  {
    question: "裝備買價已在下限 $5。你隊連賣 2 裝備，合共收幾多？",
    options: ["$3", "$4", "$5"], answer: 1,
    explanation: "每次賣價都是買價減 $3，即每份收 $2；價格不會低過 $5。",
  },
  {
    question: "情報買價 $7。由零開始連買 3 份，總成本係？",
    options: ["$21", "$22", "$23"], answer: 2,
    explanation: "三次價格依次是 $7、$8、$8，總成本 $23。",
  },
  {
    question: "能源買價 $6。一隊買 1 份，另一隊隨即賣 1 份；最後買價係？",
    options: ["$5", "$6", "$7"], answer: 1,
    explanation: "買入先令價格升至 $7，隨後賣出令價格跌回 $6。",
  },
  {
    question: "裝備買價 $8，你隊有 2 裝備、零現金。全部賣出後有幾多現金？",
    options: ["$8", "$9", "$10"], answer: 1,
    explanation: "第一份收 $5，價格跌至 $7；第二份收 $4，合共 $9。",
  },
  {
    question: "人脈買價 $6，你隊連賣 2 人脈，合共收幾多？",
    options: ["$4", "$5", "$6"], answer: 1,
    explanation: "第一份收 $3，價格跌至 $5；第二份收 $2，合共 $5。",
  },
  {
    question: "能源買價 $5，由零開始連買 3 份，總成本係？",
    options: ["$17", "$18", "$19"], answer: 1,
    explanation: "三次價格依次是 $5、$6、$7，合共 $18。",
  },
  {
    question: "情報買價已到 $8，連買 2 份要幾多？",
    options: ["$15", "$16", "$17"], answer: 1,
    explanation: "價格已在上限，兩份都是 $8，合共 $16。",
  },
  {
    question: "裝備買價 $7。一隊先賣 1 份，另一隊再買 1 份；最後買價係？",
    options: ["$6", "$7", "$8"], answer: 1,
    explanation: "賣出令價格跌至 $6，之後買入令價格升回 $7。",
  },
  {
    question: "人脈買價在下限 $5。另一隊賣 1 份後，你隊買 1 份要幾多？",
    options: ["$4", "$5", "$6"], answer: 1,
    explanation: "賣出不會令價格低過 $5，所以你隊仍以 $5 買入。",
  },
  {
    question: "能源買價 $6，你隊有 $14。連買 2 份後餘下幾多？",
    options: ["$0", "$1", "$2"], answer: 1,
    explanation: "兩份依次 $6、$7，合共 $13，餘下 $1。",
  },
  {
    question: "情報買價 $8，你隊連賣 3 份，合共收幾多？",
    options: ["$11", "$12", "$13"], answer: 1,
    explanation: "三次賣價依次 $5、$4、$3，合共 $12。",
  },
  {
    question: "裝備買價 $6。你隊連買 2 份後再賣 1 份，現金淨變化係？",
    options: ["少 $7", "少 $8", "少 $9"], answer: 1,
    explanation: "買入花 $6+$7；價格到 $8 時賣出收 $5，淨少 $8。",
  },
  {
    question: "能源及裝備買價都係 $6，各買 1 份總共要幾多？",
    options: ["$11", "$12", "$13"], answer: 1,
    explanation: "不同資源各自計價，兩份都是 $6，合共 $12。",
  },
  {
    question: "裝備及情報買價都係 $6。買 2 裝備比各買 1 裝備、1 情報貴幾多？",
    options: ["一樣", "貴 $1", "貴 $2"], answer: 1,
    explanation: "2 裝備要 $6+$7=$13；混合買入只需 $6+$6=$12。",
  },
  {
    question: "人脈買價 $7，你隊連賣 2 份，合共收幾多？",
    options: ["$6", "$7", "$8"], answer: 1,
    explanation: "第一份收 $4，價格跌至 $6；第二份收 $3，合共 $7。",
  },
  {
    question: "能源買價 $5。你買 1 份，另一隊再買 1 份，然後你賣出；你隊現金淨變化係？",
    options: ["少 $1", "少 $2", "不變"], answer: 0,
    explanation: "你先花 $5；另一隊買入後價格升到 $7，你賣出可收 $4，所以淨少 $1。",
  },
] as const;

export const BAG_CODE_ACTIONS = ["左手拍袋", "右手拍袋", "袋向左擺", "袋向右擺", "雙手捉肩帶", "袋輕推向前"] as const;

export const CARGO_ORDER_ROUNDS = [
  {
    items: ["醫療箱", "文件袋", "飲用水", "工具箱", "後備電池", "易碎儀器"],
    solution: ["醫療箱", "文件袋", "飲用水", "工具箱", "後備電池", "易碎儀器"],
    constraints: ["醫療箱一定第一", "文件袋在飲用水之前", "工具箱緊接在後備電池之前", "易碎儀器一定最後"],
  },
  {
    items: ["救生圈", "雨具", "繩索", "電筒", "食物箱", "睡袋"],
    solution: ["救生圈", "雨具", "繩索", "電筒", "食物箱", "睡袋"],
    constraints: ["救生圈一定第一", "雨具緊接在繩索之前", "電筒在食物箱之前", "睡袋一定最後"],
  },
  {
    items: ["通訊機", "藥物箱", "淡水", "乾糧", "維修包", "後備纜索"],
    solution: ["通訊機", "藥物箱", "淡水", "乾糧", "維修包", "後備纜索"],
    constraints: ["通訊機一定第一", "藥物箱在淡水之前", "淡水緊接乾糧", "維修包在後備纜索之前，後備纜索一定最後"],
  },
  {
    items: ["船員名冊", "救生衣", "照明燈", "訊號旗", "工具袋", "垃圾袋"],
    solution: ["船員名冊", "救生衣", "照明燈", "訊號旗", "工具袋", "垃圾袋"],
    constraints: ["船員名冊一定第一", "救生衣在照明燈之前", "訊號旗緊接照明燈之後", "垃圾袋一定最後"],
  },
  {
    items: ["航海圖", "指南針", "電池箱", "手提電台", "防水布", "清潔用品"],
    solution: ["航海圖", "指南針", "電池箱", "手提電台", "防水布", "清潔用品"],
    constraints: ["航海圖一定第一", "指南針在電池箱之前", "電池箱緊接手提電台", "防水布在清潔用品之前，清潔用品一定最後"],
  },
  {
    items: ["乘客清單", "急救包", "飲品箱", "零食箱", "後備雨衣", "空紙箱"],
    solution: ["乘客清單", "急救包", "飲品箱", "零食箱", "後備雨衣", "空紙箱"],
    constraints: ["乘客清單一定第一", "急救包在飲品箱之前", "飲品箱緊接零食箱", "空紙箱一定最後"],
  },
  {
    items: ["登船證", "醫療氧氣", "毛毯", "樽裝水", "工具盒", "回收袋"],
    solution: ["登船證", "醫療氧氣", "毛毯", "樽裝水", "工具盒", "回收袋"],
    constraints: ["登船證一定第一", "醫療氧氣在毛毯之前", "毛毯緊接樽裝水", "回收袋一定最後"],
  },
  {
    items: ["泊位文件", "滅火筒", "救援繩", "警示燈", "防滑墊", "空水桶"],
    solution: ["泊位文件", "滅火筒", "救援繩", "警示燈", "防滑墊", "空水桶"],
    constraints: ["泊位文件一定第一", "滅火筒在救援繩之前", "警示燈緊接救援繩之後", "空水桶一定最後"],
  },
  {
    items: ["天氣報告", "望遠鏡", "防水電台", "充電器", "帆布", "清潔布"],
    solution: ["天氣報告", "望遠鏡", "防水電台", "充電器", "帆布", "清潔布"],
    constraints: ["天氣報告一定第一", "望遠鏡在防水電台之前", "防水電台緊接充電器", "清潔布一定最後"],
  },
  {
    items: ["貨運標籤", "保溫箱", "水果箱", "乾貨袋", "綁帶", "廢紙箱"],
    solution: ["貨運標籤", "保溫箱", "水果箱", "乾貨袋", "綁帶", "廢紙箱"],
    constraints: ["貨運標籤一定第一", "保溫箱在水果箱之前", "水果箱緊接乾貨袋", "廢紙箱一定最後"],
  },
  {
    items: ["安全清單", "救生浮標", "哨子", "手電筒", "膠紙", "空膠袋"],
    solution: ["安全清單", "救生浮標", "哨子", "手電筒", "膠紙", "空膠袋"],
    constraints: ["安全清單一定第一", "救生浮標在哨子之前", "哨子緊接手電筒", "空膠袋一定最後"],
  },
  {
    items: ["航程編號", "備用藥物", "壓縮餅乾", "飲用水袋", "雨傘", "空繩袋"],
    solution: ["航程編號", "備用藥物", "壓縮餅乾", "飲用水袋", "雨傘", "空繩袋"],
    constraints: ["航程編號一定第一", "備用藥物在壓縮餅乾之前", "壓縮餅乾緊接飲用水袋", "空繩袋一定最後"],
  },
] as const;

export const CHAMELEON_DECK = [
  { category: "港鐵設施", words: ["閘機", "扶手電梯", "月台幕門", "客務中心", "路線圖", "升降機"] },
  { category: "營會用品", words: ["營袋", "睡袋", "水樽", "電筒", "充電寶", "急救包"] },
  { category: "港口貨物", words: ["貨櫃", "救生圈", "船票", "繩索", "木箱", "舷梯"] },
  { category: "桌遊元素", words: ["骰子", "棋子", "手牌", "計分板", "拍賣", "回合"] },
  { category: "香港小食", words: ["魚蛋", "燒賣", "蛋撻", "菠蘿包", "腸粉", "雞蛋仔"] },
] as const;

export const WAVELENGTH_SCALES = [
  { left: "完全計劃", right: "完全即興" },
  { left: "適合一個人", right: "適合全隊" },
  { left: "穩陣但慢", right: "冒險但快" },
  { left: "應該慳錢", right: "值得豪使" },
  { left: "冇乜用", right: "救命神器" },
  { left: "容易帶住走", right: "極難搬運" },
  { left: "可信", right: "非常可疑" },
  { left: "適合上午", right: "適合深夜" },
  { left: "合作", right: "競爭" },
  { left: "普通旅程", right: "史詩級冒險" },
  { left: "適合新手", right: "適合高手" },
  { left: "應該即刻做", right: "應該最後先做" },
  { left: "完全公平", right: "全靠運氣" },
  { left: "值得信任", right: "一定有伏" },
  { left: "輕鬆熱身", right: "終極挑戰" },
  { left: "個人決定", right: "全隊共識" },
  { left: "短期着數", right: "長線投資" },
  { left: "安靜完成", right: "極度嘈吵" },
] as const;

export const UNIQUE_CLUE_WORDS = [
  "八達通", "摩天輪", "長洲", "營袋", "月台", "船票", "充電寶", "魚蛋",
  "轉線", "地圖", "貨櫃", "雨傘", "電筒", "快船", "碼頭", "骰子",
  "行李", "交易", "迷路", "拍賣", "救生圈", "帳幕", "列車", "蛋撻",
  "指南針", "客務中心", "雨衣", "貨單", "碼頭鐘", "急救包",
] as const;
