# クレジット・ライセンス（Posit で使っているもの）

Posit が表示・同梱・読み込みしている第三者の作品と、そのライセンスです。
（1 の頭部スキャンは石膏像の「頭部（現代のスキャン）」、1-2 は石膏像の彫刻です）
アプリの中では「設定 › 体とモデル › クレジット・ライセンス」に同じ内容を出しています。

---

## 1. 胸像（クロッキーの「石膏像」）

- 作品: **"Infinite, 3D Head Scan"**
- 作者: **Lee Perry-Smith**
- ライセンス: **Creative Commons Attribution 3.0 Unported（CC BY 3.0）**
  https://creativecommons.org/licenses/by/3.0/
- Based on a work at www.triplegangers.com.
- Permissions beyond the scope of this license may be available at http://www.ir-ltd.net/
- 入手元: three.js のリポジトリ `examples/models/gltf/LeePerrySmith/`
  https://github.com/mrdoob/three.js/tree/r169/examples/models/gltf/LeePerrySmith
- 同梱しているファイル（`models/`）
  - `LeePerrySmith.glb` … 元のファイルのまま（変更なし）
  - `LeePerrySmith_normal.jpg` … 元の `Infinite-Level_02_Tangent_SmoothUV.jpg` を、名前だけ変えたもの（中身は変更なし）
  - `LeePerrySmith_License.txt` … 元のライセンスの文（変更なし）
- **改変して表示しています**
  - 元の色の画像（Map-COL）・つやの画像（Map-SPEC）は使わず、白くつやのない石膏の色・質感に変えています
  - 大きさを変え、台座を付けて、少し傾けたり左右を反転したりして表示しています
- 原文の注記: "Please remember: Do what you want with the files, but always mention where you got them from..."
- この作品は「現状のまま」提供されており、作者は何も保証していません（CC BY 3.0 第 5 条・第 6 条）。
- Posit は、作者（Lee Perry-Smith 氏）・Infinite Realities・Triplegangers が推薦・承認・関与しているものではありません。
- 像は実在の人物のスキャンです。Posit ではデッサンの練習の題材としてだけ表示しています（広告や、本人を表す用途には使っていません）。

## 1-2. 石膏像（クロッキーの「石膏像」。`models/statues/`）

どれも白くつやのない石膏の色・質感にし、台に載せて表示しています（**改変あり**）。
元のファイル（FBX と PNG の画像）を、Posit 用に **GLB に変換**し、凹凸（法線）の画像は 1024px・くぼみの陰（オクルージョン）の画像は 512px の JPEG に縮めて、1 つのファイルにまとめています。形の向き・位置（床に置く高さ・真ん中）もそろえています。
作品の名前は、元のデータの名前と、分かる範囲の作品名から付けています（作品の特定がはっきりしないものは、元のデータの名前をかっこで添えています）。

### Three D Scans（著作権なし）

- プロジェクト: **Three D Scans**（Oliver Laric さんが 2012 年に始めたプロジェクト） https://threedscans.com/
  - 美術館の彫刻を 3D スキャンし、著作権の制限なしで公開しているものです（"Every scan on the website can be downloaded for free and used without any copyright restrictions." / "The objects are all in the public domain."）
- 軽くしたデータ: **Keijiro Takahashi** さん https://github.com/keijiro/ThreeDScans
  - 原文: "The models contained in this directory were originally scanned by the Three D Scans project. These models are not copyrighted, and thus you can use them without restriction."
  - Instant Meshes で軽くし、Houdini で UV を付け、xNormal で法線とオクルージョンの画像を作ったもの
- Posit で使っているもの（ファイル名 … 表示名）
  - Plato … プラトン（Plato）
  - EpicMetro … エピクロスとメトロドロスの二重ヘルム（ウィーン大学 古典考古学研究所）
  - Gutenberg … グーテンベルクの胸像（フォトスカルプチャー。アルベルティーナ）
  - Athena … アテナ（アレッツォのミネルヴァ。フィレンツェ国立考古学博物館）
  - Hermes … ヘルメス（Hermes）
  - Nymph … ニンフ（Nymph）
  - Penelope … ペネロペ（Penelope）
  - BootlegEve … イヴ（Bootleg Eve）
  - MarblePlayer … しゃがむ少年（Marble Player）
  - ShepherdBoy … 眠る羊飼いの少年（ウォーカー・アート・ギャラリー）
  - DeChalon … ルネ・ド・シャロンのトランジ（リジェ・リシエ）
- 感謝のしるしとして、Three D Scans への寄付も歓迎されています（keijiro さんの README より）

