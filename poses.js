// poses.js — ポーズプリセット（Swift版で検証したデータから変換）
// spec の書式: "関節キー:X,Y,Z" をスペース区切り（角度は度）

export const POSE_CATEGORIES = [
  { key: 'stand', name: '立ち' },
  { key: 'daily', name: '日常' },
  { key: 'emotion', name: '感情' },
  { key: 'walk', name: '歩く・走る' },
  { key: 'sit', name: '座る' },
  { key: 'kneel', name: 'しゃがむ・膝' },
  { key: 'lie', name: '寝る' },
  { key: 'action', name: 'アクション' },
  { key: 'sport', name: 'スポーツ・踊る' },
];

export const POSE_PRESETS = [
  { id: 'armsOpen', name: '両手を広げる', category: 'stand', seat: false, lift: 0, spec: 'chest:-6,0,0 forearmL:-8,0,0 forearmR:-8,0,0 neck:-8,0,0 upperArmL:-10,90,85 upperArmR:-10,-90,-85' },
  { id: 'attention', name: '気をつけ', category: 'stand', seat: false, lift: 0, spec: 'upperArmL:0,0,3 upperArmR:0,0,-3' },
  { id: 'contrapposto', name: '片足重心で立つ', category: 'stand', seat: false, lift: 0, spec: 'hips:0,8,5 spine:0,-3,-4 chest:0,-4,-6 neck:0,0,4 upperArmL:3,0,6 upperArmR:-3,0,-8 forearmL:-12,0,0 forearmR:-14,0,0 thighL:-2,0,-9 thighR:-28,1,-11 shinL:4,0,0 shinR:42,0,0 footL:-1,10,4 footR:-13,-10,5' },
  { id: 'crossArms', name: '腕を組む', category: 'stand', seat: false, lift: 0, spec: 'chest:-4,0,0 neck:-3,0,0 upperArmL:13,-56,-7 upperArmR:3,53,21 forearmL:-98,-47,0 forearmR:-90,-64,0 handL:-70,75,-35 handR:85,55,35 thighL:0,0,4 thighR:0,0,-4' },
  { id: 'handsOnHips', name: '両手を腰に', category: 'stand', seat: false, lift: 0, spec: 'upperArmL:62,-19,42 upperArmR:62,19,-42 forearmL:-119,26,0 forearmR:-119,-26,0 handL:-21,-2,30 handR:-21,3,-30 thighL:0,0,6 thighR:0,0,-6' },
  { id: 'lookBack', name: '振り返る', category: 'stand', seat: false, lift: 0, spec: 'chest:0,25,0 forearmL:-10,0,0 forearmR:-15,0,0 head:-5,25,0 thighL:0,10,0 thighR:0,5,0 neck:0,40,0 upperArmL:8,0,6 upperArmR:-8,0,-6 spine:0,18,0' },
  { id: 'natural', name: '自然に立つ', category: 'stand', seat: false, lift: 0, spec: 'footL:0,0,-3 footR:0,0,2 forearmL:-12,0,0 forearmR:-15,0,0 thighL:0,0,4 thighR:0,0,-3 neck:3,0,0 upperArmL:4,0,7 upperArmR:-3,0,-6' },
  { id: 'phone', name: 'スマホを見る', category: 'stand', seat: false, lift: 0, spec: 'neck:25,0,0 head:15,0,0 upperArmL:0,0,5 upperArmR:-24,27,-3 forearmL:-10,0,0 forearmR:-109,-11,0 handR:1,-60,-17' },
  { id: 'pointForward', name: '前を指差す', category: 'stand', seat: false, lift: 0, spec: 'chest:0,8,0 upperArmL:0,0,5 upperArmR:-85,0,-5 forearmL:-10,0,0 forearmR:-5,0,0 handR:0,90,5' },
  { id: 'pray', name: '祈る', category: 'stand', seat: false, lift: 0, spec: 'neck:20,0,0 head:10,0,0 upperArmL:-8,-34,2 upperArmR:-8,34,-2 forearmL:-119,-58,0 forearmR:-119,58,0 handL:-21,20,45 handR:-21,-20,-45' },
  { id: 'raiseHand', name: '手を挙げる', category: 'stand', seat: false, lift: 0, spec: 'upperArmL:0,0,5 upperArmR:0,-90,-170 forearmL:-10,0,0 forearmR:-5,0,0 handR:-5,0,0' },
  { id: 'salute', name: '敬礼', category: 'stand', seat: false, lift: 0, spec: 'upperArmL:0,0,3 upperArmR:-29,-34,-135 forearmR:-117,-24,0 handR:-15,-2,-20' },
  { id: 'scratchHead', name: '頭をかく', category: 'stand', seat: false, lift: 0, spec: 'neck:8,-5,6 upperArmL:0,0,5 upperArmR:-72,-15,-150 forearmL:-10,0,0 forearmR:-133,-100,0 handR:-28,-23,-45' },
  { id: 'stretch', name: '伸びをする', category: 'stand', seat: false, lift: 0, spec: 'chest:-12,0,0 forearmL:-8,0,0 forearmR:-8,0,0 head:-10,0,0 neck:-12,0,0 upperArmL:0,90,172 upperArmR:0,-90,-172' },
  { id: 'think', name: '考える（あごに手）', category: 'stand', seat: false, lift: 0, spec: 'neck:12,0,3 head:5,-8,0 upperArmL:12,-63,-2 upperArmR:-3,57,6 forearmL:-80,52,0 forearmR:-147,-21,0 handL:18,20,-22 handR:-10,5,-33' },
  { id: 'wave', name: '手を振る', category: 'stand', seat: false, lift: 0, spec: 'neck:0,0,-3 upperArmL:0,0,6 upperArmR:-50,-24,-109 forearmL:-12,0,0 forearmR:-80,32,0 handR:9,-50,-11' },
  { id: 'bag', name: 'かばんを肩にかける', category: 'daily', seat: false, lift: 0, spec: 'hips:0,0,-3 upperArmL:3,0,6 upperArmR:13,11,-18 forearmL:-12,0,0 forearmR:-153,-46,0 handR:-41,-41,19 thighL:-10,0,3 shinL:10,0,0' },
  { id: 'carryBox', name: '箱を運ぶ', category: 'daily', seat: false, lift: 0, spec: 'spine:-5,0,0 chest:-5,0,0 upperArmL:0,-8,20 upperArmR:0,8,-20 forearmL:-90,-16,0 forearmR:-90,16,0 handL:30,35,-12 handR:30,-35,13 shinL:8,0,0 shinR:8,0,0' },
  { id: 'drink', name: '飲む', category: 'daily', seat: false, lift: 0, spec: 'neck:-15,0,0 head:-10,0,0 upperArmL:0,0,5 upperArmR:-76,29,4 forearmL:-10,0,0 forearmR:-130,33,0 handR:11,-2,-3' },
  { id: 'lean', name: '壁にもたれる', category: 'daily', seat: false, lift: 0, spec: 'hips:-8,0,0 chest:-5,0,0 upperArmL:36,-75,32 upperArmR:36,75,-32 forearmL:-77,-11,0 forearmR:-77,11,0 handL:-31,-16,0 handR:-31,16,0 thighL:-5,0,3 thighR:-35,-20,5 shinR:70,0,0 footR:10,0,0' },
  { id: 'pickUp', name: '物を拾う', category: 'daily', seat: false, lift: 0, spec: 'spine:30,0,0 chest:40,0,0 neck:20,0,0 upperArmL:-30,0,15 upperArmR:-71,1,2 forearmL:-30,0,0 forearmR:-26,31,0 handR:18,43,10 thighL:-40,0,5 thighR:-40,0,-5 shinL:60,0,0 shinR:60,0,0 footL:-20,0,0 footR:-20,0,0' },
  { id: 'umbrella', name: '傘をさす', category: 'daily', seat: false, lift: 0, spec: 'upperArmL:0,0,5 upperArmR:-12,31,-13 forearmL:-15,0,0 forearmR:-106,37,0 handR:-32,-73,35' },
  { id: 'angry', name: '怒る', category: 'emotion', seat: false, lift: 0, spec: 'chest:8,0,0 forearmL:-75,0,0 forearmR:-75,0,0 head:-12,0,0 thighL:-5,0,8 thighR:-5,0,-8 shinL:10,0,0 shinR:10,0,0 neck:0,0,0 upperArmL:-10,-20,18 upperArmR:-10,20,-18' },
  { id: 'banzai', name: 'バンザイ', category: 'emotion', seat: false, lift: 0, spec: 'chest:-10,0,0 forearmL:-12,0,0 forearmR:-12,0,0 head:-10,0,0 thighL:0,0,8 thighR:0,0,-8 neck:-15,0,0 upperArmL:-15,90,150 upperArmR:-15,-90,-150' },
  { id: 'cry', name: '泣く（顔を覆う）', category: 'emotion', seat: false, lift: 0, spec: 'spine:8,0,0 chest:15,0,0 neck:20,0,0 head:10,0,0 upperArmL:-33,-33,-15 upperArmR:-33,33,15 forearmL:-142,40,0 forearmR:-142,-40,0 handL:14,24,34 handR:14,-23,-33 shinL:8,0,0 shinR:8,0,0' },
  { id: 'depressed', name: '落ち込む（うなだれる）', category: 'emotion', seat: false, lift: 0, spec: 'chest:14,0,0 shoulderL:0,-15,-10 shoulderR:0,15,10 forearmL:-8,0,0 forearmR:-8,0,0 head:14,0,0 thighL:-5,0,0 thighR:-5,0,0 shinL:8,0,0 shinR:8,0,0 neck:22,0,0 upperArmL:-5,-10,2 upperArmR:-5,10,-2 spine:4,0,0' },
  { id: 'gutsPose', name: 'ガッツポーズ', category: 'emotion', seat: false, lift: 0, spec: 'chest:-5,5,0 neck:-10,0,0 upperArmL:4,-30,20 upperArmR:-10,-90,-95 forearmL:-95,59,0 forearmR:-115,0,0 handL:-81,55,-35' },
  { id: 'happyJump', name: '喜んで跳ねる', category: 'emotion', seat: false, lift: 0.12, spec: 'chest:-10,0,0 neck:-10,0,0 upperArmL:4,66,143 upperArmR:4,-66,-143 forearmL:-15,0,0 forearmR:-15,0,0 thighL:-83,3,5 thighR:-21,-4,-2 shinL:111,0,0 shinR:55,0,0 footL:12,-2,5 footR:6,4,-3 bodyPos:0,12,0' },
  { id: 'shy', name: '恥ずかしがる', category: 'emotion', seat: false, lift: 0, spec: 'chest:6,0,0 neck:15,-10,10 head:10,-10,5 upperArmL:1,-33,3 upperArmR:1,33,-3 forearmL:-62,-16,0 forearmR:-62,16,0 handL:35,-40,-25 handR:35,40,25 thighL:-3,-10,-4 thighR:-3,10,4 shinL:14,0,0 shinR:14,0,0' },
  { id: 'surprised', name: '驚く', category: 'emotion', seat: false, lift: 0, spec: 'spine:-5,0,0 chest:-10,0,0 neck:-10,0,0 head:-8,0,0 upperArmL:-71,-25,4 upperArmR:-71,25,-4 forearmL:-135,43,0 forearmR:-135,-43,0 handL:4,15,19 handR:4,-15,-18 thighL:10,0,5 thighR:-10,0,-5 shinL:10,0,0 shinR:15,0,0' },
  { id: 'run', name: '走る', category: 'walk', seat: false, lift: 0.03, spec: 'hips:10,8,0 spine:0,-4,0 chest:5,-10,0 neck:-10,0,0 upperArmL:41,-88,46 upperArmR:-7,20,-7 forearmL:-84,0,0 forearmR:-88,0,0 thighL:-89,9,4 thighR:-3,-5,-2 shinL:83,0,0 shinR:47,0,0 footL:7,-4,7 footR:-9,4,-2 bodyPos:0,3,0' },
  { id: 'skip', name: 'スキップ', category: 'walk', seat: false, lift: 0, spec: 'chest:0,-8,0 neck:-5,0,0 upperArmL:32,-90,45 upperArmR:-28,18,-7 forearmL:-89,0,0 forearmR:-90,0,0 thighL:-97,5,5 thighR:-13,0,0 shinL:110,0,0 shinR:24,0,0 footL:17,-1,7 footR:19,0,0 bodyPos:0,6,0' },
  { id: 'sneak', name: '忍び足', category: 'walk', seat: false, lift: 0, spec: 'hips:15,0,0 chest:10,0,0 neck:-25,0,0 upperArmL:-12,-15,17 upperArmR:-10,16,-16 forearmL:-97,-32,0 forearmR:-90,45,0 handL:23,-40,0 handR:56,20,-20 thighL:-65,6,3 thighR:-29,-4,-2 shinL:49,0,0 shinR:54,0,0 footL:27,-4,5 footR:-5,5,-2' },
  { id: 'sprint', name: '全力疾走', category: 'walk', seat: false, lift: 0, spec: 'hips:20,10,0 chest:10,-12,0 neck:-20,0,0 upperArmL:56,-88,38 upperArmR:-28,20,-2 forearmL:-71,0,0 forearmR:-88,0,0 thighL:-114,24,17 thighR:12,37,-2 shinL:88,0,0 shinR:4,0,0 footL:28,-6,25 footR:12,-37,9 bodyPos:0,4,0' },
  { id: 'stairs', name: '階段を上る', category: 'walk', seat: false, lift: 0, spec: 'hips:8,0,0 chest:4,0,0 neck:5,0,0 upperArmL:26,-42,15 upperArmR:1,21,-10 forearmL:-34,0,0 forearmR:-37,0,0 thighL:-77,6,4 thighR:-6,0,0 shinL:78,0,0 shinR:13,0,0 footL:-9,-5,4 footR:10,0,0' },
  { id: 'walk', name: '歩く', category: 'walk', seat: false, lift: 0, spec: 'hips:0,6,0 chest:0,-8,0 upperArmL:26,1,3 upperArmR:-3,-1,-3 forearmL:-23,0,0 forearmR:-27,0,0 thighL:-22,-45,-2 thighR:3,0,0 shinL:4,0,0 shinR:28,0,0 footL:2,40,-4 footR:-5,0,0' },
  { id: 'chair', name: '椅子に座る', category: 'sit', seat: true, lift: 0, spec: 'chest:-3,0,0 upperArmL:-1,-25,8 upperArmR:-1,25,-8 forearmL:-68,-70,0 forearmR:-68,70,0 handL:19,-1,19 handR:19,2,-18 thighL:-90,0,4 thighR:-90,0,-4 shinL:90,0,0 shinR:90,0,0' },
  { id: 'chairCrossLegs', name: '脚を組んで座る', category: 'sit', seat: true, lift: 0, spec: 'chest:-5,5,0 upperArmL:-26,-28,-8 upperArmR:-19,21,-8 forearmL:-53,-25,0 forearmR:-67,42,0 handL:14,-52,17 handR:20,29,-6 thighL:-106,13,-15 thighR:-88,0,-6 shinL:86,0,-12 shinR:88,0,0 footL:20,0,0' },
  { id: 'chinRest', name: '頬杖をつく', category: 'sit', seat: true, lift: 0, spec: 'spine:12,0,0 chest:22,0,0 neck:-15,0,8 head:-5,0,10 upperArmL:-51,-26,12 upperArmR:-47,37,39 forearmL:-52,-55,0 forearmR:-139,-12,0 handL:9,-10,20 handR:5,-10,-1 thighL:-90,0,6 thighR:-90,0,-6 shinL:90,0,0 shinR:90,0,0' },
  { id: 'crossLegged', name: 'あぐら', category: 'sit', seat: false, lift: 0, spec: 'spine:8,0,0 chest:5,0,0 upperArmL:-29,-15,33 upperArmR:-39,25,-29 forearmL:-29,-47,0 forearmR:-4,17,0 handL:-29,-14,30 handR:-54,43,-20 thighL:-88,70,47 thighR:-82,-67,-50 shinL:118,0,-12 shinR:135,0,11 footL:10,0,20 footR:10,0,-20' },
  { id: 'hugKnees', name: '体育座り', category: 'sit', seat: false, lift: 0, spec: 'spine:15,0,0 chest:15,0,0 neck:10,0,0 upperArmL:-65,-36,-4 upperArmR:-65,36,4 forearmL:-31,-21,0 forearmR:-31,21,0 handL:-63,45,-35 handR:-63,-45,35 thighL:-125,0,5 thighR:-125,0,-5 shinL:145,0,0 shinR:145,0,0 footL:-10,0,0 footR:-10,0,0' },
  { id: 'legsOut', name: '脚を伸ばして座る', category: 'sit', seat: false, lift: 0, spec: 'spine:-8,0,0 chest:-10,0,0 neck:5,0,0 upperArmL:31,-3,7 upperArmR:30,34,-7 forearmL:-2,51,0 forearmR:1,-15,0 handL:74,71,45 handR:77,-86,20 thighL:-80,0,5 thighR:-80,0,-5 shinL:5,0,0 shinR:5,0,0 footL:10,0,0 footR:10,0,0' },
  { id: 'seiza', name: '正座', category: 'sit', seat: false, lift: 0, spec: 'upperArmL:4,-16,2 upperArmR:4,16,-2 forearmL:-74,-45,0 forearmR:-74,45,0 handL:1,-40,21 handR:1,40,-21 thighL:-90,0,3 thighR:-90,0,-3 shinL:165,0,0 shinR:165,0,0 footL:55,0,0 footR:55,0,0' },
  { id: 'sideSit', name: '横座り', category: 'sit', seat: false, lift: 0, spec: 'chest:0,10,8 upperArmL:-30,-20,10 upperArmR:7,73,-16 forearmL:-40,0,0 forearmR:10,33,0 handR:84,-100,-45 thighL:-83,69,15 thighR:-82,70,-3 shinL:127,0,-12 shinR:120,0,-12 footL:40,0,0 footR:40,0,0' },
  { id: 'allFours', name: '四つんばい', category: 'kneel', seat: false, lift: 0, spec: 'hips:90,0,0 spine:-5,0,0 chest:-5,0,0 neck:-45,0,0 head:-25,0,0 upperArmL:-79,0,0 upperArmR:-84,20,2 forearmL:-3,100,0 forearmR:10,100,0 handL:85,94,-35 handR:85,-89,-45 thighL:-90,0,4 thighR:-90,0,-4 shinL:90,0,0 shinR:90,0,0 footL:40,0,0 footR:40,0,0' },
  { id: 'crouchLook', name: 'しゃがんで覗き込む', category: 'kneel', seat: false, lift: 0, spec: 'footL:-35,0,0 footR:30,0,0 chest:20,0,0 forearmL:-40,0,0 forearmR:-40,0,0 thighL:-125,0,12 thighR:-80,0,-10 shinL:150,0,0 shinR:160,0,0 neck:-25,0,0 upperArmL:-60,-20,10 upperArmR:-60,20,-10 spine:25,0,0' },
  { id: 'kneelBoth', name: '膝立ち', category: 'kneel', seat: false, lift: 0, spec: 'footL:40,0,0 footR:40,0,0 forearmL:-15,0,0 forearmR:-15,0,0 thighL:0,0,5 thighR:0,0,-5 shinL:90,0,0 shinR:90,0,0 upperArmL:0,0,6 upperArmR:0,0,-6' },
  { id: 'kneelOne', name: '片膝立ち', category: 'kneel', seat: false, lift: 0, spec: 'upperArmL:-47,-21,-2 upperArmR:0,0,-8 forearmL:-4,-37,0 forearmR:-15,0,0 handL:-15,-37,29 thighL:-90,0,5 thighR:0,0,-3 shinL:90,0,0 shinR:92,0,0 footR:-5,0,0' },
  { id: 'proposal', name: '片膝をついて手を差し出す', category: 'kneel', seat: false, lift: 0, spec: 'chest:5,0,0 neck:-10,0,0 upperArmL:-52,-49,-2 upperArmR:-75,0,-10 forearmL:-3,-14,0 forearmR:-15,-1,0 handL:-12,-31,31 handR:3,-91,10 thighL:-90,0,5 thighR:0,0,-3 shinL:90,0,0 shinR:92,0,0 footR:-5,0,0' },
  { id: 'squat', name: 'しゃがむ', category: 'kneel', seat: false, lift: 0, spec: 'spine:20,0,0 chest:15,0,0 neck:-20,0,0 upperArmL:-49,-11,26 upperArmR:-49,11,-26 forearmL:-92,-35,0 forearmR:-92,35,0 handL:25,-31,-20 handR:25,31,20 thighL:-120,10,18 thighR:-120,-10,-18 shinL:150,0,0 shinR:150,0,0 footL:-35,0,0 footR:-35,0,0' },
  { id: 'fetal', name: '丸まって寝る', category: 'lie', seat: false, lift: 0, spec: 'hips:0,0,90 spine:20,0,0 chest:20,0,0 neck:30,0,0 upperArmL:-10,-36,3 upperArmR:-10,36,-3 forearmL:-146,0,0 forearmR:-146,0,0 thighL:-100,0,0 thighR:-100,0,0 shinL:120,0,0 shinR:120,0,0' },
  { id: 'prone', name: 'うつ伏せ', category: 'lie', seat: false, lift: 0, spec: 'footL:40,0,0 footR:40,0,0 forearmL:-90,0,0 forearmR:-90,0,0 thighL:0,0,5 thighR:0,0,-5 neck:-10,60,0 hips:90,0,0 upperArmL:0,90,100 upperArmR:0,-90,-100' },
  { id: 'proneChin', name: 'うつ伏せで頬杖', category: 'lie', seat: false, lift: 0, spec: 'hips:90,0,0 spine:-25,0,0 chest:-30,0,0 neck:-35,0,0 upperArmL:-42,-40,-49 upperArmR:-42,40,49 forearmL:-146,2,0 forearmR:-146,-2,0 handL:29,25,-20 handR:29,-25,20 thighL:0,0,5 thighR:0,0,-5 shinL:80,0,0 shinR:110,0,0 footL:40,0,0 footR:40,0,0' },
  { id: 'sideLie', name: '横向きに寝る', category: 'lie', seat: false, lift: 0, spec: 'forearmL:-20,0,0 forearmR:-60,0,0 thighL:-35,0,0 thighR:-35,0,0 shinL:50,0,0 shinR:50,0,0 neck:0,0,-20 hips:0,0,90 upperArmL:-20,0,0 upperArmR:-90,0,0' },
  { id: 'supine', name: '仰向け', category: 'lie', seat: false, lift: 0, spec: 'footL:25,0,0 footR:25,0,0 forearmL:-10,0,0 forearmR:-10,0,0 thighL:0,0,5 thighR:0,0,-5 hips:-90,0,0 upperArmL:0,0,12 upperArmR:0,0,-12' },
  { id: 'supineHandsHead', name: '仰向けで腕枕', category: 'lie', seat: false, lift: 0, spec: 'hips:-90,0,0 neck:15,0,0 upperArmL:-61,28,166 upperArmR:-61,-28,-166 forearmL:-116,30,0 forearmR:-116,-30,0 handL:-16,23,43 handR:-16,-22,-42 thighL:-40,0,5 thighR:0,0,-5 shinL:80,0,0 footR:25,0,0' },
  { id: 'aimGun', name: '銃を構える', category: 'action', seat: false, lift: 0, spec: 'neck:10,0,0 upperArmL:-86,4,-15 upperArmR:-95,-2,14 forearmL:-11,-29,0 forearmR:-4,-49,0 handL:4,70,-3 handR:2,50,-10 thighL:-15,0,5 thighR:10,0,-5 shinL:15,0,0 shinR:10,0,0' },
  { id: 'damage', name: 'ダメージ（のけぞる）', category: 'action', seat: false, lift: 0, spec: 'spine:-12,0,0 chest:-25,0,0 neck:-25,0,0 head:-10,0,0 upperArmL:-16,16,56 upperArmR:6,-30,-51 forearmL:-54,0,0 forearmR:-60,0,0 thighL:-30,4,3 thighR:3,0,-2 shinL:32,0,0 shinR:27,0,0 footL:-12,-5,-1 footR:-5,0,2' },
  { id: 'fall', name: '転ぶ', category: 'action', seat: false, lift: 0.08, spec: 'hips:30,0,0 spine:5,0,0 chest:-5,0,0 neck:-40,0,0 upperArmL:-41,-6,16 upperArmR:-41,6,-16 forearmL:-35,-27,0 forearmR:-35,27,0 handL:-9,-25,24 handR:-9,25,-24 thighL:-70,6,3 thighR:-18,-4,-3 shinL:44,0,0 shinR:71,0,0 footL:12,-6,3 footR:-34,5,0 bodyPos:0,8,0' },
  { id: 'fightStance', name: 'ファイティングポーズ', category: 'action', seat: false, lift: 0, spec: 'hips:0,-30,0 spine:5,5,0 chest:5,5,0 neck:5,18,0 upperArmL:-60,-12,21 upperArmR:-48,19,19 forearmL:-116,11,0 forearmR:-132,11,0 handL:45,3,25 handR:53,-4,0 thighL:-31,-4,8 thighR:10,0,0 shinL:30,0,0 shinR:12,0,0 footL:1,10,-9 footR:-9,-24,6' },
  { id: 'frontKick', name: '前蹴り', category: 'action', seat: false, lift: 0, spec: 'chest:-8,0,0 neck:8,0,0 upperArmL:-43,-17,-2 upperArmR:-43,17,2 forearmL:-128,-23,0 forearmR:-128,23,0 handL:47,16,0 handR:47,-16,0 thighL:-11,0,0 thighR:-100,-26,-11 shinL:24,0,0 shinR:46,0,0 footL:-13,15,0 footR:29,17,-23' },
  { id: 'guard', name: '腕でガード', category: 'action', seat: false, lift: 0, spec: 'spine:10,0,0 chest:10,0,0 neck:15,0,0 upperArmL:-100,-38,22 upperArmR:-100,38,-22 forearmL:-96,70,0 forearmR:-96,-70,0 handL:-8,48,29 handR:-8,-47,-28 thighL:-15,0,10 thighR:-15,0,-10 shinL:25,0,0 shinR:25,0,0 footL:-5,0,0 footR:-5,0,0' },
  { id: 'highKick', name: 'ハイキック', category: 'action', seat: false, lift: 0, spec: 'hips:0,0,-22 spine:0,0,-8 chest:0,0,-8 neck:0,0,22 head:0,0,10 upperArmL:-60,-15,-13 upperArmR:56,-12,-11 forearmL:-120,-20,0 forearmR:-53,0,0 handL:50,-17,-20 thighL:-21,-5,23 thighR:-89,69,-50 shinL:36,0,0 shinR:55,0,0 footL:-17,31,-2 footR:70,40,29' },
  { id: 'jump', name: 'ジャンプ', category: 'action', seat: false, lift: 0.2, spec: 'chest:-8,0,0 neck:-10,0,0 upperArmL:9,47,159 upperArmR:9,-47,-159 forearmL:-2,0,3 forearmR:-2,0,-3 thighL:-77,0,5 thighR:-77,0,-5 shinL:112,0,0 shinR:112,0,0 footL:5,-5,2 footR:5,5,-2 bodyPos:0,20,0' },
  { id: 'punch', name: 'パンチ', category: 'action', seat: false, lift: 0, spec: 'hips:0,10,0 spine:5,8,0 chest:5,14,0 neck:0,-30,0 upperArmL:-43,-25,-33 upperArmR:-91,13,-20 forearmL:-124,-6,0 forearmR:-27,37,0 handL:41,-5,0 handR:30,45,10 thighL:-33,-1,3 thighR:14,0,-3 shinL:20,0,0 shinR:5,0,0 footL:13,10,-3 footR:-2,29,-7' },
  { id: 'swordStance', name: '剣を構える', category: 'action', seat: false, lift: 0, spec: 'hips:0,10,0 chest:0,-10,0 upperArmL:-8,-19,-2 upperArmR:-22,26,15 forearmL:-72,58,0 forearmR:-68,53,0 handL:-90,-100,45 handR:-55,-100,35 thighL:20,10,5 thighR:-20,0,-5 shinL:20,0,0 shinR:20,0,0 footL:20,0,0' },
  { id: 'throw', name: '投げる（振りかぶる）', category: 'action', seat: false, lift: 0, spec: 'hips:0,-25,0 spine:0,-10,0 chest:-8,-20,0 neck:0,40,0 upperArmL:-76,-12,13 upperArmR:-99,19,-151 forearmL:-32,-37,0 forearmR:-65,-39,0 handL:29,-41,0 handR:-56,-20,-20 thighL:-30,-2,6 thighR:15,-1,-6 shinL:4,0,0 shinR:4,0,0 footL:27,-12,-6 footR:-7,39,-4' },
  { id: 'arabesque', name: 'バレエ（アラベスク）', category: 'sport', seat: false, lift: 0, spec: 'hips:12,0,0 spine:-6,0,0 chest:-10,0,0 neck:-12,0,0 upperArmL:-101,-5,4 upperArmR:-45,28,-96 forearmL:-4,-43,0 forearmR:-14,20,0 handL:21,-45,0 handR:-61,-10,0 thighL:-19,1,-4 thighR:47,-9,0 shinL:4,0,0 shinR:41,0,0 footL:3,35,4 footR:-40,9,0' },
  { id: 'basketShoot', name: 'シュート（バスケ）', category: 'sport', seat: false, lift: 0.05, spec: 'chest:-8,0,0 neck:-20,0,0 upperArmL:-180,-96,31 upperArmR:-179,81,-9 forearmL:-65,65,0 forearmR:-42,-30,0 handL:-9,20,42 handR:-77,100,-45 shinL:10,0,0 shinR:10,0,0 footL:40,0,0 footR:40,0,0' },
  { id: 'batting', name: 'バッティング', category: 'sport', seat: false, lift: 0, spec: 'hips:10,-70,0 chest:5,0,0 neck:0,75,0 upperArmL:9,-59,-50 upperArmR:-38,-8,-46 forearmL:-101,-28,0 forearmR:-150,14,0 handL:-46,-100,-35 handR:31,0,-45 thighL:-29,-6,20 thighR:-19,-5,-2 shinL:41,0,0 shinR:32,0,0 footL:-17,6,-11 footR:-15,-6,10' },
  { id: 'cheer', name: '応援（ポンポン）', category: 'sport', seat: false, lift: 0, spec: 'neck:-8,0,0 upperArmL:21,26,34 upperArmR:12,-80,-166 forearmL:-47,0,0 forearmR:-3,0,-3 thighL:-91,3,5 thighR:-11,0,-1 shinL:110,0,0 shinR:20,0,0 footL:15,-2,5 footR:-9,-6,1' },
  { id: 'dance', name: 'ダンス（天を指す）', category: 'sport', seat: false, lift: 0, spec: 'hips:0,0,8 spine:0,0,-4 chest:0,0,-8 neck:-15,0,4 upperArmL:76,4,24 upperArmR:-160,39,-7 forearmL:-128,12,0 forearmR:-3,4,-1 handL:-8,0,15 handR:0,0,-4 thighL:-18,2,-5 thighR:-43,3,-10 shinL:27,0,0 shinR:60,0,0 footL:-9,15,-3 footR:6,-13,8' },
  { id: 'lunge', name: 'ランジ', category: 'sport', seat: false, lift: 0, spec: 'upperArmL:68,-5,22 upperArmR:68,5,-22 forearmL:-119,18,0 forearmR:-119,-18,0 handL:-13,-1,11 handR:-13,1,-11 thighL:-67,5,4 thighR:38,36,-1 shinL:41,0,0 shinR:4,0,0 footL:26,-5,3 footR:6,-35,7' },
  { id: 'soccerKick', name: 'ボールを蹴る', category: 'sport', seat: false, lift: 0, spec: 'hips:0,-12,0 chest:-10,8,0 neck:15,0,0 upperArmL:9,46,49 upperArmR:47,-19,-21 forearmL:-53,0,0 forearmR:-43,0,0 thighL:-19,-1,3 thighR:-67,-10,-1 shinL:27,0,0 shinR:41,0,0 footL:-8,20,-3 footR:70,-4,-9' },
  { id: 'swim', name: '泳ぐ（クロール）', category: 'sport', seat: false, lift: 0.3, spec: 'footL:50,0,0 footR:50,0,0 chest:0,20,0 forearmL:-10,0,0 forearmR:-5,0,0 thighL:10,0,3 thighR:-10,0,-3 neck:-20,-50,0 hips:90,0,0 upperArmL:30,0,10 upperArmR:-175,0,-5' },
  { id: 'yogaTree', name: 'ヨガ（木のポーズ）', category: 'sport', seat: false, lift: 0, spec: 'thighL:-8,1,-3 thighR:-68,-13,0 shinL:14,0,0 shinR:121,0,0 footL:-6,0,3' },
  { id: 'bow', name: 'お辞儀', category: 'stand', seat: false, lift: 0, spec: 'hips:35,0,0 spine:10,0,0 chest:10,0,0 neck:5,0,0 upperArmL:-37,73,-5 upperArmR:-37,-73,6 forearmL:-1,-75,0 forearmR:-1,85,0 handL:-20,-90,5 handR:-19,80,-8 thighL:-40,0,1 thighR:-40,-39,-2 shinL:4,0,0 shinR:4,0,0 footL:2,6,-1 footR:1,33,-2' },
  { id: 'behindBack', name: '手を後ろで組む', category: 'stand', seat: false, lift: 0, spec: 'neck:-3,0,0 upperArmL:37,-72,23 upperArmR:40,73,-26 forearmL:-81,43,0 forearmR:-88,-40,0 handL:9,19,42 handR:11,-21,-45 thighL:-11,0,1 thighR:-11,0,-1 shinL:20,0,0 shinR:20,0,0 footL:-9,12,-1 footR:-9,-12,1' },
  { id: 'facepalm', name: '顔に手を当てる', category: 'emotion', seat: false, lift: 0, spec: 'chest:5,0,0 neck:15,0,0 head:10,0,0 upperArmL:64,-5,22 upperArmR:-61,16,29 forearmL:-119,29,0 forearmR:-117,-40,0 handL:-17,-12,8 handR:22,-24,-23 thighL:-11,0,1 thighR:-21,-4,-4 shinL:20,0,0 shinR:33,0,0 footL:-9,6,-1 footR:-11,-5,3' },
  { id: 'shrug', name: '肩をすくめる', category: 'emotion', seat: false, lift: 0, spec: 'neck:0,0,8 head:0,-10,0 shoulderL:0,0,25 shoulderR:0,0,-25 upperArmL:-14,1,13 upperArmR:-14,-1,-13 forearmL:-22,81,0 forearmR:-22,-81,0 handL:-23,60,-35 handR:-23,-60,35 thighL:-11,0,1 thighR:-11,0,-1 shinL:20,0,0 shinR:20,0,0 footL:-9,6,-1 footR:-9,-6,1' },
  { id: 'takePhoto', name: '写真を撮る', category: 'daily', seat: false, lift: 0, spec: 'neck:-5,0,0 upperArmL:-79,2,-35 upperArmR:-79,-2,35 forearmL:-117,-24,0 forearmR:-117,24,0 handL:11,-10,-15 handR:11,10,15 thighL:-11,0,1 thighR:-12,-4,-4 shinL:20,0,0 shinR:33,0,0 footL:-9,6,-1 footR:-21,-15,3' },
  { id: 'readBook', name: '本を読む', category: 'daily', seat: false, lift: 0, spec: 'neck:22,0,0 head:10,0,0 upperArmL:-18,-19,7 upperArmR:-18,19,-7 forearmL:-98,45,0 forearmR:-98,-45,0 handL:-52,30,-20 handR:-52,-30,20 thighL:-11,0,1 thighR:-11,0,-1 shinL:20,0,0 shinR:20,0,0 footL:-9,6,-1 footR:-9,-6,1' },
  { id: 'reachUp', name: 'つま先立ちで手を伸ばす', category: 'daily', seat: false, lift: 0, spec: 'chest:-6,0,0 neck:-25,0,0 upperArmL:11,8,22 upperArmR:-167,3,-2 forearmL:-57,0,0 forearmR:-2,53,0 handR:-7,35,-7 thighL:-10,0,0 thighR:-10,0,0 shinL:15,0,0 shinR:15,0,0 footL:30,0,0 footR:30,0,0' },
  { id: 'tired', name: '膝に手をつく', category: 'daily', seat: false, lift: 0, spec: 'hips:40,0,0 spine:15,0,0 chest:10,0,0 neck:-30,0,0 upperArmL:-58,3,-4 upperArmR:-58,-3,4 forearmL:-3,-47,0 forearmR:-3,47,0 handL:-81,-87,44 handR:-81,88,-44 thighL:-72,4,4 thighR:-72,-4,-4 shinL:44,0,0 shinR:44,0,0 footL:-12,2,-1 footR:-12,-2,1' },
  { id: 'chairLean', name: '前かがみに座る', category: 'sit', seat: true, lift: 0, spec: 'spine:15,0,0 chest:25,0,0 neck:-20,0,0 upperArmL:-73,5,-10 upperArmR:-73,-5,10 forearmL:-17,-56,0 forearmR:-17,56,0 handL:-72,39,-35 handR:-72,-39,35 thighL:-90,0,6 thighR:-90,0,-6 shinL:90,0,0 shinR:90,0,0' },
  { id: 'lookUpPoint', name: '空を指差す', category: 'stand', seat: false, lift: 0, spec: 'chest:-5,0,0 neck:-30,0,0 head:-15,0,0 upperArmL:16,0,15 upperArmR:-152,42,-11 forearmL:-40,0,0 forearmR:-4,-78,-1 handR:-11,-59,9 thighL:-11,0,1 thighR:-14,-4,-4 shinL:20,0,0 shinR:34,0,0 footL:-9,6,-1 footR:-20,-10,3' },
  { id: 'archery', name: '弓を引く', category: 'action', seat: false, lift: 0, spec: 'hips:0,-55,0 spine:0,-10,0 chest:0,-20,0 neck:0,70,0 upperArmL:-97,-83,71 upperArmR:-31,50,48 forearmL:-3,36,1 forearmR:-130,-60,0 handL:4,40,-1 handR:85,-8,35 thighL:-19,-5,11 thighR:-16,3,-8 shinL:31,0,0 shinR:30,0,0 footL:-13,40,-12 footR:-14,-1,9' },
  { id: 'sideKick', name: '横蹴り', category: 'action', seat: false, lift: 0, spec: 'hips:0,0,-35 spine:0,0,-10 chest:0,0,-10 neck:0,0,30 head:0,0,10 upperArmL:-61,-15,-17 upperArmR:-36,18,3 forearmL:-118,-5,0 forearmR:-130,5,0 handL:57,-37,-11 handR:40,-31,-42 thighL:-26,-14,36 thighR:-37,25,-40 shinL:40,0,0 shinR:52,0,0 footL:-18,40,-3 footR:-35,-2,21' },
  { id: 'pushForward', name: '両手で押し出す', category: 'action', seat: false, lift: 0, spec: 'chest:8,0,0 neck:-5,0,0 upperArmL:-73,5,-13 upperArmR:-73,-5,13 forearmL:-30,-56,0 forearmR:-30,56,0 handL:-64,-80,45 handR:-64,80,-45 thighL:-33,-1,1 thighR:14,-47,-8 shinL:21,0,0 shinR:18,0,0 footL:12,5,-2 footR:-1,38,0' },
  { id: 'warrior2', name: 'ヨガ（戦士のポーズ）', category: 'sport', seat: false, lift: 0, spec: 'neck:0,70,0 upperArmL:77,73,88 upperArmR:77,-73,-88 forearmL:-3,4,1 forearmR:-3,-4,-1 handL:2,0,0 handR:2,0,0 thighL:-37,-17,30 thighR:-21,7,-27 shinL:52,0,0 shinR:38,0,0 footL:-19,40,-34 footR:-17,-7,28' },
  { id: 'pushup', name: '腕立て伏せ', category: 'sport', seat: false, lift: 0, spec: 'hips:80,0,0 neck:-30,0,0 upperArmL:-29,-28,56 upperArmR:-29,28,-55 forearmL:-118,-56,0 forearmR:-118,56,0 handL:52,18,45 handR:52,-18,-45 thighL:-13,0,0 thighR:-13,0,0 shinL:24,0,0 shinR:24,0,0 footL:-40,0,0 footR:-40,0,0' },
  { id: 'tennisServe', name: 'テニスのサーブ', category: 'sport', seat: false, lift: 0, spec: 'spine:-8,0,0 chest:-15,0,0 neck:-25,0,0 upperArmL:-159,-57,12 upperArmR:-7,88,-172 forearmL:-3,98,1 forearmR:3,0,1 handL:61,62,45 thighL:-25,-1,1 thighR:-4,1,-5 shinL:25,0,0 shinR:27,0,0 footL:-1,-20,-2 footR:2,1,5' },
  { id: 'volleyball', name: 'レシーブ（バレー）', category: 'sport', seat: false, lift: 0, spec: 'hips:30,0,0 chest:10,0,0 neck:-35,0,0 upperArmL:-36,4,-13 upperArmR:-36,-4,13 forearmL:-4,8,0 forearmR:-4,-8,0 handL:-33,60,-35 handR:-33,-60,35 thighL:-90,-17,8 thighR:-90,17,-8 shinL:81,0,0 shinR:81,0,0 footL:-23,17,-18 footR:-23,-17,18' },
  { id: 'quadStretch', name: '太ももを伸ばす', category: 'sport', seat: false, lift: 0, spec: 'spine:5,0,0 chest:5,0,-6 neck:-3,0,4 upperArmL:9,50,60 upperArmR:21,2,10 forearmL:-51,0,0 forearmR:-3,0,0 thighL:-8,1,-3 thighR:-10,-2,-26 shinL:14,0,0 shinR:153,0,0 footL:-6,8,3 footR:-40,26,2' },
];

