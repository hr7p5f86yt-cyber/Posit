// anatomy.js — 骨格・筋肉の名前（日本語・ラテン語）と、部位のまとまり
//
// 左右は人形から見た左右。名前のうしろに（左）（右）を付けて出す。
// 骨は skeletonView.js、筋肉は muscleView.js がこの id で部品に名前を付ける。

export const REGIONS = [
  { key: 'head', name: '頭' },
  { key: 'neck', name: '首' },
  { key: 'trunk', name: '胴（胸・腹・背中）' },
  { key: 'pelvis', name: '骨盤・お尻' },
  { key: 'arm', name: '肩・腕' },
  { key: 'hand', name: '手' },
  { key: 'leg', name: '脚' },
  { key: 'foot', name: '足' },
];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// ---- 骨 --------------------------------------------------------------------
export const BONES = {
  cranium:     { ja: '頭頂骨・後頭骨', la: 'Ossa parietalia, Os occipitale', region: 'head', info: '頭のてっぺんから後頭部の丸み（脳頭蓋）。' },
  temporal:    { ja: '側頭骨', la: 'Os temporale', region: 'head', info: 'こめかみ〜耳のまわり。下に乳様突起がある。' },
  frontal:     { ja: '前頭骨', la: 'Os frontale', region: 'head', info: '額。眼窩の上のふちは眉弓（びきゅう）として張り出す。' },
  brow:        { ja: '眉弓（前頭骨）', la: 'Arcus superciliaris', region: 'head', info: '眉の下の骨の張り出し。男性ほど強い。' },
  orbit:       { ja: '眼窩', la: 'Orbita', region: 'head', info: '眼球の入るくぼみ。前頭骨・頬骨・上顎骨などで囲まれる。' },
  zygomatic:   { ja: '頬骨', la: 'Os zygomaticum', region: 'head', info: '頬の出っぱり。顔の明暗の境目になりやすい。' },
  zygArch:     { ja: '頬骨弓', la: 'Arcus zygomaticus', region: 'head', info: '頬骨から耳の前へ続く橋。下を咬筋が通る。' },
  mastoid:     { ja: '乳様突起（側頭骨）', la: 'Processus mastoideus', region: 'head', info: '耳の後ろ下の出っぱり。胸鎖乳突筋が付く。' },
  nasal:       { ja: '鼻骨', la: 'Os nasale', region: 'head', info: '鼻すじの上半分。下は軟骨。' },
  piriform:    { ja: '梨状口（上顎骨）', la: 'Apertura piriformis', region: 'head', info: '鼻の穴の骨のふち。' },
  nasalCavity: { ja: '鼻腔', la: 'Cavitas nasi', region: 'head' },
  maxilla:     { ja: '上顎骨', la: 'Maxilla', region: 'head', info: '眼窩の下〜上の歯ぐき。' },
  teethU:      { ja: '上の歯列', la: 'Arcus dentalis superior', region: 'head' },
  teethL:      { ja: '下の歯列', la: 'Arcus dentalis inferior', region: 'head' },
  mandible:    { ja: '下顎骨', la: 'Mandibula', region: 'head', info: '下あご。下顎角（エラ）から関節突起で頭蓋とつながる。' },

  vertebraC:   { ja: '頸椎', la: 'Vertebra cervicalis', region: 'neck', info: '首の骨（7個）。第7頸椎の棘突起は首の付け根で触れる。' },
  vertebraT:   { ja: '胸椎', la: 'Vertebra thoracica', region: 'trunk', info: '胸の背骨（12個）。肋骨が付く。' },
  vertebraL:   { ja: '腰椎', la: 'Vertebra lumbalis', region: 'trunk', info: '腰の背骨（5個）。いちばん太い。' },
  disc:        { ja: '椎間板', la: 'Discus intervertebralis', region: 'trunk', info: '椎骨と椎骨のあいだの軟骨。' },
  sacrum:      { ja: '仙骨', la: 'Os sacrum', region: 'pelvis', info: '背骨の下端。左右の腸骨にはさまれる。' },
  coccyx:      { ja: '尾骨', la: 'Os coccygis', region: 'pelvis' },
  sternum:     { ja: '胸骨', la: 'Sternum', region: 'trunk', info: '胸の真ん中。上から胸骨柄・胸骨体・剣状突起。' },
  rib:         { ja: '肋骨', la: 'Costa', region: 'trunk', info: '12対。1〜7番は胸骨へ、8〜10番は上の軟骨へ、11・12番は先が浮いている。' },
  costalCart:  { ja: '肋軟骨', la: 'Cartilago costalis', region: 'trunk', info: '肋骨の前の端の軟骨。8〜10番が合わさって肋骨弓を作る。' },
  ilium:       { ja: '腸骨', la: 'Os ilium', region: 'pelvis', info: '骨盤の翼。前の端は上前腸骨棘で、腰の骨の目印になる。' },
  iliacCrest:  { ja: '腸骨稜', la: 'Crista iliaca', region: 'pelvis', info: '腸骨の上のふち。腰のくびれの下で触れる。' },
  acetabulum:  { ja: '寛骨臼', la: 'Acetabulum', region: 'pelvis', info: '大腿骨頭を受けるお椀。' },
  ischium:     { ja: '坐骨', la: 'Os ischii', region: 'pelvis', info: '座ったときに体重を受ける骨（坐骨結節）。' },
  pubis:       { ja: '恥骨', la: 'Os pubis', region: 'pelvis' },
  symphysis:   { ja: '恥骨結合', la: 'Symphysis pubica', region: 'pelvis' },
  sacroiliac:  { ja: '仙腸関節', la: 'Articulatio sacroiliaca', region: 'pelvis' },

  clavicle:    { ja: '鎖骨', la: 'Clavicula', region: 'arm', info: '胸骨と肩峰をつなぐ S 字の骨。内側 2/3 は前へ、外側 1/3 は後ろへ反る。' },
  scapula:     { ja: '肩甲骨', la: 'Scapula', region: 'arm', info: '背中の第2〜第7胸椎の高さにある三角の板。腕を上げると外へ回る。' },
  glenoid:     { ja: '関節窩（肩甲骨）', la: 'Cavitas glenoidalis', region: 'arm' },
  acromion:    { ja: '肩甲棘・肩峰', la: 'Spina scapulae, Acromion', region: 'arm', info: '肩のいちばん高い角（肩峰）。肩幅の目印。' },
  coracoid:    { ja: '烏口突起', la: 'Processus coracoideus', region: 'arm' },
  humerus:     { ja: '上腕骨', la: 'Humerus', region: 'arm', info: '二の腕の骨。下端の内側上顆・外側上顆は肘で触れる。' },
  ulna:        { ja: '尺骨', la: 'Ulna', region: 'arm', info: '前腕の小指側。肘の後ろの出っぱりが肘頭。' },
  radius:      { ja: '橈骨', la: 'Radius', region: 'arm', info: '前腕の親指側。手のひらを返すと尺骨のまわりを回る。' },

  scaphoid:    { ja: '舟状骨', la: 'Os scaphoideum', region: 'hand' },
  lunate:      { ja: '月状骨', la: 'Os lunatum', region: 'hand' },
  triquetrum:  { ja: '三角骨', la: 'Os triquetrum', region: 'hand' },
  pisiform:    { ja: '豆状骨', la: 'Os pisiforme', region: 'hand' },
  trapezium:   { ja: '大菱形骨', la: 'Os trapezium', region: 'hand' },
  trapezoid:   { ja: '小菱形骨', la: 'Os trapezoideum', region: 'hand' },
  capitate:    { ja: '有頭骨', la: 'Os capitatum', region: 'hand' },
  hamate:      { ja: '有鉤骨', la: 'Os hamatum', region: 'hand' },
  metacarpal:  { ja: '中手骨', la: 'Os metacarpi', region: 'hand', info: '手のひらの骨。頭がこぶし（ナックル）になる。' },
  phalanxP:    { ja: '基節骨', la: 'Phalanx proximalis', region: 'hand' },
  phalanxM:    { ja: '中節骨', la: 'Phalanx media', region: 'hand' },
  phalanxD:    { ja: '末節骨', la: 'Phalanx distalis', region: 'hand' },

  femur:       { ja: '大腿骨', la: 'Femur', region: 'leg', info: '太ももの骨。大転子は腰の横の出っぱりで、脚の付け根の幅を決める。' },
  patella:     { ja: '膝蓋骨', la: 'Patella', region: 'leg', info: 'ひざの皿。' },
  tibia:       { ja: '脛骨', la: 'Tibia', region: 'leg', info: 'すねの骨。前のふちは皮膚のすぐ下で、内くるぶしになる。' },
  meniscus:    { ja: '半月板', la: 'Meniscus', region: 'leg' },
  fibula:      { ja: '腓骨', la: 'Fibula', region: 'leg', info: 'すねの外側の細い骨。外くるぶしは内くるぶしより低い。' },

  talus:       { ja: '距骨', la: 'Talus', region: 'foot', info: '足首の関節の下。すねの骨を受ける。' },
  calcaneus:   { ja: '踵骨', la: 'Calcaneus', region: 'foot', info: 'かかと。アキレス腱が付く。' },
  navicular:   { ja: '舟状骨', la: 'Os naviculare', region: 'foot' },
  cuboid:      { ja: '立方骨', la: 'Os cuboideum', region: 'foot' },
  cuneiformM:  { ja: '内側楔状骨', la: 'Os cuneiforme mediale', region: 'foot' },
  cuneiformI:  { ja: '中間楔状骨', la: 'Os cuneiforme intermedium', region: 'foot' },
  cuneiformL:  { ja: '外側楔状骨', la: 'Os cuneiforme laterale', region: 'foot' },
  metatarsal:  { ja: '中足骨', la: 'Os metatarsi', region: 'foot' },
  toePhalanx:  { ja: '趾骨', la: 'Phalanges digitorum pedis', region: 'foot' },
};

