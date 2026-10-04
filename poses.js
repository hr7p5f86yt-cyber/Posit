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
  { id: 'contrapposto', name: '片足重心で立つ', category: 'stand', seat: false, lift: 0, spec: 'footL:-6,0,-6 footR:0,0,-3 chest:0,-4,6 forearmL:-12,0,0 forearmR:-14,0,0 thighL:-10,8,10 thighR:0,0,5 shinL:18,0,0 neck:0,0,-4 hips:0,8,-7 upperArmL:3,0,6 upperArmR:-3,0,-8 spine:0,-3,4' },
  { id: 'crossArms', name: '腕を組む', category: 'stand', seat: false, lift: 0, spec: 'chest:-4,0,0 forearmL:-105,-15,0 forearmR:-105,15,0 neck:-3,0,0 thighL:0,0,4 thighR:0,0,-4 upperArmL:-30,-75,-14 upperArmR:-30,75,14' },
  { id: 'handsOnHips', name: '両手を腰に', category: 'stand', seat: false, lift: 0, spec: 'forearmL:-100,0,0 forearmR:-100,0,0 thighL:0,0,6 thighR:0,0,-6 upperArmL:-5,-90,42 upperArmR:-5,90,-42 handL:0,-20,20 handR:0,20,-20' },
  { id: 'lookBack', name: '振り返る', category: 'stand', seat: false, lift: 0, spec: 'chest:0,25,0 forearmL:-10,0,0 forearmR:-15,0,0 head:-5,25,0 thighL:0,10,0 thighR:0,5,0 neck:0,40,0 upperArmL:8,0,6 upperArmR:-8,0,-6 spine:0,18,0' },
  { id: 'natural', name: '自然に立つ', category: 'stand', seat: false, lift: 0, spec: 'footL:0,0,-3 footR:0,0,2 forearmL:-12,0,0 forearmR:-15,0,0 thighL:0,0,4 thighR:0,0,-3 neck:3,0,0 upperArmL:4,0,7 upperArmR:-3,0,-6' },
  { id: 'phone', name: 'スマホを見る', category: 'stand', seat: false, lift: 0, spec: 'forearmL:-10,0,0 forearmR:-115,0,0 head:15,0,0 neck:25,0,0 upperArmL:0,0,5 upperArmR:-15,30,-8 handR:-20,-60,0' },
  { id: 'pointForward', name: '前を指差す', category: 'stand', seat: false, lift: 0, spec: 'chest:0,8,0 forearmL:-10,0,0 forearmR:-5,0,0 upperArmL:0,0,5 upperArmR:-85,0,-5 handR:0,90,0' },
  { id: 'pray', name: '祈る', category: 'stand', seat: false, lift: 0, spec: 'forearmL:-110,0,0 forearmR:-110,0,0 head:10,0,0 neck:20,0,0 upperArmL:-30,-45,12 upperArmR:-30,45,-12 handL:40,0,0 handR:40,0,0' },
  { id: 'raiseHand', name: '手を挙げる', category: 'stand', seat: false, lift: 0, spec: 'forearmL:-10,0,0 forearmR:-5,0,0 upperArmL:0,0,5 upperArmR:0,-90,-170' },
  { id: 'salute', name: '敬礼', category: 'stand', seat: false, lift: 0, spec: 'forearmR:-139,0,0 upperArmL:0,0,3 upperArmR:-101,12,-59 handR:0,0,0' },
  { id: 'scratchHead', name: '頭をかく', category: 'stand', seat: false, lift: 0, spec: 'forearmL:-10,0,0 forearmR:-130,0,0 neck:8,-5,6 upperArmL:0,0,5 upperArmR:9,-99,-143' },
  { id: 'stretch', name: '伸びをする', category: 'stand', seat: false, lift: 0, spec: 'chest:-12,0,0 forearmL:-8,0,0 forearmR:-8,0,0 head:-10,0,0 neck:-12,0,0 upperArmL:0,90,172 upperArmR:0,-90,-172' },
  { id: 'think', name: '考える（あごに手）', category: 'stand', seat: false, lift: 0, spec: 'forearmL:-95,0,0 forearmR:-141,0,0 head:5,-8,0 neck:12,0,3 upperArmL:-25,-60,10 upperArmR:-35,52,10 handR:-20,0,0' },
  { id: 'wave', name: '手を振る', category: 'stand', seat: false, lift: 0, spec: 'forearmL:-12,0,0 forearmR:-80,0,0 neck:0,0,-3 upperArmL:0,0,6 upperArmR:0,-90,-100 handR:0,-90,-10' },
  { id: 'bag', name: 'かばんを肩にかける', category: 'daily', seat: false, lift: 0, spec: 'forearmL:-12,0,0 forearmR:-120,0,0 thighL:-10,0,3 shinL:10,0,0 hips:0,0,-3 upperArmL:3,0,6 upperArmR:-10,20,-10 handR:20,0,0' },
  { id: 'carryBox', name: '箱を運ぶ', category: 'daily', seat: false, lift: 0, spec: 'chest:-5,0,0 forearmL:-75,0,0 forearmR:-75,0,0 shinL:8,0,0 shinR:8,0,0 upperArmL:-45,-40,18 upperArmR:-45,40,-18 spine:-5,0,0 handL:0,60,0 handR:0,-60,0' },
  { id: 'drink', name: '飲む', category: 'daily', seat: false, lift: 0, spec: 'forearmL:-10,0,0 forearmR:-140,0,0 head:-10,0,0 neck:-15,0,0 upperArmL:0,0,5 upperArmR:-45,40,-12 handR:-10,-40,0' },
  { id: 'lean', name: '壁にもたれる', category: 'daily', seat: false, lift: 0, spec: 'footR:10,0,0 chest:-5,0,0 forearmL:-30,0,0 forearmR:-30,0,0 thighL:-5,0,3 thighR:-35,-20,5 shinR:70,0,0 hips:-8,0,0 upperArmL:20,-30,10 upperArmR:20,30,-10' },
  { id: 'pickUp', name: '物を拾う', category: 'daily', seat: false, lift: 0, spec: 'footL:-20,0,0 footR:-20,0,0 chest:40,0,0 forearmL:-30,0,0 forearmR:-10,0,0 thighL:-40,0,5 thighR:-40,0,-5 shinL:60,0,0 shinR:60,0,0 neck:20,0,0 upperArmL:-30,0,15 upperArmR:-80,0,-5 spine:30,0,0' },
  { id: 'umbrella', name: '傘をさす', category: 'daily', seat: false, lift: 0, spec: 'forearmL:-15,0,0 forearmR:-110,0,0 upperArmL:0,0,5 upperArmR:-50,20,-20 handR:0,-90,0' },
  { id: 'angry', name: '怒る', category: 'emotion', seat: false, lift: 0, spec: 'chest:8,0,0 forearmL:-75,0,0 forearmR:-75,0,0 head:-12,0,0 thighL:-5,0,8 thighR:-5,0,-8 shinL:10,0,0 shinR:10,0,0 neck:0,0,0 upperArmL:-10,-20,18 upperArmR:-10,20,-18' },
  { id: 'banzai', name: 'バンザイ', category: 'emotion', seat: false, lift: 0, spec: 'chest:-10,0,0 forearmL:-12,0,0 forearmR:-12,0,0 head:-10,0,0 thighL:0,0,8 thighR:0,0,-8 neck:-15,0,0 upperArmL:-15,90,150 upperArmR:-15,-90,-150' },
  { id: 'cry', name: '泣く（顔を覆う）', category: 'emotion', seat: false, lift: 0, spec: 'chest:15,0,0 forearmL:-142,0,0 forearmR:-142,0,0 head:10,0,0 shinL:8,0,0 shinR:8,0,0 neck:20,0,0 upperArmL:-55,-55,20 upperArmR:-55,55,-20 spine:8,0,0 handL:20,0,0 handR:20,0,0' },
  { id: 'depressed', name: '落ち込む（うなだれる）', category: 'emotion', seat: false, lift: 0, spec: 'chest:14,0,0 shoulderL:0,-15,-10 shoulderR:0,15,10 forearmL:-8,0,0 forearmR:-8,0,0 head:14,0,0 thighL:-5,0,0 thighR:-5,0,0 shinL:8,0,0 shinR:8,0,0 neck:22,0,0 upperArmL:-5,-10,2 upperArmR:-5,10,-2 spine:4,0,0' },
  { id: 'gutsPose', name: 'ガッツポーズ', category: 'emotion', seat: false, lift: 0, spec: 'chest:-5,5,0 forearmL:-100,0,0 forearmR:-115,0,0 neck:-10,0,0 upperArmL:10,-40,20 upperArmR:-10,-90,-95' },
  { id: 'happyJump', name: '喜んで跳ねる', category: 'emotion', seat: false, lift: 0.12, spec: 'footL:30,0,0 footR:30,0,0 chest:-10,0,0 forearmL:-30,0,0 forearmR:-30,0,0 thighL:-30,0,5 thighR:-10,0,-5 shinL:80,0,0 shinR:40,0,0 neck:-10,0,0 upperArmL:-20,90,140 upperArmR:-20,-90,-140' },
  { id: 'shy', name: '恥ずかしがる', category: 'emotion', seat: false, lift: 0, spec: 'chest:6,0,0 forearmL:-35,0,0 forearmR:-35,0,0 head:10,-10,5 thighL:-3,-10,-4 thighR:-3,10,4 shinL:14,0,0 shinR:14,0,0 neck:15,-10,10 upperArmL:-15,-30,5 upperArmR:-15,30,-5 handL:-10,0,0 handR:-10,0,0' },
  { id: 'surprised', name: '驚く', category: 'emotion', seat: false, lift: 0, spec: 'chest:-10,0,0 forearmL:-134,0,0 forearmR:-134,0,0 head:-8,0,0 thighL:10,0,5 thighR:-10,0,-5 shinL:10,0,0 shinR:15,0,0 neck:-10,0,0 upperArmL:-31,-25,19 upperArmR:-31,25,-19 spine:-5,0,0 handL:30,0,0 handR:30,0,0' },
  { id: 'run', name: '走る', category: 'walk', seat: false, lift: 0.03, spec: 'footL:15,0,0 footR:30,0,0 chest:0,-14,0 forearmL:-95,0,0 forearmR:-100,0,0 thighL:-60,0,3 thighR:20,0,-3 shinL:85,0,0 shinR:55,0,0 neck:-10,0,0 hips:12,8,0 upperArmL:40,0,10 upperArmR:-50,0,-10' },
  { id: 'skip', name: 'スキップ', category: 'walk', seat: false, lift: 0, spec: 'footL:25,0,0 footR:30,0,0 chest:0,-8,0 forearmL:-40,0,0 forearmR:-60,0,0 thighL:-75,0,3 thighR:8,0,-2 shinL:95,0,0 neck:-5,0,0 upperArmL:30,0,10 upperArmR:-65,0,-10' },
  { id: 'sneak', name: '忍び足', category: 'walk', seat: false, lift: 0, spec: 'footL:-5,0,0 footR:25,0,0 chest:10,0,0 forearmL:-90,0,0 forearmR:-80,0,0 thighL:-55,0,5 thighR:-5,0,-5 shinL:60,0,0 shinR:55,0,0 neck:-25,0,0 hips:20,0,0 upperArmL:-40,-30,20 upperArmR:-50,30,-20' },
  { id: 'sprint', name: '全力疾走', category: 'walk', seat: false, lift: 0, spec: 'footL:20,0,0 footR:35,0,0 chest:5,-18,0 forearmL:-85,0,0 forearmR:-90,0,0 thighL:-85,0,3 thighR:15,0,-3 shinL:105,0,0 shinR:25,0,0 neck:-20,0,0 hips:22,10,0 upperArmL:55,0,8 upperArmR:-75,0,-8' },
  { id: 'stairs', name: '階段を上る', category: 'walk', seat: false, lift: 0, spec: 'footL:-20,0,0 footR:20,0,0 chest:4,0,0 forearmL:-15,0,0 forearmR:-25,0,0 thighL:-55,0,3 thighR:5,0,-2 shinL:75,0,0 shinR:10,0,0 neck:5,0,0 hips:8,0,0 upperArmL:15,0,6 upperArmR:-20,0,-6' },
  { id: 'walk', name: '歩く', category: 'walk', seat: false, lift: 0, spec: 'footL:-12,0,0 footR:18,0,0 chest:0,-10,0 forearmL:-12,0,0 forearmR:-28,0,0 thighL:-25,0,2 thighR:15,0,-2 shinL:8,0,0 shinR:22,0,0 hips:0,6,0 upperArmL:18,0,5 upperArmR:-22,0,-5' },
  { id: 'chair', name: '椅子に座る', category: 'sit', seat: true, lift: 0, spec: 'chest:-3,0,0 forearmL:-45,0,0 forearmR:-45,0,0 thighL:-90,0,4 thighR:-90,0,-4 shinL:90,0,0 shinR:90,0,0 upperArmL:-22,0,8 upperArmR:-22,0,-8' },
  { id: 'chairCrossLegs', name: '脚を組んで座る', category: 'sit', seat: true, lift: 0, spec: 'footL:20,0,0 chest:-5,5,0 forearmL:-50,0,0 forearmR:-50,0,0 thighL:-106,13,-15 thighR:-88,0,-6 shinL:86,0,-12 shinR:88,0,0 upperArmL:-25,-20,10 upperArmR:-25,20,-10' },
  { id: 'chinRest', name: '頬杖をつく', category: 'sit', seat: true, lift: 0, spec: 'chest:22,0,0 forearmL:-60,0,0 forearmR:-150,0,0 head:-5,0,10 thighL:-90,0,6 thighR:-90,0,-6 shinL:90,0,0 shinR:90,0,0 neck:-15,0,8 upperArmL:-45,-30,12 upperArmR:-95,40,-10 spine:12,0,0 handR:40,0,0' },
  { id: 'crossLegged', name: 'あぐら', category: 'sit', seat: false, lift: 0, spec: 'footL:10,0,20 footR:10,0,-20 chest:5,0,0 forearmL:-35,0,0 forearmR:-35,0,0 thighL:-88,70,47 thighR:-82,-67,-50 shinL:118,0,-12 shinR:135,0,11 upperArmL:-25,-20,12 upperArmR:-25,20,-12 spine:8,0,0' },
  { id: 'hugKnees', name: '体育座り', category: 'sit', seat: false, lift: 0, spec: 'footL:-10,0,0 footR:-10,0,0 chest:15,0,0 forearmL:-45,0,0 forearmR:-45,0,0 thighL:-125,0,5 thighR:-125,0,-5 shinL:145,0,0 shinR:145,0,0 neck:10,0,0 upperArmL:-60,-30,18 upperArmR:-60,30,-18 spine:15,0,0' },
  { id: 'legsOut', name: '脚を伸ばして座る', category: 'sit', seat: false, lift: 0, spec: 'footL:10,0,0 footR:10,0,0 chest:-10,0,0 forearmL:-5,0,0 forearmR:-5,0,0 thighL:-80,0,5 thighR:-80,0,-5 shinL:5,0,0 shinR:5,0,0 neck:5,0,0 upperArmL:40,0,12 upperArmR:40,0,-12 spine:-8,0,0 handL:80,0,0 handR:80,0,0' },
  { id: 'seiza', name: '正座', category: 'sit', seat: false, lift: 0, spec: 'footL:55,0,0 footR:55,0,0 forearmL:-50,0,0 forearmR:-50,0,0 thighL:-90,0,3 thighR:-90,0,-3 shinL:165,0,0 shinR:165,0,0 upperArmL:-25,-5,5 upperArmR:-25,5,-5' },
  { id: 'sideSit', name: '横座り', category: 'sit', seat: false, lift: 0, spec: 'footL:40,0,0 footR:40,0,0 chest:0,10,8 forearmL:-40,0,0 forearmR:-5,0,0 thighL:-83,69,15 thighR:-82,70,-3 shinL:127,0,-12 shinR:120,0,-12 upperArmL:-30,-20,10 upperArmR:0,0,-25 handR:80,0,0' },
  { id: 'allFours', name: '四つんばい', category: 'kneel', seat: false, lift: 0, spec: 'footL:40,0,0 footR:40,0,0 chest:-5,0,0 forearmL:-5,0,0 forearmR:-5,0,0 head:-25,0,0 thighL:-90,0,4 thighR:-90,0,-4 shinL:90,0,0 shinR:90,0,0 neck:-45,0,0 hips:90,0,0 upperArmL:-80,0,6 upperArmR:-80,0,-6 spine:-5,0,0 handL:80,0,0 handR:80,0,0' },
  { id: 'crouchLook', name: 'しゃがんで覗き込む', category: 'kneel', seat: false, lift: 0, spec: 'footL:-35,0,0 footR:30,0,0 chest:20,0,0 forearmL:-40,0,0 forearmR:-40,0,0 thighL:-125,0,12 thighR:-80,0,-10 shinL:150,0,0 shinR:160,0,0 neck:-25,0,0 upperArmL:-60,-20,10 upperArmR:-60,20,-10 spine:25,0,0' },
  { id: 'kneelBoth', name: '膝立ち', category: 'kneel', seat: false, lift: 0, spec: 'footL:40,0,0 footR:40,0,0 forearmL:-15,0,0 forearmR:-15,0,0 thighL:0,0,5 thighR:0,0,-5 shinL:90,0,0 shinR:90,0,0 upperArmL:0,0,6 upperArmR:0,0,-6' },
  { id: 'kneelOne', name: '片膝立ち', category: 'kneel', seat: false, lift: 0, spec: 'footR:-5,0,0 forearmL:-60,0,0 forearmR:-15,0,0 thighL:-90,0,5 thighR:0,0,-3 shinL:90,0,0 shinR:92,0,0 upperArmL:-30,-20,10 upperArmR:0,0,-8' },
  { id: 'proposal', name: '片膝をついて手を差し出す', category: 'kneel', seat: false, lift: 0, spec: 'footR:-5,0,0 chest:5,0,0 forearmL:-20,0,0 forearmR:-15,0,0 thighL:-90,0,5 thighR:0,0,-3 shinL:90,0,0 shinR:92,0,0 neck:-10,0,0 upperArmL:0,0,8 upperArmR:-75,0,-10 handR:0,-90,0' },
  { id: 'squat', name: 'しゃがむ', category: 'kneel', seat: false, lift: 0, spec: 'footL:-35,0,0 footR:-35,0,0 chest:15,0,0 forearmL:-50,0,0 forearmR:-50,0,0 thighL:-120,10,18 thighR:-120,-10,-18 shinL:150,0,0 shinR:150,0,0 neck:-20,0,0 upperArmL:-50,-20,10 upperArmR:-50,20,-10 spine:20,0,0' },
  { id: 'fetal', name: '丸まって寝る', category: 'lie', seat: false, lift: 0, spec: 'chest:20,0,0 forearmL:-110,0,0 forearmR:-110,0,0 thighL:-100,0,0 thighR:-100,0,0 shinL:120,0,0 shinR:120,0,0 neck:30,0,0 hips:0,0,90 upperArmL:-80,0,0 upperArmR:-80,0,0 spine:20,0,0' },
  { id: 'prone', name: 'うつ伏せ', category: 'lie', seat: false, lift: 0, spec: 'footL:40,0,0 footR:40,0,0 forearmL:-90,0,0 forearmR:-90,0,0 thighL:0,0,5 thighR:0,0,-5 neck:-10,60,0 hips:90,0,0 upperArmL:0,90,100 upperArmR:0,-90,-100' },
  { id: 'proneChin', name: 'うつ伏せで頬杖', category: 'lie', seat: false, lift: 0, spec: 'footL:40,0,0 footR:40,0,0 chest:-30,0,0 forearmL:-130,0,0 forearmR:-130,0,0 thighL:0,0,5 thighR:0,0,-5 shinL:80,0,0 shinR:110,0,0 neck:-35,0,0 hips:90,0,0 upperArmL:-120,-30,15 upperArmR:-120,30,-15 spine:-25,0,0 handL:30,0,0 handR:30,0,0' },
  { id: 'sideLie', name: '横向きに寝る', category: 'lie', seat: false, lift: 0, spec: 'forearmL:-20,0,0 forearmR:-60,0,0 thighL:-35,0,0 thighR:-35,0,0 shinL:50,0,0 shinR:50,0,0 neck:0,0,-20 hips:0,0,90 upperArmL:-20,0,0 upperArmR:-90,0,0' },
  { id: 'supine', name: '仰向け', category: 'lie', seat: false, lift: 0, spec: 'footL:25,0,0 footR:25,0,0 forearmL:-10,0,0 forearmR:-10,0,0 thighL:0,0,5 thighR:0,0,-5 hips:-90,0,0 upperArmL:0,0,12 upperArmR:0,0,-12' },
  { id: 'supineHandsHead', name: '仰向けで腕枕', category: 'lie', seat: false, lift: 0, spec: 'footR:25,0,0 forearmL:-140,0,0 forearmR:-140,0,0 thighL:-40,0,5 thighR:0,0,-5 shinL:80,0,0 neck:15,0,0 hips:-90,0,0 upperArmL:0,90,150 upperArmR:0,-90,-150' },
  { id: 'aimGun', name: '銃を構える', category: 'action', seat: false, lift: 0, spec: 'forearmL:-25,0,0 forearmR:-5,0,0 thighL:-15,0,5 thighR:10,0,-5 shinL:15,0,0 shinR:10,0,0 neck:10,0,0 upperArmL:-80,0,-25 upperArmR:-88,0,12 handL:0,90,0 handR:0,90,0' },
  { id: 'damage', name: 'ダメージ（のけぞる）', category: 'action', seat: false, lift: 0, spec: 'footR:30,0,0 chest:-30,0,0 forearmL:-25,0,0 forearmR:-25,0,0 head:-15,0,0 thighL:-20,0,5 thighR:25,0,-5 shinL:25,0,0 shinR:30,0,0 neck:-30,0,0 upperArmL:40,0,45 upperArmR:40,0,-45 spine:-15,0,0' },
  { id: 'fall', name: '転ぶ', category: 'action', seat: false, lift: 0.08, spec: 'chest:-20,0,0 forearmL:-20,0,0 forearmR:-20,0,0 thighL:20,0,5 thighR:50,0,-5 shinL:40,0,0 shinR:20,0,0 neck:-40,0,0 hips:50,0,0 upperArmL:-120,0,25 upperArmR:-120,0,-25' },
  { id: 'fightStance', name: 'ファイティングポーズ', category: 'action', seat: false, lift: 0, spec: 'footL:-5,0,0 footR:20,0,0 chest:5,-12,0 forearmL:-130,0,0 forearmR:-140,0,0 thighL:-25,0,8 thighR:15,20,-10 shinL:25,0,0 shinR:30,0,0 neck:5,-10,0 hips:0,30,0 upperArmL:-55,-35,20 upperArmR:-40,40,-25 spine:5,-8,0' },
  { id: 'frontKick', name: '前蹴り', category: 'action', seat: false, lift: 0, spec: 'footL:5,0,0 footR:-25,0,0 chest:-12,0,0 forearmL:-130,0,0 forearmR:-130,0,0 thighL:0,0,5 thighR:-95,0,-5 shinL:15,0,0 shinR:15,0,0 neck:10,0,0 upperArmL:-50,-40,25 upperArmR:-40,40,-25' },
  { id: 'guard', name: '腕でガード', category: 'action', seat: false, lift: 0, spec: 'footL:-5,0,0 footR:-5,0,0 chest:10,0,0 forearmL:-110,0,0 forearmR:-110,0,0 thighL:-15,0,10 thighR:-15,0,-10 shinL:25,0,0 shinR:25,0,0 neck:15,0,0 upperArmL:-95,-50,10 upperArmR:-95,50,-10 spine:10,0,0' },
  { id: 'highKick', name: 'ハイキック', category: 'action', seat: false, lift: 0, spec: 'footR:30,0,0 chest:0,15,15 forearmL:-60,0,0 forearmR:-120,0,0 thighL:0,30,-5 thighR:-40,0,-95 shinL:10,0,0 shinR:10,0,0 neck:0,0,-30 hips:0,0,25 upperArmL:0,0,50 upperArmR:-50,40,-20 spine:0,0,10' },
  { id: 'jump', name: 'ジャンプ', category: 'action', seat: false, lift: 0.2, spec: 'footL:30,0,0 footR:30,0,0 chest:-8,0,0 forearmL:-15,0,0 forearmR:-15,0,0 thighL:-60,0,8 thighR:-60,0,-8 shinL:95,0,0 shinR:95,0,0 neck:-10,0,0 upperArmL:-25,90,150 upperArmR:-25,-90,-150' },
  { id: 'punch', name: 'パンチ', category: 'action', seat: false, lift: 0, spec: 'footL:-10,0,0 footR:20,0,0 chest:5,15,0 forearmL:-135,0,0 forearmR:-3,0,0 thighL:-30,0,8 thighR:20,15,-10 shinL:35,0,0 shinR:15,0,0 neck:0,-25,0 hips:0,20,0 upperArmL:-45,-40,25 upperArmR:-90,0,3 spine:5,10,0 handR:0,90,0' },
  { id: 'swordStance', name: '剣を構える', category: 'action', seat: false, lift: 0, spec: 'footL:20,0,0 chest:0,-10,0 forearmL:-60,0,0 forearmR:-45,0,0 thighL:20,10,5 thighR:-20,0,-5 shinL:20,0,0 shinR:20,0,0 hips:0,10,0 upperArmL:-40,-10,-10 upperArmR:-50,-10,15 handL:-20,-60,0 handR:-20,-60,0' },
  { id: 'throw', name: '投げる（振りかぶる）', category: 'action', seat: false, lift: 0, spec: 'footL:-10,0,0 chest:-10,-25,0 forearmL:-20,0,0 forearmR:-95,0,0 thighL:-50,0,10 thighR:0,0,-10 shinL:40,0,0 shinR:20,0,0 neck:0,35,0 hips:0,-25,0 upperArmL:-80,0,20 upperArmR:0,-80,-100 spine:-5,-10,0 handR:-30,0,0' },
  { id: 'arabesque', name: 'バレエ（アラベスク）', category: 'sport', seat: false, lift: 0, spec: 'footL:55,0,0 footR:55,0,0 chest:-20,0,0 forearmL:-10,0,0 forearmR:-10,0,0 thighL:-25,30,5 thighR:50,0,-5 neck:-20,0,0 hips:25,0,0 upperArmL:-110,0,10 upperArmR:0,0,-80' },
  { id: 'basketShoot', name: 'シュート（バスケ）', category: 'sport', seat: false, lift: 0.05, spec: 'footL:40,0,0 footR:40,0,0 chest:-8,0,0 forearmL:-90,0,0 forearmR:-80,0,0 shinL:10,0,0 shinR:10,0,0 neck:-20,0,0 upperArmL:-140,-20,20 upperArmR:-150,-20,-10 handR:-60,0,0' },
  { id: 'batting', name: 'バッティング', category: 'sport', seat: false, lift: 0, spec: 'chest:5,0,0 forearmL:-60,0,0 forearmR:-110,0,0 head:0,0,0 thighL:-25,0,20 thighR:-25,0,-20 shinL:25,0,0 shinR:25,0,0 neck:0,-75,0 hips:15,70,0 upperArmL:-60,-20,-10 upperArmR:-40,-40,-40' },
  { id: 'cheer', name: '応援（ポンポン）', category: 'sport', seat: false, lift: 0, spec: 'footL:30,0,0 forearmL:-5,0,0 forearmR:-5,0,0 thighL:-70,0,5 shinL:100,0,0 neck:-8,0,0 upperArmL:0,0,40 upperArmR:-30,-90,-140' },
  { id: 'dance', name: 'ダンス（天を指す）', category: 'sport', seat: false, lift: 0, spec: 'footL:20,0,0 footR:0,0,0 chest:0,0,-8 forearmL:-100,0,0 forearmR:-5,0,0 thighL:-20,25,20 thighR:0,0,5 shinL:30,0,0 neck:-15,0,0 hips:0,0,8 upperArmL:-5,-90,42 upperArmR:-20,-90,-145' },
  { id: 'lunge', name: 'ランジ', category: 'sport', seat: false, lift: 0, spec: 'footL:-5,0,0 footR:30,0,0 forearmL:-100,0,0 forearmR:-100,0,0 thighL:-90,0,6 thighR:35,0,-6 shinL:95,0,0 shinR:10,0,0 upperArmL:0,-90,42 upperArmR:0,90,-42' },
  { id: 'soccerKick', name: 'ボールを蹴る', category: 'sport', seat: false, lift: 0, spec: 'footL:-15,0,0 footR:40,0,0 chest:-10,10,0 forearmL:-20,0,0 forearmR:-30,0,0 thighL:-20,0,5 thighR:40,0,-5 shinL:25,0,0 shinR:95,0,0 neck:20,0,0 hips:0,-15,0 upperArmL:-10,0,70 upperArmR:-30,0,-30' },
  { id: 'swim', name: '泳ぐ（クロール）', category: 'sport', seat: false, lift: 0.3, spec: 'footL:50,0,0 footR:50,0,0 chest:0,20,0 forearmL:-10,0,0 forearmR:-5,0,0 thighL:10,0,3 thighR:-10,0,-3 neck:-20,-50,0 hips:90,0,0 upperArmL:30,0,10 upperArmR:-175,0,-5' },
  { id: 'yogaTree', name: 'ヨガ（木のポーズ）', category: 'sport', seat: false, lift: 0, spec: 'footR:30,0,0 forearmL:-35,0,0 forearmR:-35,0,0 thighL:0,0,3 thighR:-60,-60,-50 shinR:150,0,0 upperArmL:0,90,165 upperArmR:0,-90,-165' },
];

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
