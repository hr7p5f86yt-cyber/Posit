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
  { key: 'sport', name: 'スポーツ' },
  { key: 'dance', name: 'ダンス' },
];

export const POSE_PRESETS = [
  { id: 'armsOpen', name: '両手を広げる', category: 'stand', seat: false, lift: 0, spec: 'chest:-6,0,0 forearmL:-8,0,0 forearmR:-8,0,0 neck:-8,0,0 upperArmL:-10,90,85 upperArmR:-10,-90,-85' },
  { id: 'attention', name: '気をつけ', category: 'stand', seat: false, lift: 0, spec: 'upperArmL:2,0,9 upperArmR:2,0,-9 forearmL:-4,0,0 forearmR:-4,0,0 handL:2,0,-6 handR:2,0,6' },
  { id: 'contrapposto', name: '片足重心で立つ', category: 'stand', seat: false, lift: 0, spec: 'hips:0,8,5 spine:0,-3,-4 chest:0,-4,-6 neck:0,0,4 upperArmL:3,1,15 upperArmR:-3,0,-8 forearmL:-24,0,0 forearmR:-14,0,0 handL:11,1,-9 thighL:-2,0,-9 thighR:-28,1,-11 shinL:4,0,0 shinR:42,0,0 footL:-1,10,4 footR:-13,-10,5' },
  { id: 'crossArms', name: '腕を組む', category: 'stand', seat: false, lift: 0, spec: 'hips:0,-6,-4 spine:0,2,3 chest:-4,3,4 neck:5,-5,-8 upperArmL:-3,-36,-3 upperArmR:-15,32,7 forearmL:-85,6,0 forearmR:-84,35,0 handL:15,0,-35 handR:-44,-65,35 thighL:-24,1,10 thighR:-3,0,7 shinL:36,0,0 shinR:5,0,0 footL:-11,11,-4 footR:-1,-8,-4' },
  { id: 'handsOnHips', name: '両手を腰に', category: 'stand', seat: false, lift: 0, spec: 'upperArmL:48,-9,24 upperArmR:48,9,-24 forearmL:-106,-8,0 forearmR:-106,8,0 handL:4,33,12 handR:4,-33,-12 thighL:0,0,6 thighR:0,0,-6' },
  { id: 'lookBack', name: '振り返る', category: 'stand', seat: false, lift: 0, spec: 'hips:0,-6,-4 spine:0,20,3 chest:0,28,4 neck:0,40,-3 head:-5,25,0 upperArmL:5,0,8 upperArmR:-8,0,-6 forearmL:-4,0,0 forearmR:-15,0,0 handL:-4,0,-2 thighL:-24,1,10 thighR:-3,0,7 shinL:36,0,0 shinR:5,0,0 footL:-11,11,-4 footR:-1,-8,-4' },
  { id: 'natural', name: '自然に立つ', category: 'stand', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:0,-3,-4 neck:3,0,3 upperArmL:7,1,14 upperArmR:-3,0,-7 forearmL:-21,0,0 forearmR:-16,0,0 handL:5,0,-7 handR:1,0,1 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'phone', name: 'スマホを見る', category: 'stand', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:0,-3,-4 neck:25,0,3 head:15,0,0 upperArmL:-6,0,11 upperArmR:-24,27,-3 forearmL:-4,0,0 forearmR:-109,-11,0 handL:-1,0,-6 handR:1,-60,-17 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'pointForward', name: '前を指差す', category: 'stand', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:0,5,-4 neck:0,0,3 upperArmL:2,1,14 upperArmR:-85,0,-5 forearmL:-21,0,0 forearmR:-5,0,0 handL:9,1,-9 handR:0,90,5 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'pray', name: '祈る', category: 'stand', seat: false, lift: 0, spec: 'neck:20,0,0 head:10,0,0 upperArmL:-15,-35,11 upperArmR:-15,35,-11 forearmL:-107,-81,0 forearmR:-107,81,0 handL:14,75,45 handR:14,-75,-45' },
  { id: 'raiseHand', name: '手を挙げる', category: 'stand', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:0,-3,-4 neck:0,0,3 upperArmL:-6,0,11 upperArmR:0,-90,-170 forearmL:-4,0,0 forearmR:-5,0,0 handL:-1,0,-6 handR:-5,0,0 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'salute', name: '敬礼', category: 'stand', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:0,-3,-4 neck:0,0,3 upperArmL:2,0,14 upperArmR:-27,-35,-134 forearmL:-5,0,0 forearmR:-115,-24,0 handL:2,0,-11 handR:-16,0,-19 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'scratchHead', name: '頭をかく', category: 'stand', seat: false, lift: 0, spec: 'hips:0,-6,-4 spine:0,2,3 chest:0,3,4 neck:8,-5,3 upperArmL:-4,0,8 upperArmR:-72,-11,-149 forearmL:-4,0,0 forearmR:-126,-100,0 handL:-2,0,-3 handR:-29,-24,-37 thighL:-24,1,10 thighR:-3,0,7 shinL:36,0,0 shinR:5,0,0 footL:-11,11,-4 footR:-1,-8,-4' },
  { id: 'stretch', name: '伸びをする', category: 'stand', seat: false, lift: 0, spec: 'chest:-12,0,0 forearmL:-8,0,0 forearmR:-8,0,0 head:-10,0,0 neck:-12,0,0 upperArmL:0,90,172 upperArmR:0,-90,-172' },
  { id: 'think', name: '考える（あごに手）', category: 'stand', seat: false, lift: 0, spec: 'hips:0,-6,-4 spine:0,2,3 chest:0,3,4 neck:12,-5,-13 head:5,-8,0 upperArmL:-25,-73,7 upperArmR:-32,22,5 forearmL:-78,65,0 forearmR:-137,-14,0 handL:0,51,-23 handR:7,-49,-17 thighL:-24,1,10 thighR:-3,0,7 shinL:36,0,0 shinR:5,0,0 footL:-11,11,-4 footR:-1,-8,-4' },
  { id: 'wave', name: '手を振る', category: 'stand', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:0,-3,-4 upperArmL:-6,-1,10 upperArmR:-50,-24,-109 forearmL:-6,0,0 forearmR:-80,32,0 handL:-1,0,-4 handR:9,-50,-11 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'bag', name: 'かばんを肩にかける', category: 'daily', seat: false, lift: 0, spec: 'hips:0,-6,-4 spine:0,2,3 chest:0,3,4 neck:0,0,-3 upperArmL:-1,-1,9 upperArmR:6,8,-18 forearmL:-4,0,0 forearmR:-150,-46,0 handL:-4,0,-3 handR:-38,-44,14 thighL:-24,1,10 thighR:-3,0,7 shinL:36,0,0 shinR:5,0,0 footL:-11,11,-4 footR:-1,-8,-4' },
  { id: 'carryBox', name: '箱を運ぶ', category: 'daily', seat: false, lift: 0, spec: 'spine:-5,0,0 chest:-5,0,0 upperArmL:0,-8,20 upperArmR:0,8,-20 forearmL:-90,-16,0 forearmR:-90,16,0 handL:30,35,-12 handR:30,-35,13 shinL:8,0,0 shinR:8,0,0' },
  { id: 'drink', name: '飲む', category: 'daily', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:0,-3,-4 neck:-15,0,3 head:-10,0,0 upperArmL:-6,0,11 upperArmR:-75,26,2 forearmL:-4,0,0 forearmR:-126,33,0 handL:-1,0,-6 handR:5,-5,-5 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'lean', name: '壁にもたれる', category: 'daily', seat: false, lift: 0, spec: 'hips:-8,0,0 chest:-5,0,0 upperArmL:35,-82,37 upperArmR:35,86,-34 forearmL:-79,-11,0 forearmR:-76,11,0 handL:-33,-17,7 handR:-31,18,-11 thighL:-18,-1,5 thighR:-30,-14,7 shinL:21,0,0 shinR:66,0,0 footL:-8,0,-2 footR:9,-1,6' },
  { id: 'pickUp', name: '物を拾う', category: 'daily', seat: false, lift: 0, spec: 'hips:45,0,0 spine:12,0,0 chest:10,0,0 neck:16,-18,27 head:16,0,0 upperArmL:-42,-16,13 upperArmR:-77,-58,10 forearmL:-93,-40,0 forearmR:-8,79,0 handL:4,-39,22 handR:-39,77,-16 thighL:-118,-1,7 thighR:-107,1,-6 shinL:102,0,0 shinR:101,0,0 footL:-28,4,-3 footR:-40,-6,4' },
  { id: 'umbrella', name: '傘をさす', category: 'daily', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:0,-3,-4 neck:0,0,3 upperArmL:0,1,11 upperArmR:-12,31,-13 forearmL:-23,0,0 forearmR:-106,37,0 handL:8,0,-6 handR:-32,-73,35 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'angry', name: '怒る', category: 'emotion', seat: false, lift: 0, spec: 'chest:8,0,0 forearmL:-75,0,0 forearmR:-75,0,0 head:-12,0,0 thighL:-5,0,8 thighR:-5,0,-8 shinL:10,0,0 shinR:10,0,0 neck:0,0,0 upperArmL:-10,-20,18 upperArmR:-10,20,-18' },
  { id: 'banzai', name: 'バンザイ', category: 'emotion', seat: false, lift: 0, spec: 'chest:-10,0,0 forearmL:-12,0,0 forearmR:-12,0,0 head:-10,0,0 thighL:0,0,8 thighR:0,0,-8 neck:-15,0,0 upperArmL:-15,90,150 upperArmR:-15,-90,-150' },
  { id: 'cry', name: '泣く（顔を覆う）', category: 'emotion', seat: false, lift: 0, spec: 'spine:8,0,0 chest:15,0,0 neck:20,0,0 head:10,0,0 upperArmL:-32,-19,-2 upperArmR:-31,18,2 forearmL:-136,40,0 forearmR:-137,-40,0 handL:13,41,21 handR:13,-41,-20 shinL:8,0,0 shinR:8,0,0' },
  { id: 'depressed', name: '落ち込む（うなだれる）', category: 'emotion', seat: false, lift: 0, spec: 'spine:4,0,0 chest:14,0,0 neck:17,0,0 head:16,0,0 shoulderL:0,-15,-10 shoulderR:0,15,10 upperArmL:-22,-3,15 upperArmR:-22,3,-15 forearmL:-4,-25,0 forearmR:-4,25,0 handL:5,-20,-5 handR:5,20,5 thighL:-5,0,0 thighR:-5,0,0 shinL:8,0,0 shinR:8,0,0' },
  { id: 'gutsPose', name: 'ガッツポーズ', category: 'emotion', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:-5,2,-4 neck:-10,0,3 upperArmL:4,-30,20 upperArmR:-10,-90,-95 forearmL:-95,59,0 forearmR:-115,0,0 handL:-81,55,-35 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'happyJump', name: '喜んで跳ねる', category: 'emotion', seat: false, lift: 0.12, spec: 'chest:-10,0,0 neck:-10,0,0 upperArmL:4,66,143 upperArmR:4,-66,-143 forearmL:-15,0,0 forearmR:-15,0,0 thighL:-83,3,5 thighR:-21,-4,-2 shinL:111,0,0 shinR:55,0,0 footL:68,0,0 footR:68,0,0 bodyPos:0,12,0' },
  { id: 'shy', name: '恥ずかしがる', category: 'emotion', seat: false, lift: 0, spec: 'chest:6,0,0 neck:15,-10,10 head:10,-10,5 upperArmL:3,-27,9 upperArmR:7,26,-11 forearmL:-65,-16,0 forearmR:-73,16,0 handL:33,-43,-31 handR:37,44,32 thighL:-7,-10,-2 thighR:2,10,1 shinL:21,0,0 shinR:4,0,0 footL:-4,0,-2 footR:5,0,2' },
  { id: 'surprised', name: '驚く', category: 'emotion', seat: false, lift: 0, spec: 'spine:-5,0,0 chest:-10,0,0 neck:-10,0,0 head:-8,0,0 upperArmL:-71,-25,4 upperArmR:-71,25,-4 forearmL:-135,43,0 forearmR:-135,-43,0 handL:4,15,19 handR:4,-15,-18 thighL:10,0,5 thighR:-10,0,-5 shinL:10,0,0 shinR:15,0,0' },
  { id: 'run', name: '走る', category: 'walk', seat: false, lift: 0.03, spec: 'hips:10,8,0 spine:0,-4,0 chest:5,-10,0 neck:-8,2,13 head:0,4,0 upperArmL:46,-15,25 upperArmR:-19,23,0 forearmL:-112,2,0 forearmR:-108,1,0 handL:-32,2,41 handR:-19,3,-3 thighL:-89,9,4 thighR:-3,-5,-2 shinL:83,0,0 shinR:47,0,0 footL:7,-4,7 footR:-9,4,-2 bodyPos:0,3,0' },
  { id: 'skip', name: 'スキップ', category: 'walk', seat: false, lift: 0, spec: 'chest:0,-8,0 neck:-5,0,0 upperArmL:32,-90,45 upperArmR:-28,18,-7 forearmL:-89,0,0 forearmR:-90,0,0 thighL:-97,5,5 thighR:-13,0,0 shinL:110,0,0 shinR:24,0,0 footL:68,0,0 footR:19,0,0 bodyPos:0,6,0' },
  { id: 'sneak', name: '忍び足', category: 'walk', seat: false, lift: 0, spec: 'hips:15,0,0 chest:10,0,0 neck:-25,0,0 upperArmL:-12,-15,17 upperArmR:-10,16,-16 forearmL:-97,-32,0 forearmR:-90,45,0 handL:23,-40,0 handR:56,20,-20 thighL:-65,6,3 thighR:-29,-4,-2 shinL:49,0,0 shinR:54,0,0 footL:27,-4,5 footR:-5,5,-2' },
  { id: 'sprint', name: '全力疾走', category: 'walk', seat: false, lift: 0, spec: 'hips:20,10,0 chest:10,-12,0 neck:-18,0,-5 head:-12,0,0 upperArmL:49,-25,31 upperArmR:-58,22,4 forearmL:-80,45,0 forearmR:-106,3,0 handL:-90,-17,-3 handR:-14,0,-7 thighL:-118,5,0 thighR:12,37,-2 shinL:88,0,0 shinR:4,0,0 footL:30,2,1 footR:12,-37,9 bodyPos:0,4,0' },
  { id: 'stairs', name: '階段を上る', category: 'walk', seat: false, lift: 0, spec: 'hips:8,0,0 chest:4,0,0 neck:5,0,0 upperArmL:26,-42,15 upperArmR:1,21,-10 forearmL:-34,0,0 forearmR:-37,0,0 thighL:-77,6,4 thighR:-6,0,0 shinL:78,0,0 shinR:13,0,0 footL:-9,-5,4 footR:10,0,0' },
  { id: 'walk', name: '歩く', category: 'walk', seat: false, lift: 0, spec: 'hips:0,6,0 chest:0,-8,0 upperArmL:26,1,3 upperArmR:-2,20,-11 forearmL:-23,0,0 forearmR:-34,0,0 handR:5,-22,-3 thighL:-22,-45,-2 thighR:3,0,0 shinL:4,0,0 shinR:28,0,0 footL:2,40,-4 footR:-5,0,0' },
  { id: 'chair', name: '椅子に座る', category: 'sit', seat: true, lift: 0, spec: 'chest:-3,0,0 upperArmL:-1,-22,11 upperArmR:-2,21,-11 forearmL:-80,-70,0 forearmR:-82,70,0 handL:19,-3,8 handR:19,5,-4 thighL:-90,0,4 thighR:-90,0,-4 shinL:90,0,0 shinR:90,0,0' },
  { id: 'chairCrossLegs', name: '脚を組んで座る', category: 'sit', seat: true, lift: 0, spec: 'chest:-5,5,0 upperArmL:-26,-26,-6 upperArmR:-19,20,-8 forearmL:-60,-25,0 forearmR:-68,42,0 handL:18,-52,12 handR:20,30,-5 thighL:-91,47,2 thighR:-89,2,-9 shinL:79,0,0 shinR:89,0,0 footL:20,-18,29 footR:-1,3,2' },
  { id: 'chinRest', name: '頬杖をつく', category: 'sit', seat: true, lift: 0, spec: 'spine:25,0,0 chest:35,0,0 neck:10,0,0 upperArmL:-44,-19,9 upperArmR:-38,14,-4 forearmL:-105,-35,0 forearmR:-147,-25,0 handL:4,-51,2 handR:13,-59,-14 thighL:-90,0,6 thighR:-90,0,-6 shinL:90,0,0 shinR:90,0,0' },
  { id: 'crossLegged', name: 'あぐら', category: 'sit', seat: false, lift: 0, spec: 'spine:8,0,0 chest:5,0,0 upperArmL:-26,-9,34 upperArmR:-28,19,-35 forearmL:-37,-47,0 forearmR:-28,17,0 handL:-27,-14,24 handR:-41,39,-16 thighL:-88,70,47 thighR:-82,-67,-50 shinL:118,0,-12 shinR:135,0,11 footL:10,0,20 footR:10,0,-20' },
  { id: 'hugKnees', name: '体育座り', category: 'sit', seat: false, lift: 0, spec: 'spine:15,0,0 chest:15,0,0 neck:-14,0,0 head:-16,0,0 upperArmL:-54,-19,13 upperArmR:-56,20,-12 forearmL:-53,17,0 forearmR:-46,-16,0 handL:-24,9,-35 handR:-28,-9,35 thighL:-125,0,5 thighR:-125,0,-5 shinL:145,0,0 shinR:145,0,0 footL:-10,0,0 footR:-10,0,0' },
  { id: 'legsOut', name: '脚を伸ばして座る', category: 'sit', seat: false, lift: 0, spec: 'spine:-8,0,0 chest:-10,0,0 neck:5,0,0 upperArmL:31,-3,7 upperArmR:30,34,-7 forearmL:-2,51,0 forearmR:1,-15,0 handL:74,71,45 handR:77,-86,20 thighL:-80,0,5 thighR:-80,0,-5 shinL:5,0,0 shinR:5,0,0 footL:10,0,0 footR:10,0,0' },
  { id: 'seiza', name: '正座', category: 'sit', seat: false, lift: 0, spec: 'upperArmL:7,-20,8 upperArmR:7,20,-8 forearmL:-91,-45,0 forearmR:-91,45,0 handL:13,-35,14 handR:14,35,-15 thighL:-90,0,3 thighR:-90,0,-3 shinL:165,0,0 shinR:165,0,0 footL:55,0,0 footR:55,0,0' },
  { id: 'sideSit', name: '横座り', category: 'sit', seat: false, lift: 0, spec: 'chest:0,10,8 upperArmL:-30,-20,10 upperArmR:11,-86,-15 forearmL:-40,0,0 forearmR:-16,33,0 handR:85,-100,-45 thighL:-102,68,10 thighR:-121,67,-13 shinL:127,0,0 shinR:119,0,0 footL:40,0,-27 footR:45,-3,-40' },
  { id: 'allFours', name: '四つんばい', category: 'kneel', seat: false, lift: 0, spec: 'hips:90,0,0 spine:-5,0,0 chest:-5,0,0 neck:-45,0,0 head:-25,0,0 upperArmL:-79,0,0 upperArmR:-84,20,2 forearmL:-3,100,0 forearmR:10,100,0 handL:85,94,-35 handR:85,-89,-45 thighL:-90,0,4 thighR:-90,0,-4 shinL:90,0,0 shinR:90,0,0 footL:40,0,0 footR:40,0,0' },
  { id: 'crouchLook', name: 'しゃがんで覗き込む', category: 'kneel', seat: false, lift: 0, spec: 'spine:25,0,0 chest:20,0,0 neck:-25,0,0 upperArmL:-60,-19,20 upperArmR:-68,20,-11 forearmL:-39,0,0 forearmR:-30,0,0 handL:-5,5,-8 handR:-2,-1,4 thighL:-125,0,12 thighR:-80,0,-10 shinL:150,0,0 shinR:160,0,0 footL:-35,0,0 footR:30,0,0' },
  { id: 'kneelBoth', name: '膝立ち', category: 'kneel', seat: false, lift: 0, spec: 'upperArmL:-4,0,7 upperArmR:-4,1,-7 forearmL:-9,0,0 forearmR:-9,0,0 handL:-2,0,-1 handR:-2,0,1 thighL:0,0,5 thighR:0,0,-5 shinL:90,0,0 shinR:90,0,0 footL:40,0,0 footR:40,0,0' },
  { id: 'kneelOne', name: '片膝立ち', category: 'kneel', seat: false, lift: 0, spec: 'upperArmL:-47,-21,-2 upperArmR:0,0,-8 forearmL:-4,-37,0 forearmR:-15,0,0 handL:-15,-37,29 thighL:-90,0,5 thighR:0,0,-3 shinL:90,0,0 shinR:92,0,0 footR:-5,0,0' },
  { id: 'proposal', name: '片膝をついて手を差し出す', category: 'kneel', seat: false, lift: 0, spec: 'chest:5,0,0 neck:-3,0,0 head:-2,0,0 upperArmL:-53,3,-3 upperArmR:-62,20,-2 forearmL:-2,-57,0 forearmR:-36,-57,0 handL:-15,-40,24 handR:-6,-50,-9 thighL:-90,0,5 thighR:0,0,-3 shinL:90,0,0 shinR:92,0,0 footR:-5,0,0' },
  { id: 'squat', name: 'しゃがむ', category: 'kneel', seat: false, lift: 0, spec: 'spine:20,0,0 chest:15,0,0 neck:-20,0,0 upperArmL:-52,-11,32 upperArmR:-53,12,-32 forearmL:-95,-35,0 forearmR:-94,35,0 handL:26,-26,-25 handR:26,26,25 thighL:-120,10,18 thighR:-120,-10,-18 shinL:150,0,0 shinR:150,0,0 footL:-35,0,0 footR:-35,0,0' },
  { id: 'fetal', name: '丸まって寝る', category: 'lie', seat: false, lift: 0, spec: 'hips:0,0,90 spine:20,0,0 chest:20,0,0 neck:30,0,0 upperArmL:-4,-22,8 upperArmR:-12,23,-4 forearmL:-138,0,0 forearmR:-131,0,0 handL:-16,12,-5 handR:-14,-12,6 thighL:-100,0,0 thighR:-100,0,0 shinL:120,0,0 shinR:120,0,0' },
  { id: 'prone', name: 'うつ伏せ', category: 'lie', seat: false, lift: 0, spec: 'footL:40,0,0 footR:40,0,0 forearmL:-90,0,0 forearmR:-90,0,0 thighL:0,0,5 thighR:0,0,-5 neck:-10,60,0 hips:90,0,0 upperArmL:0,90,100 upperArmR:0,-90,-100' },
  { id: 'proneChin', name: 'うつ伏せで頬杖', category: 'lie', seat: false, lift: 0, spec: 'hips:90,0,0 spine:-25,0,0 chest:-30,0,0 neck:-35,0,0 upperArmL:-64,-21,-7 upperArmR:-69,20,6 forearmL:-131,2,0 forearmR:-127,-2,0 handL:2,68,0 handR:1,-70,-2 thighL:0,0,5 thighR:0,0,-5 shinL:80,0,0 shinR:110,0,0 footL:40,0,0 footR:40,0,0' },
  { id: 'sideLie', name: '横向きに寝る', category: 'lie', seat: false, lift: 0, spec: 'forearmL:-20,0,0 forearmR:-60,0,0 thighL:-35,0,0 thighR:-35,0,0 shinL:50,0,0 shinR:50,0,0 neck:0,0,-20 hips:0,0,90 upperArmL:-20,0,0 upperArmR:-90,0,0' },
  { id: 'supine', name: '仰向け', category: 'lie', seat: false, lift: 0, spec: 'footL:25,0,0 footR:25,0,0 forearmL:-10,0,0 forearmR:-10,0,0 thighL:0,0,5 thighR:0,0,-5 hips:-90,0,0 upperArmL:0,0,12 upperArmR:0,0,-12' },
  { id: 'supineHandsHead', name: '仰向けで腕枕', category: 'lie', seat: false, lift: 0, spec: 'hips:-90,0,0 neck:15,0,0 upperArmL:-78,29,167 upperArmR:-73,-40,-155 forearmL:-118,36,0 forearmR:-118,-46,0 handL:-28,25,41 handR:-26,-15,-22 thighL:-40,0,5 thighR:0,0,-5 shinL:80,0,0 footR:25,0,0' },
  { id: 'aimGun', name: '銃を構える', category: 'action', seat: false, lift: 0, spec: 'neck:10,0,0 upperArmL:-87,4,-18 upperArmR:-98,-3,13 forearmL:-4,-29,0 forearmR:-4,-49,0 handL:-1,70,3 handR:5,50,-11 thighL:-15,0,5 thighR:10,0,-5 shinL:15,0,0 shinR:10,0,0' },
  { id: 'damage', name: 'ダメージ（のけぞる）', category: 'action', seat: false, lift: 0, spec: 'spine:-12,0,0 chest:-25,0,0 neck:-25,0,0 head:-10,0,0 upperArmL:-16,16,56 upperArmR:6,-30,-51 forearmL:-54,0,0 forearmR:-60,0,0 thighL:-30,4,3 thighR:3,0,-2 shinL:32,0,0 shinR:27,0,0 footL:-12,-5,-1 footR:-5,0,2' },
  { id: 'fall', name: '転ぶ', category: 'action', seat: false, lift: 0.08, spec: 'hips:30,0,0 spine:5,0,0 chest:-5,0,0 neck:-40,0,0 upperArmL:-41,-6,16 upperArmR:-41,6,-16 forearmL:-35,-27,0 forearmR:-35,27,0 handL:-9,-25,24 handR:-9,25,-24 thighL:-70,6,3 thighR:-18,-4,-3 shinL:44,0,0 shinR:71,0,0 footL:12,-6,3 footR:68,0,0 bodyPos:0,8,0' },
  { id: 'fightStance', name: 'ファイティングポーズ', category: 'action', seat: false, lift: 0, spec: 'hips:0,-30,0 spine:5,5,0 chest:5,5,0 neck:5,18,0 upperArmL:-60,-12,21 upperArmR:-49,20,16 forearmL:-116,11,0 forearmR:-131,12,0 handL:45,3,25 handR:52,-7,0 thighL:-31,-4,8 thighR:10,0,0 shinL:30,0,0 shinR:12,0,0 footL:1,10,-9 footR:-9,-24,6' },
  { id: 'frontKick', name: '前蹴り', category: 'action', seat: false, lift: 0, spec: 'chest:-8,0,0 neck:8,0,0 upperArmL:-43,-17,-2 upperArmR:-43,17,2 forearmL:-128,-23,0 forearmR:-128,23,0 handL:47,16,0 handR:47,-16,0 thighL:-11,0,0 thighR:-103,0,0 shinL:24,0,0 shinR:46,0,0 footL:-13,15,0 footR:32,0,0' },
  { id: 'guard', name: '腕でガード', category: 'action', seat: false, lift: 0, spec: 'spine:10,0,0 chest:10,0,0 neck:15,0,0 upperArmL:-100,-38,22 upperArmR:-100,38,-22 forearmL:-96,70,0 forearmR:-96,-70,0 handL:-8,48,29 handR:-8,-47,-28 thighL:-15,0,10 thighR:-15,0,-10 shinL:25,0,0 shinR:25,0,0 footL:-5,0,0 footR:-5,0,0' },
  { id: 'highKick', name: 'ハイキック', category: 'action', seat: false, lift: 0, spec: 'hips:0,0,-22 spine:0,0,-8 chest:0,0,-8 neck:0,0,22 head:0,0,10 upperArmL:-60,-15,-13 upperArmR:56,-12,-11 forearmL:-120,-20,0 forearmR:-53,0,0 handL:50,-17,-20 thighL:-19,25,33 thighR:-89,69,-50 shinL:36,0,0 shinR:55,0,0 footL:-16,0,-1 footR:68,0,0' },
  { id: 'jump', name: 'ジャンプ', category: 'action', seat: false, lift: 0.2, spec: 'chest:-8,0,0 neck:-10,0,0 upperArmL:9,47,159 upperArmR:9,-47,-159 forearmL:-2,0,3 forearmR:-2,0,-3 thighL:-77,0,5 thighR:-77,0,-5 shinL:112,0,0 shinR:112,0,0 footL:68,0,0 footR:68,0,0 bodyPos:0,20,0' },
  { id: 'punch', name: 'パンチ', category: 'action', seat: false, lift: 0, spec: 'hips:0,-15,0 spine:3,12,0 chest:3,18,0 neck:0,-16,-22 upperArmL:-40,-23,-12 upperArmR:-107,11,-4 forearmL:-131,-42,0 forearmR:-2,46,0 handL:24,34,-6 handR:16,38,4 thighL:-33,-2,3 thighR:14,0,-3 shinL:20,0,0 shinR:5,0,0 footL:13,10,-4 footR:3,-27,15' },
  { id: 'swordStance', name: '剣を構える', category: 'action', seat: false, lift: 0, spec: 'hips:0,10,0 chest:0,-10,0 upperArmL:-8,-19,-2 upperArmR:-27,26,12 forearmL:-72,58,0 forearmR:-60,53,0 handL:-90,-100,45 handR:-59,-100,29 thighL:20,10,5 thighR:-20,0,-5 shinL:20,0,0 shinR:20,0,0 footL:20,0,0' },
  { id: 'throw', name: '投げる（振りかぶる）', category: 'action', seat: false, lift: 0, spec: 'hips:0,-35,0 spine:-4,-10,0 chest:-8,-15,0 neck:18,27,0 head:0,32,0 upperArmL:-21,13,67 upperArmR:28,-100,-116 forearmL:-35,-27,0 forearmR:-90,-60,0 handL:0,-20,0 handR:2,-10,-27 thighL:-30,-2,6 thighR:15,-1,-6 shinL:4,0,0 shinR:4,0,0 footL:27,-12,-6 footR:-7,39,-4' },
  { id: 'arabesque', name: 'バレエ（アラベスク）', category: 'dance', seat: false, lift: 0, spec: 'hips:12,0,0 spine:-6,0,0 chest:-10,0,0 neck:-12,0,0 upperArmL:-101,-5,4 upperArmR:-45,28,-96 forearmL:-4,-45,0 forearmR:-14,15,0 handL:0,-40,0 thighL:-19,1,-4 thighR:47,-9,0 shinL:4,0,0 shinR:41,0,0 footL:3,35,4 footR:68,0,0' },
  { id: 'basketShoot', name: 'シュート（バスケ）', category: 'sport', seat: false, lift: 0.05, spec: 'chest:-8,0,0 neck:-20,0,0 upperArmL:-180,-96,31 upperArmR:-179,81,-9 forearmL:-65,65,0 forearmR:-42,-30,0 handL:-9,20,42 handR:-77,100,-45 shinL:10,0,0 shinR:10,0,0 footL:40,0,0 footR:40,0,0' },
  { id: 'batting', name: 'バッティング', category: 'sport', seat: false, lift: 0, spec: 'hips:10,-70,0 chest:5,0,0 neck:0,75,0 upperArmL:-85,7,-49 upperArmR:-32,-4,-44 forearmL:-4,-30,0 forearmR:-128,-23,0 handL:-89,-100,-4 handR:-43,-6,-44 thighL:-29,-6,20 thighR:-19,-5,-2 shinL:41,0,0 shinR:32,0,0 footL:-17,6,-11 footR:-15,-6,10' },
  { id: 'cheer', name: '応援（ポンポン）', category: 'sport', seat: false, lift: 0, spec: 'neck:-8,0,0 upperArmL:21,26,34 upperArmR:12,-80,-166 forearmL:-47,0,0 forearmR:-3,0,-3 thighL:-91,3,5 thighR:-11,0,-1 shinL:110,0,0 shinR:20,0,0 footL:68,0,0 footR:-9,-6,1' },
  { id: 'dance', name: 'ダンス（天を指す）', category: 'dance', seat: false, lift: 0, spec: 'hips:0,0,8 spine:0,0,-4 chest:0,0,-8 neck:-15,0,4 upperArmL:75,8,23 upperArmR:-160,39,-7 forearmL:-128,12,0 forearmR:-3,4,-1 handL:-6,2,12 handR:0,0,-4 thighL:-18,2,-5 thighR:-42,-10,-18 shinL:27,0,0 shinR:60,0,0 footL:-9,15,-3 footR:7,-1,-1' },
  { id: 'lunge', name: 'ランジ', category: 'sport', seat: false, lift: 0, spec: 'upperArmL:66,-4,25 upperArmR:66,4,-25 forearmL:-119,18,0 forearmR:-119,-18,0 handL:-12,2,12 handR:-12,-2,-12 thighL:-67,5,4 thighR:38,36,-1 shinL:41,0,0 shinR:4,0,0 footL:26,-5,3 footR:6,-35,7' },
  { id: 'soccerKick', name: 'ボールを蹴る', category: 'sport', seat: false, lift: 0, spec: 'hips:0,-12,0 chest:-10,8,0 neck:15,0,0 upperArmL:9,46,49 upperArmR:47,-19,-21 forearmL:-53,0,0 forearmR:-43,0,0 thighL:-19,-1,3 thighR:-67,-10,-1 shinL:27,0,0 shinR:41,0,0 footL:-8,20,-3 footR:68,0,0' },
  { id: 'swim', name: '泳ぐ（クロール）', category: 'sport', seat: false, lift: 0.3, spec: 'footL:50,0,0 footR:50,0,0 chest:0,20,0 forearmL:-10,0,0 forearmR:-5,0,0 thighL:10,0,3 thighR:-10,0,-3 neck:-20,-50,0 hips:90,0,0 upperArmL:30,0,10 upperArmR:-175,0,-5' },
  { id: 'yogaTree', name: 'ヨガ（木のポーズ）', category: 'sport', seat: false, lift: 0, spec: 'upperArmL:-29,-51,22 upperArmR:-29,51,-22 forearmL:-105,-57,0 forearmR:-105,57,0 handL:53,88,19 handR:53,-87,-19 thighL:-9,1,-2 thighR:-61,-9,-5 shinL:16,0,0 shinR:117,0,0 footL:-7,5,2 footR:-40,-35,23' },
  { id: 'bow', name: 'お辞儀', category: 'stand', seat: false, lift: 0, spec: 'hips:35,0,0 spine:10,0,0 chest:10,0,0 neck:5,0,0 upperArmL:-37,73,-5 upperArmR:-37,-73,6 forearmL:-1,-75,0 forearmR:-1,85,0 handL:-20,-90,5 handR:-19,80,-8 thighL:-40,0,1 thighR:-40,-39,-2 shinL:4,0,0 shinR:4,0,0 footL:2,6,-1 footR:1,33,-2' },
  { id: 'behindBack', name: '手を後ろで組む', category: 'stand', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:0,-3,-4 neck:-3,2,-33 head:0,4,0 upperArmL:36,-80,21 upperArmR:36,85,-27 forearmL:-70,32,0 forearmR:-82,-35,0 handL:16,45,45 handR:8,-29,-41 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'facepalm', name: '顔に手を当てる', category: 'emotion', seat: false, lift: 0, spec: 'chest:5,0,0 neck:15,0,0 head:10,0,0 upperArmL:63,-4,24 upperArmR:-61,16,29 forearmL:-119,29,0 forearmR:-117,-40,0 handL:-16,-10,8 handR:22,-24,-23 thighL:-11,0,1 thighR:-21,-4,-4 shinL:20,0,0 shinR:33,0,0 footL:-9,6,-1 footR:-11,-5,3' },
  { id: 'shrug', name: '肩をすくめる', category: 'emotion', seat: false, lift: 0, spec: 'neck:0,0,8 head:0,-10,0 shoulderL:0,0,25 shoulderR:0,0,-25 upperArmL:-14,1,13 upperArmR:-14,-1,-13 forearmL:-22,81,0 forearmR:-22,-81,0 handL:-23,60,-35 handR:-23,-60,35 thighL:-11,0,1 thighR:-11,0,-1 shinL:20,0,0 shinR:20,0,0 footL:-9,6,-1 footR:-9,-6,1' },
  { id: 'takePhoto', name: '写真を撮る', category: 'daily', seat: false, lift: 0, spec: 'hips:0,-6,-4 spine:0,2,3 chest:0,3,4 neck:-5,0,-3 upperArmL:-92,-30,23 upperArmR:-105,49,-38 forearmL:-113,-24,0 forearmR:-115,24,0 handL:34,46,19 handR:50,-68,-22 thighL:-24,1,10 thighR:-3,0,7 shinL:36,0,0 shinR:5,0,0 footL:-11,11,-4 footR:-1,-8,-4' },
  { id: 'readBook', name: '本を読む', category: 'daily', seat: false, lift: 0, spec: 'hips:0,-6,-4 spine:0,2,3 chest:0,3,4 neck:22,0,-3 head:10,0,0 upperArmL:-18,-19,7 upperArmR:-18,19,-7 forearmL:-98,45,0 forearmR:-98,-45,0 handL:-52,30,-20 handR:-52,-30,20 thighL:-24,1,10 thighR:-3,0,7 shinL:36,0,0 shinR:5,0,0 footL:-11,11,-4 footR:-1,-8,-4' },
  { id: 'reachUp', name: 'つま先立ちで手を伸ばす', category: 'daily', seat: false, lift: 0, spec: 'chest:-6,0,0 neck:-25,0,0 upperArmL:11,8,22 upperArmR:-167,3,-2 forearmL:-57,0,0 forearmR:-2,53,0 handR:-7,35,-7 thighL:-10,0,0 thighR:-10,0,0 shinL:15,0,0 shinR:15,0,0 footL:30,0,0 footR:30,0,0' },
  { id: 'tired', name: '膝に手をつく', category: 'daily', seat: false, lift: 0, spec: 'hips:40,0,0 spine:15,0,0 chest:10,0,0 neck:-30,0,0 upperArmL:-58,3,-4 upperArmR:-58,-3,4 forearmL:-3,-47,0 forearmR:-3,47,0 handL:-81,-87,44 handR:-81,88,-44 thighL:-72,4,4 thighR:-72,-4,-4 shinL:44,0,0 shinR:44,0,0 footL:-12,2,-1 footR:-12,-2,1' },
  { id: 'chairLean', name: '前かがみに座る', category: 'sit', seat: true, lift: 0, spec: 'spine:15,0,0 chest:25,0,0 neck:-15,0,0 head:-16,0,0 upperArmL:-83,8,-9 upperArmR:-83,-8,9 forearmL:-4,-27,0 forearmR:-4,27,0 handL:-21,6,-11 handR:-21,-6,11 thighL:-90,0,6 thighR:-90,0,-6 shinL:90,0,0 shinR:90,0,0' },
  { id: 'lookUpPoint', name: '空を指差す', category: 'stand', seat: false, lift: 0, spec: 'hips:0,6,4 spine:0,-2,-3 chest:-5,-3,-4 neck:-30,0,3 head:-15,0,0 upperArmL:16,0,15 upperArmR:-152,42,-11 forearmL:-40,0,0 forearmR:-4,-78,-1 handR:-11,-59,9 thighL:-3,0,-7 thighR:-24,-1,-10 shinL:5,0,0 shinR:36,0,0 footL:-1,8,4 footR:-11,-11,4' },
  { id: 'archery', name: '弓を引く', category: 'action', seat: false, lift: 0, spec: 'hips:0,-55,0 spine:0,-10,0 chest:0,-20,0 neck:9,71,0 head:16,1,0 upperArmL:-97,-83,71 upperArmR:-175,110,-64 forearmL:-3,36,1 forearmR:-145,99,1 handL:0,40,0 handR:74,89,-16 thighL:-19,-5,11 thighR:-16,3,-8 shinL:31,0,0 shinR:30,0,0 footL:-13,40,-12 footR:-14,-1,9' },
  { id: 'sideKick', name: '横蹴り', category: 'action', seat: false, lift: 0, spec: 'hips:0,0,-35 spine:0,0,-10 chest:0,0,-10 neck:0,0,30 head:0,0,10 upperArmL:-61,-15,-17 upperArmR:-36,18,3 forearmL:-118,-5,0 forearmR:-130,5,0 handL:57,-37,-11 handR:40,-31,-42 thighL:-24,28,50 thighR:-37,25,-40 shinL:40,0,0 shinR:52,0,0 footL:-17,0,-1 footR:-35,-2,21' },
  { id: 'pushForward', name: '両手で押し出す', category: 'action', seat: false, lift: 0, spec: 'chest:8,0,0 neck:-6,0,0 head:-2,0,0 upperArmL:-71,-18,-3 upperArmR:-71,18,3 forearmL:-34,-30,0 forearmR:-34,30,0 handL:-62,-82,45 handR:-62,82,-45 thighL:-33,-1,1 thighR:14,-47,-8 shinL:21,0,0 shinR:18,0,0 footL:12,5,-2 footR:-1,38,0' },
  { id: 'warrior2', name: 'ヨガ（戦士のポーズ）', category: 'sport', seat: false, lift: 0, spec: 'neck:0,40,0 head:0,50,0 upperArmL:77,73,88 upperArmR:77,-73,-88 forearmL:-3,4,1 forearmR:-3,-4,-1 thighL:-18,70,66 thighR:-7,6,-27 shinL:58,0,0 shinR:12,0,0 footL:9,3,-1 footR:-8,-18,27' },
  { id: 'pushup', name: '腕立て伏せ', category: 'sport', seat: false, lift: 0, spec: 'hips:80,0,0 neck:-30,0,0 upperArmL:-68,62,-17 upperArmR:-31,16,-31 forearmL:-51,-65,0 forearmR:-100,61,0 handL:-78,-61,0 handR:18,0,-45 thighL:-13,0,0 thighR:-13,0,0 shinL:24,0,0 shinR:24,0,0 footL:-40,0,0 footR:-40,0,0' },
  { id: 'tennisServe', name: 'テニスのサーブ', category: 'sport', seat: false, lift: 0, spec: 'spine:-8,0,0 chest:-15,0,0 neck:-25,0,0 upperArmL:-159,-57,12 upperArmR:-7,88,-172 forearmL:-3,61,1 forearmR:3,0,1 handL:0,60,0 thighL:-25,-1,1 thighR:-4,1,-5 shinL:25,0,0 shinR:27,0,0 footL:-1,-20,-2 footR:2,1,5' },
  { id: 'volleyball', name: 'レシーブ（バレー）', category: 'sport', seat: false, lift: 0, spec: 'hips:30,0,0 chest:10,0,0 neck:-30,0,0 head:-16,0,0 upperArmL:-46,3,-6 upperArmR:-46,-3,6 forearmL:-4,-9,0 forearmR:-4,9,0 handL:-40,90,-35 handR:-40,-90,35 thighL:-87,2,27 thighR:-87,-2,-27 shinL:76,0,0 shinR:76,0,0 footL:-16,-5,-13 footR:-16,5,13' },
  { id: 'quadStretch', name: '太ももを伸ばす', category: 'sport', seat: false, lift: 0, spec: 'spine:5,0,0 chest:5,0,-6 neck:-3,0,4 upperArmL:9,50,60 upperArmR:25,3,15 forearmL:-51,0,0 forearmR:-4,0,0 handR:-2,0,-6 thighL:-8,1,-3 thighR:-10,4,-1 shinL:14,0,0 shinR:153,0,0 footL:-6,8,3 footR:-40,2,3' },
  { id: 'toprock', name: 'トップロック（ブレイク）', category: 'dance', seat: false, lift: 0, spec: 'hips:0,-10,0 spine:5,0,0 chest:5,14,0 neck:-8,-5,10 upperArmL:47,65,1 upperArmR:-45,18,-11 forearmL:-76,0,0 forearmR:-80,-17,0 handR:15,-2,-15 thighL:-17,-1,2 thighR:-23,-3,7 shinL:26,0,0 shinR:15,0,0 footL:-9,10,-2 footR:22,-21,-2' },
  { id: 'sixStep', name: '6歩（ブレイク）', category: 'dance', seat: false, lift: 0, spec: 'hips:38,0,-6 spine:14,0,-4 chest:14,0,-6 neck:-30,0,0 head:-32,0,0 upperArmL:-12,22,43 upperArmR:-46,8,-17 forearmL:-107,-30,0 forearmR:-22,87,0 handL:-2,-20,21 handR:-90,100,-45 thighL:-125,-33,47 thighR:-121,0,-6 shinL:80,0,0 shinR:119,0,0 footL:3,-27,-32 footR:-1,5,3' },
  { id: 'chairFreeze', name: 'チェアーフリーズ（ブレイク）', category: 'dance', seat: false, lift: 0, spec: 'hips:20,0,75 spine:5,0,8 chest:5,0,8 neck:-16,22,-36 head:-8,0,0 upperArmL:37,89,82 upperArmR:9,-6,-20 forearmL:-89,0,0 forearmR:-89,97,0 handR:-18,70,-27 thighL:-96,23,10 thighR:-86,-6,-4 shinL:92,0,0 shinR:95,0,0 footL:69,2,5 footR:68,0,0' },
  { id: 'headstand', name: '三点倒立（ブレイク）', category: 'dance', seat: false, lift: 0, spec: 'hips:180,0,0 neck:-20,0,0 upperArmL:-12,51,134 upperArmR:-12,-51,-134 forearmL:-104,-59,0 forearmR:-104,59,0 handL:-54,-52,-25 handR:-54,53,25 thighL:-25,-4,19 thighR:-25,4,-19 shinL:42,0,0 shinR:42,0,0 footL:68,0,0 footR:68,0,0' },
  { id: 'windmill', name: 'ウインドミル（ブレイク）', category: 'dance', seat: false, lift: 0, spec: 'hips:-90,0,0 upperArmL:0,0,80 upperArmR:0,0,-80 forearmL:-10,0,0 forearmR:-10,0,0 thighL:-75,-16,21 thighR:-75,16,-21 shinL:4,0,0 shinR:4,0,0 footL:68,0,0 footR:68,0,0' },
  { id: 'hipHopGroove', name: 'グルーヴ（ヒップホップ）', category: 'dance', seat: false, lift: 0, spec: 'hips:8,10,0 spine:-3,0,0 chest:-6,-10,0 neck:10,9,0 head:0,6,0 upperArmL:24,14,20 upperArmR:17,-13,-20 forearmL:-79,0,0 forearmR:-88,0,0 thighL:-41,2,5 thighR:-33,-1,-8 shinL:52,0,0 shinR:48,0,0 footL:-19,11,-5 footR:-13,-10,7' },
  { id: 'popPoint', name: '指差し（ポップ）', category: 'dance', seat: false, lift: 0, spec: 'hips:0,8,0 chest:0,-8,0 neck:18,-12,-18 head:0,-16,0 upperArmL:3,-14,16 upperArmR:-107,14,-11 forearmL:-127,53,0 forearmR:-4,11,0 handL:59,-37,-35 thighL:-25,2,7 thighR:-21,-2,-7 shinL:40,0,0 shinR:37,0,0 footL:-15,10,-6 footR:-15,-10,6' },
  { id: 'lockingPoint', name: 'ポイント（ロック）', category: 'dance', seat: false, lift: 0, spec: 'hips:6,-8,-6 spine:0,-6,-4 chest:0,-18,-6 neck:22,-38,-16 head:32,-32,0 upperArmL:70,-36,58 upperArmR:63,-75,-102 forearmL:-123,50,0 forearmR:-3,-41,-1 handL:-79,-44,45 handR:0,-20,0 thighL:-40,-4,12 thighR:-25,-24,-11 shinL:56,0,0 shinR:37,0,0 footL:-22,11,-5 footR:-12,1,8' },
  { id: 'krump', name: 'クランプ', category: 'dance', seat: false, lift: 0, spec: 'hips:10,0,0 spine:-6,0,0 chest:-14,0,0 neck:11,0,0 head:16,0,0 upperArmL:36,65,40 upperArmR:36,-65,-40 forearmL:-125,23,0 forearmR:-125,-23,0 handL:-45,41,30 handR:-45,-41,-30 thighL:-43,21,26 thighR:-43,-21,-26 shinL:56,0,0 shinR:56,0,0 footL:-16,-2,-9 footR:-16,2,9' },
  { id: 'tutting', name: 'タット', category: 'dance', seat: false, lift: 0, spec: 'neck:0,-17,0 upperArmL:-89,-25,111 upperArmR:-14,-24,-54 forearmL:-93,20,0 forearmR:-92,17,0 handL:-6,-1,26 handR:0,20,35 thighL:-11,0,1 thighR:-12,1,-3 shinL:20,0,0 shinR:19,0,0 footL:-9,10,-1 footR:-7,-10,3' },
  { id: 'waacking', name: 'ワック', category: 'dance', seat: false, lift: 0, spec: 'hips:0,0,6 chest:0,10,-4 neck:0,-11,-13 head:0,-16,0 upperArmL:-62,-13,-23 upperArmR:-24,-24,-168 forearmL:-63,-47,0 forearmR:-28,-68,0 handL:0,-40,0 handR:-1,-86,-17 thighL:-12,2,-8 thighR:-37,3,-12 shinL:15,0,0 shinR:54,0,0 footL:-3,19,2 footR:12,7,2' },
  { id: 'vogue', name: 'ヴォーグ（ハンドフレーム）', category: 'dance', seat: false, lift: 0, spec: 'hips:0,0,8 chest:0,0,-5 neck:0,-8,-9 head:0,-16,0 upperArmL:-32,34,131 upperArmR:-110,79,-21 forearmL:-127,39,0 forearmR:-135,-100,0 handL:59,100,45 handR:5,-100,-25 thighL:-5,0,-8 thighR:-27,0,-11 shinL:7,0,0 shinR:34,0,0 footL:-2,15,0 footR:13,5,0' },
  { id: 'moonwalk', name: 'ムーンウォーク', category: 'dance', seat: false, lift: 0, spec: 'chest:4,0,0 neck:-4,0,0 upperArmL:29,4,14 upperArmR:40,-8,-15 forearmL:-69,0,0 forearmR:-75,0,0 thighL:1,0,0 thighR:-33,-4,-2 shinL:23,0,0 shinR:55,0,0 footL:-25,0,0 footR:28,3,-4' },
  { id: 'runningMan', name: 'ランニングマン', category: 'dance', seat: false, lift: 0, spec: 'chest:4,0,0 neck:2,0,0 upperArmL:-9,-1,11 upperArmR:70,-23,-12 forearmL:-93,9,0 forearmR:-84,0,0 handL:-25,1,3 thighL:12,0,0 thighR:-84,-3,-5 shinL:13,0,0 shinR:104,0,0 footL:-5,0,0 footR:68,0,0' },
  { id: 'dab', name: 'ダブ', category: 'dance', seat: false, lift: 0, spec: 'chest:8,-15,0 neck:24,-20,18 head:32,0,0 upperArmL:-73,-34,-44 upperArmR:-157,7,-61 forearmL:-73,-32,0 forearmR:0,88,0 handL:0,-20,0 handR:0,60,0 thighL:-11,0,1 thighR:-11,1,-3 shinL:20,0,0 shinR:19,0,0 footL:-9,10,-1 footR:-8,-10,3' },
  { id: 'heartArms', name: '頭の上でハート', category: 'dance', seat: false, lift: 0, spec: 'neck:0,0,8 upperArmL:-177,81,-10 upperArmR:-23,-31,-170 forearmL:-4,-30,0 forearmR:-60,100,0 handL:85,-28,-35 handR:75,51,-6 thighL:-11,0,1 thighR:-19,1,-2 shinL:20,0,0 shinR:28,0,0 footL:-9,6,-1 footR:-8,-15,2' },
  { id: 'plie', name: 'プリエ（バレエ）', category: 'dance', seat: false, lift: 0, spec: 'neck:-3,0,0 upperArmL:3,45,57 upperArmR:3,-45,-57 forearmL:-51,17,0 forearmR:-51,-17,0 thighL:-18,53,35 thighR:-18,-53,-35 shinL:54,0,0 shinR:54,0,0 footL:-15,0,-5 footR:-15,0,5' },
  { id: 'passe', name: 'パッセ（バレエ）', category: 'dance', seat: false, lift: 0, spec: 'upperArmL:-170,73,-5 upperArmR:-169,-73,4 forearmL:-4,-18,0 forearmR:-4,18,0 handL:80,-93,-35 handR:80,94,35 thighL:-10,1,-2 thighR:-69,-9,-5 shinL:17,0,0 shinR:121,0,0 footL:34,23,-19 footR:65,3,-5' },
  { id: 'grandJete', name: 'グラン・ジュテ（バレエ）', category: 'dance', seat: false, lift: 0, spec: 'chest:-6,0,0 neck:-3,0,0 upperArmL:-103,-9,11 upperArmR:-61,42,-104 forearmL:-24,-42,0 forearmR:-30,14,0 handL:0,-40,0 thighL:-91,26,7 thighR:43,-10,-3 shinL:39,0,0 shinR:48,0,0 footL:68,0,0 footR:68,0,0 bodyPos:0,26,0' },
  { id: 'jazzHands', name: 'ジャズハンズ', category: 'dance', seat: false, lift: 0, spec: 'hips:22,0,0 chest:-8,0,0 neck:-20,0,0 upperArmL:-27,16,63 upperArmR:-27,-16,-63 forearmL:-77,14,0 forearmR:-77,-14,0 handL:-36,-37,40 handR:-36,38,-40 thighL:-60,1,6 thighR:-60,-1,-6 shinL:54,0,0 shinR:54,0,0 footL:-16,6,-4 footR:-16,-6,4' },
  { id: 'salsa', name: 'サルサ', category: 'dance', seat: false, lift: 0, spec: 'hips:0,15,6 chest:0,-12,-4 neck:-4,11,-12 head:0,16,0 upperArmL:3,49,55 upperArmR:-165,-95,17 forearmL:-69,-31,0 forearmR:-24,17,0 handL:0,-20,0 handR:84,100,16 thighL:-12,2,-6 thighR:-29,4,-7 shinL:21,0,0 shinR:31,0,0 footL:-7,14,1 footR:28,1,2' },
  { id: 'tango', name: 'タンゴ', category: 'dance', seat: false, lift: 0, spec: 'chest:-4,0,0 neck:4,29,0 head:0,16,0 upperArmL:-35,8,54 upperArmR:-30,20,3 forearmL:-78,13,0 forearmR:-106,-44,0 handL:-45,-51,21 handR:68,29,35 thighL:29,0,2 thighR:-36,-5,-2 shinL:4,0,0 shinR:53,0,0 footL:68,0,0 footR:-18,-5,-1' },
  { id: 'flamenco', name: 'フラメンコ', category: 'dance', seat: false, lift: 0, spec: 'spine:-8,0,0 chest:-12,0,0 neck:16,-18,-23 upperArmL:-18,34,164 upperArmR:29,-87,-76 forearmL:-61,58,0 forearmR:-81,-51,0 handL:-41,49,-20 handR:1,20,-12 thighL:-11,0,1 thighR:-35,-5,-2 shinL:20,0,0 shinR:39,0,0 footL:-9,15,-1 footR:-3,5,-1' },
  { id: 'bellyDance', name: 'ベリーダンス', category: 'dance', seat: false, lift: 0, spec: 'hips:0,0,10 spine:0,0,-5 chest:0,0,-8 upperArmL:24,71,70 upperArmR:24,-71,-70 forearmL:-62,-19,0 forearmR:-62,19,0 handL:37,-22,-1 handR:37,23,1 thighL:-19,9,-11 thighR:-32,2,-13 shinL:32,0,0 shinR:44,0,0 footL:-13,5,3 footR:12,5,0' },
  { id: 'charleston', name: 'チャールストン', category: 'dance', seat: false, lift: 0, spec: 'hips:40,0,0 spine:8,0,0 chest:10,0,0 neck:-38,0,0 head:-20,0,0 upperArmL:-51,24,-18 upperArmR:-64,-83,26 forearmL:-9,-51,0 forearmR:-16,-85,0 handL:-77,-97,12 handR:71,-82,-3 thighL:-77,1,5 thighR:-77,-2,-5 shinL:44,0,0 shinR:44,0,0 footL:-6,-24,-3 footR:-7,24,3' },
  { id: 'cossack', name: 'コサックダンス', category: 'dance', seat: false, lift: 0, spec: 'hips:12,0,0 chest:-8,0,0 neck:-4,0,0 upperArmL:29,70,77 upperArmR:29,-70,-77 forearmL:-35,-20,0 forearmR:-35,20,0 handL:0,-20,0 handR:0,20,0 thighL:-111,-3,1 thighR:-108,10,-3 shinL:58,0,0 shinR:146,0,0 footL:12,0,-3 footR:-15,9,5' },
];