const FINGER_JA = { thumb: '親指', index: '人差し指', middle: '中指', ring: '薬指', pinky: '小指' };
const FINGER_NO = { thumb: 1, index: 2, middle: 3, ring: 4, pinky: 5 };

/**
 * 部品の名前を作る。
 * @param {string} id   BONES / MUSCLES の id
 * @param {object} o    side: 'L'|'R'、n: 番号、finger: 指、part: 部分の名前、tag: 一意にする追加の印
 */
export function partName(id, o = {}) {
  const b = BONES[id] || MUSCLES[id];
  if (!b) return null;
  let ja = b.ja, la = b.la;
  const n = o.n;
  if (id === 'vertebraC' || id === 'vertebraT' || id === 'vertebraL') {
    const special = id === 'vertebraC' && n === 1 ? '（環椎）' : id === 'vertebraC' && n === 2 ? '（軸椎）' : '';
    ja = `第${n}${b.ja}${special}`; la = `${b.la} ${ROMAN[n]}`;
  } else if (id === 'rib' || id === 'costalCart') {
    ja = `第${n}${b.ja}`; la = `${b.la} ${ROMAN[n]}`;
  } else if (id === 'disc' && o.levels) {
    ja = `${b.ja}（${o.levels}）`;
  } else if (id === 'metacarpal') {
    ja = `第${n}${b.ja}`; la = `${b.la} ${ROMAN[n]}`;
  } else if (id === 'phalanxP' || id === 'phalanxM' || id === 'phalanxD') {
    ja = `${FINGER_JA[o.finger] || ''}の${b.ja}`;
  } else if (id === 'metatarsal') {
    ja = `第${n}${b.ja}`; la = `${b.la} ${ROMAN[n]}`;
  } else if (id === 'toePhalanx') {
    const seg = ['基節骨', '中節骨', '末節骨'][o.seg || 0];
    ja = `第${n}趾の${seg}`; la = ['Phalanx proximalis', 'Phalanx media', 'Phalanx distalis'][o.seg || 0] + ` (digiti ${ROMAN[n]} pedis)`;
  }
  if (o.side) ja += o.side === 'L' ? '（左）' : '（右）';
  const key = [id, o.side || '', n || '', o.finger || '', o.seg ?? '', o.levels || ''].join('|');
  return { key, id, ja, la, region: b.region, info: b.info || '', part: o.part || '', side: o.side || null,
    origin: b.origin || '', insertion: b.insertion || '', action: b.action || '', kind: BONES[id] ? 'bone' : 'muscle' };
}

