import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AboutPage } from "../studio/AboutPage";
import { templateRegistry } from "../domain/studio-spec";

it("introduces every registered game with its preview and catalog image", () => {
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(AboutPage)));
  for (const [type, template] of Object.entries(templateRegistry)) {
    expect(html).toContain(`href="/demo/${type}"`);
    expect(html).toContain(`src="${template.image}"`);
    expect(html).toContain(template.name);
  }
  expect(html).toContain(`${Object.keys(templateRegistry).length} mẫu trò chơi`);
});
