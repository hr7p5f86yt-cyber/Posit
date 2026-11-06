# クレジット・ライセンス（Posit で使っているもの）

Posit が表示・同梱・読み込みしている第三者の作品と、そのライセンスです。
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

- 人形・胸像・小物を見て描いた絵は、描いた人のものです。ただし、画面をそのまま写したもの（スクリーンショット・クロッキーの記録の画像）を公開するときは、写っている作品（上の 1・2）のクレジットを添えると確実です。

---

Posit のコード（このリポジトリの `.js`・`.html`・`.css`）は、上の第三者の作品を除き、Posit の作者のものです。