### Danish Statues（CC BY 4.0）

- スキャン: **Geoffrey Marchal** さん https://sketchfab.com/geoffreymarchal
- ライセンス: **Creative Commons Attribution 4.0 International（CC BY 4.0）** https://creativecommons.org/licenses/by/4.0/
- 軽くしたデータ: **Keijiro Takahashi** さん https://github.com/keijiro/DanishStatues
- Posit で使っているもの
  - BustManWreath … 花冠をつけた男の胸像（Man wearing a wreath, Sanctuary of Diana. 1st century CE. Ny Carlsberg Glyptotek, Copenhagen） https://sketchfab.com/models/1cebca66989a48b091b027e24c561f4c
  - DancingGirl … 踊る少女（Dancing Girl, 1817-1822, Bertel Thorvaldsen. Thorvaldsen Museum, Copenhagen） https://sketchfab.com/models/85c07e953d23422b8cfd955446e55d62
  - Maria … マリア・バリャチンスカヤ（Maria Fjodorovna Barjatinskaja, Bertel Thorvaldsen. Thorvaldsen Museum, Copenhagen） https://sketchfab.com/models/7511b9190aa249a694084f5f4b43d920
  - Ugolino … ウゴリーノと息子たち（Ugolino and his sons, 1861, Jean-Baptiste Carpeaux. Ny Carlsberg Glyptotek, Copenhagen） https://sketchfab.com/models/b3c58f072c2a492080d19cfeab275d0b
- **改変して表示しています**（上に書いた変換・縮小・石膏の質感・台座）
- この作品は「現状のまま」提供されており、作者は何も保証していません（CC BY 4.0 第 5 条）。

### 共通

- Posit は、Oliver Laric さん・Three D Scans・Keijiro Takahashi さん・Geoffrey Marchal さん・各美術館が推薦・承認・関与しているものではありません。
- 元の彫刻は、どれも作られてから長い年月がたち、著作権の保護期間が終わっているもの（パブリックドメイン）です。

## 2. 人形（Xbot）

- ファイル: three.js の例のモデル `Xbot.glb`（`examples/models/gltf/Xbot.glb`）
  https://github.com/mrdoob/three.js/blob/r169/examples/models/gltf/Xbot.glb
- 元は **Adobe Mixamo**（https://www.mixamo.com/）のキャラクターです。Mixamo は Adobe の商標です。
- Posit はこのファイルを同梱せず、jsDelivr（https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/）から読み込んで表示しています。
- 表示するときに、体型・質感・関節の角度などを変えています。
- 利用は Adobe の利用条件・Mixamo の条件に従います（Mixamo のキャラクターは、個人・商用のプロジェクトで使えますが、キャラクターのファイルそのものを再配布することはできません）。
- Posit は Adobe が推薦・承認・関与しているものではありません。

## 3. three.js（r169）

- https://threejs.org/ ・ https://github.com/mrdoob/three.js
- jsDelivr（https://cdn.jsdelivr.net/npm/three@0.169.0/）から読み込んでいます。使っている addons: OrbitControls・GLTFLoader・FBXLoader・RoomEnvironment・BufferGeometryUtils・NURBSCurve など
- ライセンス: MIT License

```
The MIT License

Copyright © 2010-2024 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## 4. fflate（0.8.2）

- zip のモデルを開くときに使っています（three.js の addons に入っているものを jsDelivr から読み込み）
- https://github.com/101arrowz/fflate
- ライセンス: MIT License

```
MIT License

Copyright (c) 2023 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 5. 自分で読み込むモデル・「おすすめのモデル」について

- 「おすすめのモデル」に挙げた Sketchfab のモデルは Posit に同梱していません。リンクを載せているだけです。
- 自分で読み込んだモデルは、そのモデルのライセンスに従ってください。
  - CC BY 4.0 … 描いた絵やスクリーンショットを公開するときなどに、作者名・作品名・ライセンスを書く必要があります
  - CC BY-NC … 営利目的では使えません
- 読み込んだモデルは端末の中だけで使い、Posit からどこかへ送ることはありません。

## 6. Posit で作った絵について

- 人形・石膏像・小物を見て描いた絵は、描いた人のものです。ただし、画面をそのまま写したもの（スクリーンショット・クロッキーの記録の画像）を公開するときは、写っている作品（上の 1・1-2・2）のクレジットを添えてください（CC BY の像は必ず）。

---

Posit のコード（このリポジトリの `.js`・`.html`・`.css`）は、上の第三者の作品を除き、Posit の作者のものです。