/**
 * ポーズごとの手の形（人形の左手, 右手）。HAND_SHAPES の id。
 * 腕を組む・祈る・腰に手…のように手が体や物に触れるポーズは、手の位置と向きを「どこに置くか」から組み立て直した（v53）
 */
export const POSE_HANDS = {
  attention: ['relaxed', 'relaxed'],
  contrapposto: ['relaxed', 'relaxed'],
  crossArms: ['relaxed', 'relaxed'],
  handsOnHips: ['relaxed', 'relaxed'],
  lookBack: ['relaxed', 'relaxed'],
  natural: ['relaxed', 'relaxed'],
  phone: ['relaxed', 'grip'],
  pointForward: ['relaxed', 'point'],
  pray: ['flat', 'flat'],
  raiseHand: ['relaxed', 'open'],
  salute: ['relaxed', 'flat'],
  scratchHead: ['relaxed', 'relaxed'],
  stretch: ['open', 'open'],
  think: ['relaxed', 'fist'],
  wave: ['relaxed', 'open'],
  bag: ['relaxed', 'grip'],
  carryBox: ['flat', 'flat'],
  drink: ['relaxed', 'grip'],
  lean: ['relaxed', 'relaxed'],
  pickUp: ['relaxed', 'pinch'],
  umbrella: ['relaxed', 'grip'],
  angry: ['fist', 'fist'],
  banzai: ['open', 'open'],
  cry: ['flat', 'flat'],
  depressed: ['relaxed', 'relaxed'],
  gutsPose: ['fist', 'fist'],
  happyJump: ['open', 'open'],
  shy: ['relaxed', 'relaxed'],
  surprised: ['open', 'open'],
  run: ['fist', 'fist'],
  skip: ['relaxed', 'relaxed'],
  sneak: ['relaxed', 'relaxed'],
  sprint: ['fist', 'fist'],
  stairs: ['relaxed', 'relaxed'],
  walk: ['relaxed', 'relaxed'],
  chair: ['relaxed', 'relaxed'],
  chairCrossLegs: ['relaxed', 'relaxed'],
  chinRest: ['relaxed', 'fist'],
  crossLegged: ['relaxed', 'relaxed'],
  hugKnees: ['relaxed', 'relaxed'],
  legsOut: ['flat', 'flat'],
  seiza: ['relaxed', 'relaxed'],
  sideSit: ['relaxed', 'flat'],
  allFours: ['flat', 'flat'],
  crouchLook: ['relaxed', 'relaxed'],
  kneelBoth: ['relaxed', 'relaxed'],
  kneelOne: ['relaxed', 'relaxed'],
  proposal: ['relaxed', 'open'],
  squat: ['relaxed', 'relaxed'],
  fetal: ['relaxed', 'relaxed'],
  prone: ['relaxed', 'relaxed'],
  proneChin: ['relaxed', 'relaxed'],
  sideLie: ['relaxed', 'relaxed'],
  supine: ['relaxed', 'relaxed'],
  supineHandsHead: ['relaxed', 'relaxed'],
  aimGun: ['grip', 'grip'],
  damage: ['open', 'open'],
  fall: ['open', 'open'],
  fightStance: ['fist', 'fist'],
  frontKick: ['fist', 'fist'],
  guard: ['fist', 'fist'],
  highKick: ['fist', 'fist'],
  jump: ['open', 'open'],
  punch: ['fist', 'fist'],
  swordStance: ['grip', 'grip'],
  throw: ['open', 'grip'],
  arabesque: ['flat', 'flat'],
  basketShoot: ['open', 'open'],
  batting: ['grip', 'grip'],
  cheer: ['fist', 'fist'],
  dance: ['relaxed', 'point'],
  lunge: ['relaxed', 'relaxed'],
  soccerKick: ['relaxed', 'relaxed'],
  swim: ['flat', 'flat'],
  yogaTree: ['flat', 'flat'],
  bow: ['flat', 'flat'],
  behindBack: ['relaxed', 'relaxed'],
  facepalm: ['relaxed', 'flat'],
  shrug: ['open', 'open'],
  takePhoto: ['grip', 'grip'],
  readBook: ['relaxed', 'relaxed'],
  reachUp: ['relaxed', 'open'],
  tired: ['flat', 'flat'],
  chairLean: ['relaxed', 'relaxed'],
  lookUpPoint: ['relaxed', 'point'],
  archery: ['fist', 'pinch'],
  sideKick: ['fist', 'fist'],
  pushForward: ['open', 'open'],
  warrior2: ['flat', 'flat'],
  pushup: ['flat', 'flat'],
  tennisServe: ['open', 'grip'],
  volleyball: ['flat', 'flat'],
  quadStretch: ['relaxed', 'grip'],
};

