# Графика пруда

- `public/art/reference-ui.png` — копия исходного `plukh_codex/references/plukh-ui-reference.png`, 941×1672. Логотип, кнопки, лягушка, домик и лист показаны через SVG viewBox и контурные маски в `art.ts` и `main.ts`. Картинка загружается один раз и переиспользуется браузером. Номер уровня на исходной табличке исключён маской: действующий номер выводится HTML.
- `src/ui/pond-background.png` — фон, подготовленный встроенным инструментом imagegen из того же референса. На нём нет поля, игровых объектов или интерфейса; сетка, цели и объекты отображаются из состояния игры. CSS импортирует фон через Vite, сохраняя работу из подпапки.
- Координаты масок относятся только к исходной иллюстрации. Координаты уровней по-прежнему задаются `plukh_codex/levels.json`.

Точный запрос для подготовки фона (исходный референс передан как редактируемое изображение):

```text
Use case: precise-object-edit. Asset type: production background for an interactive mobile puzzle game.
Input image 1 is the edit target. Preserve the SAME rich hand-painted cartoon pond landscape, colors, perspective, shore, rocks, reeds, dragonfly, dock, flowers and foliage as closely as possible. Keep portrait aspect ratio.
Remove ALL UI: the entire top logo and wooden title plaque, move counter, pause button, small text sign on upper right, bottom cream tutorial panel and all three action buttons. Fill their former areas naturally with matching forest foliage at top, and foliage and the wooden dock/plank platform at bottom.
Remove the frog, its small island on left halfway down, the house and its small island on right halfway down, and ALL four large gameplay lily pads and white arrows in the central pond. Replace removed islands with water so central pond has an uninterrupted broad playing area. Remove ALL square grid lines, leaving textured blue turquoise water with soft painted caustics and subtle fish silhouettes.
Composition MUST preserve the reference's open central blue pond from 23% to 71% image height and approximately 7% to 93% image width, bordered by narrow natural shores and foliage. Keep small decorative lily pads and flowers OUTSIDE this central playing rectangle only. No letters, numbers, logos, panels, buttons, characters, houses, grid or game pieces. This is a clean scenic background, NOT a UI screenshot.
```
