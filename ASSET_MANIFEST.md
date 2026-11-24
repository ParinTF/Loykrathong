# Festival 3D assets

Models load from `public/models/festival/`. The GLBs use meters, Y-up, and a centered pivot at ground level. The paper lantern pivots at its center. Krathongs and the longboat pivot at their waterline. Thai buildings face +Z in Three.js.

## Downloaded foliage and stone

Quaternius published these models under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Commercial use and redistribution are allowed. Attribution is optional. All eight adapted models are in `public/models/festival/nature.glb`.

| Model node and source filename | Publisher page | Original GLB |
| --- | --- | --- |
| `PalmTree`, `PalmTree.glb` | [Palm Tree](https://poly.pizza/m/DsrrAYmucG) | [Download](https://static.poly.pizza/21d44b5b-efef-4abd-96ad-fc59e4ad373b.glb) |
| `FanPalm`, `FanPalm.glb` | [Palm Tree variant](https://poly.pizza/m/A6cKJYFsIb) | [Download](https://static.poly.pizza/4c17decd-3087-4afe-9611-cfd92cca47cd.glb) |
| `CanopyTree`, `CanopyTree.glb` | [Tree](https://poly.pizza/m/aVOxaHRPWe) | [Download](https://static.poly.pizza/7bf2aa94-cc44-40d9-a93c-9489eb09e008.glb) |
| `FlowerBush`, `FlowerBush.glb` | [Bush with Flowers](https://poly.pizza/m/U1ymDy8tbY) | [Download](https://static.poly.pizza/af83abca-9b41-4229-9652-e336a5f5eaba.glb) |
| `MossRock`, `MossRock.glb` | [Rock Moss](https://poly.pizza/m/Oar39tFugM) | [Download](https://static.poly.pizza/76cc8706-7c55-4ba6-9492-f673b477b4bf.glb) |
| `MeadowGrass`, `MeadowGrass.glb` | [Tall Grass](https://poly.pizza/m/JSIYtscPmP) | [Download](https://static.poly.pizza/83f8e6d6-fa7e-4cd8-a0ef-8c51d0ff4e88.glb) |
| `Fern`, `Fern.glb` | [Fern](https://poly.pizza/m/jqcanvH7D6) | [Download](https://static.poly.pizza/f94d836f-4eb4-4db0-aa53-3ecdddffa527.glb) |
| `FieldFlowers`, `FieldFlowers.glb` | [Flowers](https://poly.pizza/m/NBUxHir6FJ) | [Download](https://static.poly.pizza/c25cb5dc-3cd3-470c-a08c-045af0c0fe3d.glb) |

The Blender import script selects a flower clump, trims denser meshes, sets ground pivots, and caps embedded textures at 384 pixels. The bark normal map is capped at 256 pixels. Identical embedded images share one copy. The library includes `PalmTreeLOD`, `FanPalmLOD`, `CanopyTreeLOD`, and `FlowerBushLOD`. Three.js selects distance-appropriate meshes and submits visible vegetation in batches.

## Original Thai festival models

These models were authored for this project in Blender. The scripts below generate the complete meshes and materials. There is no third-party model or texture attribution requirement for these files.

| Local file | Model nodes | Source |
| --- | --- | --- |
| `public/models/festival/architecture.glb` | `Sala`, `FlowerStall`, `IncenseStall`, `LanternGate`, `CraftBench`, `Pier`, `Bridge`, `DistantStall` | [Blender source](tools/art/build_festival_kit.py) |
| `public/models/festival/offerings.glb` | `PaperLantern`, `LampPost`, `CeremonyPost`, `Lotus`, `Longboat`, `BananaKrathong`, `CoconutKrathong`, `HeartKrathong`, `LotusCrown`, `MarigoldCrown`, `RoseCrown` | [Blender source](tools/art/build_festival_kit.py) |

The sala's raised floor, tiered gables, wooden posts, and carved trim draw on published descriptions and photographs of Thai structures. The shop awnings, baskets, layered leaf folds, flowers, dock and bridge are original designs. [Muang Boran Museum](https://www.muangboran.co.th/en/landmark/thai-pavilion/) · [Siam Society's Kamthieng House Museum](https://thesiamsociety.org/en/facilities/kamthieng-house-museum-saeng-aroon-house/) · [Journal of Asian Architecture study of Thai pavilions](https://so01.tci-thaijo.org/index.php/AJA/article/view/267265)

## Rebuilding the libraries

Run the scripts with Blender 5.3. For the nature library, place the source GLBs in one directory under the filenames in the first table.

```powershell
blender --background --python-exit-code 1 --python tools/art/build_festival_kit.py
blender --background --python-exit-code 1 --python tools/art/prepare_nature.py -- <download-directory>
```

`src/game/festival/assets.ts` preloads the libraries through `GLTFLoader` and shares geometry and materials across instances. The landscape, sky, candle glow and river shader are generated in Three.js.

The HUD uses self-hosted Thai and Latin WOFF2 subsets of [Noto Sans Thai](https://github.com/google/fonts/tree/main/ofl/notosansthai). Both are distributed with the SIL Open Font License in [public/fonts/OFL-NotoSansThai.txt](public/fonts/OFL-NotoSansThai.txt).

The photobooth uses the Thai and Latin WOFF2 subsets of [Mali](https://github.com/google/fonts/tree/main/ofl/mali) for the Love Letter frame in `public/fonts/mali-500-*.woff2`. Its license is [OFL-Mali.txt](public/fonts/OFL-Mali.txt).

The photobooth uses [Noto Serif Thai](https://github.com/google/fonts/tree/main/ofl/notoserifthai) for names in the other frames in `public/fonts/notoserifthai-500-*.woff2`. Its license is [OFL-NotoSerifThai.txt](public/fonts/OFL-NotoSerifThai.txt).