/** spec 文字列を {関節キー: {x,y,z}} に展開する */
export function parseSpec(spec) {
  const out = {};
  if (!spec) return out;
  for (const token of String(spec).split(/\s+/)) {
    if (!token) continue;
    const i = token.indexOf(':');
    if (i < 0) continue;
    const key = token.slice(0, i);
    const nums = token.slice(i + 1).split(',').map(Number);
    if (nums.length < 3 || nums.some(n => !isFinite(n))) continue;
    out[key] = { x: nums[0], y: nums[1], z: nums[2] };
  }
  return out;
}

/** 角度一式を spec 文字列に畳む（0 のものは省く） */
export function toSpec(angles) {
  const parts = [];
  for (const key of Object.keys(angles)) {
    const a = angles[key];
    if (!a) continue;
    const x = Math.round(a.x), y = Math.round(a.y), z = Math.round(a.z);
    if (x === 0 && y === 0 && z === 0) continue;
    parts.push(key + ':' + x + ',' + y + ',' + z);
  }
  return parts.join(' ');
}

export const POSES_BY_CATEGORY = POSE_CATEGORIES.map(c => ({
  ...c,
  poses: POSE_PRESETS.filter(p => p.category === c.key),
}));

// ---- 手の形（左手基準。右手は左右反転して当てる）----
// 書式: "指の骨:X,Y,Z"（度）
//   人差し指〜小指  X=曲げる（マイナスで手のひら側へ） / Y=ひねり / Z=開く（プラスで親指側へ）
//   親指の付け根    X=手のひらの面の中で小指側へ倒す（マイナス） / Z=手のひらから前へ離す（プラス）
//   親指の先の二節  X=曲げる（マイナスで人差し指・中指の第二関節のほうへ）
// 親指の角度は、実際の素体で「握ったときに人差し指と中指の中節に乗る」
// 「OK で人差し指の先に触れる」などの位置になるよう、数値で探して決めた。
export const HAND_SHAPES = [
  { id: 'flat', name: '平ら（初期）', spec: '' },
  { id: 'relaxed', name: '自然', spec: 'index1:-15,0,3 index2:-25,0,0 index3:-15,0,0 middle1:-20,0,0 middle2:-30,0,0 middle3:-17,0,0 ring1:-25,0,-3 ring2:-35,0,0 ring3:-18,0,0 pinky1:-30,0,-6 pinky2:-38,0,0 pinky3:-20,0,0 thumb1:5,0,-10 thumb2:0,0,0 thumb3:0,0,0' },
  { id: 'open', name: 'パー', spec: 'index1:8,0,14 middle1:8,0,0 ring1:8,0,-10 pinky1:8,0,-22 thumb1:30,0,-25 thumb2:0,0,0 thumb3:0,0,0' },
  { id: 'fist', name: 'グー', spec: 'index1:-88,0,-3 index2:-100,0,0 index3:-65,0,0 middle1:-88,0,0 middle2:-100,0,0 middle3:-65,0,0 ring1:-88,0,3 ring2:-100,0,0 ring3:-65,0,0 pinky1:-88,0,6 pinky2:-100,0,0 pinky3:-65,0,0 thumb1:-5,0,45 thumb2:-50,0,0 thumb3:-70,0,0' },
  { id: 'point', name: '指差し', spec: 'index1:0,0,2 middle1:-88,0,0 middle2:-100,0,0 middle3:-65,0,0 ring1:-88,0,3 ring2:-100,0,0 ring3:-65,0,0 pinky1:-88,0,6 pinky2:-100,0,0 pinky3:-65,0,0 thumb1:-10,0,50 thumb2:-70,0,0 thumb3:-40,0,0' },
  { id: 'peace', name: 'ピース', spec: 'index1:0,0,12 middle1:0,0,-10 ring1:-88,0,3 ring2:-100,0,0 ring3:-65,0,0 pinky1:-88,0,6 pinky2:-100,0,0 pinky3:-65,0,0 thumb1:-40,0,35 thumb2:-60,0,0 thumb3:-30,0,0' },
  { id: 'ok', name: 'OK', spec: 'index1:-50,0,0 index2:-60,0,0 index3:-40,0,0 middle1:-10,0,-3 middle2:-12,0,0 middle3:-6,0,0 ring1:-14,0,-10 ring2:-14,0,0 ring3:-8,0,0 pinky1:-20,0,-18 pinky2:-16,0,0 pinky3:-10,0,0 thumb1:-15,0,25 thumb2:0,0,0 thumb3:-70,0,0' },
  { id: 'thumbsUp', name: 'いいね', spec: 'index1:-88,0,-3 index2:-100,0,0 index3:-65,0,0 middle1:-88,0,0 middle2:-100,0,0 middle3:-65,0,0 ring1:-88,0,3 ring2:-100,0,0 ring3:-65,0,0 pinky1:-88,0,6 pinky2:-100,0,0 pinky3:-65,0,0 thumb1:60,0,-25 thumb2:10,0,0 thumb3:0,0,0' },
  { id: 'grip', name: '握る（棒）', spec: 'index1:-55,0,-2 index2:-75,0,0 index3:-45,0,0 middle1:-58,0,0 middle2:-75,0,0 middle3:-45,0,0 ring1:-60,0,2 ring2:-75,0,0 ring3:-45,0,0 pinky1:-62,0,4 pinky2:-75,0,0 pinky3:-45,0,0 thumb1:-55,0,5 thumb2:20,0,0 thumb3:0,0,0' },
  { id: 'pinch', name: 'つまむ', spec: 'index1:-40,0,0 index2:-45,0,0 index3:-25,0,0 middle1:-45,0,0 middle2:-60,0,0 middle3:-30,0,0 ring1:-55,0,2 ring2:-70,0,0 ring3:-35,0,0 pinky1:-60,0,4 pinky2:-75,0,0 pinky3:-40,0,0 thumb1:-30,0,10 thumb2:0,0,0 thumb3:-10,0,0' },
  { id: 'claw', name: '爪を立てる', spec: 'index1:-15,0,10 index2:-80,0,0 index3:-60,0,0 middle1:-15,0,0 middle2:-82,0,0 middle3:-60,0,0 ring1:-15,0,-8 ring2:-82,0,0 ring3:-60,0,0 pinky1:-15,0,-16 pinky2:-80,0,0 pinky3:-60,0,0 thumb1:-10,0,30 thumb2:-25,0,0 thumb3:-60,0,0' },
  { id: 'knife', name: '手刀', spec: 'index1:0,0,-3 ring1:0,0,2 pinky1:0,0,5 thumb1:-15,0,-20 thumb2:0,0,0 thumb3:0,0,0' },
  { id: 'three', name: '3', spec: 'index1:0,0,10 middle1:0,0,0 ring1:0,0,-8 pinky1:-88,0,6 pinky2:-100,0,0 pinky3:-65,0,0 thumb1:-50,0,30 thumb2:-70,0,0 thumb3:20,0,0' },
  { id: 'four', name: '4', spec: 'index1:0,0,12 middle1:0,0,1 ring1:0,0,-9 pinky1:0,0,-18 thumb1:-25,0,10 thumb2:-70,0,0 thumb3:-70,0,0' },
  { id: 'rock', name: 'ロック', spec: 'index1:0,0,8 middle1:-88,0,0 middle2:-100,0,0 middle3:-65,0,0 ring1:-88,0,3 ring2:-100,0,0 ring3:-65,0,0 pinky1:0,0,-14 thumb1:-25,0,35 thumb2:-50,0,0 thumb3:-60,0,0' },
  { id: 'phone', name: '電話', spec: 'index1:-88,0,-3 index2:-100,0,0 index3:-65,0,0 middle1:-88,0,0 middle2:-100,0,0 middle3:-65,0,0 ring1:-88,0,3 ring2:-100,0,0 ring3:-65,0,0 pinky1:0,0,-18 thumb1:60,0,-30 thumb2:10,0,0 thumb3:0,0,0' },
];