export { FINGER_JA, FINGER_NO };

// ---- 筋肉（表層の主なもの。muscleView.js が形を作る） ---------------------
//   origin … 起始、insertion … 停止、action … はたらき
export const MUSCLES = {
  // 頭・首
  temporalis:   { ja: '側頭筋', la: 'M. temporalis', region: 'head', origin: '側頭窩', insertion: '下顎骨の筋突起', action: '口を閉じる（かみしめる）' },
  masseter:     { ja: '咬筋', la: 'M. masseter', region: 'head', origin: '頬骨弓', insertion: '下顎角の外側', action: '口を閉じる。かみしめるとエラが張る' },
  frontalis:    { ja: '前頭筋', la: 'M. frontalis', region: 'head', origin: '帽状腱膜', insertion: '眉の皮膚', action: '眉を上げる（額のしわ）' },
  orbOculi:     { ja: '眼輪筋', la: 'M. orbicularis oculi', region: 'head', origin: '眼窩の内側のふち', insertion: 'まぶた・眼のまわりの皮膚', action: '目を閉じる' },
  orbOris:      { ja: '口輪筋', la: 'M. orbicularis oris', region: 'head', origin: '口のまわり', insertion: '唇の皮膚', action: '口をすぼめる' },
  zygomaticus:  { ja: '大頬骨筋', la: 'M. zygomaticus major', region: 'head', origin: '頬骨', insertion: '口角', action: '口角を引き上げる（笑う）' },
  scm:          { ja: '胸鎖乳突筋', la: 'M. sternocleidomastoideus', region: 'neck', origin: '胸骨柄・鎖骨の内側', insertion: '側頭骨の乳様突起', action: '首を反対側へ回す・前へ曲げる。首の形の目印' },
  trapezius:    { ja: '僧帽筋', la: 'M. trapezius', region: 'neck', origin: '後頭骨・項靭帯・第7頸椎〜第12胸椎の棘突起', insertion: '鎖骨の外側・肩峰・肩甲棘', action: '肩をすくめる・肩甲骨を寄せる' },
  splenius:     { ja: '頭板状筋', la: 'M. splenius capitis', region: 'neck', origin: '項靭帯・第7頸椎〜第3胸椎', insertion: '乳様突起・後頭骨', action: '頭を後ろへ反らす・回す' },
  // 胸・腹
  pecMajor:     { ja: '大胸筋', la: 'M. pectoralis major', region: 'trunk', origin: '鎖骨の内側半分・胸骨・第1〜6肋軟骨', insertion: '上腕骨の大結節稜', action: '腕を前で閉じる・内へひねる' },
  serratus:     { ja: '前鋸筋', la: 'M. serratus anterior', region: 'trunk', origin: '第1〜9肋骨の外側', insertion: '肩甲骨の内側縁', action: '肩甲骨を前へ出す。脇の下にのこぎり状に見える' },
  rectusAbd:    { ja: '腹直筋', la: 'M. rectus abdominis', region: 'trunk', origin: '恥骨', insertion: '第5〜7肋軟骨・剣状突起', action: '体を前へ曲げる。腱画で区切られ「割れた腹筋」になる' },
  extOblique:   { ja: '外腹斜筋', la: 'M. obliquus externus abdominis', region: 'trunk', origin: '第5〜12肋骨の外側', insertion: '腸骨稜・腹直筋鞘', action: '体をねじる・横へ曲げる' },
  latissimus:   { ja: '広背筋', la: 'M. latissimus dorsi', region: 'trunk', origin: '第7胸椎以下の棘突起・腸骨稜', insertion: '上腕骨の小結節稜', action: '腕を後ろ下へ引く。背中の逆三角形を作る' },
  erector:      { ja: '脊柱起立筋', la: 'M. erector spinae', region: 'trunk', origin: '仙骨・腸骨稜', insertion: '肋骨・椎骨・後頭骨', action: '背中を反らす。背骨の両わきの盛り上がり' },
  rhomboid:     { ja: '菱形筋', la: 'Mm. rhomboidei', region: 'trunk', origin: '第7頸椎〜第5胸椎の棘突起', insertion: '肩甲骨の内側縁', action: '肩甲骨を背骨へ寄せる' },
  infraspinatus:{ ja: '棘下筋', la: 'M. infraspinatus', region: 'arm', origin: '肩甲骨の棘下窩', insertion: '上腕骨の大結節', action: '腕を外へひねる' },
  teresMajor:   { ja: '大円筋', la: 'M. teres major', region: 'arm', origin: '肩甲骨の下角', insertion: '上腕骨の小結節稜', action: '腕を内へひねる・後ろへ引く' },
  // 肩・腕
  deltoidA:     { ja: '三角筋（前部）', la: 'M. deltoideus, pars clavicularis', region: 'arm', origin: '鎖骨の外側1/3', insertion: '上腕骨の三角筋粗面', action: '腕を前へ上げる' },
  deltoidM:     { ja: '三角筋（中部）', la: 'M. deltoideus, pars acromialis', region: 'arm', origin: '肩峰', insertion: '上腕骨の三角筋粗面', action: '腕を横へ上げる。肩の丸み' },
  deltoidP:     { ja: '三角筋（後部）', la: 'M. deltoideus, pars spinalis', region: 'arm', origin: '肩甲棘', insertion: '上腕骨の三角筋粗面', action: '腕を後ろへ引く' },
  biceps:       { ja: '上腕二頭筋', la: 'M. biceps brachii', region: 'arm', origin: '肩甲骨の関節上結節（長頭）・烏口突起（短頭）', insertion: '橈骨粗面', action: '肘を曲げる・手のひらを上へ返す（力こぶ）' },
  brachialis:   { ja: '上腕筋', la: 'M. brachialis', region: 'arm', origin: '上腕骨の前面下半分', insertion: '尺骨粗面', action: '肘を曲げる。二頭筋の両わきにのぞく' },
  triceps:      { ja: '上腕三頭筋', la: 'M. triceps brachii', region: 'arm', origin: '肩甲骨の関節下結節・上腕骨の後面', insertion: '尺骨の肘頭', action: '肘を伸ばす。二の腕の後ろ' },
  brachiorad:   { ja: '腕橈骨筋', la: 'M. brachioradialis', region: 'arm', origin: '上腕骨の外側下部', insertion: '橈骨の茎状突起', action: '肘を曲げる。前腕の親指側の盛り上がり' },
  flexorsFA:    { ja: '前腕の屈筋群', la: 'Mm. flexores antebrachii', region: 'arm', origin: '上腕骨の内側上顆', insertion: '手根骨・指骨', action: '手首と指を曲げる（円回内筋・橈側手根屈筋・長掌筋・尺側手根屈筋など）' },
  extensorsFA:  { ja: '前腕の伸筋群', la: 'Mm. extensores antebrachii', region: 'arm', origin: '上腕骨の外側上顆', insertion: '中手骨・指骨', action: '手首と指を伸ばす（長・短橈側手根伸筋・総指伸筋・尺側手根伸筋など）' },
  thenar:       { ja: '母指球筋', la: 'Eminentia thenaris', region: 'hand', origin: '手根骨', insertion: '親指の基節骨', action: '親指を動かす。親指の付け根のふくらみ' },
  hypothenar:   { ja: '小指球筋', la: 'Eminentia hypothenaris', region: 'hand', origin: '手根骨', insertion: '小指の基節骨', action: '小指を動かす。手のひらの小指側のふくらみ' },
  // 骨盤・脚
  gluteusMax:   { ja: '大殿筋', la: 'M. gluteus maximus', region: 'pelvis', origin: '腸骨の後ろ・仙骨・尾骨', insertion: '大腿骨の殿筋粗面・腸脛靭帯', action: '脚を後ろへ伸ばす。お尻の丸み' },
  gluteusMed:   { ja: '中殿筋', la: 'M. gluteus medius', region: 'pelvis', origin: '腸骨の外面', insertion: '大腿骨の大転子', action: '脚を横へ開く。片足立ちで骨盤を支える' },
  tfl:          { ja: '大腿筋膜張筋', la: 'M. tensor fasciae latae', region: 'leg', origin: '上前腸骨棘', insertion: '腸脛靭帯', action: '脚を前・横へ上げる' },
  sartorius:    { ja: '縫工筋', la: 'M. sartorius', region: 'leg', origin: '上前腸骨棘', insertion: '脛骨の内側（鵞足）', action: 'あぐらをかく動き。太ももを斜めに横切る細長い筋' },
  rectusFem:    { ja: '大腿直筋', la: 'M. rectus femoris', region: 'leg', origin: '下前腸骨棘', insertion: '膝蓋骨・脛骨粗面', action: '膝を伸ばす・脚を前へ上げる' },
  vastusLat:    { ja: '外側広筋', la: 'M. vastus lateralis', region: 'leg', origin: '大腿骨の大転子・粗線', insertion: '膝蓋骨', action: '膝を伸ばす。太ももの外側の張り' },
  vastusMed:    { ja: '内側広筋', la: 'M. vastus medialis', region: 'leg', origin: '大腿骨の粗線', insertion: '膝蓋骨', action: '膝を伸ばす。膝の内側上のしずく形' },
  adductors:    { ja: '内転筋群', la: 'Mm. adductores', region: 'leg', origin: '恥骨・坐骨', insertion: '大腿骨の粗線', action: '脚を閉じる（長内転筋・大内転筋・薄筋など）' },
  bicepsFem:    { ja: '大腿二頭筋', la: 'M. biceps femoris', region: 'leg', origin: '坐骨結節・大腿骨の粗線', insertion: '腓骨頭', action: '膝を曲げる（ハムストリングの外側）' },
  semitend:     { ja: '半腱様筋・半膜様筋', la: 'M. semitendinosus, M. semimembranosus', region: 'leg', origin: '坐骨結節', insertion: '脛骨の内側', action: '膝を曲げる（ハムストリングの内側）' },
  gastroc:      { ja: '腓腹筋', la: 'M. gastrocnemius', region: 'leg', origin: '大腿骨の内側上顆・外側上顆', insertion: '踵骨（アキレス腱）', action: 'つま先立ち。ふくらはぎの二つのふくらみ' },
  soleus:       { ja: 'ヒラメ筋', la: 'M. soleus', region: 'leg', origin: '脛骨・腓骨の後面上部', insertion: '踵骨（アキレス腱）', action: 'つま先立ち。腓腹筋の下の両わきにのぞく' },
  tibialisAnt:  { ja: '前脛骨筋', la: 'M. tibialis anterior', region: 'leg', origin: '脛骨の外側面', insertion: '内側楔状骨・第1中足骨', action: 'つま先を上げる。すねの骨のすぐ外側' },
  peroneus:     { ja: '長腓骨筋', la: 'M. fibularis longus', region: 'leg', origin: '腓骨の外側面', insertion: '第1中足骨・内側楔状骨', action: '足の裏を外へ向ける' },
  achilles:     { ja: 'アキレス腱（踵骨腱）', la: 'Tendo calcaneus', region: 'foot', origin: '腓腹筋・ヒラメ筋', insertion: '踵骨隆起', action: 'ふくらはぎの力をかかとへ伝える' },
};