/**
 * ポーズごとの手の形（人形の左手, 右手）。HAND_SHAPES の id。
 * 腕を組む・祈る・腰に手…のように手が体や物に触れるポーズは、手の位置と向きを「どこに置くか」から組み立て直した（v53）
 */
export const POSE_HANDS = {
  attention: ['relaxed', 'relaxed'],
  contrapposto: ['relaxed', 'relaxed'],
  crossArms: ['grip', 'grip'],
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
  sprint: ['flat', 'flat'],
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
  toprock: ['fist', 'fist'],
  sixStep: ['relaxed', 'flat'],
  chairFreeze: ['open', 'flat'],
  headstand: ['flat', 'flat'],
  windmill: ['flat', 'flat'],
  hipHopGroove: ['relaxed', 'relaxed'],
  popPoint: ['fist', 'point'],
  lockingPoint: ['relaxed', 'point'],
  krump: ['fist', 'fist'],
  tutting: ['flat', 'flat'],
  waacking: ['flat', 'open'],
  vogue: ['flat', 'flat'],
  moonwalk: ['relaxed', 'relaxed'],
  runningMan: ['fist', 'fist'],
  dab: ['flat', 'point'],
  heartArms: ['relaxed', 'relaxed'],
  plie: ['relaxed', 'relaxed'],
  passe: ['relaxed', 'relaxed'],
  grandJete: ['flat', 'flat'],
  jazzHands: ['open', 'open'],
  salsa: ['relaxed', 'relaxed'],
  tango: ['relaxed', 'flat'],
  flamenco: ['claw', 'claw'],
  bellyDance: ['relaxed', 'relaxed'],
  charleston: ['flat', 'flat'],
  cossack: ['flat', 'flat'],
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
  // 平ら: 指をそろえて伸ばし、親指は人差し指の横に（素体の初期の親指は手のひらの前へ 6cm も出ていて、手を合わせたり床についたりすると親指だけが当たる）
  { id: 'flat', name: '平ら', spec: 'index1:2,0,-3 middle1:2,0,0 ring1:2,0,2 pinky1:2,0,4 thumb1:-28,0,-38 thumb2:0,0,0 thumb3:0,0,0' },
  { id: 'relaxed', name: '自然', spec: 'index1:-15,0,3 index2:-25,0,0 index3:-15,0,0 middle1:-20,0,0 middle2:-30,0,0 middle3:-17,0,0 ring1:-25,0,-3 ring2:-35,0,0 ring3:-18,0,0 pinky1:-30,0,-6 pinky2:-38,0,0 pinky3:-20,0,0 thumb1:-10,0,-22 thumb2:5,0,0 thumb3:5,0,0' },
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