// ---- 顔の向き・表情 ----
export const FACE_PRESETS = [
  { id: 'front', name: '正面', spec: '' },
  { id: 'lookUp', name: '見上げる', spec: 'head:-18,0,0 neck:-28,0,0' },
  { id: 'lookDown', name: '見下ろす', spec: 'head:14,0,0 neck:28,0,0' },
  { id: 'turnLeft', name: '左を向く', spec: 'head:0,28,0 neck:0,45,0' },
  { id: 'turnRight', name: '右を向く', spec: 'head:0,-28,0 neck:0,-45,0' },
  { id: 'lookBack', name: '振り向く', spec: 'head:-6,40,0 neck:0,70,0' },
  { id: 'tilt', name: '首をかしげる', spec: 'head:0,6,-12 neck:0,8,-16' },
  { id: 'threeQuarterUp', name: '斜め上を見る', spec: 'head:-14,18,0 neck:-16,32,0' },
  { id: 'threeQuarterDown', name: '斜め下を見る', spec: 'head:10,-18,0 neck:20,-30,0' },
  { id: 'openMouth', name: '口を開ける', spec: 'jaw:26,0,0' },
  { id: 'surprise', name: '驚く', spec: 'head:-8,0,0 jaw:32,0,0 neck:-12,0,0' },
  { id: 'laugh', name: '笑う', spec: 'head:-12,0,4 jaw:22,0,0 neck:-18,0,6' },
  { id: 'sleepy', name: 'うとうと', spec: 'head:14,0,8 neck:30,0,12' },
  { id: 'shyFace', name: '恥ずかしがる', spec: 'head:10,-12,6 neck:18,-20,8' },
];

/** 指の spec を {骨キー: {x,y,z}} に展開する */
export function parseFingerSpec(spec) {
  const out = {};
  if (!spec) return out;
  for (const token of String(spec).split(/\s+/)) {
    const i = token.indexOf(':');
    if (i < 0) continue;
    const nums = token.slice(i + 1).split(',').map(Number);
    if (nums.length < 3 || nums.some(n => !isFinite(n))) continue;
    out[token.slice(0, i)] = { x: nums[0], y: nums[1], z: nums[2] };
  }
  return out;
}

// ===== poses.js ここまで =====
