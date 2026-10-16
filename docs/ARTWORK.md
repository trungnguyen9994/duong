# Hình ảnh cho giao diện phiêu lưu

Được tạo bằng công cụ image_gen tích hợp, dựa trên ảnh tham khảo do người dùng cung cấp. File gốc giữ nguyên; các bản dùng trong dự án được sao chép vào `public/art`.

Các nhân vật PNG có kênh alpha trong suốt. Các nền là PNG ngang, không có chữ cố định; câu hỏi/nút được dựng bằng giao diện. PowerPoint chuẩn bị ảnh trong trình duyệt và nhúng ảnh vào file.

## forest

File: `E:/project/duong/public/art/forest.png`

Prompt:

Use case: illustration-story. The attached image is a STYLE REFERENCE for a Vietnamese elementary school educational adventure game, not an edit target. Create a polished landscape game background asset only, wide 16:9. Colorful storybook 2D digital painting with expressive lush scenery, warm sunshine and soft outlined forms similar to the reference. Composition: detailed scenic framing at far left/right and bottom, calm open readable central area behind the interface. No people, no characters, no text, no lettering, no UI, no buttons, no clocks, no watermarks. Scene: emerald magical forest clearing, towering trees framing edges, blue distant mountains, winding golden path, small stream, flowers, soft blue sky. Cheerful, safe and welcoming for 8-9 year olds.

## mountain

File: `E:/project/duong/public/art/mountain.png`

Prompt:

Use case: illustration-story. The attached image is a STYLE REFERENCE for a Vietnamese elementary school educational adventure game, not an edit target. Create a polished landscape game background asset only, wide 16:9. Colorful storybook 2D digital painting with expressive lush scenery, warm sunshine and soft outlined forms similar to the reference. Composition: detailed scenic framing at far left/right and bottom, calm open readable central area behind the interface. No people, no characters, no text, no lettering, no UI, no buttons, no clocks, no watermarks. Scene: sunny adventure valley, turquoise waterfall to the right, rounded blue mountains, leafy trees framing the left, golden path across a small stone bridge in the bottom, lush grass. Safe, joyful outdoor quest.

## cave

File: `E:/project/duong/public/art/cave.png`

Prompt:

Use case: illustration-story. The attached image is a STYLE REFERENCE for a Vietnamese elementary school educational adventure game, not an edit target. Create a polished landscape game background asset only, wide 16:9. Colorful storybook 2D digital painting with expressive lush scenery, warm sunshine and soft outlined forms similar to the reference. Composition: detailed scenic framing at far left/right and bottom, calm open readable central area behind the interface. No people, no characters, no text, no lettering, no UI, no buttons, no clocks, no watermarks. Scene: a friendly magical crystal cave, warm amber cave walls framing edges, gentle luminous turquoise and purple crystals on edges and floor, broad quiet softly lit center, golden stepping stone path. Curious and inviting, never scary or dark.

## castle

File: `E:/project/duong/public/art/castle.png`

Prompt:

Use case: illustration-story. The attached image is a STYLE REFERENCE for a Vietnamese elementary school educational adventure game, not an edit target. Create a polished landscape game background asset only, wide 16:9. Colorful storybook 2D digital painting with expressive lush scenery, warm sunshine and soft outlined forms similar to the reference. Composition: detailed scenic framing at far left/right and bottom, calm open readable central area behind the interface. No people, no characters, no text, no lettering, no UI, no buttons, no clocks, no watermarks. Scene: bright magical kingdom, pastel cream castle with lavender towers in the distance on the upper right, flowering meadow, golden path winding through bottom, lush trees framing edges, balloons and tiny festive flags. Joyful triumphant safe fairytale.

## explorer

File: `E:/project/duong/public/art/explorer.png`

Prompt:

Use case: illustration-story. Attached image is a STYLE REFERENCE, not an edit target. Create ONE full body adorable Vietnamese elementary school child explorer mascot named Be Sao, 8-9 years old, cartoon storybook 2D digital illustration in the same polished friendly art style as the reference. Big expressive brown eyes, black hair, round warm face, small golden explorer hat with a star pin, mint green shirt, blue shorts, orange small backpack, comfy sneakers. Standing, smiling, one hand raised in a friendly encouraging gesture, looking toward the viewer. Full body centered, clean silhouette, no props obstructing face, no text, no lettering, no watermark, no ground or shadow outside character. Genuinely transparent background, production ready character cutout.

