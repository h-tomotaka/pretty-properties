import { FrontMatterCache, MarkdownRenderer, MarkdownView } from "obsidian";
import PrettyPropertiesPlugin from "src/main";
import { getNestedProperty } from "../propertyUtils";

const SIMPLE_IMAGE_CLASS = "pp-simple-frontmatter-image";

const normalizeImageValue = (value: string): string | null => {
  let normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const url = new URL(normalized);
      normalized = `![](${url.toString()})`;
    } catch {
      return null;
    }
  } else {
    if (normalized.startsWith("[")) {
      normalized = `!${normalized}`;
    }

    if (!normalized.startsWith("![")) {
      normalized = `![[${normalized}]]`;
    }
  }

  return normalized;
};

const getSimpleImageValue = (
  frontmatter: FrontMatterCache | undefined,
  plugin: PrettyPropertiesPlugin
): string | null => {
  if (!frontmatter || !plugin.settings.simpleImageProperty) {
    return null;
  }

  let value = getNestedProperty(frontmatter, plugin.settings.simpleImageProperty);
  if (Array.isArray(value)) {
    value = value[0];
  }

  if (typeof value !== "string") {
    return null;
  }

  return value;
};

const removeSimpleImage = (contentEl: HTMLElement) => {
  const mdContainer = contentEl.querySelector(".metadata-container");
  mdContainer?.querySelector(`.${SIMPLE_IMAGE_CLASS}`)?.remove();
};

export const renderSimpleImage = async (
  contentEl: HTMLElement,
  frontmatter: FrontMatterCache | undefined,
  sourcePath: string,
  plugin: PrettyPropertiesPlugin
) => {
  const mdContainer = contentEl.querySelector(".metadata-container");
  if (!mdContainer) {
    return;
  }

  if (!plugin.settings.enableSimpleImage) {
    removeSimpleImage(contentEl);
    return;
  }

  if (mdContainer.querySelector(".metadata-side-image")) {
    removeSimpleImage(contentEl);
    return;
  }

  const rawValue = getSimpleImageValue(frontmatter, plugin);
  if (!rawValue) {
    removeSimpleImage(contentEl);
    return;
  }

  const imageMarkdown = normalizeImageValue(rawValue);
  if (!imageMarkdown) {
    removeSimpleImage(contentEl);
    return;
  }

  const temp = document.createElement("div");
  try {
    await MarkdownRenderer.render(
      plugin.app,
      imageMarkdown,
      temp,
      sourcePath,
      plugin
    );
  } catch (error) {
    console.error("Cannot render simple frontmatter image", error);
    removeSimpleImage(contentEl);
    return;
  }

  const image = temp.querySelector("img");
  if (!image) {
    removeSimpleImage(contentEl);
    return;
  }

  image.classList.add("pp-simple-frontmatter-image__img");

  const wrapper = document.createElement("div");
  wrapper.classList.add(
    SIMPLE_IMAGE_CLASS,
    `pp-simple-frontmatter-image-${plugin.settings.simpleImagePosition}`
  );
  wrapper.setAttribute("data-value", imageMarkdown);
  wrapper.append(image);

  mdContainer.querySelector(`.${SIMPLE_IMAGE_CLASS}`)?.remove();
  if (plugin.settings.simpleImagePosition === "bottom") {
    mdContainer.append(wrapper);
  } else {
    mdContainer.prepend(wrapper);
  }
};

export const updateSimpleImageForView = async (
  view: MarkdownView,
  plugin: PrettyPropertiesPlugin
) => {
  const file = view.file;
  if (!file) {
    return;
  }

  const cache = plugin.app.metadataCache.getFileCache(file);
  const frontmatter = cache?.frontmatter;
  await renderSimpleImage(view.contentEl, frontmatter, file.path, plugin);
};

export const updateAllSimpleImages = (plugin: PrettyPropertiesPlugin) => {
  const leaves = plugin.app.workspace.getLeavesOfType("markdown");
  for (const leaf of leaves) {
    const view = leaf.view;
    if (view instanceof MarkdownView) {
      updateSimpleImageForView(view, plugin);
    }
  }
};