## explorer-girl

File: `E:/project/duong/public/art/explorer-girl.png`

Prompt:

Use case: illustration-story. The two attached images are style references, not edit targets: first is a homepage layout; second is the existing boy explorer mascot. Generate ONE full-body Vietnamese elementary-school GIRL explorer companion age 8-9 in the same exact polished cheerful storybook 2D cartoon art style as the boy. Big brown eyes, black medium length hair, tan safari hat with a pink ribbon, pink short sleeve shirt, teal shorts, purple small backpack, comfy brown sneakers. Smiling and waving toward viewer with one hand, other hand holding a little folded treasure map. Full body clearly visible head to toes, centered, friendly pose, clean silhouette. No words, no text, no watermark, no backdrop, no ground. Genuinely transparent background and clean alpha cutout, no colored halo.

## Homepage reference redesign (2026-10-15)
- Asset: `public/art/home-hero-v2.png`; generated with the built-in imagegen tool.
- Prompt: children's educational website hero, lush tree and waterfall left, blue mountains and river center, cream castle with red roofs right; explorer boy and beagle lower left, explorer girl lower right; pale cyan open upper center for HTML copy; vibrant storybook illustration; no text, logos, sign boards or UI.
- Navigation, subject boards, text, icons and buttons are rendered in HTML/CSS/SVG. Existing transparent explorer assets are reused on narrow screens.

## Login page redesign (2026-10-16)

Final asset: `public/art/login-scene-v2.png`. Built-in imagegen generation plus a targeted imagegen edit; no external image API or runtime generation feature. All copy, icons, labels, tabs and form controls are HTML/SVG/CSS. The discarded first draft remains in the imagegen cache, not in the project.

Generation prompt:
> Use case: illustration-story. Asset: wide 1824x896 full-bleed background for a Vietnamese primary school educational game LOGIN page. Bright polished children's storybook digital illustration. Composition: lush tree frames far left; tall blue waterfall on left quarter; pale blue mountain valley in center; cream fairy-tale castle with warm red spires on far right hillside and golden winding path; foreground cheerful grass, colorful flowers and stones. Lower LEFT quadrant: two adorable chibi schoolchildren sitting together on a rock, boy mint-green shirt blue shorts orange backpack straw explorer hat holding a paper map and pointing right/up, girl pink shirt blue shorts pink-ribbon straw hat reading a book, cute beagle between them. Children around x17%-45%, y57%-96%. Upper left center x20%-47%, y5%-48% is pale cyan open sky reserved for live HTML marketing text. Entire RIGHT CENTER x54%-83%, y7%-90% reserved for a large live HTML white login card: leave calm sky and soft scenery behind that area, no children there. Castle is at extreme right x85%-100% so visible beside card. Very close composition to a cheerful educational website login illustration. High quality crisp vivid friendly cartoon painting. NO text, NO letters, NO typography, NO UI, no cards, no logos, no watermark. Landscape ratio about 2:1.

Final edit prompt:
> Edit this website background illustration to fix composition for live text overlay. Keep the wide landscape ratio, cheerful polished storybook style, castle at far right, flowers and blue mountains. Change ONLY these layout aspects: reposition the group of two seated explorer children and beagle from the far lower left to the lower center-left, with bounding box approximately x18%-46%, y57%-98%; their heads must start BELOW 55% image height and feet near bottom. Group should be slightly smaller and move right so centered at x32%. Put their rock under them. Repaint their old location naturally with grass/waterfall scenery. Move waterfall further toward far left (within x0%-19%). Keep a large calm PALE CYAN sky zone x20%-48%, y4%-48%, no tree branches, cliffs or high contrast objects there; it will hold HTML heading and four feature cards. No overlays/cards, no typography, no words, no logos or watermark. Preserve everything else, especially rightmost castle and open right-center area.
